/**
 * TestCatalog.js — Master list of available diagnostic tests.
 *
 * Individual labs set their own prices in LabInventory (separate model).
 * This is the global catalog — like a product catalog for tests.
 */

import mongoose from 'mongoose';

const testCatalogSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Test name is required'],
      trim: true,
      unique: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['blood', 'urine', 'imaging', 'pathology', 'cardiology', 'neurology', 'other'],
    },
    description: { type: String, maxlength: 1000 },
    sampleType: { type: String, trim: true }, // "Blood", "Urine", "Saliva"
    preparations: { type: String, maxlength: 500 }, // "Fast for 8 hours before test"
    reportTurnaround: { type: String }, // "1-2 business days"
    isActive: { type: Boolean, default: true },
    // Admin manages this catalog
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

testCatalogSchema.index({ name: 'text', category: 1 });

export const TestCatalog = mongoose.model('TestCatalog', testCatalogSchema);
