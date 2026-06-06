import { Router } from "express";
import { authenticate, isManager, isStaff } from "../middleware/auth.js";
import { createTicketController } from "../controllers/ticket.controller.js";
import { createTicketService } from "../services/ticket.service.js";
import type { CreateNotification } from "../services/notifications.js";

type TicketRouteDeps = {
  createNotification: CreateNotification;
  updateSLAStatuses: () => Promise<void>;
  logAssetHistory: (
    assetId: string,
    action: string,
    details?: string,
    options?: { userId?: string | null; ticketId?: string | null; maintenanceId?: string | null },
  ) => Promise<void>;
};

export function createTicketRouter(deps: TicketRouteDeps) {
  const router = Router();
  const controller = createTicketController(createTicketService(deps));

  router.param("id", (_req, res, next, id) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: "Invalid ID format." });
    }
    next();
  });

  router.get("/", authenticate, controller.list);
  router.get("/all", authenticate, isStaff, controller.listAll);
  router.get("/:id", authenticate, controller.getById);
  router.post("/", authenticate, controller.create);
  router.delete("/:id", authenticate, isManager, controller.delete);

  return router;
}
