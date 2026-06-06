import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { appendFile, mkdir, readFile } from "fs/promises";
import { randomBytes } from "crypto";
import { exec, execFile } from "child_process";
import { promisify } from "util";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Prisma } from "@prisma/client";
import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import { allowedEmailSchema, inviteUserSchema, loginSchema, setupPasswordSchema } from "./schemas/auth.js";
import {
  appealSchema,
  approvalRequestSchema,
  approvalResponseSchema,
  assetMaintenanceSchema,
  assetSchema,
  assetTypeSchema,
  assignTicketSchema,
  commentSchema,
  createUserSchema,
  delaySchema,
  feedbackSchema,
  maintenanceAssignSchema,
  maintenancePartSchema,
  maintenanceSchema,
  quantitySchema,
  slaPauseSchema,
  staffReviewSchema,
  updateAssetSchema,
  updateMaintenanceStatusSchema,
  updateTicketSchema,
  updateUserPasswordSchema,
  updateUserRoleSchema,
  updateUserSchema,
  updateUserStatusSchema,
  updateManagerUserPermissionSchema,
} from "./schemas/api.js";
import { cookieOptions, HIGH_PRIORITY_LEVELS, INVITE_TOKEN_TTL_MS, isProduction, JWT_COOKIE_NAME, TELEGRAM_LINK_CODE_TTL_MS } from "./config/app.js";
import { authenticate, isAdmin, isInventoryManager, isManager, isStaff, isTechnician } from "./middleware/auth.js";
import { createHealthRouter } from "./routes/healthRoutes.js";
import { createTicketRouter } from "./routes/ticket.routes.js";
import { formatValidationError, hashPassword, normalizeEmail, parseBody, signAuthToken, verifyAuthToken } from "./lib/auth.js";
import { configuredOrigins, isAllowedOrigin, parseCookieHeader, parseOrigin } from "./lib/http.js";
import { prisma } from "./lib/prisma.js";
import { isActiveStatus, isAdminRole, isManagerRole, isTechnicianRole } from "./lib/roles.js";
import { buildInviteUrl, sendInviteEmail } from "./services/invitations.js";
import { createNotificationService, serializeNotification } from "./services/notifications.js";
import { createSLAService } from "./services/slaService.js";
import { getTelegramUpdates, sendTelegramMessage } from "./services/telegram.js";

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL environment variable is not set. Database connection will fail.");
  console.log("Set DATABASE_URL to your PostgreSQL connection string before starting the server.");
} else if (process.env.DATABASE_URL.includes("localhost:5432")) {
  console.warn("WARNING: DATABASE_URL is set to 'localhost:5432'. This will fail in the AI Studio environment. Please provide a real PostgreSQL connection string.");
}

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const allowedRoles = new Set(["staff", "technician", "manager", "admin"]);
const adminInviteRoles = new Set(["staff", "manager", "technician"]);

function getInviteBaseUrl(req: express.Request) {
  const origin = req.get("origin");
  if (isAllowedOrigin(origin)) {
    return parseOrigin(origin);
  }

  return parseOrigin(process.env.APP_BASE_URL) || parseOrigin(process.env.FRONTEND_ORIGIN) || undefined;
}

function isMissingTableError(err: unknown) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === "P2021";
  }

  if (err instanceof Error) {
    return err.message.includes("does not exist in the current database");
  }

  return false;
}

async function ensureDatabaseSchema() {
  console.warn("Missing Prisma tables detected. Running `prisma db push` to sync the schema...");
  const result = process.platform === "win32"
    ? await execAsync("cmd.exe /c prisma db push --skip-generate", {
        cwd: process.cwd(),
        env: process.env,
        timeout: 120000,
      })
    : await execFileAsync(
        path.join(process.cwd(), "node_modules", ".bin", "prisma"),
        ["db", "push", "--skip-generate"],
        {
          cwd: process.cwd(),
          env: process.env,
          timeout: 120000,
        },
      );

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  if (stdout.trim()) {
    console.log(stdout.trim());
  }

  if (stderr.trim()) {
    console.warn(stderr.trim());
  }
}

