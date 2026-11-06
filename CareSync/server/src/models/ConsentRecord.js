/**
 * ConsentRecord.js — Patient consent for sharing health records.
 *
 * A patient can grant a specific recipient (e.g., a doctor) access
 * to a specific record (e.g., a LabReport) for a limited time.
 *
 * Security:
 * - Backend always checks: isRevoked, expiresAt, and recipientId
 * - Access cannot be extended — a new consent must be created
 * - Every access attempt is logged in AuditLog
 */

import mongoose from 'mongoose';

const consentRecordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Who is allowed to access the record
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // What type of record and which specific record
    recordType: {
      type: String,
      enum: ['LabReport', 'Appointment'],
      required: true,
    },
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
    revokedAt: Date,
  },
  { timestamps: true }
);

consentRecordSchema.index({ patientId: 1, isRevoked: 1 });
consentRecordSchema.index({ recipientId: 1, recordId: 1, expiresAt: 1 });

export const ConsentRecord = mongoose.model('ConsentRecord', consentRecordSchema);
