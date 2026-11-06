import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/LabReport.js', () => ({ LabReport: { find: vi.fn(), findById: vi.fn() } }));
vi.mock('../services/consentService.js', () => ({ findActiveConsent: vi.fn() }));
vi.mock('../utils/audit.js', () => ({ writeAuditLog: vi.fn() }));

import { LabReport } from '../models/LabReport.js';
import { findActiveConsent } from '../services/consentService.js';
import { writeAuditLog } from '../utils/audit.js';
import { downloadReport, getMyReports, uploadReport } from './reportController.js';

describe('reportController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('denies a doctor without record-specific consent and records the denied attempt', async () => {
    LabReport.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({
      _id: 'report-id',
      patientId: 'patient-id',
    }) });
    findActiveConsent.mockResolvedValue(null);
    const next = vi.fn();
    await downloadReport({ params: { id: 'report-id' }, user: { id: 'doctor-id', role: 'doctor' } }, {}, next);
    expect(findActiveConsent).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: 'doctor-id',
      recordType: 'LabReport',
      recordId: 'report-id',
    }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'report.access',
      success: false,
    }));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('allows the patient through authorization but does not claim download without private storage', async () => {
    LabReport.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({
      _id: 'report-id',
      patientId: 'patient-id',
    }) });
    const next = vi.fn();
    await downloadReport({ params: { id: 'report-id' }, user: { id: 'patient-id', role: 'patient' } }, {}, next);
    expect(findActiveConsent).not.toHaveBeenCalled();
    expect(writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'report.access',
      success: true,
    }));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 501 }));
  });

  it('keeps report upload disabled until private storage is configured', async () => {
    const next = vi.fn();
    await uploadReport({}, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 501 }));
  });

  it('lists only the patient’s report metadata and excludes the private stored filename', async () => {
    const lean = vi.fn().mockResolvedValue([]);
    const sort = vi.fn().mockReturnValue({ lean });
    const select = vi.fn().mockReturnValue({ sort });
    LabReport.find.mockReturnValue({ select });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await getMyReports({ user: { id: 'patient-id' } }, res, vi.fn());

    expect(LabReport.find).toHaveBeenCalledWith({ patientId: 'patient-id' });
    expect(select).toHaveBeenCalledWith('_id labBookingId originalFilename mimeType fileSize summary uploadedAt');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
