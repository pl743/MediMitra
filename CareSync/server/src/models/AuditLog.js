/**
 * AuditLog.js — Security audit trail.
 *
 * Records sensitive operations: login, consent access, admin actions, etc.
 * Never stores sensitive medical content — only who did what to which record.
 */

import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    action: {
      type: String,
      required: true,
      // Examples: 'user.login', 'report.access', 'consent.create', 'admin.verify_provider'
    },
    resourceType: { type: String }, // 'User', 'LabReport', 'Provider', etc.
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    // Safe metadata only — no passwords, no medical content
    metadata: { type: mongoose.Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    success: { type: Boolean, default: true },
    failureReason: { type: String },
  },
  {
    timestamps: true,
    // Audit logs are never updated, only inserted
    versionKey: false,
  }
);

auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
