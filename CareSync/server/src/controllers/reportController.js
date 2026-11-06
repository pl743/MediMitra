import { LabReport } from '../models/LabReport.js';
import { findActiveConsent } from '../services/consentService.js';
import { writeAuditLog } from '../utils/audit.js';
import { AppError } from '../utils/AppError.js';

export async function uploadReport(req, res, next) {
  try {
    throw new AppError('Private report file storage is not configured; upload is unavailable', 501);
  } catch (error) {
    next(error);
  }
}

export async function getMyReports(req, res, next) {
  try {
    const reports = await LabReport.find({ patientId: req.user.id })
      .select('_id labBookingId originalFilename mimeType fileSize summary uploadedAt')
      .sort({ uploadedAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: { reports } });
  } catch (error) {
    next(error);
  }
}

export async function downloadReport(req, res, next) {
  try {
    const report = await LabReport.findById(req.params.id).select('_id patientId');
    if (!report) throw new AppError('Report not found', 404);

    const isPatient = report.patientId.toString() === req.user.id;
    const consent = !isPatient && req.user.role === 'doctor'
      ? await findActiveConsent({
        recipientId: req.user.id,
        recordType: 'LabReport',
        recordId: report._id,
      })
      : null;
    const allowed = isPatient || Boolean(consent);
    await writeAuditLog(req, {
      action: 'report.access',
      resourceType: 'LabReport',
      resourceId: report._id,
      metadata: { consentGranted: Boolean(consent) },
      success: allowed,
      failureReason: allowed ? undefined : 'Patient ownership or active recipient consent required',
    });
    if (!allowed) throw new AppError('Access denied', 403);

    throw new AppError('Private report file storage is not configured; download is unavailable', 501);
  } catch (error) {
    next(error);
  }
}
