/**
 * LabBooking.js — Patient booking for a diagnostic test at a lab.
 *
 * Status flow:
 *   requested → confirmed → sample_collected → processing → report_ready
 *            → cancelled
 */

import mongoose from 'mongoose';

const labBookingSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    labId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestCatalog',
      required: true,
    },
    // Optional: linked from a doctor's test recommendation
    referredByAppointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    collectionType: {
      type: String,
      enum: ['lab_visit', 'home_collection'],
      required: true,
    },
    scheduledAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['requested', 'confirmed', 'sample_collected', 'processing', 'report_ready', 'cancelled'],
      default: 'requested',
    },
    // Snapshot of the price at time of booking
    bookingDetails: {
      testName: String,
      labName: String,
      priceAtBooking: Number,
      collectionAddress: String, // For home collection
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabReport',
    },
    cancelledAt: Date,
    cancellationReason: String,
  },
  { timestamps: true }
);

labBookingSchema.index({ patientId: 1, status: 1, createdAt: -1 });
labBookingSchema.index({ labId: 1, status: 1, scheduledAt: 1 });

export const LabBooking = mongoose.model('LabBooking', labBookingSchema);
