import { Appointment } from '../models/Appointment.js';
import { ConsentRecord } from '../models/ConsentRecord.js';
import { LabReport } from '../models/LabReport.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { writeAuditLog } from '../utils/audit.js';

const MAX_CONSENT_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

export async function createConsent(req, res, next) {
  try {
    const { recipientId, recordType, recordId, expiresAt } = req.validatedData;
    const expiration = new Date(expiresAt);
    const now = new Date();
    if (expiration <= now || expiration.getTime() > now.getTime() + MAX_CONSENT_DURATION_MS) {
      throw new AppError('Consent expiry must be in the next 365 days', 400);
    }

    const recipient = await User.findOne({
      _id: recipientId,
      role: 'doctor',
      isActive: true,
      isVerified: true,
    });
    if (!recipient) throw new AppError('An active doctor recipient is required', 400);

    const record = recordType === 'Appointment'
      ? await Appointment.findOne({ _id: recordId, patientId: req.user.id }).select('_id')
      : await LabReport.findOne({ _id: recordId, patientId: req.user.id }).select('_id');
    if (!record) throw new AppError('Record not found for this patient', 404);

    const existing = await ConsentRecord.findOne({
      patientId: req.user.id,
      recipientId,
      recordType,
      recordId,
      isRevoked: false,
      expiresAt: { $gt: now },
    });
    if (existing) throw new AppError('An active consent already exists for this record and doctor', 409);

    const consent = await ConsentRecord.create({
      patientId: req.user.id,
      recipientId,
      recordType,
      recordId,
      expiresAt: expiration,
    });
    await writeAuditLog(req, {
      action: 'consent.create',
      resourceType: recordType,
      resourceId: recordId,
      metadata: { consentId: String(consent._id), recipientId: String(recipientId) },
    });
    res.status(201).json({ success: true, data: { consent } });
  } catch (error) {
    next(error);
  }
}

export async function getMyConsents(req, res, next) {
  try {
    const consents = await ConsentRecord.find({ patientId: req.user.id })
      .populate('recipientId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: { consents } });
  } catch (error) {
    next(error);
  }
}

export async function revokeConsent(req, res, next) {
  try {
    const consent = await ConsentRecord.findOneAndUpdate(
      { _id: req.params.id, patientId: req.user.id, isRevoked: false },
      { $set: { isRevoked: true, revokedAt: new Date() } },
      { new: true }
    );
    if (!consent) throw new AppError('Active consent not found', 404);
    await writeAuditLog(req, {
      action: 'consent.revoke',
      resourceType: consent.recordType,
      resourceId: consent.recordId,
      metadata: { consentId: String(consent._id), recipientId: String(consent.recipientId) },
    });
    res.status(200).json({ success: true, data: { consent } });
  } catch (error) {
    next(error);
  }
}
