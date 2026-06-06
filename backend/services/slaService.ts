import { findManagerIds, findOpenTicketsForSLA, updateTicketSLA } from "../repositories/slaRepository.js";
import type { CreateNotification } from "./notifications.js";

export function createSLAService(createNotification: CreateNotification) {
  return {
    async updateSLAStatuses() {
      try {
        const now = new Date();
        const openTickets = await findOpenTicketsForSLA();

        for (const ticket of openTickets) {
          if (!ticket.dueDate) continue;
          const dueDate = new Date(ticket.dueDate);
          let newStatus = ticket.slaStatus;
          let escalationLevel = ticket.escalationLevel || 0;

          if (ticket.slaPaused) {
            newStatus = "paused";
          } else if (now > dueDate) {
            newStatus = "breached";
            escalationLevel = 2;
          } else {
            const hoursRemaining = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
            if (hoursRemaining < 2) {
              newStatus = "at-risk";
              escalationLevel = Math.max(escalationLevel, 1);
            } else {
              newStatus = "on-track";
            }
          }

          if (newStatus !== ticket.slaStatus || escalationLevel !== (ticket.escalationLevel || 0)) {
            await updateTicketSLA(ticket.id, {
              slaStatus: newStatus,
              escalationLevel,
              escalatedAt: newStatus === "at-risk" || newStatus === "breached" ? now : null,
            });

            if (newStatus === "at-risk" || newStatus === "breached") {
              const managers = await findManagerIds();
              for (const manager of managers) {
                await createNotification(
                  manager.id,
                  newStatus === "breached" ? "SLA Breached" : "Ticket At Risk",
                  `${ticket.user?.name || "A user"}'s ticket "${ticket.title}" is ${newStatus}.`,
                  `/tickets/${ticket.id}`,
                );
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to update SLA statuses:", err);
      }
    },
  };
}
