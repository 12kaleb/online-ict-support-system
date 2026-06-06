import type { NextFunction, Request, Response } from "express";
import { createTicketSchema } from "../schemas/api.js";
import { parseBody } from "../lib/auth.js";
import { isHttpError } from "../lib/httpError.js";
import type { createTicketService } from "../services/ticket.service.js";

type TicketService = ReturnType<typeof createTicketService>;

function handleControllerError(error: unknown, res: Response, next: NextFunction) {
  if (isHttpError(error)) {
    return res.status(error.status).json({ error: error.message });
  }

  return next(error);
}

export function createTicketController(ticketService: TicketService) {
  return {
    async list(req: Request, res: Response, next: NextFunction) {
      try {
        res.json(await ticketService.listTickets((req as any).user));
      } catch (err) {
        handleControllerError(err, res, next);
      }
    },

    async listAll(req: Request, res: Response, next: NextFunction) {
      try {
        res.json(await ticketService.listAllTickets((req as any).user));
      } catch (err) {
        handleControllerError(err, res, next);
      }
    },

    async getById(req: Request, res: Response, next: NextFunction) {
      try {
        res.json(await ticketService.getTicket((req as any).user, req.params.id));
      } catch (err) {
        handleControllerError(err, res, next);
      }
    },

    async create(req: Request, res: Response, next: NextFunction) {
      try {
        res.json(await ticketService.createTicket((req as any).user, parseBody(createTicketSchema, req.body)));
      } catch (err) {
        handleControllerError(err, res, next);
      }
    },

    async delete(req: Request, res: Response, next: NextFunction) {
      try {
        res.json(await ticketService.deleteTicket(req.params.id));
      } catch (err) {
        handleControllerError(err, res, next);
      }
    },
  };
}
