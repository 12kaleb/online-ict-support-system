import { TICKET_TEMPLATES } from "../config/app.js";
import { HttpError } from "../lib/httpError.js";
import { isManagerRole } from "../lib/roles.js";
import type { CreateNotification } from "./notifications.js";
import * as ticketRepository from "../repositories/ticket.repository.js";

type Actor = {
  id: string;
  name: string;
  role: string;
  department?: string | null;
};

type CreateTicketInput = {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  assetId?: string;
  attachments?: Array<{ name: string; url: string; type: string }>;
  templateKey?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  buildingBlockNo: string;
  roomNumber: string;
};

type TicketServiceDeps = {
  createNotification: CreateNotification;
  updateSLAStatuses: () => Promise<void>;
  logAssetHistory: (
    assetId: string,
    action: string,
    details?: string,
    options?: { userId?: string | null; ticketId?: string | null; maintenanceId?: string | null },
  ) => Promise<void>;
};

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

function isPresidentialBureauDepartment(department?: string | null) {
  return Boolean(department?.trim().toLowerCase().includes("presidential bureau"));
}

function ticketListWhereFor(actor: Actor) {
  if (actor.role === "staff") {
    return { userId: actor.id };
  }

  if (actor.role === "technician") {
    return { assignedTo: actor.id };
  }

  return {};
}

function assertCanViewTicket(actor: Actor, ticket: { userId: string; assignedTo?: string | null }) {
  const isOwner = ticket.userId === actor.id;
  const isAssigned = ticket.assignedTo === actor.id;
  const isPrivileged = isManagerRole(actor.role);

  if (actor.role === "technician" && !isAssigned) {
    throw new HttpError(403, "Technicians can only view assigned tickets");
  }

  if (actor.role === "staff" && !isOwner) {
    throw new HttpError(403, "Forbidden");
  }

  if (!isPrivileged && !isAssigned && !isOwner) {
    throw new HttpError(403, "Forbidden");
  }
}

export function createTicketService(deps: TicketServiceDeps) {
  return {
    async listTickets(actor: Actor) {
      return ticketRepository.findTickets(ticketListWhereFor(actor));
    },

    async listAllTickets(actor: Actor) {
      await deps.updateSLAStatuses();
      return ticketRepository.findTickets(ticketListWhereFor(actor));
    },

    async getTicket(actor: Actor, id: string) {
      const ticket = await ticketRepository.findTicketById(id);
      if (!ticket) {
        throw new HttpError(404, "Ticket not found");
      }

      assertCanViewTicket(actor, ticket);
      return ticket;
    },

    async createTicket(actor: Actor, input: CreateTicketInput) {
      const template = input.templateKey ? TICKET_TEMPLATES[input.templateKey] : null;
      const resolvedCategory = input.category || template?.category || "Other";
      const resolvedPriority = isPresidentialBureauDepartment(actor.department)
        ? "critical"
        : input.priority || template?.priority || "medium";
      const resolvedTitle = input.title || template?.title;
      const resolvedDescription = input.description || template?.description;

      if (!resolvedTitle || !resolvedDescription) {
        throw new HttpError(400, "Title and description are required.");
      }

      const ticket = await ticketRepository.createTicket({
        title: resolvedTitle,
        description: resolvedDescription,
        category: resolvedCategory,
        priority: resolvedPriority,
        templateKey: input.templateKey || null,
        userId: actor.id,
        assetId: input.assetId || null,
        locationLatitude: input.location?.latitude ?? null,
        locationLongitude: input.location?.longitude ?? null,
        locationAccuracy: input.location?.accuracy ?? null,
        buildingBlockNo: input.buildingBlockNo,
        roomNumber: input.roomNumber,
        dueDate: getSLADueDate(resolvedPriority),
        attachments: input.attachments,
      });

      await ticketRepository.logTicketHistory(
        ticket.id,
        actor.id,
        "Created",
        `Ticket created with priority: ${resolvedPriority}`,
      );

      if (input.assetId) {
        await deps.logAssetHistory(input.assetId, "ticket-linked", `Linked to ticket "${resolvedTitle}"`, {
          userId: actor.id,
          ticketId: ticket.id,
        });
      }

      const managers = await ticketRepository.findManagers();
      for (const manager of managers) {
        await deps.createNotification(
          manager.id,
          "New Ticket",
          `${actor.name} created a new ticket: ${resolvedTitle}`,
          `/tickets/${ticket.id}`,
        );
      }

      return ticket;
    },

    async deleteTicket(id: string) {
      const ticket = await ticketRepository.findTicketById(id);
      if (!ticket) {
        throw new HttpError(404, "Ticket not found");
      }

      await ticketRepository.deleteTicket(id);
      return { message: "Ticket deleted successfully" };
    },
  };
}
