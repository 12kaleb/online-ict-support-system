import type { Server } from "socket.io";
import { prisma } from "../lib/prisma.js";
import { sendTelegramNotification } from "./telegram.js";

export type CreateNotification = (userId: string, title: string, message: string, link?: string) => Promise<void>;

export const serializeNotification = (notification: any) => ({
  ...notification,
  read: Boolean(notification.isRead),
});

export function createNotificationService(io: Server): CreateNotification {
  return async (userId: string, title: string, message: string, link?: string) => {
    try {
      const notification = await prisma.notification.create({
        data: { userId, title, message, link },
      });
      io.to(userId).emit("notification", serializeNotification(notification));

      const recipient = await prisma.profile.findUnique({
        where: { id: userId },
        select: { name: true, email: true, telegramChatId: true },
      });
      await sendTelegramNotification({
        chatId: recipient?.telegramChatId,
        recipientName: recipient?.name,
        recipientEmail: recipient?.email,
        title,
        message,
        link,
      });
    } catch (err) {
      console.error("Failed to create notification:", err);
    }
  };
}
