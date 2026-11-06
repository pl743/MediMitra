import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/Appointment.js', () => ({ Appointment: { findOne: vi.fn() } }));
vi.mock('../models/ConsentRecord.js', () => ({
  ConsentRecord: { create: vi.fn(), findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() },
}));
vi.mock('../models/LabReport.js', () => ({ LabReport: { findOne: vi.fn() } }));
vi.mock('../models/User.js', () => ({ User: { findOne: vi.fn() } }));
vi.mock('../utils/audit.js', () => ({ writeAuditLog: vi.fn() }));

import { Appointment } from '../models/Appointment.js';
import { ConsentRecord } from '../models/ConsentRecord.js';
import { User } from '../models/User.js';
import { writeAuditLog } from '../utils/audit.js';
import { createConsent, getMyConsents, revokeConsent } from './consentController.js';

describe('consentController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('grants access only to an appointment owned by the authenticated patient', async () => {
    User.findOne.mockResolvedValue({ _id: 'doctor-id', role: 'doctor' });
    const select = vi.fn().mockResolvedValue({ _id: 'appointment-id' });
    Appointment.findOne.mockReturnValue({ select });
    ConsentRecord.findOne.mockResolvedValue(null);
    ConsentRecord.create.mockResolvedValue({ _id: 'consent-id' });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await createConsent({
      user: { id: 'patient-id' },
      validatedData: {
        recipientId: 'doctor-id',
        recordType: 'Appointment',
        recordId: 'appointment-id',
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    }, res, vi.fn());

    expect(Appointment.findOne).toHaveBeenCalledWith({
      _id: 'appointment-id',
      patientId: 'patient-id',
    });
    expect(ConsentRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      patientId: 'patient-id',
      recipientId: 'doctor-id',
      recordType: 'Appointment',
      recordId: 'appointment-id',
    }));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'consent.create',
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects attempts to share another patient’s record', async () => {
    User.findOne.mockResolvedValue({ _id: 'doctor-id' });
    Appointment.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
    const next = vi.fn();
    await createConsent({
      user: { id: 'patient-id' },
      validatedData: {
        recipientId: 'doctor-id',
        recordType: 'Appointment',
        recordId: 'not-owned',
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(ConsentRecord.create).not.toHaveBeenCalled();
  });

  it('rejects consent expiry beyond the supported one-year limit', async () => {
    const next = vi.fn();
    await createConsent({
      user: { id: 'patient-id' },
      validatedData: {
        recipientId: 'doctor-id',
        recordType: 'Appointment',
        recordId: 'appointment-id',
        expiresAt: new Date(Date.now() + 366 * 86_400_000).toISOString(),
      },
    }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(User.findOne).not.toHaveBeenCalled();
    expect(ConsentRecord.create).not.toHaveBeenCalled();
  });

  it('lists only the authenticated patient’s consents', async () => {
    const lean = vi.fn().mockResolvedValue([]);
    const sort = vi.fn().mockReturnValue({ lean });
    const populate = vi.fn().mockReturnValue({ sort });
    ConsentRecord.find.mockReturnValue({ populate });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await getMyConsents({ user: { id: 'patient-id' } }, res, vi.fn());
    expect(ConsentRecord.find).toHaveBeenCalledWith({ patientId: 'patient-id' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('revokes consent only when owned by the authenticated patient', async () => {
    ConsentRecord.findOneAndUpdate.mockResolvedValue(null);
    const next = vi.fn();
    await revokeConsent({ params: { id: 'consent-id' }, user: { id: 'patient-id' } }, {}, next);
    expect(ConsentRecord.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'consent-id', patientId: 'patient-id', isRevoked: false },
      { $set: { isRevoked: true, revokedAt: expect.any(Date) } },
      { new: true }
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(writeAuditLog).not.toHaveBeenCalled();
  });

  it('records a patient-authorized revocation', async () => {
    const consent = {
      _id: 'consent-id',
      recordType: 'Appointment',
      recordId: 'appointment-id',
      recipientId: 'doctor-id',
    };
    ConsentRecord.findOneAndUpdate.mockResolvedValue(consent);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await revokeConsent({ params: { id: 'consent-id' }, user: { id: 'patient-id' } }, res, vi.fn());
    expect(writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'consent.revoke',
      resourceId: 'appointment-id',
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
