import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { appendFile, mkdir } from "fs/promises";
import cors from "cors";
import cookieParser from "cookie-parser";
import { PrismaClient, Prisma } from "@prisma/client";
import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL environment variable is not set. Database connection will fail.");
  console.log("Set DATABASE_URL to your PostgreSQL connection string before starting the server.");
} else if (process.env.DATABASE_URL.includes("localhost:5432")) {
  console.warn("WARNING: DATABASE_URL is set to 'localhost:5432'. This will fail in the AI Studio environment. Please provide a real PostgreSQL connection string.");
}

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "ict-support-secret-key-123";
const isAdminRole = (role?: string) => role === "admin";
const isManagerRole = (role?: string) => role === "manager" || role === "admin";
const isTechnicianRole = (role?: string) => role === "technician" || isManagerRole(role);
const isStaffRole = (role?: string) => role === "staff" || isTechnicianRole(role);

const allowedRoles = new Set(["staff", "technician", "manager", "admin"]);
const PASSWORD_MIN_LENGTH = 6;
const JWT_COOKIE_NAME = "token";
const isProduction = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? "none" : "lax") as const,
};

type AuthTokenPayload = {
  sub: string;
  email: string;
  role: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidPassword(password?: string) {
  return typeof password === "string" && password.length >= PASSWORD_MIN_LENGTH;
}

function signAuthToken(profile: { id: string; email: string; role: string }) {
  return jwt.sign(
    {
      sub: profile.id,
      email: profile.email,
      role: profile.role,
    } satisfies AuthTokenPayload,
    JWT_SECRET,
    { expiresIn: "30d" },
  );
}

function verifyAuthToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}

