import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/LabBooking.js', () => ({
  LabBooking: {
    create: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    exists: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock('../models/Provider.js', () => ({
  Provider: {
    findOne: vi.fn(),
    exists: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock('../models/TestCatalog.js', () => ({
  TestCatalog: { findOne: vi.fn() },
}));

vi.mock('../models/LabReport.js', () => ({
  LabReport: { exists: vi.fn() },
}));

vi.mock('../services/careJourneyService.js', () => ({
  addJourneyEvent: vi.fn(),
}));

vi.mock('../services/notificationService.js', () => ({
  createNotification: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { error: vi.fn() },
}));

import { LabBooking } from '../models/LabBooking.js';
import { LabReport } from '../models/LabReport.js';
import { Provider } from '../models/Provider.js';
import { TestCatalog } from '../models/TestCatalog.js';
import { addJourneyEvent } from '../services/careJourneyService.js';
import { createNotification } from '../services/notificationService.js';
import {
  cancelLabBooking,
  createLabBooking,
  getMyLabBookings,
  updateLabBookingStatus,
} from './labBookingController.js';
import {
  createLabBookingSchema,
  updateLabBookingStatusSchema,
} from '../validators/labBookingValidators.js';

describe('labBookingController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a pending booking request using active lab and test records', async () => {
    const lab = { _id: 'lab-id', name: 'Verified Lab' };
    const test = { _id: 'test-id', name: 'Blood panel' };
    Provider.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(lab) });
    TestCatalog.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(test) });
    LabBooking.exists.mockResolvedValue(false);
    LabBooking.create.mockResolvedValue({ _id: 'booking-id', status: 'requested' });
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await createLabBooking(
      {
        user: { id: 'patient-id', role: 'patient' },
        validatedData: {
          labId: 'lab-id',
          testId: 'test-id',
          collectionType: 'lab_visit',
          scheduledAt: new Date(Date.now() + 60_000).toISOString(),
        },
      },
      response,
      vi.fn()
    );

    expect(LabBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-id',
        labId: 'lab-id',
        testId: 'test-id',
        status: 'requested',
        bookingDetails: { testName: 'Blood panel', labName: 'Verified Lab', collectionAddress: undefined },
      })
    );
    expect(addJourneyEvent).toHaveBeenCalledWith('patient-id', expect.objectContaining({
      type: 'lab_booking_created',
      refModel: 'LabBooking',
      refId: 'booking-id',
    }));
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'patient-id',
      type: 'lab_booking_created',
      dedupeKey: 'lab_booking_created:booking-id',
    }));
    expect(response.status).toHaveBeenCalledWith(201);
  });

  it('rejects home collection without an address and past scheduled times', () => {
    const result = createLabBookingSchema.safeParse({
      labId: '507f1f77bcf86cd799439011',
      testId: '507f1f77bcf86cd799439012',
      collectionType: 'home_collection',
      scheduledAt: '2020-01-01T10:00:00.000Z',
    });

    expect(result.success).toBe(false);
    expect(updateLabBookingStatusSchema.safeParse({ status: 'unknown' }).success).toBe(false);
  });

  it('accepts a future lab-visit request and validates required booking fields', () => {
    const valid = createLabBookingSchema.safeParse({
      labId: '507f1f77bcf86cd799439011',
      testId: '507f1f77bcf86cd799439012',
      collectionType: 'lab_visit',
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const invalid = createLabBookingSchema.safeParse({
      labId: 'invalid',
      testId: '507f1f77bcf86cd799439012',
      collectionType: 'unsupported',
      scheduledAt: 'not-a-date',
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it('rejects a duplicate active request for the same patient, test, lab, and time', async () => {
    Provider.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'lab-id' }) });
    TestCatalog.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'test-id' }) });
    LabBooking.exists.mockResolvedValue(true);
    const next = vi.fn();

    await createLabBooking(
      {
        user: { id: 'patient-id', role: 'patient' },
        validatedData: {
          labId: 'lab-id',
          testId: 'test-id',
          collectionType: 'lab_visit',
          scheduledAt: new Date(Date.now() + 60_000).toISOString(),
        },
      },
      {},
      next
    );

    expect(LabBooking.create).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
  });

  it('lists only the authenticated patient’s bookings', async () => {
    const query = {
      populate: vi.fn(),
      sort: vi.fn(),
      skip: vi.fn(),
      limit: vi.fn(),
    };
    query.populate.mockReturnValue(query);
    query.sort.mockReturnValue(query);
    query.skip.mockReturnValue(query);
    query.limit.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    LabBooking.find.mockReturnValue(query);
    LabBooking.countDocuments.mockResolvedValue(0);
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await getMyLabBookings({ user: { id: 'patient-id' }, query: {} }, response, vi.fn());

    expect(LabBooking.find).toHaveBeenCalledWith({ patientId: 'patient-id' });
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('does not allow another patient to cancel a booking', async () => {
    LabBooking.findById.mockResolvedValue({ patientId: 'other-patient-id', status: 'requested' });
    const next = vi.fn();

    await cancelLabBooking(
      {
        params: { id: '507f1f77bcf86cd799439011' },
        user: { id: 'patient-id', role: 'patient' },
        validatedData: {},
      },
      {},
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(LabBooking.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects cancellation after the lab has confirmed the request', async () => {
    LabBooking.findById.mockResolvedValue({
      patientId: 'patient-id',
      status: 'confirmed',
    });
    LabBooking.findOneAndUpdate.mockResolvedValue(null);
    const next = vi.fn();

    await cancelLabBooking(
      {
        params: { id: '507f1f77bcf86cd799439011' },
        user: { id: 'patient-id', role: 'patient' },
        validatedData: {},
      },
      {},
      next
    );

    expect(LabBooking.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'requested' }),
      expect.any(Object),
      expect.any(Object)
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
  });

  it('cancels the authenticated patient’s pending request', async () => {
    LabBooking.findById.mockResolvedValue({
      _id: 'booking-id',
      patientId: 'patient-id',
      status: 'requested',
    });
    const cancelled = { _id: 'booking-id', patientId: 'patient-id', status: 'cancelled' };
    LabBooking.findOneAndUpdate.mockResolvedValue(cancelled);
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await cancelLabBooking(
      {
        params: { id: '507f1f77bcf86cd799439011' },
        user: { id: 'patient-id', role: 'patient' },
        validatedData: { reason: 'No longer needed' },
      },
      response,
      vi.fn()
    );

    expect(LabBooking.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'requested', patientId: 'patient-id' }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'cancelled',
          cancellationReason: 'No longer needed',
        }),
      }),
      { new: true, runValidators: true }
    );
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('only lets staff update bookings for labs they manage', async () => {
    LabBooking.findById.mockResolvedValue({
      _id: 'booking-id',
      labId: 'lab-id',
      status: 'requested',
    });
    Provider.exists.mockResolvedValue(false);
    const next = vi.fn();

    await updateLabBookingStatus(
      {
        params: { id: '507f1f77bcf86cd799439011' },
        user: { id: 'lab-staff-id', role: 'lab_staff' },
        validatedData: { status: 'confirmed' },
      },
      {},
      next
    );

    expect(Provider.exists).toHaveBeenCalledWith({
      _id: 'lab-id',
      type: 'laboratory',
      managedBy: 'lab-staff-id',
    });
    expect(LabBooking.findOneAndUpdate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('lets assigned lab staff confirm a future request', async () => {
    const booking = {
      _id: 'booking-id',
      patientId: 'patient-id',
      labId: 'lab-id',
      status: 'requested',
      scheduledAt: new Date(Date.now() + 60_000),
    };
    const updated = { ...booking, patientId: 'patient-id', status: 'confirmed' };
    LabBooking.findById.mockResolvedValue(booking);
    Provider.exists.mockResolvedValue(true);
    LabBooking.findOneAndUpdate.mockResolvedValue(updated);
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await updateLabBookingStatus(
      {
        params: { id: '507f1f77bcf86cd799439011' },
        user: { id: 'lab-staff-id', role: 'lab_staff' },
        validatedData: { status: 'confirmed' },
      },
      response,
      vi.fn()
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(LabBooking.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'booking-id', status: 'requested' },
      { $set: { status: 'confirmed' } },
      { new: true, runValidators: true }
    );
  });

  it('does not confirm a request after its preferred time has passed', async () => {
    LabBooking.findById.mockResolvedValue({
      _id: 'booking-id',
      labId: 'lab-id',
      status: 'requested',
      scheduledAt: new Date(Date.now() - 60_000),
    });
    Provider.exists.mockResolvedValue(true);
    const next = vi.fn();

    await updateLabBookingStatus(
      {
        params: { id: '507f1f77bcf86cd799439011' },
        user: { id: 'lab-staff-id', role: 'lab_staff' },
        validatedData: { status: 'confirmed' },
      },
      {},
      next
    );

    expect(LabBooking.findOneAndUpdate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
  });

  it('does not mark a lab booking report ready without the linked report record', async () => {
    LabBooking.findById.mockResolvedValue({
      _id: 'booking-id',
      patientId: 'patient-id',
      labId: 'lab-id',
      status: 'processing',
      reportId: null,
    });
    Provider.exists.mockResolvedValue(true);
    const next = vi.fn();

    await updateLabBookingStatus({
      params: { id: '507f1f77bcf86cd799439011' },
      user: { id: 'lab-staff-id', role: 'lab_staff' },
      validatedData: { status: 'report_ready' },
    }, {}, next);

    expect(LabReport.exists).not.toHaveBeenCalled();
    expect(LabBooking.findOneAndUpdate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
  });
});
