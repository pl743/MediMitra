/**
 * ImportJob.js — Record of CSV bulk import operations.
 *
 * Tracks each admin-initiated import with its result summary.
 */

import mongoose from 'mongoose';

const importJobSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['test_catalog', 'medicine_catalog', 'pharmacy_inventory'],
      required: true,
    },
    originalFilename: { type: String },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
    },
    result: {
      totalRows: { type: Number, default: 0 },
      successCount: { type: Number, default: 0 },
      skippedCount: { type: Number, default: 0 },
      failedCount: { type: Number, default: 0 },
      // Array of { row: number, error: string } for failed rows
      errors: [{ row: Number, error: String }],
    },
    completedAt: Date,
  },
  { timestamps: true }
);

importJobSchema.index({ adminId: 1, createdAt: -1 });

export const ImportJob = mongoose.model('ImportJob', importJobSchema);
