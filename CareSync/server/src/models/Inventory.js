/**
 * Inventory.js — Stock record for a medicine at a specific pharmacy.
 *
 * Concurrency safety for reservations:
 * - quantity: total physically available stock
 * - reservedQuantity: temporarily reserved, pending pharmacy confirmation
 * - availableQuantity: quantity - reservedQuantity (computed)
 *
 * When a patient requests a reservation:
 *   Use findOneAndUpdate with condition: { quantity - reservedQuantity >= requestedQty }
 *   Atomically increment reservedQuantity.
 *
 * confirmedAt: When the pharmacist last confirmed the stock count.
 *   If this is old (e.g., > 24 hours), we display a "Stock may be outdated" warning.
 */

import mongoose from 'mongoose';

const inventorySchema = new mongoose.Schema(
  {
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
      min: [0, 'Quantity cannot be negative'],
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Reserved quantity cannot be negative'],
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
    },
    // When pharmacist last confirmed this stock count
    confirmedAt: {
      type: Date,
      default: Date.now,
    },
    // Is this inventory record currently active/visible to patients
    isAvailable: { type: Boolean, default: true },
    // Low stock threshold for dashboard warning
    lowStockThreshold: { type: Number, default: 10 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Each pharmacy can only have one inventory record per medicine
inventorySchema.index({ pharmacyId: 1, medicineId: 1 }, { unique: true });
inventorySchema.index({ pharmacyId: 1, isAvailable: 1 });
inventorySchema.index({ medicineId: 1 });

// Virtual: available = total - reserved
inventorySchema.virtual('availableQuantity').get(function () {
  return Math.max(0, this.quantity - this.reservedQuantity);
});

// Virtual: is this stock reading stale (> 24 hours old)?
inventorySchema.virtual('isStale').get(function () {
  if (!this.confirmedAt) return true;
  const hoursSinceConfirm = (Date.now() - this.confirmedAt) / (1000 * 60 * 60);
  return hoursSinceConfirm > 24;
});

export const Inventory = mongoose.model('Inventory', inventorySchema);
