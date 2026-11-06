/**
 * LabReport.js — Diagnostic report uploaded by lab staff.
 *
 * Security:
 * - Reports are stored with a server-generated UUID filename
 * - Only the patient and authorized doctor can access
 * - Reports are served through an authenticated API route, NOT a public URL
 */

import mongoose from 'mongoose';

const labReportSchema = new mongoose.Schema(
  {
    labBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabBooking',
      required: true,
      unique: true, // One report per booking
    },
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
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Server-generated filename (never the original upload name)
    storedFilename: { type: String, required: true },
    originalFilename: { type: String }, // For display only
    mimeType: { type: String }, // Validated on upload
    fileSize: { type: Number }, // In bytes
    // Summary text (optional)
    summary: { type: String, maxlength: 2000 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

labReportSchema.index({ patientId: 1 });

export const LabReport = mongoose.model('LabReport', labReportSchema);
