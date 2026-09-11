import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Get user notifications and unread count
 */
export const getUserNotifications = async (userId, limit = 20) => {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    }),
    prisma.notification.count({
      where: { userId, isRead: false }
    })
  ]);

  return { notifications, unreadCount };
};

/**
 * Create a new persistent notification
 */
export const createNotification = async (userId, { type, title, message, link, data }) => {
  return prisma.notification.create({
    data: {
      userId,
      type: type || 'SYSTEM',
      title,
      message,
      link,
      data: data || null
    }
  });
};

/**
 * Mark a single notification as read
 */
export const markAsRead = async (notificationId, userId) => {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true }
  });
};

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = async (userId) => {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true }
  });
};

/**
 * Delete a notification
 */
export const deleteNotification = async (notificationId, userId) => {
  return prisma.notification.deleteMany({
    where: { id: notificationId, userId }
  });
};
