import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/Appointment.js', () => ({
  Appointment: { findOne: vi.fn() },
}));

vi.mock('../models/CareJourney.js', () => ({
  CareJourney: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock('../models/LabBooking.js', () => ({
  LabBooking: { findOne: vi.fn() },
}));

vi.mock('../models/LabReport.js', () => ({
  LabReport: { exists: vi.fn() },
}));

import { Appointment } from '../models/Appointment.js';
import { CareJourney } from '../models/CareJourney.js';
import { LabBooking } from '../models/LabBooking.js';
import { addJourneyEvent } from './careJourneyService.js';

const appointmentId = '507f1f77bcf86cd799439011';

describe('careJourneyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records an event only when its owned appointment has the matching status', async () => {
    Appointment.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue({ _id: appointmentId, status: 'confirmed' }),
    });
    CareJourney.findOne.mockResolvedValueOnce(null).mockResolvedValue({ patientId: 'patient-id' });
    CareJourney.updateOne.mockResolvedValue({});
    CareJourney.findOneAndUpdate.mockResolvedValue({
      patientId: 'patient-id',
      events: [{ type: 'appointment_confirmed' }],
    });

    const journey = await addJourneyEvent('patient-id', {
      type: 'appointment_confirmed',
      title: 'Appointment confirmed',
      refModel: 'Appointment',
      refId: appointmentId,
    });

    expect(Appointment.findOne).toHaveBeenCalledWith({
      _id: appointmentId,
      patientId: 'patient-id',
    });
    expect(CareJourney.findOneAndUpdate).toHaveBeenCalledWith(
      {
        patientId: 'patient-id',
        events: { $not: { $elemMatch: { dedupeKey: `appointment_confirmed:Appointment:${appointmentId}` } } },
      },
      { $push: { events: expect.objectContaining({ dedupeKey: `appointment_confirmed:Appointment:${appointmentId}` }) } },
      { new: true, runValidators: true }
    );
    expect(journey.events).toHaveLength(1);
  });

  it('returns an existing event without inserting a duplicate', async () => {
    const existing = { events: [{ type: 'appointment_booked' }] };
    CareJourney.findOne.mockResolvedValue(existing);

    const result = await addJourneyEvent('patient-id', {
      type: 'appointment_booked',
      title: 'Appointment booked',
      refModel: 'Appointment',
      refId: appointmentId,
    });

    expect(CareJourney.findOne).toHaveBeenCalledWith({
      patientId: 'patient-id',
      events: { $elemMatch: { dedupeKey: `appointment_booked:Appointment:${appointmentId}` } },
    });
    expect(Appointment.findOne).not.toHaveBeenCalled();
    expect(CareJourney.findOneAndUpdate).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });

  it('rejects unsupported event types and source records not owned by the patient', async () => {
    await expect(addJourneyEvent('patient-id', {
      type: 'invented_medical_claim',
      title: 'Arbitrary event',
      refModel: 'Appointment',
      refId: appointmentId,
    })).rejects.toMatchObject({ statusCode: 400 });

    CareJourney.findOne.mockResolvedValue(null);
    Appointment.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
    await expect(addJourneyEvent('patient-id', {
      type: 'appointment_booked',
      title: 'Appointment booked',
      refModel: 'Appointment',
      refId: appointmentId,
    })).rejects.toMatchObject({ statusCode: 404 });
    expect(LabBooking.findOne).not.toHaveBeenCalled();
  });

  it('rejects an event when the source status does not support that transition', async () => {
    CareJourney.findOne.mockResolvedValue(null);
    Appointment.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue({ _id: appointmentId, status: 'booked' }),
    });

    await expect(addJourneyEvent('patient-id', {
      type: 'consultation_completed',
      title: 'Consultation completed',
      refModel: 'Appointment',
      refId: appointmentId,
    })).rejects.toMatchObject({ statusCode: 409 });
  });
});
