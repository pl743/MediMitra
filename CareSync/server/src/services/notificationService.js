/**
 * notificationService.js — Creates in-app notifications for application events.
 */

import { Notification } from '../models/Notification.js';

export async function createNotification(notificationData) {
  if (notificationData.dedupeKey) {
    const filter = { userId: notificationData.userId, dedupeKey: notificationData.dedupeKey };
    try {
      return await Notification.findOneAndUpdate(
        filter,
        { $setOnInsert: notificationData },
        { new: true, upsert: true, runValidators: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
      return Notification.findOne(filter);
    }
  }
  return Notification.create(notificationData);
}
