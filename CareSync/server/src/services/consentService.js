import { ConsentRecord } from '../models/ConsentRecord.js';

export async function findActiveConsent({ recipientId, recordType, recordId, now = new Date() }) {
  return ConsentRecord.findOne({
    recipientId,
    recordType,
    recordId,
    isRevoked: false,
    expiresAt: { $gt: now },
  });
}
