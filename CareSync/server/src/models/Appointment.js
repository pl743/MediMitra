/**
 * Appointment.js — Patient appointment bookings.
 *
 * Status flow:
 *   booked → confirmed → completed
 *         → cancelled
 *         → no_show
 *
 * Status transitions are enforced in the appointmentService.
 */

import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
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
      required: true,
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DoctorSlot',
      required: true,
    },
    status: {
      type: String,
      enum: ['booked', 'confirmed', 'cancelled', 'completed', 'no_show'],
      default: 'booked',
    },
    // Patient's reason for visit (optional)
    reasonForVisit: { type: String, maxlength: 500 },
    // Doctor notes after consultation (private — not shown to patient in basic view)
    consultationNotes: { type: String, maxlength: 2000, select: false },
    // Snapshot of booking details (preserved even if doctor changes fee)
    bookingDetails: {
      slotStartTime: Date,
      slotEndTime: Date,
      doctorName: String,
      providerName: String,
      consultationFee: Number,
    },
    cancelledAt: Date,
    cancelledBy: {
      type: String,
      enum: ['patient', 'doctor', 'admin'],
    },
    cancellationReason: String,
    completedAt: Date,
  },
  { timestamps: true }
);

// Fast lookup for patient appointment history
appointmentSchema.index({ patientId: 1, status: 1, createdAt: -1 });
// Fast lookup for doctor's daily schedule
appointmentSchema.index({ doctorId: 1, 'bookingDetails.slotStartTime': 1, status: 1 });

export const Appointment = mongoose.model('Appointment', appointmentSchema);
