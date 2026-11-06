/**
 * Waitlist.js — Patient waitlist for an unavailable doctor slot.
 *
 * When a slot becomes available (cancellation), the job processor
 * finds the earliest eligible waitlist entry and creates a time-limited offer.
 *
 * Status flow:
 *   waiting → offered → accepted (booking created) → expired (offer not accepted in time)
 *           → cancelled (patient withdrew)
 */

import mongoose from 'mongoose';

const waitlistSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
    },
    // Patient's preferred date range
    preferredDateStart: { type: Date, required: true },
    preferredDateEnd: { type: Date, required: true },
    status: {
      type: String,
      enum: ['waiting', 'offered', 'accepted', 'expired', 'cancelled'],
      default: 'waiting',
    },
    // When a slot is offered
    offeredSlotId: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorSlot' },
    offerExpiresAt: Date,
    acceptedAppointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    notes: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

// Don't allow duplicate active waitlist entries for same patient+doctor
waitlistSchema.index(
  { patientId: 1, doctorId: 1, status: 1 },
  { partialFilterExpression: { status: { $in: ['waiting', 'offered'] } } }
);
waitlistSchema.index({ doctorId: 1, status: 1, createdAt: 1 });
waitlistSchema.index({ offerExpiresAt: 1, status: 1 }); // For expiry job

export const Waitlist = mongoose.model('Waitlist', waitlistSchema);
