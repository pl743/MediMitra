import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/DoctorProfile.js', () => ({ DoctorProfile: { findOne: vi.fn() } }));
vi.mock('../models/DoctorSlot.js', () => ({ DoctorSlot: { findOneAndUpdate: vi.fn() } }));
vi.mock('../models/Waitlist.js', () => ({
  Waitlist: { create: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn() },
}));
vi.mock('../services/waitlistService.js', () => ({
  acceptWaitlistOffer: vi.fn(),
  expireWaitlistOffers: vi.fn(),
  offerAvailableSlot: vi.fn(),
}));
vi.mock('../services/careJourneyService.js', () => ({ addJourneyEvent: vi.fn() }));
vi.mock('../services/notificationService.js', () => ({ createNotification: vi.fn() }));
vi.mock('../utils/logger.js', () => ({ logger: { error: vi.fn() } }));

import { DoctorProfile } from '../models/DoctorProfile.js';
import { Waitlist } from '../models/Waitlist.js';
import { expireWaitlistOffers } from '../services/waitlistService.js';
import { joinWaitlist, cancelWaitlist } from './waitlistController.js';

describe('waitlistController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects duplicate active entries for the same patient and doctor', async () => {
    expireWaitlistOffers.mockResolvedValue(0);
    const doctorQuery = {
      userId: { role: 'doctor', isActive: true, isVerified: true },
      providerId: { _id: 'provider-id', isActive: true, verificationStatus: 'verified' },
      populate: vi.fn(),
    };
    doctorQuery.populate.mockReturnValue(doctorQuery);
    DoctorProfile.findOne.mockReturnValue(doctorQuery);
    Waitlist.findOne.mockResolvedValue({ _id: 'existing-entry' });
    const next = vi.fn();

    await joinWaitlist({
      user: { id: 'patient-id' },
      validatedData: {
        doctorId: 'doctor-id',
        preferredDateStart: new Date(Date.now() + 3_600_000).toISOString(),
        preferredDateEnd: new Date(Date.now() + 86_400_000).toISOString(),
      },
    }, {}, next);

    expect(Waitlist.findOne).toHaveBeenCalledWith({
      patientId: 'patient-id',
      doctorId: 'doctor-id',
      status: { $in: ['waiting', 'offered'] },
    });
    expect(Waitlist.create).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
  });

  it('cancels only an active entry belonging to the authenticated patient', async () => {
    expireWaitlistOffers.mockResolvedValue(0);
    Waitlist.findOneAndUpdate.mockResolvedValue(null);
    const next = vi.fn();
    await cancelWaitlist({ params: { id: 'entry-id' }, user: { id: 'patient-id' } }, {}, next);
    expect(Waitlist.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'entry-id', patientId: 'patient-id', status: { $in: ['waiting', 'offered'] } },
      { $set: { status: 'cancelled' } },
      { new: true }
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });
});
