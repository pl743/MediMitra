/**
 * notificationController.js — In-app notifications.
 * Full implementation — reads and marks notifications in the DB.
 */

import { Notification } from '../models/Notification.js';
import { AppError } from '../utils/AppError.js';

/**
 * GET /api/v1/notifications
 * Returns paginated notifications for the authenticated user,
 * newest first. Optionally filter by ?unread=true.
 */
export async function getNotifications(req, res, next) {
  try {
    const { unread, page = 1, limit = 20 } = req.validatedQuery;
    const pageNum = page;
    const limitNum = limit;
    const skip = (pageNum - 1) * limitNum;

    const filter = { userId: req.user.id };
    if (unread === 'true') filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: req.user.id, isRead: false }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/notifications/:id/read
 * Marks a single notification as read. Only the owning user can do this.
 */
export async function markAsRead(req, res, next) {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      throw new AppError('Invalid notification ID format', 400);
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true, runValidators: true }
    );

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    res.status(200).json({ success: true, data: { notification } });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/notifications/read-all
 * Marks all unread notifications for the authenticated user as read.
 */
export async function markAllAsRead(req, res, next) {
  try {
    const result = await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notification(s) marked as read`,
    });
  } catch (error) {
    next(error);
  }
}
