import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/Notification.js', () => ({
  Notification: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateMany: vi.fn(),
  },
}));

import { Notification } from '../models/Notification.js';
import { getNotifications, markAsRead } from './notificationController.js';
import { notificationListSchema } from '../validators/notificationValidators.js';

describe('notificationController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid notification pagination and filter values', () => {
    expect(notificationListSchema.safeParse({ page: '0' }).success).toBe(false);
    expect(notificationListSchema.safeParse({ unread: 'maybe' }).success).toBe(false);
  });

  it('lists only the authenticated user’s notifications and unread count', async () => {
    const query = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ _id: 'notification-id', isRead: false }]),
    };
    Notification.find.mockReturnValue(query);
    Notification.countDocuments
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await getNotifications({
      user: { id: 'my-user-id' },
      validatedQuery: { unread: 'true', page: 1, limit: 10 },
    }, res, vi.fn());

    expect(Notification.find).toHaveBeenCalledWith({ userId: 'my-user-id', isRead: false });
    expect(Notification.countDocuments).toHaveBeenNthCalledWith(
      2,
      { userId: 'my-user-id', isRead: false }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ unreadCount: 1 }),
    }));
  });

  it('marks a notification read only when it belongs to the authenticated user', async () => {
    const notification = { _id: '507f1f77bcf86cd799439011', isRead: true };
    Notification.findOneAndUpdate.mockResolvedValue(notification);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await markAsRead({
      params: { id: notification._id },
      user: { id: 'my-user-id' },
    }, res, vi.fn());

    expect(Notification.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: notification._id, userId: 'my-user-id' },
      { $set: { isRead: true, readAt: expect.any(Date) } },
      { new: true, runValidators: true }
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects malformed notification IDs without querying the database', async () => {
    const next = vi.fn();

    await markAsRead({
      params: { id: 'invalid' },
      user: { id: 'my-user-id' },
    }, {}, next);

    expect(Notification.findOneAndUpdate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });
});
