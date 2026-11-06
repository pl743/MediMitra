/**
 * DoctorSlot.js — Available appointment time slots for doctors.
 *
 * Each slot represents a specific time window when a doctor is available.
 * When a patient books, the slot's isBooked flag is set to true and
 * appointmentId is linked — this is done atomically to prevent double booking.
 *
 * Concurrency safety:
 * We use findOneAndUpdate with a { isBooked: false } condition.
 * Only one request can set isBooked: true for the same slot.
 * If two requests arrive simultaneously, only one succeeds.
 */

import mongoose from 'mongoose';

const doctorSlotSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
    },
    isBooked: {
      type: Boolean,
      default: false,
      index: true, // Fast lookup for available slots
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index for finding available slots for a specific doctor
doctorSlotSchema.index({ doctorId: 1, startTime: 1, isBooked: 1 });

// Prevent creating duplicate slots for the same doctor at the same time
doctorSlotSchema.index({ doctorId: 1, startTime: 1 }, { unique: true });

export const DoctorSlot = mongoose.model('DoctorSlot', doctorSlotSchema);
