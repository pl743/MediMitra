import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/Appointment.js', () => ({
  Appointment: {
    create: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock('../models/DoctorSlot.js', () => ({
  DoctorSlot: {
    findOneAndUpdate: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock('../models/DoctorProfile.js', () => ({
  DoctorProfile: {
    findOne: vi.fn(),
  },
}));

vi.mock('../services/notificationService.js', () => ({
  createNotification: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { error: vi.fn() },
}));

vi.mock('../services/careJourneyService.js', () => ({
  addJourneyEvent: vi.fn(),
}));

vi.mock('../services/waitlistService.js', () => ({
  offerAvailableSlot: vi.fn(),
}));

import { Appointment } from '../models/Appointment.js';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { DoctorSlot } from '../models/DoctorSlot.js';
import { createNotification } from '../services/notificationService.js';
import { addJourneyEvent } from '../services/careJourneyService.js';
import { logger } from '../utils/logger.js';
import { offerAvailableSlot } from '../services/waitlistService.js';
import {
  bookAppointment,
  cancelAppointment,
  getMyAppointments,
  rescheduleAppointment,
  updateAppointmentStatus,
} from './appointmentController.js';

describe('appointmentController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a slot that has already been claimed', async () => {
    DoctorSlot.findOneAndUpdate.mockResolvedValue(null);
    const next = vi.fn();

    await bookAppointment(
      { validatedData: { slotId: '507f1f77bcf86cd799439011' }, user: { id: 'patient-id' } },
      {},
      next
    );

    expect(DoctorSlot.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: '507f1f77bcf86cd799439011',
        isBooked: false,
        startTime: { $gt: expect.any(Date) },
        endTime: { $gt: expect.any(Date) },
      }),
      { isBooked: true },
      { new: true }
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(Appointment.create).not.toHaveBeenCalled();
  });

  it('releases a claimed slot if appointment creation fails', async () => {
    const slot = {
      _id: 'slot-id',
      doctorId: 'doctor-id',
      providerId: 'provider-id',
      startTime: new Date(Date.now() + 60_000),
      endTime: new Date(Date.now() + 90_000),
    };
    DoctorSlot.findOneAndUpdate
      .mockResolvedValueOnce(slot)
      .mockResolvedValueOnce(null);
    const profileQuery = { populate: vi.fn() };
    profileQuery.populate.mockReturnValue(profileQuery);
    const profile = { ...profileQuery, userId: { firstName: 'Care', lastName: 'Doctor' } };
    profileQuery.populate.mockReturnValueOnce(profile).mockReturnValueOnce(profile);
    DoctorProfile.findOne.mockReturnValue(profileQuery);
    Appointment.create.mockRejectedValue(new Error('database write failed'));
    const next = vi.fn();

    await bookAppointment(
      { validatedData: { slotId: 'slot-id' }, user: { id: 'patient-id' } },
      {},
      next
    );

    expect(DoctorSlot.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { _id: 'slot-id', isBooked: true, appointmentId: null },
      { isBooked: false },
      { new: true }
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'database write failed' }));
  });

  it('returns booking success when ancillary post-booking effects fail', async () => {
    const slot = {
      _id: 'slot-id',
      doctorId: 'doctor-id',
      providerId: 'provider-id',
      startTime: new Date(Date.now() + 60_000),
      endTime: new Date(Date.now() + 90_000),
      save: vi.fn(),
    };
    const profile = {
      userId: { firstName: 'Care', lastName: 'Doctor' },
      providerId: { name: 'Care Clinic' },
      consultationFee: 100,
    };
    const profileQuery = { populate: vi.fn() };
    profileQuery.populate.mockReturnValueOnce(profileQuery).mockReturnValueOnce(profile);
    DoctorSlot.findOneAndUpdate.mockResolvedValue(slot);
    DoctorProfile.findOne.mockReturnValue(profileQuery);
    Appointment.create.mockResolvedValue({
      _id: 'appointment-id',
      bookingDetails: { doctorName: 'Care Doctor' },
    });
    addJourneyEvent.mockRejectedValue(new Error('journey service unavailable'));
    createNotification.mockRejectedValue(new Error('notification service unavailable'));
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await bookAppointment(
      { validatedData: { slotId: 'slot-id' }, user: { id: 'patient-id' } },
      response,
      vi.fn()
    );

    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it.each(['completed', 'cancelled', 'no_show'])(
    'does not allow cancelling an appointment in terminal status %s',
    async (status) => {
      Appointment.findById.mockResolvedValue({
        patientId: 'patient-id',
        doctorId: 'doctor-id',
        status,
        save: vi.fn(),
      });
      const next = vi.fn();

      await cancelAppointment(
        { params: { id: 'appointment-id' }, user: { id: 'patient-id', role: 'patient' }, body: {} },
        {},
        next
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
      expect(DoctorSlot.findByIdAndUpdate).not.toHaveBeenCalled();
    }
  );

  it('scopes appointment history to the authenticated patient', async () => {
    const query = {
      populate: vi.fn(),
      sort: vi.fn(),
      skip: vi.fn(),
      limit: vi.fn(),
    };
    query.populate.mockReturnValue(query);
    query.sort.mockReturnValue(query);
    query.skip.mockReturnValue(query);
    query.limit.mockResolvedValue([]);
    Appointment.find.mockReturnValue(query);
    Appointment.countDocuments.mockResolvedValue(0);
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await getMyAppointments({ user: { id: 'my-patient-id' }, query: {} }, response, vi.fn());

    expect(Appointment.find).toHaveBeenCalledWith({ patientId: 'my-patient-id' });
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('denies a patient access to another patient’s appointment cancellation', async () => {
    const save = vi.fn();
    Appointment.findById.mockResolvedValue({
      patientId: 'another-patient-id',
      doctorId: 'doctor-id',
      status: 'booked',
      save,
    });
    const next = vi.fn();

    await cancelAppointment(
      { params: { id: 'appointment-id' }, user: { id: 'patient-id', role: 'patient' }, body: {} },
      {},
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(save).not.toHaveBeenCalled();
  });

  it('returns cancellation success when the care journey update fails', async () => {
    const appointment = {
      _id: 'appointment-id',
      patientId: 'patient-id',
      doctorId: 'doctor-id',
      slotId: 'slot-id',
      status: 'booked',
    };
    const cancelledAppointment = { ...appointment, status: 'cancelled', updatedAt: new Date() };
    Appointment.findById.mockResolvedValue(appointment);
    Appointment.findOneAndUpdate.mockResolvedValue(cancelledAppointment);
    DoctorSlot.findOneAndUpdate.mockResolvedValue({ _id: 'slot-id' });
    addJourneyEvent.mockRejectedValue(new Error('journey service unavailable'));
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await cancelAppointment(
      { params: { id: 'appointment-id' }, user: { id: 'patient-id', role: 'patient' }, body: {} },
      response,
      vi.fn()
    );

    expect(Appointment.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'appointment-id', status: { $in: ['booked', 'confirmed'] } },
      { $set: expect.objectContaining({ status: 'cancelled', cancelledBy: 'patient' }) },
      { new: true, runValidators: true }
    );
    expect(DoctorSlot.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'slot-id', appointmentId: 'appointment-id', isBooked: true },
      { $set: { isBooked: false, appointmentId: null } },
      { new: true }
    );
    expect(offerAvailableSlot).toHaveBeenCalledWith('slot-id');
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(logger.error).toHaveBeenCalledWith(
      { error: 'journey service unavailable', appointmentId: 'appointment-id' },
      'Appointment cancelled, but the care journey event could not be recorded'
    );
  });

  it('does not release a slot when another request already changed the appointment status', async () => {
    Appointment.findById.mockResolvedValue({
      _id: 'appointment-id',
      patientId: 'patient-id',
      doctorId: 'doctor-id',
      slotId: 'slot-id',
      status: 'booked',
    });
    Appointment.findOneAndUpdate.mockResolvedValue(null);
    const next = vi.fn();

    await cancelAppointment(
      { params: { id: 'appointment-id' }, user: { id: 'patient-id', role: 'patient' }, body: {} },
      {},
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(DoctorSlot.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('secures a replacement slot before atomically updating the appointment', async () => {
    const appointment = {
      _id: 'appointment-id',
      patientId: 'patient-id',
      doctorId: 'doctor-id',
      slotId: 'old-slot-id',
      status: 'confirmed',
    };
    const updatedAppointment = { ...appointment, slotId: 'new-slot-id', status: 'booked' };
    const newSlot = {
      _id: 'new-slot-id',
      startTime: new Date(Date.now() + 60_000),
      endTime: new Date(Date.now() + 90_000),
    };
    Appointment.findById.mockResolvedValue(appointment);
    Appointment.findOneAndUpdate.mockResolvedValue(updatedAppointment);
    DoctorSlot.findOneAndUpdate
      .mockResolvedValueOnce(newSlot)
      .mockResolvedValueOnce(newSlot)
      .mockResolvedValueOnce({ _id: 'old-slot-id' });
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await rescheduleAppointment(
      { params: { id: 'appointment-id' }, validatedData: { newSlotId: 'new-slot-id' }, user: { id: 'patient-id' } },
      response,
      vi.fn()
    );

    expect(Appointment.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: 'appointment-id',
        patientId: 'patient-id',
        status: 'confirmed',
        slotId: 'old-slot-id',
      },
      {
        $set: {
          slotId: 'new-slot-id',
          status: 'booked',
          'bookingDetails.slotStartTime': newSlot.startTime,
          'bookingDetails.slotEndTime': newSlot.endTime,
        },
      },
      { new: true, runValidators: true }
    );
    expect(DoctorSlot.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: 'old-slot-id', appointmentId: 'appointment-id', isBooked: true },
      { $set: { isBooked: false, appointmentId: null } },
      { new: true }
    );
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('releases the replacement slot when an appointment reschedule loses a race', async () => {
    Appointment.findById.mockResolvedValue({
      _id: 'appointment-id',
      patientId: 'patient-id',
      doctorId: 'doctor-id',
      slotId: 'old-slot-id',
      status: 'confirmed',
    });
    Appointment.findOneAndUpdate.mockResolvedValue(null);
    DoctorSlot.findOneAndUpdate
      .mockResolvedValueOnce({ _id: 'new-slot-id' })
      .mockResolvedValueOnce({ _id: 'new-slot-id' })
      .mockResolvedValueOnce(null);
    const next = vi.fn();

    await rescheduleAppointment(
      { params: { id: 'appointment-id' }, validatedData: { newSlotId: 'new-slot-id' }, user: { id: 'patient-id' } },
      {},
      next
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(DoctorSlot.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: 'new-slot-id', isBooked: true, appointmentId: 'appointment-id' },
      { $set: { isBooked: false, appointmentId: null } }
    );
  });

  it('records a completed appointment only after a valid confirmed-to-completed transition', async () => {
    Appointment.findById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      patientId: 'patient-id',
      doctorId: 'doctor-id',
      status: 'confirmed',
    });
    const updated = { _id: '507f1f77bcf86cd799439011', status: 'completed' };
    Appointment.findOneAndUpdate.mockResolvedValue(updated);
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await updateAppointmentStatus({
      params: { id: '507f1f77bcf86cd799439011' },
      user: { id: 'doctor-id', role: 'doctor' },
      validatedData: { status: 'completed' },
    }, response, vi.fn());

    expect(Appointment.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: '507f1f77bcf86cd799439011', status: 'confirmed' },
      { $set: { status: 'completed', completedAt: expect.any(Date) } },
      { new: true, runValidators: true }
    );
    expect(addJourneyEvent).toHaveBeenCalledWith('patient-id', expect.objectContaining({
      type: 'consultation_completed',
      refModel: 'Appointment',
      refId: '507f1f77bcf86cd799439011',
    }));
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: 'appointment_completed',
      dedupeKey: 'appointment_completed:507f1f77bcf86cd799439011',
    }));
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('rejects invalid appointment state transitions', async () => {
    Appointment.findById.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      patientId: 'patient-id',
      doctorId: 'doctor-id',
      status: 'booked',
    });
    const next = vi.fn();

    await updateAppointmentStatus({
      params: { id: '507f1f77bcf86cd799439011' },
      user: { id: 'doctor-id', role: 'doctor' },
      validatedData: { status: 'completed' },
    }, {}, next);

    expect(Appointment.findOneAndUpdate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
  });
});
