import { describe, expect, it, vi } from 'vitest';

vi.mock('../models/Notification.js', () => ({
  Notification: {
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

import { Notification } from '../models/Notification.js';
import { createNotification } from './notificationService.js';

describe('notificationService', () => {
  it('creates event notifications idempotently when a deduplication key is provided', async () => {
    const notification = { _id: 'notification-id' };
    Notification.findOneAndUpdate.mockResolvedValue(notification);

    const result = await createNotification({
      userId: 'patient-id',
      type: 'appointment_confirmed',
      title: 'Appointment confirmed',
      message: 'Your appointment is confirmed.',
      dedupeKey: 'appointment_confirmed:appointment-id',
    });

    expect(Notification.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'patient-id', dedupeKey: 'appointment_confirmed:appointment-id' },
      { $setOnInsert: expect.objectContaining({ type: 'appointment_confirmed' }) },
      { new: true, upsert: true, runValidators: true }
    );
    expect(result).toBe(notification);
    expect(Notification.create).not.toHaveBeenCalled();
  });
});
