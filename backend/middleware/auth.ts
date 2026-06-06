import type { NextFunction, Request, Response } from "express";
import { JWT_COOKIE_NAME } from "../config/app.js";
import { prisma } from "../lib/prisma.js";
import { verifyAuthToken } from "../lib/auth.js";
import { isActiveStatus, isAdminRole, isInventoryRole, isManagerRole, isStaffRole, isTechnicianRole } from "../lib/roles.js";

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies[JWT_COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  void (async () => {
    try {
      const payload = verifyAuthToken(token);
      const profile = await prisma.profile.findUnique({ where: { id: payload.sub } });
      if (!profile) return res.status(401).json({ error: "Profile not found" });
      if (!isActiveStatus(profile.status)) {
        return res.status(403).json({ error: "Your account is not active." });
      }

      (req as any).user = {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        status: profile.status,
        canInviteStaff: profile.canInviteStaff,
        name: profile.name,
        department: profile.department,
        telegramLinked: Boolean(profile.telegramChatId),
        createdAt: profile.createdAt,
      };
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  })();
}

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!isAdminRole((req as any).user.role)) return res.status(403).json({ error: "Forbidden" });
  next();
};

export const isManager = (req: Request, res: Response, next: NextFunction) => {
  if (!isManagerRole((req as any).user.role)) return res.status(403).json({ error: "Forbidden" });
  next();
};

export const isTechnician = (req: Request, res: Response, next: NextFunction) => {
  if (!isTechnicianRole((req as any).user.role)) return res.status(403).json({ error: "Forbidden" });
  next();
};

export const isStaff = (req: Request, res: Response, next: NextFunction) => {
  if (!isStaffRole((req as any).user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

export const isInventoryManager = (req: Request, res: Response, next: NextFunction) => {
  if (!isInventoryRole((req as any).user.role)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};
