import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/Appointment.js', () => ({
  Appointment: { find: vi.fn() },
}));

vi.mock('../models/CareJourney.js', () => ({
  CareJourney: { findOne: vi.fn() },
}));

vi.mock('../models/LabBooking.js', () => ({
  LabBooking: { find: vi.fn() },
}));

vi.mock('../models/LabReport.js', () => ({
  LabReport: { find: vi.fn() },
}));

import { Appointment } from '../models/Appointment.js';
import { CareJourney } from '../models/CareJourney.js';
import { LabBooking } from '../models/LabBooking.js';
import { LabReport } from '../models/LabReport.js';
import { getMyJourney } from './careJourneyController.js';

function sourceQuery(value) {
  const query = {
    select: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(value),
  };
  return query;
}

describe('careJourneyController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a timeline from the authenticated patient’s real appointments and lab bookings', async () => {
    CareJourney.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        events: [{
          type: 'appointment_booked',
          title: 'Appointment booked',
          refModel: 'Appointment',
          refId: 'appointment-id',
          timestamp: new Date('2026-01-01T10:00:00Z'),
        }],
      }),
    });
    Appointment.find.mockReturnValue(sourceQuery([{
      _id: 'appointment-id',
      status: 'confirmed',
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-02T10:00:00Z'),
      bookingDetails: { doctorName: 'Dr. Care' },
    }]));
    LabBooking.find.mockReturnValue(sourceQuery([{
      _id: 'booking-id',
      status: 'requested',
      createdAt: new Date('2026-01-03T10:00:00Z'),
      bookingDetails: { testName: 'Blood test', labName: 'Verified Lab' },
    }]));
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await getMyJourney({ user: { id: 'my-patient-id' } }, res, vi.fn());

    expect(CareJourney.findOne).toHaveBeenCalledWith({ patientId: 'my-patient-id' });
    expect(Appointment.find).toHaveBeenCalledWith({ patientId: 'my-patient-id' });
    expect(LabBooking.find).toHaveBeenCalledWith({ patientId: 'my-patient-id' });
    const events = res.json.mock.calls[0][0].data.events;
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining([
      'appointment_booked',
      'appointment_confirmed',
      'lab_booking_created',
    ]));
    expect(events.filter((event) => event.type === 'appointment_booked')).toHaveLength(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('does not expose a report-ready event without a real linked patient report', async () => {
    CareJourney.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        events: [{
          type: 'report_ready',
          title: 'Report ready',
          refModel: 'LabBooking',
          refId: 'booking-id',
          timestamp: new Date('2026-01-03T10:00:00Z'),
        }],
      }),
    });
    Appointment.find.mockReturnValue(sourceQuery([]));
    LabBooking.find.mockReturnValue(sourceQuery([{
      _id: 'booking-id',
      status: 'report_ready',
      reportId: 'report-id',
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-03T10:00:00Z'),
    }]));
    const reportQuery = {
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    };
    LabReport.find.mockReturnValue(reportQuery);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await getMyJourney({ user: { id: 'my-patient-id' } }, res, vi.fn());

    const events = res.json.mock.calls[0][0].data.events;
    expect(events.map((event) => event.type)).toEqual(['lab_booking_created']);
  });
});
