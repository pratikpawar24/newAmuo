import { Notification } from '../models/Notification';
import { Types } from 'mongoose';
import { logger } from '../utils/logger';

type NotificationType = 'ride_request' | 'ride_accepted' | 'ride_cancelled' | 'chat_message' | 'badge_earned' | 'system';

export async function createNotification(
  userId: string | Types.ObjectId,
  type: NotificationType,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
  io?: any
): Promise<void> {
  try {
    const notification = await Notification.create({ userId, type, title, body, data });
    if (io) {
      io.to(`user:${userId.toString()}`).emit('notification:new', {
        _id: notification._id,
        type,
        title,
        body,
        data,
        read: false,
        createdAt: notification.createdAt,
      });
    }
  } catch (error) {
    logger.error('Create notification error:', error);
  }
}

export async function getUserNotifications(userId: string, limit = 20, skip = 0) {
  return Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
}

export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  const result = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { read: true },
    { new: true }
  );
  return !!result;
}

export async function getUnreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ userId, read: false });
}
