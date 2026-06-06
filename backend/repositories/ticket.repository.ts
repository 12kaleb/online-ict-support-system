import { prisma } from "../lib/prisma.js";

const ticketListInclude = {
  user: { select: { name: true } },
  technician: { select: { name: true } },
  asset: true,
  attachments: true,
  feedback: true,
  approvalRequests: {
    where: { status: "pending" },
    select: { id: true, type: true, status: true, createdAt: true },
  },
};

const ticketDetailInclude = {
  user: { select: { name: true, email: true } },
  technician: { select: { name: true, email: true } },
  asset: true,
  attachments: true,
  feedback: true,
  approvalRequests: {
    orderBy: { createdAt: "desc" as const },
    include: {
      requestedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  },
  assetUsages: {
    include: { asset: true, user: { select: { name: true } } },
    orderBy: { createdAt: "desc" as const },
  },
  history: {
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" as const },
  },
};

export function findTickets(where: Record<string, unknown>) {
  return prisma.ticket.findMany({
    where,
    include: ticketListInclude,
    orderBy: { createdAt: "desc" },
  });
}

export function findTicketById(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: ticketDetailInclude,
  });
}

export function createTicket(data: {
  title: string;
  description: string;
  category: string;
  priority: string;
  templateKey?: string | null;
  userId: string;
  assetId?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  locationAccuracy?: number | null;
  buildingBlockNo?: string;
  roomNumber?: string;
  dueDate: Date;
  attachments?: Array<{ name: string; url: string; type: string }>;
}) {
  return prisma.ticket.create({
    data: {
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      templateKey: data.templateKey || null,
      userId: data.userId,
      assetId: data.assetId || null,
      locationLatitude: data.locationLatitude ?? null,
      locationLongitude: data.locationLongitude ?? null,
      locationAccuracy: data.locationAccuracy ?? null,
      buildingBlockNo: data.buildingBlockNo,
      roomNumber: data.roomNumber,
      dueDate: data.dueDate,
      slaStatus: "on-track",
      attachments: data.attachments ? {
        create: data.attachments.map((attachment) => ({
          name: attachment.name,
          url: attachment.url,
          type: attachment.type,
        })),
      } : undefined,
    },
  });
}

export function deleteTicket(id: string) {
  return prisma.ticket.delete({
    where: { id },
  });
}

export function findManagers() {
  return prisma.profile.findMany({
    where: { role: { in: ["manager", "admin"] } },
    select: { id: true },
  });
}

export function logTicketHistory(ticketId: string, userId: string, action: string, details?: string) {
  return prisma.ticketHistory.create({
    data: { ticketId, userId, action, details },
  });
}
