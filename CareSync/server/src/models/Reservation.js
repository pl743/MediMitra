/**
 * Reservation.js — Medicine reservation request from a patient.
 *
 * Status flow:
 *   pending → confirmed → fulfilled
 *           → rejected
 *           → cancelled (by patient)
 *           → expired (auto, if pharmacy doesn't respond)
 *
 * When status changes to rejected/cancelled/expired:
 *   The reserved quantity must be released back to inventory.
 */

import mongoose from 'mongoose';

const reservationSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
    },
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'rejected', 'cancelled', 'expired', 'fulfilled'],
      default: 'pending',
    },
    // Snapshot of price at reservation time
    priceAtReservation: { type: Number },
    // When should this reservation auto-expire if pharmacy doesn't respond
    expiresAt: {
      type: Date,
      required: true,
    },
    respondedAt: Date,
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: String,
    cancellationReason: String,
    patientNotes: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

reservationSchema.index({ patientId: 1, status: 1, createdAt: -1 });
reservationSchema.index({ pharmacyId: 1, status: 1, createdAt: -1 });
reservationSchema.index({ expiresAt: 1, status: 1 }); // For expiry job

export const Reservation = mongoose.model('Reservation', reservationSchema);
