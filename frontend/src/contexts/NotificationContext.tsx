'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';

interface Notification {
  id: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  isRead?: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode; user: any }> = ({ children, user }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const normalizeNotification = (notification: Notification) => ({
    ...notification,
    read: Boolean(notification.read ?? notification.isRead),
  });

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data.map(normalizeNotification) : []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      } else {
        console.error('Failed to mark notification as read:', await res.text());
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();

      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
      const transports = socketUrl ? ['websocket', 'polling'] : ['polling'];
      
      const newSocket = io(socketUrl, {
        withCredentials: true,
        transports,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
      });

      newSocket.on('notification', (notification: Notification) => {
        setNotifications(prev => [normalizeNotification(notification), ...prev.slice(0, 19)]); // Keep list manageable
        toast.info(notification.title, {
          description: notification.message,
          action: notification.link ? {
            label: 'View',
            onClick: async () => {
              await markAsRead(notification.id);
              window.location.href = notification.link!;
            }
          } : undefined
        });
      });

      newSocket.on('connect_error', (err) => {
        console.error('Notification socket connection failed:', err.message);
      });

      return () => {
        newSocket.disconnect();
      };
    }

    return undefined;
  }, [user]);

  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'PUT' });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      } else {
        console.error('Failed to mark all notifications as read:', await res.text());
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