function getSLADurationMs(priority?: string) {
  switch (priority) {
    case "critical":
      return 4 * 60 * 60 * 1000;
    case "high":
      return 24 * 60 * 60 * 1000;
    case "medium":
      return 3 * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

function getSLADueDate(priority?: string, from = new Date()) {
  return new Date(from.getTime() + getSLADurationMs(priority));
}

function normalizeStatus(value?: string) {
  return value?.trim().toLowerCase();
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function cellText(row: Record<string, unknown>, keys: string[]) {
  const normalizedKeys = new Set(keys.map(normalizeHeader));
  for (const [key, value] of Object.entries(row)) {
    if (normalizedKeys.has(normalizeHeader(key))) {
      const text = String(value ?? "").trim();
      return text || undefined;
    }
  }
  return undefined;
}

function cellNumber(row: Record<string, unknown>, keys: string[], fallback: number) {
  const value = cellText(row, keys);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cellBoolean(row: Record<string, unknown>, keys: string[], fallback = false) {
  const value = cellText(row, keys);
  if (value === undefined) return fallback;
  return ["true", "yes", "y", "1", "consumable"].includes(value.toLowerCase());
}

function parseExcelRows(fileBase64: unknown) {
  if (typeof fileBase64 !== "string" || !fileBase64.trim()) {
    const err = new Error("Excel file is required.") as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  if (fileBase64.length > 7_000_000) {
    const err = new Error("Excel file is too large. The maximum encoded size is 7 MB.") as Error & { status?: number };
    err.status = 413;
    throw err;
  }

  const buffer = Buffer.from(fileBase64.replace(/^data:.*;base64,/, ""), "base64");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    const err = new Error("The Excel file does not contain any sheets.") as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: "",
  });

  if (rows.length > 1000) {
    const err = new Error("Excel import is limited to 1000 rows at a time.") as Error & { status?: number };
    err.status = 413;
    throw err;
  }

  return rows;
}

const TICKET_STATUS_RANK: Record<string, number> = {
  open: 0,
  "in-progress": 1,
  "pending-confirmation": 2,
  resolved: 3,
  closed: 4,
};

function isBackwardTicketStatusChange(from: string, to: string) {
  const fromRank = TICKET_STATUS_RANK[from];
  const toRank = TICKET_STATUS_RANK[to];
  return fromRank !== undefined && toRank !== undefined && toRank < fromRank;
}

function shouldRequireClosureApproval(ticket: { priority?: string }) {
  return HIGH_PRIORITY_LEVELS.has(ticket.priority || "");
}

function generateTelegramLinkCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

async function getTechnicianActiveWork(
  technicianId: string,
  options?: { excludeTicketId?: string; excludeMaintenanceId?: string },
) {
  const [ticket, maintenance] = await Promise.all([
    prisma.ticket.findFirst({
      where: {
        assignedTo: technicianId,
        status: { notIn: ["pending-confirmation", "resolved", "closed"] },
        ...(options?.excludeTicketId ? { NOT: { id: options.excludeTicketId } } : {}),
      },
      select: { id: true, title: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.maintenance.findFirst({
      where: {
        technicianId,
        status: { not: "completed" },
        ...(options?.excludeMaintenanceId ? { NOT: { id: options.excludeMaintenanceId } } : {}),
      },
      select: { id: true, title: true },
      orderBy: { startTime: "asc" },
    }),
  ]);

  if (ticket) {
    return `Technician already has an active ticket: ${ticket.title}.`;
  }

  if (maintenance) {
    return `Technician already has active maintenance: ${maintenance.title}.`;
  }

  return null;
}

async function writeAuditLog(actor: any, action: string, details: Record<string, unknown>) {
  try {
    const logsDir = path.join(process.cwd(), "logs");
    await mkdir(logsDir, { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      actorId: actor?.id || null,
      actorEmail: actor?.email || null,
      actorRole: actor?.role || null,
      action,
      details,
    };
    await appendFile(path.join(logsDir, "audit.log"), `${JSON.stringify(entry)}\n`, "utf8");
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

async function syncAssetCatalog(
  assetId: string,
  data: {
    name: string;
    brand?: string | null;
    type: string;
    typeId?: string | null;
    isConsumable: boolean;
    minStockLevel: number;
  },
) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { catalog: true },
  });

  if (!asset) {
    return null;
  }

  if (asset.catalogId) {
    await prisma.assetCatalog.update({
      where: { id: asset.catalogId },
      data,
    });
    await prisma.asset.updateMany({
      where: { catalogId: asset.catalogId },
      data,
    });
  } else {
    await prisma.asset.update({
      where: { id: assetId },
      data,
    });
  }

  return prisma.asset.findUnique({
    where: { id: assetId },
    include: { assetType: true, catalog: true },
  });
}

async function deleteAssetCatalogIfEmpty(catalogId?: string | null) {
  if (!catalogId) {
    return;
  }

  const siblingCount = await prisma.asset.count({
    where: { catalogId },
  });

  if (siblingCount === 0) {
    await prisma.assetCatalog.delete({
      where: { id: catalogId },
    });
  }
}

async function logAssetHistory(
  assetId: string,
  action: string,
  details?: string,
  options?: {
    userId?: string | null;
    ticketId?: string | null;
    maintenanceId?: string | null;
  },
) {
  try {
    await prisma.assetHistory.create({
      data: {
        assetId,
        action,
        details,
        userId: options?.userId || null,
        ticketId: options?.ticketId || null,
        maintenanceId: options?.maintenanceId || null,
      },
    });
  } catch (err) {
    console.error("Failed to log asset history:", err);
  }
}

async function ensureApprovalRequest(input: {
  type: string;
  requestedById: string;
  reason?: string;
  ticketId?: string | null;
  assetId?: string | null;
  maintenanceId?: string | null;
}) {
  const existing = await prisma.approvalRequest.findFirst({
    where: {
      type: input.type,
      status: "pending",
      ticketId: input.ticketId || null,
      assetId: input.assetId || null,
      maintenanceId: input.maintenanceId || null,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.approvalRequest.create({
    data: {
      type: input.type,
      requestedById: input.requestedById,
      reason: input.reason,
      ticketId: input.ticketId || null,
      assetId: input.assetId || null,
      maintenanceId: input.maintenanceId || null,
    },
  });
}

async function handleTelegramLinkMessage(chatId: string, text?: string) {
  const match = text?.trim().match(/^\/start\s+([A-Z0-9]+)$/i);
  if (!match) {
    await sendTelegramMessage(
      chatId,
      "Open your ICT Support profile, choose Connect Telegram, then send the /start command with your link code.",
    );
    return;
  }

  const code = match[1].toUpperCase();
  const profile = await prisma.profile.findFirst({
    where: {
      telegramLinkCode: code,
      telegramLinkCodeExpiresAt: { gt: new Date() },
    },
    select: { id: true, name: true },
  });

  if (!profile) {
    await sendTelegramMessage(chatId, "That Telegram link code is invalid or expired. Please generate a new code from your profile.");
    return;
  }

  await prisma.$transaction([
    prisma.profile.updateMany({
      where: {
        telegramChatId: chatId,
        NOT: { id: profile.id },
      },
      data: { telegramChatId: null },
    }),
    prisma.profile.update({
      where: { id: profile.id },
      data: {
        telegramChatId: chatId,
        telegramLinkCode: null,
        telegramLinkCodeExpiresAt: null,
      },
    }),
  ]);

  await sendTelegramMessage(chatId, `Telegram connected for ${profile.name}. You will now receive ICT Support notifications here.`);
}

function startTelegramLinkPolling() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return;
  }

  let offset: number | undefined;
  let polling = false;

  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
      const updates = await getTelegramUpdates(offset);
      for (const update of updates) {
        offset = update.update_id + 1;
        const chatId = update.message?.chat?.id;
        if (chatId !== undefined) {
          await handleTelegramLinkMessage(String(chatId), update.message?.text);
        }
      }
    } catch (err) {
      console.warn("Telegram link polling failed:", err);
    } finally {
      polling = false;
    }
  };

  poll();
  setInterval(poll, 5000);
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: configuredOrigins,
      credentials: true,
      methods: ["GET", "POST"],
    }
  });
  const PORT = Number(process.env.PORT || 3000);

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookieHeader(socket.handshake.headers.cookie);
      const token = cookies[JWT_COOKIE_NAME];
      if (!token) return next(new Error("Unauthorized"));

      const payload = verifyAuthToken(token);
      const profile = await prisma.profile.findUnique({ where: { id: payload.sub } });
      if (!profile || !isActiveStatus(profile.status)) {
        return next(new Error("Unauthorized"));
      }

      socket.data.userId = profile.id;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.join(socket.data.userId);
    console.log(`User ${socket.data.userId} joined their notification room`);
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  app.use(cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed."));
    },
    credentials: true,
  }));
  app.use((req, res, next) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method) || !req.path.startsWith("/api")) {
      return next();
    }

    const origin = req.get("origin");
    if (origin && !isAllowedOrigin(origin)) {
      return res.status(403).json({ error: "Origin is not allowed." });
    }

    if (isProduction && !origin) {
      return res.status(403).json({ error: "Origin header is required." });
    }

    next();
  });
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  app.use(cookieParser());
  app.set("trust proxy", 1);
  app.param("id", (req, res, next, id) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: "Invalid ID format." });
    }
    next();
  });

  const createNotification = createNotificationService(io);
  const { updateSLAStatuses } = createSLAService(createNotification);

  // --- Helper: Log Ticket History ---
  const logTicketHistory = async (ticketId: string, userId: string, action: string, details?: string) => {
    try {
      await prisma.ticketHistory.create({
        data: { ticketId, userId, action, details }
      });
    } catch (err) {
      console.error("Failed to log ticket history:", err);
    }
  };

  // --- API Routes ---
  app.use("/api", createHealthRouter());
  app.use("/api/tickets", createTicketRouter({
    createNotification,
    updateSLAStatuses,
    logAssetHistory,
  }));

  // Auth
  app.post("/api/auth/register", (_req, res) => {
    res.status(403).json({
      error: "Public signup is disabled. Ask an administrator for an invitation link.",
    });
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: formatValidationError(parsed.error) });
      }

      const { email, password, rememberMe } = parsed.data;
      const normalizedEmail = normalizeEmail(email);
      let profile;

      try {
        profile = await prisma.profile.findUnique({ where: { email: normalizedEmail } });
      } catch (err) {
        if (!isMissingTableError(err)) {
          throw err;
        }

        await ensureDatabaseSchema();
        profile = await prisma.profile.findUnique({ where: { email: normalizedEmail } });
      }

      if (!profile?.passwordHash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      if (!isActiveStatus(profile.status)) {
        return res.status(403).json({ error: "Your account is pending admin approval." });
      }

      const passwordMatches = await bcrypt.compare(password, profile.passwordHash);
      if (!passwordMatches) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      res.cookie(JWT_COOKIE_NAME, signAuthToken(profile), {
        ...cookieOptions,
        maxAge,
      });

      res.json({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        status: profile.status,
        canInviteStaff: profile.canInviteStaff,
        department: profile.department,
        createdAt: profile.createdAt,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post(["/api/admin/create-user", "/api/auth/admin/create-user", "/api/auth/invitations"], authenticate, async (req: any, res, next) => {
    try {
      const parsed = inviteUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: formatValidationError(parsed.error) });
      }

      const { email, name, role, department } = parsed.data;
      if (isAdminRole(req.user.role)) {
        if (!adminInviteRoles.has(role)) {
          return res.status(400).json({ error: "Invalid role for invitation." });
        }
      } else if (req.user.role === "manager" && req.user.canInviteStaff) {
        if (role !== "staff") {
          return res.status(403).json({ error: "Managers can only invite staff users." });
        }
      } else {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (!adminInviteRoles.has(role)) {
        return res.status(400).json({ error: "Invalid role for invitation." });
      }

      const normalizedEmail = normalizeEmail(email);
      const existingProfile = await prisma.profile.findUnique({ where: { email: normalizedEmail } });
      if (existingProfile && existingProfile.status === "active") {
        return res.status(400).json({ error: "A user with this email already exists." });
      }

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);
      const profile = await prisma.$transaction(async (tx) => {
        const pendingProfile = existingProfile
          ? await tx.profile.update({
              where: { id: existingProfile.id },
              data: {
                name,
                email: normalizedEmail,
                role,
                status: "pending",
                department,
                passwordHash: null,
              },
            })
          : await tx.profile.create({
              data: {
                name,
                email: normalizedEmail,
                role,
                status: "pending",
                department,
                passwordHash: null,
              },
            });

        await tx.inviteToken.deleteMany({
          where: { userId: pendingProfile.id },
        });

        await tx.inviteToken.create({
          data: {
            token,
            userId: pendingProfile.id,
            expiresAt,
          },
        });

        return pendingProfile;
      });

      const inviteUrl = buildInviteUrl(token, getInviteBaseUrl(req));
      const mailResult = await sendInviteEmail({
        email: normalizedEmail,
        name,
        role,
        inviteUrl,
      });

      await writeAuditLog((req as any).user, "user.invited", {
        email: normalizedEmail,
        name,
        role,
        department,
        inviteDelivery: mailResult.delivered ? "email" : "response",
      });

      res.json({
        message: mailResult.delivered ? "Invitation sent successfully." : "Invitation created. SMTP is unavailable or not configured, so the invite link was returned in the response.",
        inviteUrl,
        user: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          status: profile.status,
          department: profile.department,
          createdAt: profile.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/import/users", authenticate, async (req: any, res, next) => {
    try {
      const rows = parseExcelRows(req.body?.file);
      const result = {
        created: 0,
        updated: 0,
        skipped: [] as Array<{ row: number; reason: string }>,
      };

      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;
        const role = (cellText(row, ["role"]) || "staff").toLowerCase();
        const payload = {
          name: cellText(row, ["name", "full name"]),
          email: cellText(row, ["email", "email address"]),
          role,
          department: cellText(row, ["department", "dept"]),
        };

        const parsed = inviteUserSchema.safeParse(payload);
        if (!parsed.success) {
          result.skipped.push({ row: rowNumber, reason: formatValidationError(parsed.error) });
          continue;
        }

        if (isAdminRole(req.user.role)) {
          if (!adminInviteRoles.has(parsed.data.role)) {
            result.skipped.push({ row: rowNumber, reason: "Invalid role for invitation." });
            continue;
          }
        } else if (req.user.role === "manager" && req.user.canInviteStaff) {
          if (parsed.data.role !== "staff") {
            result.skipped.push({ row: rowNumber, reason: "Managers can only import staff users." });
            continue;
          }
        } else {
          return res.status(403).json({ error: "Forbidden" });
        }

        const normalizedEmail = normalizeEmail(parsed.data.email);
        const existingProfile = await prisma.profile.findUnique({ where: { email: normalizedEmail } });
        if (existingProfile && existingProfile.status === "active") {
          result.skipped.push({ row: rowNumber, reason: "A user with this email already exists." });
          continue;
        }

        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);
        const profile = await prisma.$transaction(async (tx) => {
          const pendingProfile = existingProfile
            ? await tx.profile.update({
                where: { id: existingProfile.id },
                data: {
                  name: parsed.data.name,
                  email: normalizedEmail,
                  role: parsed.data.role,
                  status: "pending",
                  department: parsed.data.department,
                  passwordHash: null,
                },
              })
            : await tx.profile.create({
                data: {
                  name: parsed.data.name,
                  email: normalizedEmail,
                  role: parsed.data.role,
                  status: "pending",
                  department: parsed.data.department,
                  passwordHash: null,
                },
              });

          await tx.inviteToken.deleteMany({ where: { userId: pendingProfile.id } });
          await tx.inviteToken.create({
            data: {
              token,
              userId: pendingProfile.id,
              expiresAt,
            },
          });

          return pendingProfile;
        });

        const inviteUrl = buildInviteUrl(token, getInviteBaseUrl(req));
        await sendInviteEmail({
          email: normalizedEmail,
          name: parsed.data.name,
          role: parsed.data.role,
          inviteUrl,
        });

        await writeAuditLog(req.user, "user.imported", {
          targetUserId: profile.id,
          email: normalizedEmail,
          role: parsed.data.role,
          department: parsed.data.department,
        });

        if (existingProfile) {
          result.updated += 1;
        } else {
          result.created += 1;
        }
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/auth/setup-password", async (req, res, next) => {
    try {
      const parsed = setupPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: formatValidationError(parsed.error) });
      }

      const { token, password } = parsed.data;
      const inviteToken = await prisma.inviteToken.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!inviteToken) {
        return res.status(400).json({ error: "Invite token is invalid. Please ask an administrator to send a new invitation." });
      }

      if (inviteToken.expiresAt.getTime() < Date.now()) {
        await prisma.inviteToken.delete({ where: { token } });
        return res.status(400).json({ error: "Invite token has expired." });
      }

      const passwordHash = await hashPassword(password);
      const updatedUser = await prisma.$transaction(async (tx) => {
        const user = await tx.profile.update({
          where: { id: inviteToken.userId },
          data: {
            passwordHash,
            status: "active",
          },
        });

        await tx.inviteToken.delete({
          where: { token },
        });

        return user;
      });

      res.json({
        message: "Password set successfully. You can now sign in.",
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          status: updatedUser.status,
          canInviteStaff: updatedUser.canInviteStaff,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie(JWT_COOKIE_NAME, cookieOptions);
    res.json({ message: "Logged out" });
  });

  app.get("/api/auth/me", authenticate, (req: any, res) => {
    res.json(req.user);
  });

  app.post("/api/profile/telegram/link-code", authenticate, async (req: any, res, next) => {
    try {
      const code = generateTelegramLinkCode();
      const expiresAt = new Date(Date.now() + TELEGRAM_LINK_CODE_TTL_MS);

      await prisma.profile.update({
        where: { id: req.user.id },
        data: {
          telegramLinkCode: code,
          telegramLinkCodeExpiresAt: expiresAt,
        },
      });

      const botUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
      res.json({
        code,
        expiresAt,
        command: `/start ${code}`,
        botUsername: botUsername || null,
        botLink: botUsername ? `https://t.me/${botUsername}?start=${code}` : null,
      });
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/profile/telegram", authenticate, async (req: any, res, next) => {
    try {
      await prisma.profile.update({
        where: { id: req.user.id },
        data: {
          telegramChatId: null,
          telegramLinkCode: null,
          telegramLinkCodeExpiresAt: null,
        },
      });

      res.json({ telegramLinked: false });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/admin/allowed-emails", authenticate, isAdmin, async (req, res, next) => {
    try {
      const allowedEmails = await prisma.allowedEmail.findMany({
        orderBy: { createdAt: "desc" },
      });
      res.json(allowedEmails);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/admin/allowed-emails", authenticate, isAdmin, async (req, res, next) => {
    try {
      const parsed = allowedEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: formatValidationError(parsed.error) });
      }

      const email = normalizeEmail(parsed.data.email);
      const allowedEmail = await prisma.allowedEmail.upsert({
        where: { email },
        update: { isUsed: false },
        create: { email },
      });

      await writeAuditLog((req as any).user, "allowed_email.upserted", { email });
      res.json(allowedEmail);
    } catch (err) {
      next(err);
    }
  });

  // Tickets

  app.put("/api/tickets/:id", authenticate, isStaff, async (req: any, res, next) => {
    try {
      const { status, assignedTo, priority } = parseBody(updateTicketSchema, req.body);
      const oldTicket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      
      if (!oldTicket) return res.status(404).json({ error: "Ticket not found" });

      if (req.user.role === "staff" && oldTicket.userId !== req.user.id) {
        return res.status(403).json({ error: "Requesters can only update their own tickets" });
      }

      // Technician can only update assigned tickets
      if (req.user.role === "technician" && oldTicket.assignedTo !== req.user.id) {
        return res.status(403).json({ error: "Technicians can only update assigned tickets" });
      }

      // Only manager can assign
      if (assignedTo !== undefined && assignedTo !== oldTicket.assignedTo) {
        if (!isManagerRole(req.user.role)) {
          return res.status(403).json({ error: "Only managers can assign technicians" });
        }

        if (assignedTo) {
          const tech = await prisma.profile.findUnique({ where: { id: assignedTo } });
          if (!tech || tech.role !== "technician") {
            return res.status(400).json({ error: "Invalid technician ID" });
          }

          const activeWork = await getTechnicianActiveWork(assignedTo, { excludeTicketId: oldTicket.id });
          if (activeWork) {
            return res.status(400).json({ error: activeWork });
          }
        }
      }

      const requestedStatus = normalizeStatus(status);
      const normalizedStatus = req.user.role === "technician" && requestedStatus === "resolved"
        ? "pending-confirmation"
        : requestedStatus;

      // Role-based status transition checks
      if (normalizedStatus && normalizedStatus !== oldTicket.status) {
        if (TICKET_STATUS_RANK[normalizedStatus] === undefined) {
          return res.status(400).json({ error: "Invalid ticket status" });
        }
        if (isBackwardTicketStatusChange(oldTicket.status, normalizedStatus)) {
          return res.status(400).json({ error: "Ticket status cannot move backward. Closed tickets can be appealed by the requester." });
        }
        if (req.user.role === "technician" && !["in-progress", "pending-confirmation"].includes(normalizedStatus)) {
          return res.status(403).json({ error: "Technicians can only set status to in-progress or resolved" });
        }
        if (req.user.role === "staff" && !["open", "closed"].includes(normalizedStatus)) {
          return res.status(403).json({ error: "Requesters can only reopen or close tickets from their view." });
        }
        if (normalizedStatus === "closed" && !isManagerRole(req.user.role)) {
          return res.status(403).json({ error: "Only managers can close invalid or unnecessary tickets." });
        }
        if (normalizedStatus === "closed" && ["pending-confirmation", "resolved"].includes(oldTicket.status)) {
          return res.status(400).json({ error: "Solved tickets cannot be closed. Close is only for invalid or unnecessary tickets." });
        }
        if (normalizedStatus === "closed" && oldTicket.isApproved) {
          return res.status(400).json({ error: "Approved solved tickets cannot be closed." });
        }
        if (normalizedStatus === "closed" && shouldRequireClosureApproval(oldTicket) && !isManagerRole(req.user.role)) {
          const approvedClosureRequest = await prisma.approvalRequest.findFirst({
            where: {
              ticketId: oldTicket.id,
              type: "high-priority-ticket-close",
              status: "approved",
            },
          });
          if (!approvedClosureRequest) {
            return res.status(400).json({ error: "A manager must approve closure of high-priority tickets." });
          }
        }
      }

      const updateData: Record<string, unknown> = {
        status: normalizedStatus || undefined,
        assignedTo: assignedTo === undefined ? undefined : (assignedTo || null),
        priority: priority || undefined,
      };

      if (normalizedStatus === "pending-confirmation") {
        updateData.resolvedAt = new Date();
        updateData.closedAt = null;
      }

      if (normalizedStatus === "resolved") {
        updateData.resolvedAt = new Date();
        updateData.closedAt = null;
      }

      if (normalizedStatus === "closed") {
        updateData.closedAt = new Date();
        if (!oldTicket.resolvedAt) {
          updateData.resolvedAt = new Date();
        }
      }

      if (normalizedStatus === "open" || normalizedStatus === "in-progress") {
        updateData.closedAt = null;
        if (normalizedStatus === "open") {
          updateData.resolvedAt = null;
        }
      }

      if (normalizedStatus && ["pending-confirmation", "resolved", "closed"].includes(normalizedStatus)) {
        updateData.slaPaused = false;
        updateData.slaPausedAt = null;
        updateData.slaPausedRemainingMinutes = null;
        updateData.blockingReason = null;
        updateData.blockedAt = null;
        updateData.slaStatus = null;
        updateData.escalationLevel = 0;
        updateData.escalatedAt = null;
      }

      const ticket = await prisma.ticket.update({
        where: { id: req.params.id },
        data: updateData,
      });

      // Notify User on Status Change
      if (normalizedStatus && normalizedStatus !== oldTicket?.status) {
        await createNotification(ticket.userId, "Ticket Updated", `Your ticket "${ticket.title}" is now ${normalizedStatus}`, `/tickets/${ticket.id}`);
        await logTicketHistory(ticket.id, req.user.id, "Status Changed", `From ${oldTicket?.status} to ${normalizedStatus}`);
        await writeAuditLog(req.user, "ticket.status_changed", {
          ticketId: ticket.id,
          from: oldTicket?.status,
          to: normalizedStatus,
        });
      }

      if (priority && priority !== oldTicket?.priority) {
        await logTicketHistory(ticket.id, req.user.id, "Priority Changed", `From ${oldTicket?.priority} to ${priority}`);
        await writeAuditLog(req.user, "ticket.priority_changed", {
          ticketId: ticket.id,
          from: oldTicket?.priority,
          to: priority,
        });
      }

      if (assignedTo !== undefined && assignedTo !== oldTicket?.assignedTo) {
        const tech = assignedTo ? await prisma.profile.findUnique({ where: { id: assignedTo }, select: { name: true } }) : null;
        await logTicketHistory(ticket.id, req.user.id, "Assigned To", `Assigned to ${tech?.name || "Unassigned"}`);
      }

      if (["pending-confirmation", "resolved"].includes(normalizedStatus || "") && shouldRequireClosureApproval(ticket)) {
        const approvalRequest = await ensureApprovalRequest({
          type: "high-priority-ticket-close",
          requestedById: req.user.id,
          reason: `Closure approval requested for ${ticket.priority} ticket "${ticket.title}".`,
          ticketId: ticket.id,
        });
        const managers = await prisma.profile.findMany({
          where: { role: { in: ["manager", "admin"] } },
          select: { id: true },
        });
        for (const manager of managers) {
          await createNotification(
            manager.id,
            "Closure Approval Needed",
            `Ticket "${ticket.title}" requires approval before closure.`,
            `/tickets/${ticket.id}`,
          );
        }
        await writeAuditLog(req.user, "ticket.closure_approval_requested", {
          ticketId: ticket.id,
          approvalRequestId: approvalRequest.id,
        });
      }

      res.json(ticket);
    } catch (err) {
      next(err);
    }
  });

  // Manager specific actions
  app.put("/api/tickets/:id/assign", authenticate, isManager, async (req: any, res, next) => {
    try {
      const { assignedTo } = parseBody(assignTicketSchema, req.body);
      const exists = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "Ticket not found" });
      if (isBackwardTicketStatusChange(exists.status, "in-progress")) {
        return res.status(400).json({ error: "Assigning a technician cannot move a resolved or closed ticket back to in progress." });
      }

      // If assigning to someone, verify they are a technician
      if (assignedTo) {
        const tech = await prisma.profile.findUnique({ where: { id: assignedTo } });
        if (!tech || tech.role !== "technician") {
          return res.status(400).json({ error: "Invalid technician ID" });
        }

        const activeWork = await getTechnicianActiveWork(assignedTo, { excludeTicketId: exists.id });
        if (activeWork) {
          return res.status(400).json({ error: activeWork });
        }
      }

      const updateData: any = { assignedTo: assignedTo || null };
      
      // Update status to in-progress if a technician is assigned
      if (assignedTo) {
        updateData.status = "in-progress";
      }

      const ticket = await prisma.ticket.update({
        where: { id: req.params.id },
        data: updateData,
      });

      // Notify Technician
      if (assignedTo) {
        await createNotification(assignedTo, "New Assignment", `You have been assigned to ticket: ${ticket.title}`, `/tickets/${ticket.id}`);
      }

      // Log History
      let techName = "Unassigned";
      if (assignedTo) {
        const tech = await prisma.profile.findUnique({ where: { id: assignedTo }, select: { name: true } });
        techName = tech?.name || assignedTo;
      }
      await logTicketHistory(ticket.id, req.user.id, "Assigned To", `Assigned to ${techName}`);
      await writeAuditLog(req.user, "ticket.assigned", {
        ticketId: ticket.id,
        assignedTo: assignedTo || null,
      });

      res.json(ticket);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/tickets/:id/approve", authenticate, isManager, async (req: any, res, next) => {
    try {
      const exists = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "Ticket not found" });

      const ticket = await prisma.ticket.update({
        where: { id: req.params.id },
        data: { isApproved: true },
      });
      
      await createNotification(ticket.userId, "Ticket Approved", `Your ticket "${ticket.title}" has been approved.`, `/tickets/${ticket.id}`);

      // Log History
      await logTicketHistory(ticket.id, req.user.id, "Status Changed", "Approved by Manager");

      res.json(ticket);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/tickets/:id/staff-review", authenticate, async (req: any, res, next) => {
    try {
      const { approved } = parseBody(staffReviewSchema, req.body);
      const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (req.user.role !== "staff") return res.status(403).json({ error: "Forbidden" });
      if (ticket.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
      const isAwaitingRequesterConfirmation = ticket.status === "pending-confirmation" || (ticket.status === "resolved" && !ticket.isApproved);
      if (!isAwaitingRequesterConfirmation) {
        return res.status(400).json({ error: "Only tickets awaiting confirmation can be reviewed" });
      }
      if (!approved && ticket.status !== "pending-confirmation") {
        return res.status(400).json({ error: "Only tickets awaiting requester confirmation can be sent back for more work." });
      }

      if (!approved) {
        const updatedTicket = await prisma.ticket.update({
          where: { id: req.params.id },
          data: {
            status: "open",
            isApproved: false,
            resolvedAt: null,
            closedAt: null,
          },
        });

        await logTicketHistory(ticket.id, req.user.id, "Reopened by Requester", "Requester reported that the issue is not solved");
        if (ticket.assignedTo) {
          await createNotification(ticket.assignedTo, "Ticket Needs More Work", `The requester reported ticket "${ticket.title}" is not solved.`, `/tickets/${ticket.id}`);
        }

        const managers = await prisma.profile.findMany({
          where: { role: { in: ["manager", "admin"] } },
          select: { id: true },
        });
        for (const manager of managers) {
          await createNotification(manager.id, "Ticket Reopened", `${req.user.name} reported ticket "${ticket.title}" is not solved.`, `/tickets/${ticket.id}`);
        }

        return res.json(updatedTicket);
      }

      const updatedTicket = await prisma.ticket.update({
        where: { id: req.params.id },
        data: {
          status: "resolved",
          isApproved: true,
          closedAt: null,
          slaPaused: false,
          slaPausedAt: null,
          slaPausedRemainingMinutes: null,
          blockingReason: null,
          blockedAt: null,
          slaStatus: null,
          escalationLevel: 0,
          escalatedAt: null,
        },
      });

      await logTicketHistory(ticket.id, req.user.id, "Resolved and Approved", "Confirmed as solved by requester");
      if (ticket.assignedTo) {
        await createNotification(ticket.assignedTo, "Ticket Confirmed Solved", `The requester confirmed ticket "${ticket.title}" is solved.`, `/tickets/${ticket.id}`);
      }

      res.json(updatedTicket);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/tickets/:id/appeal", authenticate, async (req: any, res, next) => {
    try {
      const { reason } = parseBody(appealSchema, req.body);
      const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (req.user.role !== "staff") return res.status(403).json({ error: "Forbidden" });
      if (ticket.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
      if (ticket.status !== "closed") {
        return res.status(400).json({ error: "Only closed tickets can be appealed." });
      }
      const appeal = await ensureApprovalRequest({
        type: "closed-ticket-appeal",
        requestedById: req.user.id,
        reason,
        ticketId: ticket.id,
      });

      const managers = await prisma.profile.findMany({
        where: { role: { in: ["manager", "admin"] } },
        select: { id: true },
      });
      for (const manager of managers) {
        await createNotification(
          manager.id,
          "Ticket Appeal Submitted",
          `${req.user.name} appealed closed ticket "${ticket.title}".`,
          `/tickets/${ticket.id}`,
        );
      }

      await logTicketHistory(ticket.id, req.user.id, "Appeal Submitted", reason);
      await writeAuditLog(req.user, "ticket.appeal_submitted", {
        ticketId: ticket.id,
        approvalRequestId: appeal.id,
      });

      res.json(appeal);
    } catch (err) {
      next(err);
    }
  });

  // Feedback
  app.post("/api/tickets/:id/feedback", authenticate, async (req: any, res, next) => {
    try {
      const { rating, comment } = parseBody(feedbackSchema, req.body);
      
      const ticket = await prisma.ticket.findUnique({
        where: { id: req.params.id },
        include: { technician: { select: { id: true, name: true } } },
      });
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (ticket.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
      if (!["resolved", "closed"].includes(ticket.status)) {
        return res.status(400).json({ error: "Feedback can only be submitted after a ticket is resolved or closed." });
      }

      const feedback = await prisma.feedback.upsert({
        where: { ticketId: req.params.id },
        update: { rating, comment },
        create: { rating, comment, ticketId: req.params.id }
      });

      const commentSuffix = comment ? ` Comment: ${comment}` : "";
      await logTicketHistory(ticket.id, req.user.id, "Feedback Submitted", `Rating: ${rating}/5.${commentSuffix}`);

      if (ticket.assignedTo) {
        await createNotification(
          ticket.assignedTo,
          "Ticket Feedback Received",
          `${req.user.name} rated ticket "${ticket.title}" ${rating}/5.${commentSuffix}`,
          `/tickets/${ticket.id}`,
        );
      }

      if (rating <= 2 || comment) {
        const managers = await prisma.profile.findMany({
          where: { role: { in: ["manager", "admin"] } },
          select: { id: true },
        });
        for (const manager of managers) {
          await createNotification(
            manager.id,
            rating <= 2 ? "Low Ticket Rating" : "Ticket Feedback Comment",
            `${req.user.name} rated ticket "${ticket.title}" ${rating}/5.${commentSuffix}`,
            `/tickets/${ticket.id}`,
          );
        }
      }

      await writeAuditLog(req.user, "ticket.feedback_submitted", {
        ticketId: ticket.id,
        rating,
        hasComment: Boolean(comment),
      });

      res.json(feedback);
    } catch (err) {
      next(err);
    }
  });

  // --- Helper: Seed Asset Types ---
  const seedAssetTypes = async () => {
    try {
      console.log("Checking database connection and seeding asset types...");
      let count: number;

      try {
        count = await prisma.assetType.count();
      } catch (err) {
        if (!isMissingTableError(err)) {
          throw err;
        }

        await ensureDatabaseSchema();
        count = await prisma.assetType.count();
      }

      if (count === 0) {
        const defaults = ['Laptop', 'Desktop', 'Printer', 'Server', 'Network Device', 'Other'];
        for (const name of defaults) {
          await prisma.assetType.create({ data: { name } });
        }
        console.log('✅ Seeded default asset types');
        
        // Link existing assets and catalogs to new types
        const types = await prisma.assetType.findMany();
        const assets = await prisma.asset.findMany({ where: { typeId: null } });
        for (const asset of assets) {
          const matchingType = types.find(t => t.name.toLowerCase() === asset.type.toLowerCase());
          if (matchingType) {
            await prisma.asset.update({
              where: { id: asset.id },
              data: { typeId: matchingType.id }
            });
          } else {
            const otherType = types.find(t => t.name === 'Other');
            if (otherType) {
              await prisma.asset.update({
                where: { id: asset.id },
                data: { typeId: otherType.id }
              });
            }
          }
        }

        const catalogs = await prisma.assetCatalog.findMany({ where: { typeId: null } });
        for (const catalog of catalogs) {
          const matchingType = types.find(t => t.name.toLowerCase() === catalog.type.toLowerCase());
          const otherType = types.find(t => t.name === "Other");
          await prisma.assetCatalog.update({
            where: { id: catalog.id },
            data: { typeId: matchingType?.id || otherType?.id || null }
          });
        }
      } else {
        console.log("✅ Database connected and asset types already exist.");
      }
    } catch (err: any) {
      console.error("❌ Database initialization failed during startup!");
      if (err instanceof Prisma.PrismaClientInitializationError) {
        if (err.message.includes("Can't reach database server at `localhost:5432`")) {
          console.error("   CRITICAL: DATABASE_URL is still set to 'localhost:5432'.");
          console.error("   Please provide a real PostgreSQL connection string in the AI Studio Secrets panel.");
        } else {
          console.error("   Prisma Initialization Error:", err.message);
        }
      } else {
        console.error("   Error details:", err.message || err);
      }
      console.warn("⚠️  Server will continue to start, but database features will be unavailable.");
    }
  };
  
  // Run seeding in background
  seedAssetTypes();

  app.get("/api/assets", authenticate, async (req: any, res, next) => {
    try {
      let maintenanceWhere: any = { status: { not: "completed" } };
      if (req.user.role === "technician") {
        maintenanceWhere = { ...maintenanceWhere, technicianId: req.user.id };
      }

      const assets = await prisma.asset.findMany({
        include: { 
          maintenances: { where: maintenanceWhere, orderBy: { startTime: "asc" } },
          assetType: true,
          catalog: true,
          assignedUser: { select: { id: true, name: true, department: true } },
          history: {
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { user: { select: { name: true } } },
          },
        },
        orderBy: [{ name: "asc" }, { createdAt: "desc" }],
      });
      res.json(assets);
    } catch (err) {
      next(err);
    }
  });

  // Asset Types
  app.get("/api/asset-types", authenticate, async (req, res, next) => {
    try {
      const types = await prisma.assetType.findMany({
        orderBy: { name: "asc" }
      });
      res.json(types);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/asset-types", authenticate, isInventoryManager, async (req, res, next) => {
    try {
      const { name } = parseBody(assetTypeSchema, req.body);
      
      const existing = await prisma.assetType.findUnique({ where: { name } });
      if (existing) return res.status(400).json({ error: "Asset type already exists" });

      const type = await prisma.assetType.create({ data: { name } });
      res.json(type);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/asset-types/:id", authenticate, isInventoryManager, async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Check if any assets are using this type
      const assetCount = await prisma.assetCatalog.count({ where: { typeId: id } });
      if (assetCount > 0) {
        return res.status(400).json({ error: "Cannot delete asset type that is in use" });
      }

      await prisma.assetType.delete({ where: { id } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/assets", authenticate, isInventoryManager, async (req, res, next) => {
    try {
      const { name, brand, type, typeId, serialNo, quantity, status, minStockLevel, isConsumable, assignedUserId, assignedDepartment } = parseBody(assetSchema, req.body);
      const normalizedQuantity = quantity;
      const normalizedIsConsumable = isConsumable;
      const normalizedMinStockLevel = minStockLevel;
      
      if (serialNo) {
        const existing = await prisma.asset.findUnique({ where: { serialNo } });
        if (existing) return res.status(400).json({ error: "Asset with this Serial Number already exists" });
      }

      if (!normalizedIsConsumable && serialNo && normalizedQuantity > 1) {
        return res.status(400).json({ error: "A serialized device can only be created as a single unit" });
      }

      const catalog = await prisma.assetCatalog.create({
        data: {
          name,
          brand: brand || null,
          type: type || "Other",
          typeId: typeId || null,
          isConsumable: normalizedIsConsumable,
          minStockLevel: normalizedMinStockLevel,
        },
      });

      if (normalizedIsConsumable) {
        const asset = await prisma.asset.create({
          data: {
            catalogId: catalog.id,
            name,
            brand: brand || null,
            type: type || "Other",
            typeId: typeId || null,
            serialNo: null,
            quantity: normalizedQuantity,
            minStockLevel: normalizedMinStockLevel,
            isConsumable: true,
            status: status || "active",
            assignedUserId: assignedUserId || null,
            assignedDepartment: assignedDepartment || null,
          },
          include: { assetType: true, catalog: true },
        });
        await logAssetHistory(asset.id, "created", `Asset ${asset.name} registered in inventory`, {
          userId: (req as any).user.id,
        });
        return res.json(asset);
      }

      const createdAssets = await Promise.all(
        Array.from({ length: normalizedQuantity }, (_, index) =>
          prisma.asset.create({
            data: {
              catalogId: catalog.id,
              name,
              brand: brand || null,
              type: type || "Other",
              typeId: typeId || null,
              serialNo: index === 0 ? serialNo || null : null,
              quantity: 1,
              minStockLevel: normalizedMinStockLevel,
              isConsumable: false,
              status: status || "active",
              assignedUserId: assignedUserId || null,
              assignedDepartment: assignedDepartment || null,
            },
            include: { assetType: true, catalog: true },
          }),
        ),
      );

      await Promise.all(
        createdAssets.map((asset) =>
          logAssetHistory(asset.id, "created", `Asset ${asset.name} registered in inventory`, {
            userId: (req as any).user.id,
          }),
        ),
      );

      res.json(createdAssets[0]);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/import/assets", authenticate, isInventoryManager, async (req: any, res, next) => {
    try {
      const rows = parseExcelRows(req.body?.file);
      const result = {
        created: 0,
        skipped: [] as Array<{ row: number; reason: string }>,
      };

      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;
        const typeName = cellText(row, ["type", "asset type", "category"]) || "Other";
        const assignedEmail = cellText(row, ["assigned email", "assigned user email", "user email"]);
        let typeId: string | null = null;
        let assignedUserId: string | null = null;

        const assetType = await prisma.assetType.upsert({
          where: { name: typeName },
          update: {},
          create: { name: typeName },
        });
        typeId = assetType.id;

        if (assignedEmail) {
          const assignedUser = await prisma.profile.findUnique({
            where: { email: normalizeEmail(assignedEmail) },
            select: { id: true },
          });
          if (!assignedUser) {
            result.skipped.push({ row: rowNumber, reason: `Assigned user ${assignedEmail} was not found.` });
            continue;
          }
          assignedUserId = assignedUser.id;
        }

        const payload = {
          name: cellText(row, ["name", "asset name"]),
          brand: cellText(row, ["brand", "manufacturer"]),
          type: typeName,
          typeId,
          serialNo: cellText(row, ["serial no", "serial number", "serial"]),
          quantity: cellNumber(row, ["quantity", "qty"], 1),
          status: (cellText(row, ["status"]) || "active").toLowerCase(),
          minStockLevel: cellNumber(row, ["min stock level", "min stock", "minimum stock"], 0),
          isConsumable: cellBoolean(row, ["is consumable", "consumable", "spare part"], false),
          assignedUserId,
          assignedDepartment: cellText(row, ["assigned department", "department"]),
        };

        const parsed = assetSchema.safeParse(payload);
        if (!parsed.success) {
          result.skipped.push({ row: rowNumber, reason: formatValidationError(parsed.error) });
          continue;
        }

        const { name, brand, type, serialNo, quantity, status, minStockLevel, isConsumable, assignedDepartment } = parsed.data;
        if (serialNo) {
          const existing = await prisma.asset.findUnique({ where: { serialNo } });
          if (existing) {
            result.skipped.push({ row: rowNumber, reason: "Asset with this Serial Number already exists." });
            continue;
          }
        }

        if (!isConsumable && serialNo && quantity > 1) {
          result.skipped.push({ row: rowNumber, reason: "A serialized device can only be imported as a single unit." });
          continue;
        }

        const catalog = await prisma.assetCatalog.create({
          data: {
            name,
            brand: brand || null,
            type: type || "Other",
            typeId,
            isConsumable,
            minStockLevel,
          },
        });

        const createdAssets = isConsumable
          ? [
              await prisma.asset.create({
                data: {
                  catalogId: catalog.id,
                  name,
                  brand: brand || null,
                  type: type || "Other",
                  typeId,
                  serialNo: null,
                  quantity,
                  minStockLevel,
                  isConsumable: true,
                  status,
                  assignedUserId,
                  assignedDepartment: assignedDepartment || null,
                },
              }),
            ]
          : await Promise.all(
              Array.from({ length: quantity }, (_, unitIndex) =>
                prisma.asset.create({
                  data: {
                    catalogId: catalog.id,
                    name,
                    brand: brand || null,
                    type: type || "Other",
                    typeId,
                    serialNo: unitIndex === 0 ? serialNo || null : null,
                    quantity: 1,
                    minStockLevel,
                    isConsumable: false,
                    status,
                    assignedUserId,
                    assignedDepartment: assignedDepartment || null,
                  },
                }),
              ),
            );

        await Promise.all(
          createdAssets.map((asset) =>
            logAssetHistory(asset.id, "created", `Asset ${asset.name} imported from Excel`, {
              userId: req.user.id,
            }),
          ),
        );

        result.created += createdAssets.length;
      }

      await writeAuditLog(req.user, "assets.imported", {
        created: result.created,
        skipped: result.skipped.length,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Asset Usage
  app.post("/api/tickets/:id/usage", authenticate, isStaff, async (req: any, res, next) => {
    try {
      const { assetId, quantity } = parseBody(maintenancePartSchema.pick({ assetId: true, quantity: true }), req.body);
      const ticketId = req.params.id;

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      if (req.user.role === "staff" && ticket.userId !== req.user.id) {
        return res.status(403).json({ error: "Requesters can only add asset usage to their own tickets" });
      }

      // Technician can only add usage to assigned tickets
      if (req.user.role === "technician" && ticket.assignedTo !== req.user.id) {
        return res.status(403).json({ error: "Technicians can only add usage to assigned tickets" });
      }

      const asset = await prisma.asset.findUnique({ where: { id: assetId } });
      if (!asset) return res.status(404).json({ error: "Asset not found" });
      if (!asset.isConsumable && quantity !== 1) {
        return res.status(400).json({ error: "Individual devices can only be used one at a time" });
      }
      if (asset.isConsumable && asset.quantity < quantity) return res.status(400).json({ error: "Insufficient quantity in stock" });
      if (!asset.isConsumable && asset.status !== "active") {
        return res.status(400).json({ error: "This device is not available" });
      }

      // Transaction to ensure atomicity
      const [usage] = await prisma.$transaction([
        prisma.assetUsage.create({
          data: {
            ticketId,
            assetId,
            userId: req.user.id,
            quantity
          },
          include: { asset: true }
        }),
        prisma.asset.update({
          where: { id: assetId },
          data: asset.isConsumable
            ? { quantity: { decrement: quantity } }
            : { status: "requested" }
        })
      ]);

      // Log History
      await logTicketHistory(ticketId, req.user.id, "Asset Used", `Used ${quantity}x ${asset.name}`);
      await logAssetHistory(assetId, "used-on-ticket", `Used ${quantity}x on ticket "${ticket.title}"`, {
        userId: req.user.id,
        ticketId,
      });

      res.json(usage);
    } catch (err) {
      next(err);
    }
  });

  // Asset Maintenance
  app.get("/api/assets/maintenance/upcoming", authenticate, async (req, res, next) => {
    try {
      const maintenance = await prisma.maintenance.findMany({
        where: { status: { not: "completed" } },
        include: { asset: { select: { name: true } } },
        orderBy: { startTime: "asc" },
        take: 10
      });
      res.json(maintenance);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/assets/:id/maintenance", authenticate, async (req, res, next) => {
    try {
      const maintenance = await prisma.maintenance.findMany({
        where: { assetId: req.params.id },
        orderBy: { startTime: "desc" }
      });
      res.json(maintenance);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/assets/:id/maintenance", authenticate, isInventoryManager, async (req, res, next) => {
    try {
      const { type, scheduledDate, endDate, description } = parseBody(assetMaintenanceSchema, req.body);
      const asset = await prisma.asset.findUnique({ where: { id: req.params.id } });
      if (!asset) return res.status(404).json({ error: "Asset not found" });
      if (asset.isConsumable) {
        return res.status(400).json({ error: "Consumables cannot be scheduled for maintenance" });
      }
      if (asset.quantity !== 1) {
        return res.status(400).json({ error: "Maintenance can only be scheduled for individual asset units" });
      }
      if (asset.status === "maintenance") {
        return res.status(400).json({ error: "Asset is already under maintenance" });
      }
      if (asset.status === "retired") {
        return res.status(400).json({ error: "Retired assets cannot be scheduled for maintenance" });
      }
      if (asset.status === "requested") {
        return res.status(400).json({ error: "Requested assets cannot be scheduled for maintenance" });
      }
      const assetName = asset.name;
      const startTime = new Date(scheduledDate);
      const endTime = endDate ? new Date(endDate) : new Date(startTime.getTime() + 3600000);

      const maintenance = await prisma.maintenance.create({
        data: {
          assetId: req.params.id,
          title: `Maintenance for ${assetName}`, // Better title
          type,
          startTime,
          endTime,
          description,
          status: "scheduled"
        }
      });
      await logAssetHistory(req.params.id, "maintenance-scheduled", maintenance.description || maintenance.title, {
        userId: (req as any).user.id,
        maintenanceId: maintenance.id,
      });
      res.json(maintenance);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/assets/maintenance/:id", authenticate, isInventoryManager, async (req, res, next) => {
    try {
      const { status } = parseBody(updateMaintenanceStatusSchema, req.body);
      const exists = await prisma.maintenance.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "Maintenance record not found" });
      if (status === "in-progress" && !exists.technicianId) {
        return res.status(400).json({ error: "Assign a technician before starting maintenance" });
      }
      if (status === "completed" && !exists.technicianId) {
        return res.status(400).json({ error: "Assign a technician before completing maintenance" });
      }
      if (exists.status === "scheduled" && status === "completed") {
        return res.status(400).json({ error: "Start maintenance before completing it" });
      }
      if (exists.status === "completed" && status !== "completed") {
        return res.status(400).json({ error: "Completed maintenance cannot be reopened" });
      }
      if (exists.status === "in-progress" && status === "scheduled") {
        return res.status(400).json({ error: "In-progress maintenance cannot be moved back to scheduled" });
      }

      const maintenance = await prisma.maintenance.update({
        where: { id: req.params.id },
        data: { status }
      });

      // Update asset status if linked
      if (maintenance.assetId) {
        if (status === "in-progress") {
          await prisma.asset.update({
            where: { id: maintenance.assetId },
            data: { status: "maintenance" }
          });
        } else if (status === "completed") {
          await prisma.asset.update({
            where: { id: maintenance.assetId },
            data: { status: "active" }
          });
        }
        await logAssetHistory(
          maintenance.assetId,
          "maintenance-status-updated",
          `Maintenance "${maintenance.title}" marked ${status}`,
          {
            userId: (req as any).user.id,
            maintenanceId: maintenance.id,
          },
        );
      }

      res.json(maintenance);
    } catch (err) {
      next(err);
    }
  });

  // Asset Requests
  app.get("/api/assets/requests", authenticate, async (req: any, res, next) => {
    try {
      let where: any = {};
      if (req.user.role === "staff" || req.user.role === "technician") {
        where = { userId: req.user.id };
      }
      
      const requests = await prisma.assetRequest.findMany({
        where,
        include: { 
          asset: { select: { name: true, type: true, brand: true } }, 
          user: { select: { name: true, email: true } } 
        },
        orderBy: { createdAt: "desc" }
      });
      res.json(requests);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/assets/:id/request", authenticate, async (req: any, res, next) => {
    try {
      const assetId = req.params.id;
      const userId = req.user.id;
      const { quantity } = parseBody(quantitySchema, req.body);
      
      // Basic UUID validation to prevent Prisma error on malformed ID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(assetId)) {
        return res.status(400).json({ error: "Invalid asset ID format" });
      }

      const asset = await prisma.asset.findUnique({ where: { id: assetId } });
      if (!asset) return res.status(404).json({ error: "Asset not found" });
      if (asset.status === "maintenance") {
        return res.status(400).json({ error: "Assets under maintenance cannot be requested" });
      }
      if (asset.status === "retired") {
        return res.status(400).json({ error: "Retired assets cannot be requested" });
      }

      const requestedQty = quantity;
      if (!asset.isConsumable && requestedQty !== 1) {
        return res.status(400).json({ error: "Individual devices can only be requested one at a time" });
      }
      if (asset.isConsumable && requestedQty > asset.quantity) return res.status(400).json({ error: "Requested quantity exceeds available stock" });
      if (!asset.isConsumable && asset.status !== "active") {
        return res.status(400).json({ error: "This device is not available for requests" });
      }

      const activeRequest = !asset.isConsumable ? await prisma.assetRequest.findFirst({
        where: {
          assetId,
          status: { in: ["pending-approval", "pending", "fulfilled"] },
        },
      }) : null;
      if (activeRequest) {
        return res.status(400).json({ error: "This asset already has an active request" });
      }

      const needsManagerApproval = req.user.role === "technician";
      const request = await prisma.assetRequest.create({
        data: {
          assetId,
          userId,
          quantity: requestedQty,
          status: needsManagerApproval ? "pending-approval" : "pending"
        }
      });

      if (!needsManagerApproval) {
        await prisma.asset.update({
          where: { id: assetId },
          data: asset.isConsumable
            ? { status: requestedQty === asset.quantity ? "requested" : asset.status }
            : { status: "requested" }
        });
      }

      // Notify managers
      const managers = await prisma.profile.findMany({
        where: { role: { in: ["manager", "admin"] } },
        select: { id: true }
      });
      for (const manager of managers) {
        await createNotification(
          manager.id,
          needsManagerApproval ? "Asset Request Needs Approval" : "New Asset Request",
          `${req.user.name} requested ${requestedQty}x ${asset.name}.`,
          `/assets`,
        );
      }

      res.json(request);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/assets/requests/:id/approve", authenticate, isManager, async (req: any, res, next) => {
    try {
      const requestId = req.params.id;
      const request = await prisma.assetRequest.findUnique({
        where: { id: requestId },
        include: { asset: true, user: true },
      });
      if (!request) return res.status(404).json({ error: "Request not found" });
      if (request.status !== "pending-approval") return res.status(400).json({ error: "Only requests pending approval can be approved" });
      if (request.asset.status === "maintenance") {
        return res.status(400).json({ error: "Assets under maintenance cannot be approved" });
      }
      if (request.asset.status === "retired") {
        return res.status(400).json({ error: "Retired assets cannot be approved" });
      }
      if (request.asset.isConsumable && request.asset.quantity < request.quantity) {
        return res.status(400).json({ error: "Requested quantity exceeds available stock" });
      }
      if (!request.asset.isConsumable && request.asset.status !== "active") {
        return res.status(400).json({ error: "This device is no longer available" });
      }

      const [updatedRequest] = await prisma.$transaction([
        prisma.assetRequest.update({
          where: { id: requestId },
          data: { status: "pending" },
          include: {
            asset: { select: { name: true, type: true, brand: true } },
            user: { select: { name: true, email: true } },
          },
        }),
        prisma.asset.update({
          where: { id: request.assetId },
          data: request.asset.isConsumable
            ? { status: request.quantity === request.asset.quantity ? "requested" : request.asset.status }
            : { status: "requested" },
        }),
      ]);

      await createNotification(request.userId, "Asset Request Approved", `Your request for ${request.quantity}x ${request.asset.name} was approved.`, `/assets`);

      res.json(updatedRequest);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/assets/requests/:id/fulfill", authenticate, isInventoryManager, async (req, res, next) => {
    try {
      const requestId = req.params.id;
      const request = await prisma.assetRequest.findUnique({ 
        where: { id: requestId },
        include: { asset: true, user: true }
      });
      if (!request) return res.status(404).json({ error: "Request not found" });
      if (request.status === "fulfilled") return res.status(400).json({ error: "Request already fulfilled" });
      if (request.status === "pending-approval") return res.status(400).json({ error: "Manager approval is required before fulfillment" });
      if (request.asset.isConsumable && request.asset.quantity < request.quantity) {
        return res.status(400).json({ error: "Asset out of stock or insufficient quantity" });
      }

      const [updatedRequest] = await prisma.$transaction([
        prisma.assetRequest.update({
          where: { id: requestId },
          data: { status: "fulfilled" }
        }),
        prisma.asset.update({
          where: { id: request.assetId },
          data: request.asset.isConsumable
            ? {
                quantity: { decrement: request.quantity },
                status: "active"
              }
            : {
                status: "requested"
              }
        })
      ]);

      await createNotification(request.userId, "Asset Request Fulfilled", `Your request for ${request.quantity}x ${request.asset.name} has been fulfilled.`, `/assets`);

      res.json(updatedRequest);
    } catch (err) {
      next(err);
    }
  });

  // Return Asset Request
  app.put("/api/assets/requests/:id/return", authenticate, async (req: any, res, next) => {
    try {
      const requestId = req.params.id;
      const request = await prisma.assetRequest.findUnique({ 
        where: { id: requestId },
        include: { asset: true, user: true }
      });
      if (!request) return res.status(404).json({ error: "Request not found" });
      if (request.status !== "fulfilled") return res.status(400).json({ error: "Only fulfilled requests can be returned" });
      
      const isStaffAuthority = isManagerRole(req.user.role);
      const isOwner = request.userId === req.user.id;

      if (!isStaffAuthority && !isOwner) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const updateData: any = {};
      if (isOwner) updateData.userReturned = true;
      if (isStaffAuthority) updateData.staffReturned = true;

      const willBeReturned = (request.userReturned || updateData.userReturned) && 
                             (request.staffReturned || updateData.staffReturned);

      if (willBeReturned) {
        updateData.status = "returned";
        updateData.returnedAt = new Date();
      }

      const [updatedRequest] = await prisma.$transaction([
        prisma.assetRequest.update({
          where: { id: requestId },
          data: updateData,
          include: { 
            asset: { select: { name: true, type: true, brand: true } }, 
            user: { select: { name: true, email: true } } 
          }
        }),
        ...(willBeReturned ? [
          prisma.asset.update({
            where: { id: request.assetId },
            data: request.asset.isConsumable
              ? {
                  quantity: { increment: request.quantity },
                  status: "active"
                }
              : {
                  status: "active"
                }
          })
        ] : [])
      ]);

      // Notify managers if user returned
      if (isOwner && !isStaffAuthority) {
        const managers = await prisma.profile.findMany({
          where: { role: { in: ["manager", "admin"] } },
          select: { id: true }
        });
        for (const manager of managers) {
          await createNotification(manager.id, "Asset Return Initiated", `${req.user.name} initiated return for ${request.asset.name}.`, `/assets`);
        }
      }

      // Notify user if staff returned
      if (isStaffAuthority && !isOwner) {
        await createNotification(request.userId, "Asset Return Confirmed", `Staff confirmed return for ${request.asset.name}.`, `/assets`);
      }

      res.json(updatedRequest);
    } catch (err) {
      next(err);
    }
  });

  // Return Asset Usage
  app.put("/api/assets/usage/:id/return", authenticate, isStaff, async (req: any, res, next) => {
    try {
      const usageId = req.params.id;
      const usage = await prisma.assetUsage.findUnique({ 
        where: { id: usageId },
        include: { asset: true, ticket: true }
      });
      if (!usage) return res.status(404).json({ error: "Usage record not found" });
      if (usage.status === "returned") return res.status(400).json({ error: "Asset already returned" });

      const isStaffAuthority = isManagerRole(req.user.role);
      const isOwner = usage.userId === req.user.id || usage.ticket.assignedTo === req.user.id;

      if (!isStaffAuthority && !isOwner) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const updateData: any = {};
      if (isOwner) updateData.userReturned = true;
      if (isStaffAuthority) updateData.staffReturned = true;

      const willBeReturned = (usage.userReturned || updateData.userReturned) && 
                             (usage.staffReturned || updateData.staffReturned);

      if (willBeReturned) {
        updateData.status = "returned";
        updateData.returnedAt = new Date();
      }

      const [updatedUsage] = await prisma.$transaction([
        prisma.assetUsage.update({
          where: { id: usageId },
          data: updateData,
          include: { 
            asset: { select: { name: true, type: true, brand: true } }, 
            user: { select: { name: true, email: true } } 
          }
        }),
        ...(willBeReturned ? [
          prisma.asset.update({
            where: { id: usage.assetId },
            data: usage.asset.isConsumable
              ? {
                  quantity: { increment: usage.quantity },
                  status: "active"
                }
              : {
                  status: "active"
                }
          })
        ] : [])
      ]);

      // Log History if fully returned
      if (willBeReturned) {
        await logTicketHistory(usage.ticketId, req.user.id, "Asset Returned", `Returned ${usage.quantity}x ${usage.asset.name}`);
      } else {
        await logTicketHistory(usage.ticketId, req.user.id, "Asset Return Initiated", `${req.user.name} initiated return for ${usage.asset.name}`);
      }

      res.json(updatedUsage);
    } catch (err) {
      next(err);
    }
  });

  // Update Asset (with restock notification)
  app.put("/api/assets/:id", authenticate, isInventoryManager, async (req, res, next) => {
    try {
      const { name, brand, type, typeId, serialNo, quantity, status, minStockLevel, isConsumable, assignedUserId, assignedDepartment } = parseBody(updateAssetSchema, req.body);
      const assetId = req.params.id;

      const oldAsset = await prisma.asset.findUnique({ where: { id: assetId } });
      if (!oldAsset) return res.status(404).json({ error: "Asset not found" });

      if (status === "retired" && !isManagerRole((req as any).user.role)) {
        return res.status(403).json({ error: "Only managers or admins can retire assets" });
      }

      const normalizedIsConsumable = isConsumable ?? oldAsset.isConsumable;
      const normalizedMinStockLevel = minStockLevel ?? oldAsset.minStockLevel;
      const normalizedQuantity = normalizedIsConsumable
        ? quantity ?? oldAsset.quantity
        : 1;

      if (status === "retired" && oldAsset.status !== "retired") {
        const [activeMaintenance, pendingRequests, activeUsage] = await Promise.all([
          prisma.maintenance.count({ where: { assetId, status: { not: "completed" } } }),
          prisma.assetRequest.count({ where: { assetId, status: { in: ["pending", "fulfilled"] } } }),
          prisma.assetUsage.count({ where: { assetId, status: "in-use" } }),
        ]);

        if (activeMaintenance > 0 || pendingRequests > 0 || activeUsage > 0) {
          return res.status(400).json({ error: "Cannot retire asset while it has active maintenance, requests, or usage" });
        }
      }

      if (oldAsset.isConsumable !== normalizedIsConsumable) {
        return res.status(400).json({ error: "Change the inventory kind by creating a new asset record instead of converting this one" });
      }

      if (serialNo && serialNo !== oldAsset.serialNo) {
        const existing = await prisma.asset.findUnique({ where: { serialNo } });
        if (existing) return res.status(400).json({ error: "Another asset with this Serial Number already exists" });
      }

      const asset = await syncAssetCatalog(assetId, {
        name,
        brand: brand || null,
        type: type || "Other",
        typeId: typeId || null,
        isConsumable: normalizedIsConsumable,
        minStockLevel: normalizedMinStockLevel,
      });

      if (!asset) return res.status(404).json({ error: "Asset not found" });

      const updatedAsset = await prisma.asset.update({
        where: { id: assetId },
        data: {
          serialNo: serialNo || null,
          quantity: normalizedQuantity,
          minStockLevel: normalizedMinStockLevel,
          isConsumable: normalizedIsConsumable,
          status,
          assignedUserId: assignedUserId || null,
          assignedDepartment: assignedDepartment || null,
        },
        include: { assetType: true, catalog: true }
      });

      // If quantity increased, notify pending requests
      if (normalizedIsConsumable && normalizedQuantity > oldAsset.quantity) {
        const pendingRequests = await prisma.assetRequest.findMany({
          where: { assetId, status: "pending" },
          include: { user: true }
        });

        for (const request of pendingRequests) {
          await createNotification(
            request.userId,
            "Asset Restocked",
            `The asset "${asset.name}" you requested is now back in stock (Qty: ${quantity}).`,
            "/assets",
          );
          
          await prisma.assetRequest.updateMany({
            where: { id: request.id },
            data: { status: "fulfilled" }
          });
        }
      }

      if (status && status !== oldAsset.status) {
        await logAssetHistory(assetId, "status-updated", `Status changed from ${oldAsset.status} to ${status}`, {
          userId: (req as any).user.id,
        });
      }

      if (assignedUserId !== oldAsset.assignedUserId || assignedDepartment !== oldAsset.assignedDepartment) {
        await logAssetHistory(
          assetId,
          "assignment-updated",
          `Assignment updated${assignedDepartment ? ` for ${assignedDepartment}` : ""}`,
          { userId: (req as any).user.id },
        );
      }

      await writeAuditLog((req as any).user, "asset.updated", {
        assetId,
        changes: {
          status,
          assignedUserId: assignedUserId || null,
          assignedDepartment: assignedDepartment || null,
        },
      });

      res.json(updatedAsset);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/assets/:id", authenticate, isInventoryManager, async (req, res, next) => {
    try {
      const assetId = req.params.id;
      const asset = await prisma.asset.findUnique({ where: { id: assetId } });
      if (!asset) return res.status(404).json({ error: "Asset not found" });

      const [activeMaintenance, pendingRequests, activeUsage] = await Promise.all([
        prisma.maintenance.count({ where: { assetId, status: { not: "completed" } } }),
        prisma.assetRequest.count({ where: { assetId, status: { in: ["pending", "fulfilled"] } } }),
        prisma.assetUsage.count({ where: { assetId, status: "in-use" } }),
      ]);

      if (activeMaintenance > 0 || pendingRequests > 0 || activeUsage > 0) {
        return res.status(400).json({ error: "Cannot delete asset while it has active maintenance, requests, or usage" });
      }

      if (asset.isConsumable && asset.quantity > 1) {
        const updatedAsset = await prisma.asset.update({
          where: { id: assetId },
          data: { quantity: { decrement: 1 } },
        });

        await writeAuditLog((req as any).user, "asset.unit_deleted", {
          assetId,
          assetName: asset.name,
          previousQuantity: asset.quantity,
          newQuantity: updatedAsset.quantity,
        });
        await logAssetHistory(assetId, "quantity-decremented", "One unit removed from stock", {
          userId: (req as any).user.id,
        });

        return res.json({
          message: "One asset unit deleted successfully",
          asset: updatedAsset,
        });
      }

      await prisma.asset.delete({ where: { id: assetId } });
      await deleteAssetCatalogIfEmpty(asset.catalogId);
      await writeAuditLog((req as any).user, "asset.deleted", {
        assetId,
        assetName: asset.name,
      });
      res.json({ message: "Asset deleted successfully" });
    } catch (err) {
      next(err);
    }
  });

  // Delay reporting
  app.put("/api/assets/maintenance/:id/delay", authenticate, isInventoryManager, async (req, res, next) => {
    try {
      const { delayReason } = parseBody(delaySchema, req.body);
      const exists = await prisma.maintenance.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "Maintenance record not found" });

      const maintenance = await prisma.maintenance.update({
        where: { id: req.params.id },
        data: { isDelayed: true, delayReason }
      });
      res.json(maintenance);
    } catch (err) {
      next(err);
    }
  });

  app.put(["/api/tickets/:id/sla-pause", "/api/tickets/:id/delay"], authenticate, isTechnician, async (req: any, res, next) => {
    try {
      const pausePayload = parseBody(slaPauseSchema, req.body);
      const blockingReason = pausePayload.blockingReason || pausePayload.delayReason || "";

      const exists = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "Ticket not found" });
      if (req.user.role === "technician" && exists.assignedTo !== req.user.id) {
        return res.status(403).json({ error: "Technicians can only pause SLA for assigned tickets" });
      }
      if (["resolved", "closed"].includes(exists.status)) {
        return res.status(400).json({ error: "Resolved or closed tickets cannot be paused" });
      }
      const existingTicket: any = exists;

      if (existingTicket.slaPaused) {
        return res.status(400).json({ error: "SLA is already paused for this ticket" });
      }

      const now = new Date();
      const dueDate = exists.dueDate ? new Date(exists.dueDate) : getSLADueDate(exists.priority, now);
      const remainingMinutes = Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60)));
      const pauseUpdateData: any = {
        dueDate,
        slaPaused: true,
        slaPausedAt: now,
        slaPausedRemainingMinutes: remainingMinutes,
        blockingReason,
        blockedAt: now,
        slaStatus: "paused",
      };

      const ticket = await prisma.ticket.update({
        where: { id: req.params.id },
        data: pauseUpdateData
      });

      const managers = await prisma.profile.findMany({
        where: { role: { in: ["manager", "admin"] } },
        select: { id: true },
      });

      for (const manager of managers) {
        if (manager.id !== req.user.id) {
          await createNotification(
            manager.id,
            "SLA Paused",
            `${req.user.name} paused SLA for ticket "${ticket.title}" because: ${blockingReason}`,
            `/tickets/${ticket.id}`,
          );
        }
      }

      await logTicketHistory(ticket.id, req.user.id, "SLA Paused", `Blocked because: ${blockingReason}`);
      await writeAuditLog(req.user, "ticket.sla_paused", {
        ticketId: ticket.id,
        blockingReason,
        remainingMinutes,
      });

      res.json(ticket);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/assets/:id/history", authenticate, async (req, res, next) => {
    try {
      const history = await prisma.assetHistory.findMany({
        where: { assetId: req.params.id },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      });
      res.json(history);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/tickets/:id/sla-resume", authenticate, isTechnician, async (req: any, res, next) => {
    try {
      const exists = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "Ticket not found" });
      if (req.user.role === "technician" && exists.assignedTo !== req.user.id) {
        return res.status(403).json({ error: "Technicians can only resume SLA for assigned tickets" });
      }
      const existingTicket: any = exists;

      if (!existingTicket.slaPaused) {
        return res.status(400).json({ error: "SLA is not paused for this ticket" });
      }

      const now = new Date();
      const remainingMinutes = Math.max(0, existingTicket.slaPausedRemainingMinutes ?? 0);
      const resumedDueDate = new Date(now.getTime() + remainingMinutes * 60 * 1000);
      const nextSlaStatus = remainingMinutes <= 120 ? "at-risk" : "on-track";
      const resumeUpdateData: any = {
        dueDate: resumedDueDate,
        slaPaused: false,
        slaPausedAt: null,
        slaPausedRemainingMinutes: null,
        blockingReason: null,
        blockedAt: null,
        slaStatus: nextSlaStatus,
      };

      const ticket = await prisma.ticket.update({
        where: { id: req.params.id },
        data: resumeUpdateData
      });

      const managers = await prisma.profile.findMany({
        where: { role: { in: ["manager", "admin"] } },
        select: { id: true },
      });

      for (const manager of managers) {
        if (manager.id !== req.user.id) {
          await createNotification(
            manager.id,
            "SLA Resumed",
            `${req.user.name} resumed SLA for ticket "${ticket.title}".`,
            `/tickets/${ticket.id}`,
          );
        }
      }

      await logTicketHistory(ticket.id, req.user.id, "SLA Resumed", `Remaining time restored: ${remainingMinutes} minute(s)`);
      await writeAuditLog(req.user, "ticket.sla_resumed", {
        ticketId: ticket.id,
        remainingMinutes,
        resumedDueDate,
      });

      res.json(ticket);
    } catch (err) {
      next(err);
    }
  });

  // Notifications
  app.get("/api/notifications", authenticate, async (req: any, res, next) => {
    try {
      const notifications = await prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        take: 20
      });
      res.json(notifications.map(serializeNotification));
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/notifications/read-all", authenticate, async (req: any, res, next) => {
    try {
      await prisma.notification.updateMany({
        where: { userId: req.user.id, isRead: false },
        data: { isRead: true },
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/notifications/:id/read", authenticate, async (req: any, res, next) => {
    try {
      const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
      if (!notification) return res.status(404).json({ error: "Notification not found" });
      if (notification.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

      const updatedNotification = await prisma.notification.update({
        where: { id: req.params.id },
        data: { isRead: true }
      });
      res.json(serializeNotification(updatedNotification));
    } catch (err) {
      next(err);
    }
  });

  // Maintenance
  app.get("/api/maintenance", authenticate, async (req: any, res, next) => {
    try {
      let where: any = {};
      if (req.user.role === "technician") {
        where = {
          OR: [
            { assetId: null },
            { technicianId: req.user.id },
          ],
        };
      } else if (!isManagerRole(req.user.role)) {
        where = { assetId: null };
      }

      const maintenance = await prisma.maintenance.findMany({
        where,
        include: { 
          technician: { select: { name: true } },
          asset: { select: { name: true, type: true, brand: true } }
        },
        orderBy: { startTime: "asc" }
      });
      res.json(maintenance);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/maintenance", authenticate, isInventoryManager, async (req, res, next) => {
    try {
      const { title, description, startTime, endTime, type, technicianId, assetId } = parseBody(maintenanceSchema, req.body);
      if (assetId) {
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        if (!asset) return res.status(404).json({ error: "Asset not found" });
        if (asset.isConsumable) {
          return res.status(400).json({ error: "Consumables cannot be scheduled for maintenance" });
        }
        if (asset.quantity !== 1) {
          return res.status(400).json({ error: "Maintenance can only be scheduled for individual asset units" });
        }
        if (asset.status === "maintenance") {
          return res.status(400).json({ error: "Asset is already under maintenance" });
        }
        if (asset.status === "retired") {
          return res.status(400).json({ error: "Retired assets cannot be scheduled for maintenance" });
        }
        if (asset.status === "requested") {
          return res.status(400).json({ error: "Requested assets cannot be scheduled for maintenance" });
        }
      }
      if (technicianId) {
        const tech = await prisma.profile.findUnique({ where: { id: technicianId } });
        if (!tech || tech.role !== "technician") {
          return res.status(400).json({ error: "Invalid technician ID" });
        }

        const activeWork = await getTechnicianActiveWork(technicianId);
        if (activeWork) {
          return res.status(400).json({ error: activeWork });
        }
      }

      const maintenance = await prisma.maintenance.create({ 
        data: { 
          title, 
          description, 
          startTime: new Date(startTime), 
          endTime: new Date(endTime), 
          type,
          technicianId: technicianId || null,
          assetId: assetId || null,
          status: "scheduled"
        } 
      });
      res.json(maintenance);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/maintenance/:id/status", authenticate, isInventoryManager, async (req, res, next) => {
    try {
      const { status } = parseBody(updateMaintenanceStatusSchema, req.body);
      const exists = await prisma.maintenance.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "Maintenance not found" });
      if (status === "in-progress" && !exists.technicianId) {
        return res.status(400).json({ error: "Assign a technician before starting maintenance" });
      }
      if (status === "completed" && !exists.technicianId) {
        return res.status(400).json({ error: "Assign a technician before completing maintenance" });
      }
      if (exists.status === "scheduled" && status === "completed") {
        return res.status(400).json({ error: "Start maintenance before completing it" });
      }
      if (exists.status === "completed" && status !== "completed") {
        return res.status(400).json({ error: "Completed maintenance cannot be reopened" });
      }
      if (exists.status === "in-progress" && status === "scheduled") {
        return res.status(400).json({ error: "In-progress maintenance cannot be moved back to scheduled" });
      }

      const maintenance = await prisma.maintenance.update({
        where: { id: req.params.id },
        data: { status }
      });

      // Update asset status if linked
      if (maintenance.assetId) {
        if (status === "in-progress") {
          await prisma.asset.update({
            where: { id: maintenance.assetId },
            data: { status: "maintenance" }
          });
        } else if (status === "completed") {
          await prisma.asset.update({
            where: { id: maintenance.assetId },
            data: { status: "active" }
          });
        }
      }

      res.json(maintenance);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/maintenance/:id/assign", authenticate, isManager, async (req, res, next) => {
    try {
      const { technicianId } = parseBody(maintenanceAssignSchema, req.body);
      const exists = await prisma.maintenance.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "Maintenance not found" });
      if (exists.status === "completed") {
        return res.status(400).json({ error: "Completed maintenance cannot be reassigned" });
      }
      if (exists.status === "in-progress" && !technicianId) {
        return res.status(400).json({ error: "In-progress maintenance cannot be unassigned" });
      }

      if (technicianId) {
        const tech = await prisma.profile.findUnique({ where: { id: technicianId } });
        if (!tech || tech.role !== "technician") {
          return res.status(400).json({ error: "Invalid technician ID" });
        }

        const activeWork = await getTechnicianActiveWork(technicianId, { excludeMaintenanceId: exists.id });
        if (activeWork) {
          return res.status(400).json({ error: activeWork });
        }
      }

      const maintenance = await prisma.maintenance.update({
        where: { id: req.params.id },
        data: { technicianId: technicianId || null },
        include: { technician: { select: { name: true } } }
      });

      if (technicianId) {
        await createNotification(technicianId, "Maintenance Assigned", `You have been assigned to maintenance: ${maintenance.title}`, `/maintenance`);
      }

      res.json(maintenance);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/maintenance/:id", authenticate, isManager, async (req, res, next) => {
    try {
      const existing = await prisma.maintenance.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: "Maintenance not found" });

      await prisma.maintenance.delete({
        where: { id: req.params.id }
      });

      if (existing.assetId && existing.status === "in-progress") {
        const remainingInProgress = await prisma.maintenance.count({
          where: {
            assetId: existing.assetId,
            status: "in-progress"
          }
        });

        if (remainingInProgress === 0) {
          await prisma.asset.update({
            where: { id: existing.assetId },
            data: { status: "active" }
          });
        }
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/maintenance/:id/parts", authenticate, async (req, res, next) => {
    try {
      const parts = await prisma.maintenancePartUsage.findMany({
        where: { maintenanceId: req.params.id },
        include: { asset: true },
        orderBy: { createdAt: "desc" },
      });
      res.json(parts);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/maintenance/:id/parts", authenticate, isInventoryManager, async (req: any, res, next) => {
    try {
      const { assetId, quantity, notes } = parseBody(maintenancePartSchema, req.body);
      const maintenance = await prisma.maintenance.findUnique({ where: { id: req.params.id } });
      if (!maintenance) return res.status(404).json({ error: "Maintenance not found" });

      const asset = await prisma.asset.findUnique({ where: { id: assetId } });
      if (!asset) return res.status(404).json({ error: "Asset not found" });

      const normalizedQuantity = quantity;
      if (asset.isConsumable && asset.quantity < normalizedQuantity) {
        return res.status(400).json({ error: "Insufficient stock for this part" });
      }

      const [partUsage] = await prisma.$transaction([
        prisma.maintenancePartUsage.create({
          data: {
            maintenanceId: req.params.id,
            assetId,
            quantity: normalizedQuantity,
            notes: notes || null,
          },
          include: { asset: true },
        }),
        prisma.asset.update({
          where: { id: assetId },
          data: asset.isConsumable
            ? { quantity: { decrement: normalizedQuantity } }
            : { status: "maintenance" },
        }),
      ]);

      await logAssetHistory(assetId, "used-in-maintenance", `Used ${normalizedQuantity}x for maintenance "${maintenance.title}"`, {
        userId: req.user.id,
        maintenanceId: maintenance.id,
      });

      res.json(partUsage);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/approvals", authenticate, isManager, async (req, res, next) => {
    try {
      const approvals = await prisma.approvalRequest.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          requestedBy: { select: { id: true, name: true } },
          reviewedBy: { select: { id: true, name: true } },
          ticket: { select: { id: true, title: true, priority: true, status: true } },
          asset: { select: { id: true, name: true, status: true } },
          maintenance: { select: { id: true, title: true, status: true } },
        },
      });
      res.json(approvals);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/approvals", authenticate, isStaff, async (req: any, res, next) => {
    try {
      const payload = parseBody(approvalRequestSchema, req.body);
      const approval = await ensureApprovalRequest({
        type: payload.type,
        requestedById: req.user.id,
        reason: payload.reason || undefined,
        ticketId: payload.ticketId,
        assetId: payload.assetId,
        maintenanceId: payload.maintenanceId,
      });

      const managers = await prisma.profile.findMany({
        where: { role: { in: ["manager", "admin"] } },
        select: { id: true },
      });
      for (const manager of managers) {
        await createNotification(manager.id, "Approval Requested", `A new ${approval.type} approval request is waiting for review.`, approval.ticketId ? `/tickets/${approval.ticketId}` : "/assets");
      }

      res.json(approval);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/approvals/:id/respond", authenticate, isManager, async (req: any, res, next) => {
    try {
      const { status } = parseBody(approvalResponseSchema, req.body);

      const approval = await prisma.approvalRequest.update({
        where: { id: req.params.id },
        data: {
          status,
          reviewedById: req.user.id,
          reviewedAt: new Date(),
        },
        include: {
          requestedBy: { select: { id: true, name: true } },
          ticket: true,
          asset: true,
          maintenance: true,
        },
      });

      if (approval.requestedById) {
        await createNotification(
          approval.requestedById,
          `Approval ${status}`,
          `Your ${approval.type} request was ${status}.`,
          approval.ticketId ? `/tickets/${approval.ticketId}` : "/assets",
        );
      }

      await writeAuditLog(req.user, "approval.responded", {
        approvalRequestId: approval.id,
        status,
      });

      res.json(approval);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/audit-logs", authenticate, isManager, async (req, res, next) => {
    try {
      const logPath = path.join(process.cwd(), "logs", "audit.log");
      const contents = await readFile(logPath, "utf8").catch(() => "");
      const entries = contents
        .split("\n")
        .filter(Boolean)
        .slice(-200)
        .reverse()
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      res.json(entries);
    } catch (err) {
      next(err);
    }
  });

  // Users Management (Admin Only)
  app.get("/api/users", authenticate, isAdmin, async (req, res, next) => {
    try {
      const users = await prisma.profile.findMany({
        select: { id: true, name: true, email: true, role: true, status: true, canInviteStaff: true, department: true },
      });
      res.json(users);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/users", authenticate, isAdmin, async (req, res, next) => {
    try {
      const { name, email, password, role, department } = parseBody(createUserSchema, req.body);
      const normalizedEmail = normalizeEmail(email);

      // Check if user already exists
      const existingUser = await prisma.profile.findUnique({ where: { email: normalizedEmail } });
      if (existingUser) {
        return res.status(400).json({ error: "Email already in use" });
      }

      const user = await prisma.profile.create({
        data: {
          name,
          email: normalizedEmail,
          role: allowedRoles.has(role) ? role : "staff",
          status: "active",
          department,
          passwordHash: await hashPassword(password),
        },
      });
      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/users/:id", authenticate, isAdmin, async (req, res, next) => {
    try {
      const { name, email, role, department } = parseBody(updateUserSchema, req.body);
      const exists = await prisma.profile.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "User not found" });

      const normalizedEmail = normalizeEmail(email);

      const duplicate = await prisma.profile.findFirst({
        where: {
          email: normalizedEmail,
          NOT: { id: req.params.id },
        },
      });
      if (duplicate) {
        return res.status(400).json({ error: "Email already in use" });
      }

      const user = await prisma.profile.update({
        where: { id: req.params.id },
        data: {
          name,
          email: normalizedEmail,
          role: role && allowedRoles.has(role) ? role : exists.role,
          ...((role && role !== "manager") ? { canInviteStaff: false } : {}),
          department,
        },
      });
      await writeAuditLog((req as any).user, "user.updated", {
        targetUserId: req.params.id,
        name,
        email,
        role,
        department,
      });
      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/users/:id/role", authenticate, isAdmin, async (req, res, next) => {
    try {
      const { role } = parseBody(updateUserRoleSchema, req.body);
      const exists = await prisma.profile.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "User not found" });

      const user = await prisma.profile.update({
        where: { id: req.params.id },
        data: {
          role,
          ...(role !== "manager" ? { canInviteStaff: false } : {}),
        },
      });
      await writeAuditLog((req as any).user, "user.role_changed", {
        targetUserId: req.params.id,
        role,
      });
      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/users/:id/manager-user-permission", authenticate, isAdmin, async (req, res, next) => {
    try {
      const { canInviteStaff } = parseBody(updateManagerUserPermissionSchema, req.body);
      const exists = await prisma.profile.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "User not found" });
      if (exists.role !== "manager") {
        return res.status(400).json({ error: "Only managers can receive permission to invite staff." });
      }

      const user = await prisma.profile.update({
        where: { id: req.params.id },
        data: { canInviteStaff },
      });

      await writeAuditLog((req as any).user, "user.manager_staff_invite_permission_changed", {
        targetUserId: req.params.id,
        canInviteStaff,
      });

      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/users/:id/password", authenticate, isAdmin, async (req, res, next) => {
    try {
      const { password } = parseBody(updateUserPasswordSchema, req.body);
      const exists = await prisma.profile.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "User not found" });

      await prisma.profile.update({
        where: { id: req.params.id },
        data: {
          passwordHash: await hashPassword(password),
        },
      });

      await writeAuditLog((req as any).user, "user.password_reset", {
        targetUserId: req.params.id,
      });
      res.json({ message: "Password reset successfully" });
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/users/:id", authenticate, isAdmin, async (req, res, next) => {
    try {
      const { id } = req.params;
      // Prevent deleting self
      if (id === (req as any).user.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      
      const exists = await prisma.profile.findUnique({ where: { id: id } });
      if (!exists) return res.status(404).json({ error: "User not found" });

      const [assignedOpenTickets, requestedOpenTickets, activeMaintenance] = await Promise.all([
        prisma.ticket.count({ where: { assignedTo: id, status: { notIn: ["pending-confirmation", "closed", "resolved"] } } }),
        prisma.ticket.count({ where: { userId: id, status: { notIn: ["pending-confirmation", "closed", "resolved"] } } }),
        prisma.maintenance.count({ where: { technicianId: id, status: { not: "completed" } } }),
      ]);

      if (assignedOpenTickets > 0 || requestedOpenTickets > 0 || activeMaintenance > 0) {
        return res.status(400).json({ error: "Cannot delete a user with active tickets or maintenance assignments" });
      }

      await prisma.profile.delete({ where: { id } });
      await writeAuditLog((req as any).user, "user.deleted", {
        targetUserId: id,
        targetEmail: exists.email,
      });
      res.json({ message: "User deleted successfully" });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/technicians", authenticate, isTechnician, async (req, res, next) => {
    try {
      const techs = await prisma.profile.findMany({
        where: { role: "technician" },
        select: { id: true, name: true },
      });
      res.json(techs);
    } catch (err) {
      next(err);
    }
  });

  // Comments
  app.get("/api/tickets/:id/comments", authenticate, async (req: any, res, next) => {
    try {
      const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      const isOwner = ticket.userId === req.user.id;
      const isAssigned = ticket.assignedTo === req.user.id;
      const isPrivileged = isManagerRole(req.user.role);

      if (req.user.role === "technician" && !isAssigned) {
        return res.status(403).json({ error: "Technicians can only view comments for assigned tickets" });
      }

      if (!isPrivileged && !isAssigned && !isOwner) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const comments = await prisma.comment.findMany({
        where: {
          ticketId: req.params.id,
          ...(isManagerRole(req.user.role) || req.user.role === "technician" ? {} : { isInternal: false }),
        },
        include: { user: { select: { name: true } }, attachments: true },
        orderBy: { createdAt: "asc" },
      });
      res.json(comments);
    } catch (err) {
      next(err);
    }
  });

  // History
  app.get("/api/tickets/:id/history", authenticate, async (req: any, res, next) => {
    try {
      const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      const isOwner = ticket.userId === req.user.id;
      const isAssigned = ticket.assignedTo === req.user.id;
      const isPrivileged = isManagerRole(req.user.role);

      if (req.user.role === "technician" && !isAssigned) {
        return res.status(403).json({ error: "Technicians can only view history for assigned tickets" });
      }

      if (!isPrivileged && !isAssigned && !isOwner) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const history = await prisma.ticketHistory.findMany({
        where: { ticketId: req.params.id },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      res.json(history);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/tickets/:id/comments", authenticate, async (req: any, res, next) => {
    try {
      const { message, attachments, isInternal } = parseBody(commentSchema, req.body);

      const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      const isOwner = ticket.userId === req.user.id;
      const isAssigned = ticket.assignedTo === req.user.id;
      const isPrivileged = isManagerRole(req.user.role);

      if (req.user.role === "technician" && !isAssigned) {
        return res.status(403).json({ error: "Technicians can only comment on assigned tickets" });
      }

      if (!isPrivileged && !isAssigned && !isOwner) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (isInternal && !isTechnicianRole(req.user.role)) {
        return res.status(403).json({ error: "Only technicians and managers can create internal notes" });
      }

      const comment = await prisma.comment.create({
        data: { 
          message, 
          ticketId: req.params.id, 
          userId: req.user.id,
          isInternal: Boolean(isInternal),
          attachments: attachments ? {
            create: attachments.map((a: any) => ({ name: a.name, url: a.url, type: a.type }))
          } : undefined
        },
      });
      await logTicketHistory(
        req.params.id,
        req.user.id,
        Boolean(isInternal) ? "Internal Note Added" : "Comment Added",
        message?.slice(0, 120),
      );
      res.json(comment);
    } catch (err) {
      next(err);
    }
  });

  // Stats (Enhanced for Reporting)
  app.get("/api/stats", authenticate, async (req: any, res, next) => {
    try {
      let where: any = {};
      if (req.user.role === "staff") {
        where = { userId: req.user.id };
      } else if (req.user.role === "technician") {
        where = { assignedTo: req.user.id };
      }

      const total = await prisma.ticket.count({ where });
      const open = await prisma.ticket.count({ where: { ...where, status: "open" } });
      const completedStatuses = ["resolved", "closed"];
      const resolved = await prisma.ticket.count({ where: { ...where, status: "resolved" } });
      const closed = await prisma.ticket.count({ where: { ...where, status: "closed" } });
      const pendingConfirmation = await prisma.ticket.count({ where: { ...where, status: "pending-confirmation" } });
      const completed = resolved + closed;
      const pending = await prisma.ticket.count({ where: { ...where, status: "in-progress" } });
      
      // Manual grouping for stats
      const allTickets = await prisma.ticket.findMany({ where, select: { category: true, priority: true, status: true } });
      
      const categoryCounts: Record<string, number> = {};
      const priorityCounts: Record<string, number> = {};
      const statusCounts: Record<string, number> = {};
      
      allTickets.forEach(t => {
        categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
        priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1;
        statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
      });
      
      const byCategory = Object.entries(categoryCounts).map(([category, count]) => ({ category, _count: { id: count } }));
      const byPriority = Object.entries(priorityCounts).map(([priority, count]) => ({ priority, _count: { id: count } }));
      const byStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, _count: { id: count } }));

      // Volume over time (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const tickets = await prisma.ticket.findMany({
        where: { ...where, createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true }
      });

      const volumeOverTime = Array.from({ length: 7 }).map((_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = tickets.filter(t => t.createdAt.toISOString().split('T')[0] === dateStr).length;
        return { date: dateStr, count };
      }).reverse();

      const delayedTickets = await prisma.ticket.count({ where: { ...where, isDelayed: true } });
      const delayedMaintenance = await prisma.maintenance.count({ 
        where: { 
          isDelayed: true,
          ...(req.user.role === "technician" ? { technicianId: req.user.id } : {})
        } 
      });
      const activeSlaWhere = {
        ...where,
        status: { notIn: ["pending-confirmation", "resolved", "closed"] },
      };
      const slaAtRisk = await prisma.ticket.count({ where: { ...activeSlaWhere, slaStatus: "at-risk" } });
      const slaBreached = await prisma.ticket.count({ where: { ...activeSlaWhere, slaStatus: "breached" } });
      const openApprovals = isManagerRole(req.user.role)
        ? await prisma.approvalRequest.count({ where: { status: "pending" } })
        : 0;
      const assetHealth = isManagerRole(req.user.role)
        ? {
            active: await prisma.asset.count({ where: { status: "active" } }),
            maintenance: await prisma.asset.count({ where: { status: "maintenance" } }),
            retired: await prisma.asset.count({ where: { status: "retired" } }),
          }
        : null;
      const slaResolvedOnTimeBase = await prisma.ticket.findMany({
        where: {
          ...where,
          status: { in: ["resolved", "closed"] },
          dueDate: { not: null },
          resolvedAt: { not: null },
        },
        select: { dueDate: true, resolvedAt: true },
      });
      const slaResolvedOnTime = slaResolvedOnTimeBase.filter((ticket) => {
        const dueDate = ticket.dueDate ? new Date(ticket.dueDate) : null;
        const resolvedAt = ticket.resolvedAt ? new Date(ticket.resolvedAt) : null;
        return dueDate && resolvedAt && resolvedAt <= dueDate;
      }).length;
      const slaPerformance = slaResolvedOnTimeBase.length > 0
        ? Math.round((slaResolvedOnTime / slaResolvedOnTimeBase.length) * 100)
        : 100;
      const feedbackWhere = { ticket: where };
      const feedbackSummary = await prisma.feedback.aggregate({
        where: feedbackWhere,
        _avg: { rating: true },
        _count: { id: true },
      });
      const feedbackItems = await prisma.feedback.findMany({
        where: feedbackWhere,
        include: {
          ticket: {
            select: {
              id: true,
              title: true,
              assignedTo: true,
              user: { select: { name: true } },
              technician: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      });
      const feedbackDistribution = await Promise.all([1, 2, 3, 4, 5].map(async (rating) => ({
        rating,
        count: await prisma.feedback.count({ where: { ...feedbackWhere, rating } }),
      })));
      const lowFeedbackCount = await prisma.feedback.count({
        where: { ...feedbackWhere, rating: { lte: 2 } },
      });

      // Technician specific report (for managers)
      let technicianStats = null;
      if (isManagerRole(req.user.role)) {
        const technicians = await prisma.profile.findMany({
          where: { role: "technician" },
          select: {
            id: true,
            name: true,
            assigned: {
              select: {
                status: true,
                isDelayed: true,
                feedback: { select: { rating: true } },
              }
            }
          }
        });

        technicianStats = technicians.map(tech => {
          const ratings = tech.assigned.map((ticket) => ticket.feedback?.rating).filter((rating): rating is number => typeof rating === "number");
          return {
            id: tech.id,
            name: tech.name,
            total: tech.assigned.length,
            resolved: tech.assigned.filter(t => t.status === "resolved").length,
            closed: tech.assigned.filter(t => t.status === "closed").length,
            completed: tech.assigned.filter(t => completedStatuses.includes(t.status)).length,
            delayed: tech.assigned.filter(t => t.isDelayed).length,
            feedbackCount: ratings.length,
            averageRating: ratings.length ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1)) : null,
          };
        });
      }

      res.json({ 
        total, 
        open, 
        resolved, 
        closed,
        pendingConfirmation,
        completed,
        pending, 
        byCategory, 
        byPriority, 
        byStatus, 
        volumeOverTime,
        delayedTickets,
        delayedMaintenance,
        technicianStats,
        slaAtRisk,
        slaBreached,
        slaPerformance,
        openApprovals,
        assetHealth,
        feedback: {
          averageRating: feedbackSummary._avg.rating ? Number(feedbackSummary._avg.rating.toFixed(1)) : null,
          total: feedbackSummary._count.id,
          lowCount: lowFeedbackCount,
          distribution: feedbackDistribution,
          recent: feedbackItems.map((feedback) => ({
            id: feedback.id,
            ticketId: feedback.ticketId,
            ticketTitle: feedback.ticket.title,
            rating: feedback.rating,
            comment: feedback.comment,
            createdAt: feedback.createdAt,
            requesterName: feedback.ticket.user?.name,
            technicianName: feedback.ticket.technician?.name,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // Knowledge Base
  app.get("/api/kb", async (req, res, next) => {
    try {
      const kb = await prisma.knowledgeBase.findMany();
      res.json(kb);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/users/:id/status", authenticate, isAdmin, async (req, res, next) => {
    try {
      const { status } = parseBody(updateUserStatusSchema, req.body);
      const exists = await prisma.profile.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "User not found" });

      const user = await prisma.profile.update({
        where: { id: req.params.id },
        data: { status },
      });

      await writeAuditLog((req as any).user, "user.status_changed", {
        targetUserId: req.params.id,
        status,
      });

      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  // --- Frontend Integration ---
  // 404 handler for API routes (placed before Next handler)
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
  });

  // Global error handler for API routes (placed after all routes)
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`Global Error [Prisma ${err.code}]:`, err.message);
      console.error("Meta:", err.meta);
    } else {
      console.error("Global Error:", err);
    }
    
    // If headers already sent, delegate to default express error handler
    if (res.headersSent) {
      return next(err);
    }

    const status = err.status || 500;
    const message = err.message || "Internal Server Error";
    const code = err.code || "UNKNOWN_ERROR";

    // Always return JSON for API routes
    if (req.path.startsWith("/api")) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        // Handle known Prisma errors
        if (err.code === 'P2002') {
          const target = (err.meta?.target as string[]) || [];
          if (target.includes('email')) {
            return res.status(400).json({ error: "Email already in use" });
          }
          return res.status(400).json({ error: `Unique constraint failed on ${target.join(', ')}` });
        }
        if (err.code === 'P2003') {
          return res.status(400).json({ error: "Foreign key constraint failed. Related record not found." });
        }
        if (err.code === 'P2025') {
          return res.status(404).json({ error: "Record not found." });
        }
        if (err.code === 'P2021' || err.code === 'P2022') {
          return res.status(500).json({
            error: "Database schema is missing or out of date. Run the backend Prisma db push step against the deployed database.",
            code: "DATABASE_SCHEMA_MISSING",
          });
        }
        if (err.code === 'P1001') {
          return res.status(500).json({
            error: "The database server is unreachable. Check the deployed DATABASE_URL host and network access.",
            code: "DATABASE_UNREACHABLE",
          });
        }
      } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
        // Handle unknown Prisma errors (like database corruption)
        console.error("Prisma Unknown Request Error:", err.message);
        return res.status(500).json({ 
          error: "A database error occurred. Please try again later.",
          code: "DATABASE_UNKNOWN_ERROR"
        });
      } else if (err instanceof Prisma.PrismaClientInitializationError) {
        // Handle Prisma initialization errors (like connection issues)
        console.error("Prisma Initialization Error:", err.message);
        let errorMessage = "Failed to connect to the database.";
        let errorCode = "DATABASE_CONNECTION_ERROR";

        if (err.message.includes("Environment variable not found: DATABASE_URL")) {
          errorMessage = "The DATABASE_URL environment variable is missing. Please set it in the AI Studio Secrets panel.";
          errorCode = "DATABASE_URL_MISSING";
        } else if (err.message.includes("Can't reach database server at `localhost:5432`")) {
          errorMessage = "The database URL is still set to 'localhost:5432'. Please provide a real PostgreSQL connection string in the AI Studio Secrets panel.";
          errorCode = "DATABASE_URL_DEFAULT_VALUE";
        } else if (err.message.includes("Can't reach database server")) {
          errorMessage = "The database server is unreachable. Please check your host and port.";
          errorCode = "DATABASE_UNREACHABLE";
        } else if (err.message.includes("Authentication failed")) {
          errorMessage = "Database authentication failed. Please check your username and password.";
          errorCode = "DATABASE_AUTH_FAILED";
        }

        return res.status(500).json({ 
          error: errorMessage,
          code: errorCode
        });
      } else if (err instanceof Prisma.PrismaClientValidationError) {
        // Handle Prisma validation errors (like invalid data types)
        console.error("Prisma Validation Error:", err.message);
        return res.status(400).json({ 
          error: "Invalid data provided to the database.",
          code: "DATABASE_VALIDATION_ERROR"
        });
      }
      return res.status(status).json({ 
        error: message,
        code: code
      });
    }

    res.status(status).json({
      error: message,
      code,
    });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startTelegramLinkPolling();
  });
}

startServer();