async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
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

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const PORT = 3000;

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("join", (userId) => {
      socket.join(userId);
      console.log(`User ${userId} joined their notification room`);
    });
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(cookieParser());

  // --- Auth Middleware ---
  const authenticate = async (req: any, res: any, next: any) => {
    const token = req.cookies[JWT_COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const payload = verifyAuthToken(token);
      const profile = await prisma.profile.findUnique({ where: { id: payload.sub } });
      if (!profile) return res.status(401).json({ error: "Profile not found" });

      req.user = {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        name: profile.name,
        department: profile.department,
        createdAt: profile.createdAt,
      };
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (!isAdminRole(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };

  const isManager = (req: any, res: any, next: any) => {
    if (!isManagerRole(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };

  const isTechnician = (req: any, res: any, next: any) => {
    if (!isTechnicianRole(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };

  const isStaff = (req: any, res: any, next: any) => {
    if (!isStaffRole(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };

  // --- Helper: Create Notification ---
  const createNotification = async (userId: string, title: string, message: string, link?: string) => {
    try {
      const notification = await prisma.notification.create({
        data: { userId, title, message, link }
      });
      // Emit real-time notification
      io.to(userId).emit("notification", notification);
      // Also emit to managers for certain types if needed, but for now just the user
    } catch (err) {
      console.error("Failed to create notification:", err);
    }
  };

  // --- Helper: Update SLA Statuses ---
  const updateSLAStatuses = async () => {
    try {
      const now = new Date();
      const openTickets = await prisma.ticket.findMany({
        where: {
          status: { notIn: ["closed", "resolved"] },
          dueDate: { not: null }
        }
      });

      for (const ticket of openTickets as any[]) {
        if (!ticket.dueDate) continue;
        const dueDate = new Date(ticket.dueDate);
        let newStatus = ticket.slaStatus;

        if (now > dueDate) {
          newStatus = "breached";
        } else {
          const hoursRemaining = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
          if (hoursRemaining < 2) {
            newStatus = "at-risk";
          } else {
            newStatus = "on-track";
          }
        }

        if (newStatus !== ticket.slaStatus) {
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: { slaStatus: newStatus }
          });
        }
      }
    } catch (err) {
      console.error("Failed to update SLA statuses:", err);
    }
  };

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
  
  // Health Check
  app.get("/api/health", async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ 
        status: "ok", 
        database: "connected", 
        provider: "postgresql"
      });
    } catch (err) {
      res.status(500).json({ status: "error", database: "disconnected", message: "Database connection failed" });
    }
  });

  // Auth
  app.post("/api/auth/register", async (req, res, next) => {
    const { name, email, password, department } = req.body;
    try {
      const normalizedEmail = normalizeEmail(email || "");
      if (!name || !normalizedEmail || !department) {
        return res.status(400).json({ error: "Name, email, and department are required." });
      }
      if (!isValidPassword(password)) {
        return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
      }

      const existingProfile = await prisma.profile.findUnique({ where: { email: normalizedEmail } });
      if (existingProfile) {
        return res.status(400).json({ error: "A user with this email already exists." });
      }

      const existingUserCount = await prisma.profile.count();
      const role = normalizedEmail === "kalebteshome94@gmail.com" || existingUserCount === 0 ? "admin" : "staff";
      const profile = await prisma.profile.create({
        data: {
          name,
          email: normalizedEmail,
          department,
          role,
          passwordHash: await hashPassword(password),
        },
      });

      res.json({
        message: "Registration successful. Please login.",
        user: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          department: profile.department,
          createdAt: profile.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    const { email, password, rememberMe } = req.body;
    try {
      const normalizedEmail = normalizeEmail(email || "");
      const profile = await prisma.profile.findUnique({ where: { email: normalizedEmail } });
      if (!profile?.passwordHash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const passwordMatches = await bcrypt.compare(password || "", profile.passwordHash);
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
        department: profile.department,
        createdAt: profile.createdAt,
      });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Create Technician or Manager
  app.post(["/api/admin/create-user", "/api/auth/admin/create-user"], authenticate, isAdmin, async (req, res, next) => {
    const { email, name, role, department, password } = req.body;
    
    if (!["technician", "manager"].includes(role)) {
      return res.status(400).json({ error: "Invalid role for manager creation" });
    }

    try {
      const normalizedEmail = normalizeEmail(email || "");
      if (!name || !normalizedEmail || !department) {
        return res.status(400).json({ error: "Name, email, and department are required." });
      }
      if (!isValidPassword(password)) {
        return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
      }

      const existingProfile = await prisma.profile.findUnique({ where: { email: normalizedEmail } });
      if (existingProfile) {
        return res.status(400).json({ error: "A user with this email already exists." });
      }

      const profile = await prisma.profile.create({
        data: {
          name,
          email: normalizedEmail,
          role,
          department,
          passwordHash: await hashPassword(password),
        },
      });

      await writeAuditLog((req as any).user, "user.invited", {
        email: normalizedEmail,
        name,
        role,
        department,
      });

      res.json({
        message: "User created successfully.",
        user: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          department: profile.department,
          createdAt: profile.createdAt,
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

  // Tickets
  app.get("/api/tickets", authenticate, async (req: any, res, next) => {
    try {
      let where: any = {};
      if (req.user.role === "staff") {
        where = { userId: req.user.id };
      } else if (req.user.role === "technician") {
        where = { assignedTo: req.user.id };
      }
      
      const tickets = await prisma.ticket.findMany({
        where,
        include: { 
          user: { select: { name: true } }, 
          technician: { select: { name: true } },
          asset: true,
          attachments: true,
          feedback: true
        },
        orderBy: { createdAt: "desc" },
      });
      res.json(tickets);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/tickets/all", authenticate, isStaff, async (req: any, res, next) => {
    try {
      await updateSLAStatuses();
      let where: any = {};
      if (req.user.role === "technician") {
        where = { assignedTo: req.user.id };
      }

      const tickets = await prisma.ticket.findMany({
        where,
        include: { 
          user: { select: { name: true } }, 
          technician: { select: { name: true } },
          asset: true,
          attachments: true,
          feedback: true
        },
        orderBy: { createdAt: "desc" },
      });
      res.json(tickets);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/tickets/:id", authenticate, async (req: any, res, next) => {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: req.params.id },
        include: {
          user: { select: { name: true, email: true } },
          technician: { select: { name: true, email: true } },
          asset: true,
          attachments: true,
          feedback: true,
          assetUsages: {
            include: { asset: true, user: { select: { name: true } } },
            orderBy: { createdAt: "desc" }
          },
          history: {
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: "desc" }
          }
        }
      });
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      // Authorization Check
      const isStaff = isStaffRole(req.user.role);
      const isOwner = ticket.userId === req.user.id;
      const isAssigned = ticket.assignedTo === req.user.id;

      if (req.user.role === "technician" && !isAssigned) {
        return res.status(403).json({ error: "Technicians can only view assigned tickets" });
      }

      if (!isStaff && !isOwner) {
        return res.status(403).json({ error: "Forbidden" });
      }

      res.json(ticket);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/tickets", authenticate, async (req: any, res, next) => {
    try {
      const { title, description, category, priority, assetId, attachments } = req.body;
      
      // SLA Logic: Set due date based on priority
      const dueDate = new Date();
      if (priority === "critical") dueDate.setHours(dueDate.getHours() + 4);
      else if (priority === "high") dueDate.setDate(dueDate.getDate() + 1);
      else if (priority === "medium") dueDate.setDate(dueDate.getDate() + 3);
      else dueDate.setDate(dueDate.getDate() + 7);

      const ticket = await prisma.ticket.create({
        data: { 
          title, 
          description, 
          category, 
          priority, 
          userId: req.user.id,
          assetId: assetId || null,
          dueDate,
          slaStatus: "on-track",
          attachments: attachments ? {
            create: attachments.map((a: any) => ({ name: a.name, url: a.url, type: a.type }))
          } : undefined
        },
      });

      // Log History
      await logTicketHistory(ticket.id, req.user.id, "Created", `Ticket created with priority: ${priority}`);

      // Notify Managers
      const managers = await prisma.profile.findMany({ where: { role: { in: ["manager", "admin"] } } });
      for (const manager of managers) {
        await createNotification(manager.id, "New Ticket", `${req.user.name} created a new ticket: ${title}`, `/tickets/${ticket.id}`);
      }

      res.json(ticket);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/tickets/:id", authenticate, isStaff, async (req: any, res, next) => {
    try {
      const { status, assignedTo, priority } = req.body;
      const oldTicket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      
      if (!oldTicket) return res.status(404).json({ error: "Ticket not found" });

      // Technician can only update assigned tickets
      if (req.user.role === "technician" && oldTicket.assignedTo !== req.user.id) {
        return res.status(403).json({ error: "Technicians can only update assigned tickets" });
      }

      // Only manager can assign
      if (assignedTo !== undefined && assignedTo !== oldTicket.assignedTo) {
        if (!isManagerRole(req.user.role)) {
          return res.status(403).json({ error: "Only managers can assign technicians" });
        }
      }

      // Role-based status transition checks
      if (status && status !== oldTicket.status) {
        if (req.user.role === "technician" && !["in-progress", "resolved"].includes(status)) {
          return res.status(403).json({ error: "Technicians can only set status to in-progress or resolved" });
        }
        if (isManagerRole(req.user.role) && status !== "resolved") {
          return res.status(403).json({ error: "Managers can only approve (resolve) tickets" });
        }
        if (isManagerRole(req.user.role) && !["closed", "open"].includes(status)) {
          // Managers can close or reopen
        }
      }

      const ticket = await prisma.ticket.update({
        where: { id: req.params.id },
        data: { 
          status: status || undefined, 
          assignedTo: assignedTo === undefined ? undefined : (assignedTo || null), 
          priority: priority || undefined 
        },
      });

      // Notify User on Status Change
      if (status && status !== oldTicket?.status) {
        await createNotification(ticket.userId, "Ticket Updated", `Your ticket "${ticket.title}" is now ${status}`, `/tickets/${ticket.id}`);
        await logTicketHistory(ticket.id, req.user.id, "Status Changed", `From ${oldTicket?.status} to ${status}`);
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

      res.json(ticket);
    } catch (err) {
      next(err);
    }
  });

  // Manager specific actions
  app.put("/api/tickets/:id/assign", authenticate, isManager, async (req: any, res, next) => {
    try {
      const { assignedTo } = req.body;
      const exists = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "Ticket not found" });

      if (!exists.isApproved) {
        return res.status(400).json({ error: "Ticket must be approved before assignment" });
      }

      // If assigning to someone, verify they are a technician
      if (assignedTo) {
        const tech = await prisma.profile.findUnique({ where: { id: assignedTo } });
        if (!tech || tech.role !== "technician") {
          return res.status(400).json({ error: "Invalid technician ID" });
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
      const { approved } = req.body;
      const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (req.user.role !== "staff") return res.status(403).json({ error: "Forbidden" });
      if (ticket.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });
      if (ticket.status !== "resolved") {
        return res.status(400).json({ error: "Only resolved tickets can be reviewed" });
      }

      const updatedTicket = await prisma.ticket.update({
        where: { id: req.params.id },
        data: approved
          ? { status: "closed", isApproved: true }
          : { status: "open", isApproved: false, isDelayed: false, delayReason: null },
      });

      if (approved) {
        await logTicketHistory(ticket.id, req.user.id, "Resolved and Approved", "Confirmed as solved by requester");
        if (ticket.assignedTo) {
          await createNotification(ticket.assignedTo, "Ticket Confirmed Solved", `The requester confirmed ticket "${ticket.title}" is solved.`, `/tickets/${ticket.id}`);
        }
      } else {
        await logTicketHistory(ticket.id, req.user.id, "Status Changed", "Reopened by requester because issue is not solved");
        if (ticket.assignedTo) {
          await createNotification(ticket.assignedTo, "Ticket Reopened", `The requester reported that ticket "${ticket.title}" is not solved yet.`, `/tickets/${ticket.id}`);
        }
      }

      res.json(updatedTicket);
    } catch (err) {
      next(err);
    }
  });

  // Feedback
  app.post("/api/tickets/:id/feedback", authenticate, async (req: any, res, next) => {
    try {
      const { rating, comment } = req.body;
      
      const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (ticket.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

      const feedback = await prisma.feedback.create({
        data: { rating, comment, ticketId: req.params.id }
      });
      res.json(feedback);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/tickets/:id", authenticate, isManager, async (req: any, res, next) => {
    try {
      const exists = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "Ticket not found" });

      await prisma.ticket.delete({
        where: { id: req.params.id }
      });
      res.json({ message: "Ticket deleted successfully" });
    } catch (err) {
      next(err);
    }
  });

  // --- Helper: Seed Asset Types ---
  const seedAssetTypes = async () => {
    try {
      console.log("Checking database connection and seeding asset types...");
      const count = await prisma.assetType.count();
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

  app.post("/api/asset-types", authenticate, isStaff, async (req, res, next) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: "Name is required" });
      
      const existing = await prisma.assetType.findUnique({ where: { name } });
      if (existing) return res.status(400).json({ error: "Asset type already exists" });

      const type = await prisma.assetType.create({ data: { name } });
      res.json(type);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/asset-types/:id", authenticate, isStaff, async (req, res, next) => {
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

  app.post("/api/assets", authenticate, isStaff, async (req, res, next) => {
    try {
      const { name, brand, type, typeId, serialNo, quantity, status, minStockLevel, isConsumable } = req.body;
      const normalizedQuantity = Math.max(1, parseInt(quantity?.toString() || "1"));
      const normalizedIsConsumable = Boolean(isConsumable);
      const normalizedMinStockLevel = Math.max(0, parseInt(minStockLevel?.toString() || "0"));
      
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
          },
          include: { assetType: true, catalog: true },
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
            },
            include: { assetType: true, catalog: true },
          }),
        ),
      );

      res.json(createdAssets[0]);
    } catch (err) {
      next(err);
    }
  });

  // Asset Usage
  app.post("/api/tickets/:id/usage", authenticate, isStaff, async (req: any, res, next) => {
    try {
      const { assetId, quantity } = req.body;
      const ticketId = req.params.id;

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

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

  app.post("/api/assets/:id/maintenance", authenticate, isStaff, async (req, res, next) => {
    try {
      const { type, scheduledDate, description } = req.body;
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
      const assetName = asset.name;

      const maintenance = await prisma.maintenance.create({
        data: {
          assetId: req.params.id,
          title: `Maintenance for ${assetName}`, // Better title
          type,
          startTime: new Date(scheduledDate),
          endTime: new Date(new Date(scheduledDate).getTime() + 3600000), // Default 1 hour
          description,
          status: "scheduled"
        }
      });
      res.json(maintenance);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/assets/maintenance/:id", authenticate, isStaff, async (req, res, next) => {
    try {
      const { status } = req.body;
      const exists = await prisma.maintenance.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "Maintenance record not found" });
      if (status === "completed" && !exists.technicianId) {
        return res.status(400).json({ error: "Assign a technician before completing maintenance" });
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
      const { quantity } = req.body;
      
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

      const requestedQty = parseInt(quantity?.toString() || "1");
      if (requestedQty <= 0) return res.status(400).json({ error: "Invalid quantity" });
      if (!asset.isConsumable && requestedQty !== 1) {
        return res.status(400).json({ error: "Individual devices can only be requested one at a time" });
      }
      if (asset.isConsumable && requestedQty > asset.quantity) return res.status(400).json({ error: "Requested quantity exceeds available stock" });
      if (!asset.isConsumable && asset.status !== "active") {
        return res.status(400).json({ error: "This device is not available for requests" });
      }

      const [request] = await prisma.$transaction([
        prisma.assetRequest.create({
          data: {
            assetId,
            userId,
            quantity: requestedQty,
            status: "pending"
          }
        }),
        prisma.asset.update({
          where: { id: assetId },
          data: asset.isConsumable
            ? { status: requestedQty === asset.quantity ? "requested" : asset.status }
            : { status: "requested" }
        })
      ]);

      // Notify managers
      const managers = await prisma.profile.findMany({
        where: { role: { in: ["manager", "admin"] } },
        select: { id: true }
      });
      for (const manager of managers) {
        await createNotification(manager.id, "New Asset Request", `${req.user.name} requested ${requestedQty}x ${asset.name}.`, `/assets`);
      }

      res.json(request);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/assets/requests/:id/fulfill", authenticate, isStaff, async (req, res, next) => {
    try {
      const requestId = req.params.id;
      const request = await prisma.assetRequest.findUnique({ 
        where: { id: requestId },
        include: { asset: true, user: true }
      });
      if (!request) return res.status(404).json({ error: "Request not found" });
      if (request.status === "fulfilled") return res.status(400).json({ error: "Request already fulfilled" });
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
  app.put("/api/assets/:id", authenticate, isStaff, async (req, res, next) => {
    try {
      const { name, brand, type, typeId, serialNo, quantity, status, minStockLevel, isConsumable } = req.body;
      const assetId = req.params.id;

      const oldAsset = await prisma.asset.findUnique({ where: { id: assetId } });
      if (!oldAsset) return res.status(404).json({ error: "Asset not found" });

      const normalizedIsConsumable = Boolean(isConsumable);
      const normalizedMinStockLevel = Math.max(0, parseInt(minStockLevel?.toString() || oldAsset.minStockLevel.toString() || "0"));
      const normalizedQuantity = normalizedIsConsumable
        ? Math.max(0, parseInt(quantity?.toString() || oldAsset.quantity.toString()))
        : 1;

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
          await prisma.notification.create({
            data: {
              userId: request.userId,
              title: "Asset Restocked",
              message: `The asset "${asset.name}" you requested is now back in stock (Qty: ${quantity}).`,
              link: "/assets"
            }
          });
          
          await prisma.assetRequest.updateMany({
            where: { id: request.id },
            data: { status: "fulfilled" }
          });
        }
      }

      res.json(updatedAsset);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/assets/:id", authenticate, isStaff, async (req, res, next) => {
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
  app.put("/api/assets/maintenance/:id/delay", authenticate, isStaff, async (req, res, next) => {
    try {
      const { delayReason } = req.body;
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

  app.put("/api/tickets/:id/delay", authenticate, isStaff, async (req, res, next) => {
    try {
      const { delayReason } = req.body;
      const exists = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "Ticket not found" });

      const ticket = await prisma.ticket.update({
        where: { id: req.params.id },
        data: { isDelayed: true, delayReason }
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
      res.json(notifications);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/notifications/:id/read", authenticate, async (req: any, res, next) => {
    try {
      const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
      if (!notification) return res.status(404).json({ error: "Notification not found" });
      if (notification.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

      await prisma.notification.update({
        where: { id: req.params.id },
        data: { isRead: true }
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Maintenance
  app.get("/api/maintenance", authenticate, async (req: any, res, next) => {
    try {
      let where: any = {};
      if (req.user.role === "technician") {
        where = { technicianId: req.user.id };
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

  app.post("/api/maintenance", authenticate, isStaff, async (req, res, next) => {
    try {
      const { title, description, startTime, endTime, type, technicianId, assetId } = req.body;
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

  app.put("/api/maintenance/:id/status", authenticate, isStaff, async (req, res, next) => {
    try {
      const { status } = req.body;
      const exists = await prisma.maintenance.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "Maintenance not found" });
      if (status === "completed" && !exists.technicianId) {
        return res.status(400).json({ error: "Assign a technician before completing maintenance" });
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
      const { technicianId } = req.body;
      const exists = await prisma.maintenance.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "Maintenance not found" });

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

  // Users Management (Admin Only)
  app.get("/api/users", authenticate, isAdmin, async (req, res, next) => {
    try {
      const users = await prisma.profile.findMany({
        select: { id: true, name: true, email: true, role: true, department: true },
      });
      res.json(users);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/users", authenticate, isAdmin, async (req, res, next) => {
    const { name, email, password, role, department } = req.body;
    try {
      const normalizedEmail = normalizeEmail(email || "");
      if (!name || !normalizedEmail) {
        return res.status(400).json({ error: "Name and email are required" });
      }
      if (!isValidPassword(password)) {
        return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
      }

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
    const { name, email, role, department } = req.body;
    try {
      const exists = await prisma.profile.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "User not found" });

      const normalizedEmail = normalizeEmail(email || "");
      if (!name || !normalizedEmail) {
        return res.status(400).json({ error: "Name and email are required" });
      }

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
    const { role } = req.body;
    try {
      const exists = await prisma.profile.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "User not found" });
      if (!allowedRoles.has(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const user = await prisma.profile.update({
        where: { id: req.params.id },
        data: { role },
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

  app.put("/api/users/:id/password", authenticate, isAdmin, async (req, res, next) => {
    const { password } = req.body;
    try {
      const exists = await prisma.profile.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "User not found" });
      if (!isValidPassword(password)) {
        return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
      }

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
        prisma.ticket.count({ where: { assignedTo: id, status: { notIn: ["closed", "resolved"] } } }),
        prisma.ticket.count({ where: { userId: id, status: { notIn: ["closed", "resolved"] } } }),
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

  app.get("/api/technicians", authenticate, async (req, res, next) => {
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

      const isStaff = ["manager", "technician", "staff"].includes(req.user.role);
      const isOwner = ticket.userId === req.user.id;

      if (!isStaff && !isOwner) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const comments = await prisma.comment.findMany({
        where: { ticketId: req.params.id },
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

      const isStaff = ["manager", "technician", "staff"].includes(req.user.role);
      const isOwner = ticket.userId === req.user.id;

      if (req.user.role === "technician" && ticket.assignedTo !== req.user.id) {
        return res.status(403).json({ error: "Technicians can only view history for assigned tickets" });
      }

      if (!isStaff && !isOwner) {
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
      const { message, attachments } = req.body;

      const ticket = await prisma.ticket.findUnique({ where: { id: req.params.id } });
      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      const isStaff = ["manager", "technician", "staff"].includes(req.user.role);
      const isOwner = ticket.userId === req.user.id;

      if (req.user.role === "technician" && ticket.assignedTo !== req.user.id) {
        return res.status(403).json({ error: "Technicians can only comment on assigned tickets" });
      }

      if (!isStaff && !isOwner) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const comment = await prisma.comment.create({
        data: { 
          message, 
          ticketId: req.params.id, 
          userId: req.user.id,
          attachments: attachments ? {
            create: attachments.map((a: any) => ({ name: a.name, url: a.url, type: a.type }))
          } : undefined
        },
      });
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
      const resolved = await prisma.ticket.count({ where: { ...where, status: "resolved" } });
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
                isDelayed: true
              }
            }
          }
        });

        technicianStats = technicians.map(tech => ({
          id: tech.id,
          name: tech.name,
          total: tech.assigned.length,
          resolved: tech.assigned.filter(t => t.status === "resolved").length,
          delayed: tech.assigned.filter(t => t.isDelayed).length
        }));
      }

      res.json({ 
        total, 
        open, 
        resolved, 
        pending, 
        byCategory, 
        byPriority, 
        byStatus, 
        volumeOverTime,
        delayedTickets,
        delayedMaintenance,
        technicianStats
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

  // --- Vite Integration ---
  // 404 handler for API routes (placed before Vite middleware)
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

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

    // For non-API routes, let the default handler or Vite handle it
    next(err);
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
