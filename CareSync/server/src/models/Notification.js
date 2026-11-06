/**
 * Notification.js — In-app notifications for users.
 *
 * Created programmatically when key events happen:
 * - Appointment booked/cancelled
 * - Lab booking status update
 * - Reservation accepted/rejected
 * - Report ready
 * - Waitlist slot offered
 */

import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'appointment_booked',
        'appointment_confirmed',
        'appointment_cancelled',
        'appointment_completed',
        'appointment_no_show',
        'lab_booking_created',
        'lab_booking_confirmed',
        'lab_booking_updated',
        'report_ready',
        'reservation_confirmed',
        'reservation_rejected',
        'waitlist_offer',
        'follow_up_pending',
        'general',
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 100 },
    message: { type: String, required: true, maxlength: 500 },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    dedupeKey: { type: String },
    // Link to the related record for deep-linking
    relatedModel: {
      type: String,
      enum: ['Appointment', 'LabBooking', 'Reservation', 'Waitlist', 'CareJourney', null],
    },
    relatedId: { type: mongoose.Schema.Types.ObjectId },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index(
  { userId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } }
);

export const Notification = mongoose.model('Notification', notificationSchema);
