import { AuditLog } from '../models/AuditLog.js';

export async function writeAuditLog(req, entry) {
  return AuditLog.create({
    actorId: req.user?.id,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    metadata: entry.metadata,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
    success: entry.success ?? true,
    failureReason: entry.failureReason,
  });
}
