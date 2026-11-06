/**
 * Medicine.js — Master medicine catalog.
 *
 * Individual pharmacies have their own Inventory records pointing to this.
 * Strength, form, and manufacturer matter — similar names ≠ same medicine.
 */

import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      required: [true, 'Brand name is required'],
      trim: true,
    },
    genericName: {
      type: String,
      required: [true, 'Generic name is required'],
      trim: true,
      lowercase: true,
    },
    strength: { type: String, trim: true }, // "500mg", "10mg/5ml"
    form: {
      type: String,
      enum: ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'other'],
      required: true,
    },
    manufacturer: { type: String, trim: true },
    category: { type: String, trim: true }, // "Antibiotic", "Analgesic"
    requiresPrescription: { type: Boolean, default: false },
    description: { type: String, maxlength: 500 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Text search across brand name, generic name, and manufacturer
medicineSchema.index({ brandName: 'text', genericName: 'text', manufacturer: 'text' });
medicineSchema.index({ genericName: 1, form: 1, strength: 1 });

export const Medicine = mongoose.model('Medicine', medicineSchema);
