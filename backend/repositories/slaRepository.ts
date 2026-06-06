import { prisma } from "../lib/prisma.js";

export async function findOpenTicketsForSLA() {
  return prisma.ticket.findMany({
    where: {
      status: { notIn: ["pending-confirmation", "closed", "resolved"] },
      dueDate: { not: null },
    },
    include: {
      user: { select: { name: true } },
    },
  });
}

export async function updateTicketSLA(
  ticketId: string,
  data: {
    slaStatus: string | null;
    escalationLevel: number;
    escalatedAt: Date | null;
  },
) {
  return prisma.ticket.update({
    where: { id: ticketId },
    data,
  });
}

export async function findManagerIds() {
  return prisma.profile.findMany({
    where: { role: { in: ["manager", "admin"] } },
    select: { id: true },
  });
}
