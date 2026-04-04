import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import { supabase, supabaseAdmin } from "./lib/supabase";
import { PrismaClient, Prisma } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  console.warn("⚠️ WARNING: DATABASE_URL environment variable is not set. Database connection will fail.");
  console.log("💡 To connect to your Supabase database, add the following to your AI Studio Secrets:");
  console.log("   DATABASE_URL=postgresql://postgres:%40%23Kaleb1301@db.qmmojzifrvtkvlysjpbh.supabase.co:5432/postgres?sslmode=require");
} else if (process.env.DATABASE_URL.includes("localhost:5432")) {
  console.warn("⚠️ WARNING: DATABASE_URL is set to 'localhost:5432'. This will fail in the AI Studio environment. Please provide a real PostgreSQL connection string.");
}

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "ict-support-secret-key-123";

async function startServer() {
  console.log("🚀 Starting ICT Support System Server...");
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const PORT = 3000;

  console.log("📡 Setting up Socket.IO...");
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
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    
    if (!supabase) {
      return res.status(500).json({ error: "Supabase client not initialized. Check environment variables." });
    }

    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) throw error;
      
      // Get profile from Prisma
      const profile = await prisma.profile.findUnique({ where: { id: user.id } });
      if (!profile) return res.status(401).json({ error: "Profile not found" });
      
      req.user = { ...user, ...profile };
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  const isAdmin = (req: any, res: any, next: any) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    next();
  };

  const isManager = (req: any, res: any, next: any) => {
    if (req.user.role !== "manager" && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    next();
  };

  const isTechnician = (req: any, res: any, next: any) => {
    if (!["technician", "manager", "admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };

  const isInternal = (req: any, res: any, next: any) => {
    if (!["staff", "technician", "manager", "admin"].includes(req.user.role)) {
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
          await (prisma.ticket as any).update({
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
      if (!process.env.DATABASE_URL) {
        return res.status(500).json({ 
          status: "error", 
          database: "disconnected", 
          message: "DATABASE_URL environment variable is not set.",
          code: "DATABASE_URL_MISSING"
        });
      }
      
      if (process.env.DATABASE_URL.includes("localhost:5432")) {
        return res.status(500).json({ 
          status: "error", 
          database: "disconnected", 
          message: "DATABASE_URL is set to 'localhost:5432'. Please provide a real PostgreSQL connection string.",
          code: "DATABASE_URL_DEFAULT_VALUE"
        });
      }

      await prisma.$queryRaw`SELECT 1`;
      res.json({ 
        status: "ok", 
        database: "connected", 
        provider: "postgresql"
      });
    } catch (err) {
      res.status(500).json({ 
        status: "error", 
        database: "disconnected", 
        message: "Database connection failed. Please check your DATABASE_URL.",
        code: "DATABASE_CONNECTION_FAILED"
      });
    }
  });

  // Auth
  app.post("/api/auth/register", async (req, res, next) => {
    const { name, email, password, department } = req.body;
    
    if (!supabase) {
      return res.status(500).json({ error: "Supabase client not initialized. Check environment variables." });
    }

    try {
      // 1. Signup with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, department }
        }
      });

      if (error) return res.status(400).json({ error: error.message });
      if (!data.user) return res.status(400).json({ error: "Signup failed" });

      // 2. Create profile in Prisma
      // Bootstrap the first admin user if it's the developer's email
      const role = email === "kalebteshome94@gmail.com" ? "admin" : "staff";
      
      const profile = await prisma.profile.create({
        data: {
          id: data.user.id,
          name,
          email,
          role,
          department
        }
      });

      res.json({ message: "Registration successful. Please check your email for verification.", user: profile });
    } catch (err) {
      next(err);
    }
  });

  // Admin User Creation (Technicians and Managers)
  app.post("/api/auth/admin/create-user", authenticate, isAdmin, async (req, res, next) => {
    const { email, name, role, department } = req.body;
    
    if (!supabaseAdmin) {
      return res.status(500).json({ error: "Supabase Admin client not initialized. Check environment variables." });
    }

    if (!["technician", "manager"].includes(role)) {
      return res.status(400).json({ error: "Invalid role for admin creation" });
    }

    try {
      // 1. Create user via Supabase Admin API
      // Note: We don't provide a password. Supabase will generate a random one.
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name, role, department }
      });

      if (error) return res.status(400).json({ error: error.message });
      if (!data.user) return res.status(400).json({ error: "User creation failed" });

      // 2. Create profile record
      const profile = await prisma.profile.create({
        data: {
          id: data.user.id,
          name,
          email,
          role,
          department
        }
      });

      // 3. Send password setup email (reset password flow)
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) {
        console.error("Failed to send reset email:", resetError);
        // We don't return error here because the user was already created
      }

      res.json({ message: `${role} created successfully. Password setup email sent.`, user: profile });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    const { email, password, rememberMe } = req.body;

    if (!supabase) {
      return res.status(500).json({ error: "Supabase client not initialized. Check environment variables." });
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) return res.status(401).json({ error: error.message });
      if (!data.user || !data.session) return res.status(401).json({ error: "Login failed" });

      const profile = await prisma.profile.findUnique({ where: { id: data.user.id } });
      if (!profile) return res.status(401).json({ error: "Profile not found" });

      const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      res.cookie("token", data.session.access_token, { 
        httpOnly: true, 
        secure: true, 
        sameSite: "none", 
        maxAge 
      });

      res.json(profile);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    res.clearCookie("token", {
      httpOnly: true,
      secure: true,
      sameSite: "none"
    });
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

  app.get("/api/tickets/all", authenticate, isInternal, async (req: any, res, next) => {
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
      const isInternalUser = ["admin", "manager", "technician", "staff"].includes(req.user.role);
      const isOwner = ticket.userId === req.user.id;
      const isAssigned = ticket.assignedTo === req.user.id;

      if (req.user.role === "technician" && !isAssigned) {
        return res.status(403).json({ error: "Technicians can only view assigned tickets" });
      }

      if (!isInternalUser && !isOwner) {
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

      const ticket = await (prisma.ticket as any).create({
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
      const managers = await prisma.profile.findMany({ where: { role: "manager" } });
      for (const manager of managers) {
        await createNotification(manager.id, "New Ticket", `${req.user.name} created a new ticket: ${title}`, `/tickets/${ticket.id}`);
      }

      res.json(ticket);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/tickets/:id", authenticate, isInternal, async (req: any, res, next) => {
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
        if (req.user.role !== "manager") {
          return res.status(403).json({ error: "Only managers can assign technicians" });
        }
      }

      // Role-based status transition checks
      if (status && status !== oldTicket.status) {
        if (req.user.role === "technician" && !["in-progress", "resolved"].includes(status)) {
          return res.status(403).json({ error: "Technicians can only set status to in-progress or resolved" });
        }
        if (req.user.role === "manager" && status !== "resolved") {
          return res.status(403).json({ error: "Managers can only approve (resolve) tickets" });
        }
        if (req.user.role === "manager" && !["closed", "open"].includes(status)) {
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
        
        // Link existing assets to new types
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
          assetType: true
        }
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

  app.post("/api/asset-types", authenticate, isInternal, async (req, res, next) => {
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

  app.delete("/api/asset-types/:id", authenticate, isInternal, async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Check if any assets are using this type
      const assetCount = await prisma.asset.count({ where: { typeId: id } });
      if (assetCount > 0) {
        return res.status(400).json({ error: "Cannot delete asset type that is in use" });
      }

      await prisma.assetType.delete({ where: { id } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/assets", authenticate, isInternal, async (req, res, next) => {
    try {
      const { name, brand, type, typeId, serialNo, quantity, status } = req.body;
      
      if (serialNo) {
        const existing = await prisma.asset.findUnique({ where: { serialNo } });
        if (existing) return res.status(400).json({ error: "Asset with this Serial Number already exists" });
      }

      const asset = await prisma.asset.create({ 
        data: { 
          name, 
          brand,
          type: type || "Other", 
          typeId: typeId || null,
          serialNo: serialNo || null, 
          quantity: quantity || 1, 
          status: status || "active" 
        },
        include: { assetType: true }
      });
      res.json(asset);
    } catch (err) {
      next(err);
    }
  });

  // Asset Usage
  app.post("/api/tickets/:id/usage", authenticate, isInternal, async (req: any, res, next) => {
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
      if (asset.quantity < quantity) return res.status(400).json({ error: "Insufficient quantity in stock" });

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
          data: { quantity: { decrement: quantity } }
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

  app.post("/api/assets/:id/maintenance", authenticate, isInternal, async (req, res, next) => {
    try {
      const { type, scheduledDate, description } = req.body;
      const asset = await prisma.asset.findUnique({ where: { id: req.params.id } });
      const assetName = asset?.name || req.params.id;

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

  app.put("/api/assets/maintenance/:id", authenticate, isInternal, async (req, res, next) => {
    try {
      const { status } = req.body;
      const exists = await prisma.maintenance.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "Maintenance record not found" });

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

      const requestedQty = parseInt(quantity?.toString() || "1");
      if (requestedQty <= 0) return res.status(400).json({ error: "Invalid quantity" });
      if (requestedQty > asset.quantity) return res.status(400).json({ error: "Requested quantity exceeds available stock" });

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
          data: { status: requestedQty === asset.quantity ? "requested" : asset.status }
        })
      ]);

      // Notify managers
      const managers = await prisma.profile.findMany({
        where: { role: { in: ["manager"] } },
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

  app.put("/api/assets/requests/:id/fulfill", authenticate, isInternal, async (req, res, next) => {
    try {
      const requestId = req.params.id;
      const request = await prisma.assetRequest.findUnique({ 
        where: { id: requestId },
        include: { asset: true, user: true }
      });
      if (!request) return res.status(404).json({ error: "Request not found" });
      if (request.status === "fulfilled") return res.status(400).json({ error: "Request already fulfilled" });
      if (request.asset.quantity < request.quantity) return res.status(400).json({ error: "Asset out of stock or insufficient quantity" });

      const [updatedRequest] = await prisma.$transaction([
        prisma.assetRequest.update({
          where: { id: requestId },
          data: { status: "fulfilled" }
        }),
        prisma.asset.update({
          where: { id: request.assetId },
          data: { 
            quantity: { decrement: request.quantity },
            status: "active" // Set back to active if it was requested
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
      
      const isInternalAuthority = ["admin", "manager"].includes(req.user.role);
      const isOwner = request.userId === req.user.id;

      if (!isInternalAuthority && !isOwner) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const updateData: any = {};
      if (isOwner) updateData.userReturned = true;
      if (isInternalAuthority) updateData.staffReturned = true;

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
            data: { 
              quantity: { increment: request.quantity },
              status: "active" // Set back to active upon return
            }
          })
        ] : [])
      ]);

      // Notify managers if user returned
      if (isOwner && !isInternalAuthority) {
        const managers = await prisma.profile.findMany({
          where: { role: "manager" },
          select: { id: true }
        });
        for (const manager of managers) {
          await createNotification(manager.id, "Asset Return Initiated", `${req.user.name} initiated return for ${request.asset.name}.`, `/assets`);
        }
      }

      // Notify user if staff returned
      if (isInternalAuthority && !isOwner) {
        await createNotification(request.userId, "Asset Return Confirmed", `Staff confirmed return for ${request.asset.name}.`, `/assets`);
      }

      res.json(updatedRequest);
    } catch (err) {
      next(err);
    }
  });

  // Return Asset Usage
  app.put("/api/assets/usage/:id/return", authenticate, isInternal, async (req: any, res, next) => {
    try {
      const usageId = req.params.id;
      const usage = await prisma.assetUsage.findUnique({ 
        where: { id: usageId },
        include: { asset: true, ticket: true }
      });
      if (!usage) return res.status(404).json({ error: "Usage record not found" });
      if (usage.status === "returned") return res.status(400).json({ error: "Asset already returned" });

      const isInternalAuthority = ["admin", "manager"].includes(req.user.role);
      const isOwner = usage.userId === req.user.id || usage.ticket.assignedTo === req.user.id;

      if (!isInternalAuthority && !isOwner) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const updateData: any = {};
      if (isOwner) updateData.userReturned = true;
      if (isInternalAuthority) updateData.staffReturned = true;

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
            data: { 
              quantity: { increment: usage.quantity },
              status: "active" // Set back to active upon return
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
  app.put("/api/assets/:id", authenticate, isInternal, async (req, res, next) => {
    try {
      const { name, brand, type, typeId, serialNo, quantity, status } = req.body;
      const assetId = req.params.id;

      const oldAsset = await prisma.asset.findUnique({ where: { id: assetId } });
      if (!oldAsset) return res.status(404).json({ error: "Asset not found" });

      if (serialNo && serialNo !== oldAsset.serialNo) {
        const existing = await prisma.asset.findUnique({ where: { serialNo } });
        if (existing) return res.status(400).json({ error: "Another asset with this Serial Number already exists" });
      }

      const asset = await prisma.asset.update({
        where: { id: assetId },
        data: { 
          name, 
          brand,
          type: type || "Other", 
          typeId: typeId || null,
          serialNo, 
          quantity: quantity !== undefined ? parseInt(quantity.toString()) : undefined, 
          status 
        },
        include: { assetType: true }
      });

      // If quantity increased, notify pending requests
      if (quantity !== undefined && quantity > oldAsset.quantity) {
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

      res.json(asset);
    } catch (err) {
      next(err);
    }
  });

  // Delay reporting
  app.put("/api/assets/maintenance/:id/delay", authenticate, isInternal, async (req, res, next) => {
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

  app.put("/api/tickets/:id/delay", authenticate, isInternal, async (req, res, next) => {
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

  app.post("/api/maintenance", authenticate, isInternal, async (req, res, next) => {
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

  app.put("/api/maintenance/:id/status", authenticate, isInternal, async (req, res, next) => {
    try {
      const { status } = req.body;
      const exists = await prisma.maintenance.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "Maintenance not found" });

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

  // Users Management (Admin Only)
  app.get("/api/users", authenticate, isManager, async (req, res, next) => {
    try {
      const users = await prisma.profile.findMany({
        select: { id: true, name: true, email: true, role: true, department: true },
      });
      res.json(users);
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/users", authenticate, isManager, async (req, res, next) => {
    const { name, email, password, role, department } = req.body;
    try {
      // Check if user already exists
      const existingUser = await prisma.profile.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: "Email already in use" });
      }

      const user = await prisma.profile.create({
        data: { name, email, role: role || "staff", department },
      });
      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/users/:id", authenticate, isManager, async (req, res, next) => {
    const { name, email, role, department } = req.body;
    try {
      const exists = await prisma.profile.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "User not found" });

      const user = await prisma.profile.update({
        where: { id: req.params.id },
        data: { name, email, role, department },
      });
      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/users/:id/role", authenticate, isManager, async (req, res, next) => {
    const { role } = req.body;
    try {
      const exists = await prisma.profile.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "User not found" });

      const user = await prisma.profile.update({
        where: { id: req.params.id },
        data: { role },
      });
      res.json(user);
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/users/:id/password", authenticate, isManager, async (req, res, next) => {
    const { password } = req.body;
    try {
      const exists = await prisma.profile.findUnique({ where: { id: req.params.id } });
      if (!exists) return res.status(404).json({ error: "User not found" });

      // Update password in Supabase Auth
      const { error } = await supabaseAdmin.auth.admin.updateUserById(req.params.id, {
        password
      });

      if (error) return res.status(400).json({ error: error.message });

      res.json({ message: "Password reset successfully" });
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/users/:id", authenticate, isManager, async (req, res, next) => {
    try {
      const { id } = req.params;
      // Prevent deleting self
      if (id === (req as any).user.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }
      
      const exists = await prisma.profile.findUnique({ where: { id: id } });
      if (!exists) return res.status(404).json({ error: "User not found" });

      // Also delete from Supabase Auth
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) console.error("Failed to delete user from Supabase Auth:", error);

      await prisma.profile.delete({ where: { id } });
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

      const isInternalUser = ["admin", "manager", "technician", "staff"].includes(req.user.role);
      const isOwner = ticket.userId === req.user.id;

      if (!isInternalUser && !isOwner) {
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

      const isInternalUser = ["admin", "manager", "technician", "staff"].includes(req.user.role);
      const isOwner = ticket.userId === req.user.id;

      if (req.user.role === "technician" && ticket.assignedTo !== req.user.id) {
        return res.status(403).json({ error: "Technicians can only view history for assigned tickets" });
      }

      if (!isInternalUser && !isOwner) {
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

      const isInternalUser = ["admin", "manager", "technician", "staff"].includes(req.user.role);
      const isOwner = ticket.userId === req.user.id;

      if (req.user.role === "technician" && ticket.assignedTo !== req.user.id) {
        return res.status(403).json({ error: "Technicians can only comment on assigned tickets" });
      }

      if (!isInternalUser && !isOwner) {
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
      if (req.user.role === "manager") {
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
    console.log("🛠️ Initializing Vite in development mode...");
    const vite = await createViteServer({
      root: path.resolve(process.cwd(), "client"),
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("✅ Vite middleware integrated.");
  } else {
    console.log("📦 Serving static files in production mode...");
    const distPath = path.join(process.cwd(), "client", "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global error handler for API routes (placed after all routes)
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global Error:", err);
    
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
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("❌ Failed to start server:", err);
});
