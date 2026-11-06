import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/Appointment.js', () => ({ Appointment: { create: vi.fn() } }));
vi.mock('../models/DoctorProfile.js', () => ({ DoctorProfile: { findOne: vi.fn() } }));
vi.mock('../models/DoctorSlot.js', () => ({
  DoctorSlot: { findById: vi.fn(), findOneAndUpdate: vi.fn(), findOne: vi.fn() },
}));
vi.mock('../models/Waitlist.js', () => ({ Waitlist: { findOneAndUpdate: vi.fn() } }));
vi.mock('./notificationService.js', () => ({ createNotification: vi.fn() }));
vi.mock('../utils/logger.js', () => ({ logger: { error: vi.fn() } }));

import { Appointment } from '../models/Appointment.js';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { DoctorSlot } from '../models/DoctorSlot.js';
import { Waitlist } from '../models/Waitlist.js';
import { createNotification } from './notificationService.js';
import { acceptWaitlistOffer, offerAvailableSlot } from './waitlistService.js';

describe('waitlistService', () => {
  beforeEach(() => vi.resetAllMocks());

  it('does not offer a slot already claimed by another booking', async () => {
    const availableSlot = {
      _id: 'slot-id',
      doctorId: 'doctor-id',
      isBooked: true,
      startTime: new Date(Date.now() + 3_600_000),
      endTime: new Date(Date.now() + 3_900_000),
    };
    DoctorSlot.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(availableSlot) });
    await expect(offerAvailableSlot('slot-id')).resolves.toBeNull();
    expect(DoctorSlot.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Waitlist.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('atomically holds a slot before assigning a matching waiting patient', async () => {
    const slot = {
      _id: 'slot-id',
      doctorId: 'doctor-id',
      startTime: new Date(Date.now() + 3_600_000),
      endTime: new Date(Date.now() + 3_900_000),
    };
    const entry = { _id: 'waitlist-id', patientId: 'patient-id' };
    DoctorSlot.findById.mockReturnValue({ select: vi.fn().mockResolvedValue({ ...slot, isBooked: false }) });
    const profile = {
      userId: { role: 'doctor', isActive: true, isVerified: true },
      providerId: { isActive: true, verificationStatus: 'verified' },
      populate: vi.fn(),
    };
    profile.populate.mockReturnValue(profile);
    DoctorProfile.findOne.mockReturnValue(profile);
    DoctorSlot.findOneAndUpdate.mockResolvedValueOnce(slot);
    Waitlist.findOneAndUpdate.mockResolvedValue(entry);
    const result = await offerAvailableSlot('slot-id');
    expect(result).toBe(entry);
    expect(Waitlist.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        doctorId: 'doctor-id',
        status: 'waiting',
        preferredDateStart: { $lte: slot.startTime },
        preferredDateEnd: { $gte: slot.startTime },
      }),
      expect.objectContaining({ $set: expect.objectContaining({ status: 'offered', offeredSlotId: 'slot-id' }) }),
      { sort: { createdAt: 1 }, new: true }
    );
    expect(createNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'patient-id',
      type: 'waitlist_offer',
      relatedModel: 'Waitlist',
    }));
    expect(DoctorSlot.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'slot-id', doctorId: 'doctor-id', isBooked: false }),
      { $set: { isBooked: true, appointmentId: null } },
      { new: true }
    );
  });

  it('creates an appointment and links the slot only after the patient accepts an active offer', async () => {
    const appointment = { _id: 'appointment-id' };
    const entry = {
      _id: 'waitlist-id',
      patientId: 'patient-id',
      doctorId: 'doctor-id',
      offeredSlotId: 'slot-id',
      save: vi.fn().mockResolvedValue(undefined),
    };
    const slot = {
      _id: 'slot-id',
      doctorId: 'doctor-id',
      providerId: 'provider-id',
      startTime: new Date(Date.now() + 3_600_000),
      endTime: new Date(Date.now() + 3_900_000),
    };
    const profile = {
      userId: { firstName: 'Care', lastName: 'Doctor', role: 'doctor', isActive: true, isVerified: true },
      providerId: { name: 'Clinic', isActive: true, verificationStatus: 'verified' },
      consultationFee: 50,
      populate: vi.fn(),
    };
    profile.populate.mockReturnValue(profile);
    Waitlist.findOneAndUpdate.mockResolvedValue(entry);
    DoctorSlot.findOne.mockResolvedValue(slot);
    DoctorProfile.findOne.mockReturnValue(profile);
    Appointment.create.mockResolvedValue(appointment);
    DoctorSlot.findOneAndUpdate.mockResolvedValue(slot);

    await expect(acceptWaitlistOffer('waitlist-id', 'patient-id')).resolves.toBe(appointment);

    expect(Appointment.create).toHaveBeenCalledWith(expect.objectContaining({
      patientId: 'patient-id',
      doctorId: 'doctor-id',
      slotId: 'slot-id',
      status: 'booked',
      bookingDetails: expect.objectContaining({ doctorName: 'Care Doctor', providerName: 'Clinic' }),
    }));
    expect(DoctorSlot.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: 'slot-id', isBooked: true, appointmentId: null, startTime: { $gt: expect.any(Date) } },
      { $set: { appointmentId: 'appointment-id' } },
      { new: true }
    );
    expect(entry.acceptedAppointmentId).toBe('appointment-id');
    expect(entry.save).toHaveBeenCalledOnce();
  });

  it('does not book after an offered slot has become unavailable', async () => {
    Waitlist.findOneAndUpdate.mockResolvedValue({
      _id: 'waitlist-id',
      offeredSlotId: 'slot-id',
    });
    DoctorSlot.findOne.mockResolvedValue(null);
    await expect(acceptWaitlistOffer('waitlist-id', 'patient-id')).rejects.toMatchObject({ statusCode: 409 });
    expect(Appointment.create).not.toHaveBeenCalled();
    expect(Waitlist.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: 'waitlist-id', status: 'accepted' },
      { $set: { status: 'expired' } }
    );
  });

  it('requires an active offer belonging to this patient before creating an appointment', async () => {
    Waitlist.findOneAndUpdate.mockResolvedValue(null);
    await expect(acceptWaitlistOffer('waitlist-id', 'other-patient')).rejects.toMatchObject({ statusCode: 409 });
    expect(Waitlist.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'waitlist-id',
        patientId: 'other-patient',
        status: 'offered',
        offerExpiresAt: { $gt: expect.any(Date) },
      }),
      { $set: { status: 'accepted' } },
      { new: true }
    );
    expect(Appointment.create).not.toHaveBeenCalled();
  });
});
