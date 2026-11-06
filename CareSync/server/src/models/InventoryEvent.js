/**
 * InventoryEvent.js — Audit log of all inventory changes.
 *
 * Every time stock is added, removed, reserved, or released,
 * an event is recorded here. This creates a full history.
 */

import mongoose from 'mongoose';

const inventoryEventSchema = new mongoose.Schema(
  {
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
    type: {
      type: String,
      enum: ['stock_add', 'stock_remove', 'reservation', 'reservation_release', 'confirmation', 'adjustment'],
      required: true,
    },
    quantityDelta: { type: Number }, // Positive = added, Negative = removed
    quantityAfter: { type: Number }, // Quantity after this event
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: { type: String, maxlength: 200 },
    relatedReservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
    },
  },
  { timestamps: true }
);

inventoryEventSchema.index({ inventoryId: 1, createdAt: -1 });
inventoryEventSchema.index({ pharmacyId: 1, createdAt: -1 });

export const InventoryEvent = mongoose.model('InventoryEvent', inventoryEventSchema);
