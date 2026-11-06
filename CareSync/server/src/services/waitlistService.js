import { Appointment } from '../models/Appointment.js';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { DoctorSlot } from '../models/DoctorSlot.js';
import { Waitlist } from '../models/Waitlist.js';
import { createNotification } from './notificationService.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const OFFER_DURATION_MS = 2 * 60 * 60 * 1000;

async function getEligibleDoctor(doctorId) {
  const profile = await DoctorProfile.findOne({ userId: doctorId, acceptingPatients: true })
    .populate('userId', 'firstName lastName role isActive isVerified')
    .populate('providerId', 'name isActive verificationStatus');
  if (
    !profile ||
    profile.userId?.role !== 'doctor' ||
    !profile.userId.isActive ||
    !profile.userId.isVerified ||
    !profile.providerId?.isActive ||
    profile.providerId.verificationStatus !== 'verified'
  ) return null;
  return profile;
}

export async function offerAvailableSlot(slotId) {
  const now = new Date();
  const availableSlot = await DoctorSlot.findById(slotId).select('_id doctorId isBooked startTime endTime');
  if (
    !availableSlot ||
    availableSlot.isBooked ||
    availableSlot.startTime <= now ||
    availableSlot.endTime <= now ||
    !await getEligibleDoctor(availableSlot.doctorId)
  ) return null;

  const slot = await DoctorSlot.findOneAndUpdate(
    {
      _id: slotId,
      doctorId: availableSlot.doctorId,
      isBooked: false,
      startTime: { $gt: now },
      endTime: { $gt: now },
    },
    { $set: { isBooked: true, appointmentId: null } },
    { new: true }
  );
  if (!slot) return null;

  const waitlist = await Waitlist.findOneAndUpdate(
    {
      doctorId: slot.doctorId,
      status: 'waiting',
      preferredDateStart: { $lte: slot.startTime },
      preferredDateEnd: { $gte: slot.startTime },
    },
    {
      $set: {
        status: 'offered',
        offeredSlotId: slot._id,
        offerExpiresAt: new Date(Math.min(now.getTime() + OFFER_DURATION_MS, slot.startTime.getTime())),
      },
    },
    { sort: { createdAt: 1 }, new: true }
  );

  if (!waitlist) {
    await DoctorSlot.findOneAndUpdate(
      { _id: slot._id, isBooked: true, appointmentId: null },
      { $set: { isBooked: false } }
    );
    return null;
  }

  try {
    await createNotification({
      userId: waitlist.patientId,
      type: 'waitlist_offer',
      title: 'Appointment slot available',
      message: 'A doctor appointment slot matching your waitlist preferences is available. Accept it before the offer expires.',
      relatedModel: 'Waitlist',
      relatedId: waitlist._id,
      dedupeKey: `waitlist_offer:${waitlist._id}`,
    });
  } catch (error) {
    logger.error(
      { error: error.message, waitlistId: String(waitlist._id) },
      'Waitlist offer created, but the notification could not be recorded'
    );
  }
  return waitlist;
}

export async function expireWaitlistOffers(now = new Date()) {
  const expiredOffers = await Waitlist.find({
    status: 'offered',
    offerExpiresAt: { $lte: now },
  }).select('_id offeredSlotId').limit(200).lean();

  let expiredCount = 0;
  for (const offer of expiredOffers) {
    const expired = await Waitlist.findOneAndUpdate(
      { _id: offer._id, status: 'offered', offerExpiresAt: { $lte: now } },
      { $set: { status: 'expired' } },
      { new: true }
    );
    if (!expired) continue;

    if (offer.offeredSlotId) {
      const released = await DoctorSlot.findOneAndUpdate(
        { _id: offer.offeredSlotId, isBooked: true, appointmentId: null },
        { $set: { isBooked: false } },
        { new: true }
      );
      if (released) await offerAvailableSlot(released._id);
    }
    expiredCount += 1;
  }
  return expiredCount;
}

export function startWaitlistExpiryJob(intervalMs = 60_000) {
  const run = () => {
    expireWaitlistOffers().catch((error) => {
      logger.error({ error: error.message }, 'Waitlist offer expiry sweep failed');
    });
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return timer;
}

export async function acceptWaitlistOffer(waitlistId, patientId) {
  const now = new Date();
  const waitlist = await Waitlist.findOneAndUpdate(
    {
      _id: waitlistId,
      patientId,
      status: 'offered',
      offerExpiresAt: { $gt: now },
    },
    { $set: { status: 'accepted' } },
    { new: true }
  );
  if (!waitlist) throw new AppError('This waitlist offer has expired or is no longer available', 409);

  const slot = await DoctorSlot.findOne({
    _id: waitlist.offeredSlotId,
    doctorId: waitlist.doctorId,
    isBooked: true,
    appointmentId: null,
    startTime: { $gt: now },
  });
  if (!slot) {
    await Waitlist.findOneAndUpdate({ _id: waitlist._id, status: 'accepted' }, { $set: { status: 'expired' } });
    if (waitlist.offeredSlotId) {
      const released = await DoctorSlot.findOneAndUpdate(
        { _id: waitlist.offeredSlotId, isBooked: true, appointmentId: null },
        { $set: { isBooked: false } },
        { new: true }
      );
      if (released) await offerAvailableSlot(released._id);
    }
    throw new AppError('The offered slot is no longer available', 409);
  }

  const profile = await getEligibleDoctor(waitlist.doctorId);
  if (!profile || !profile.providerId) {
    await Waitlist.findOneAndUpdate({ _id: waitlist._id, status: 'accepted' }, { $set: { status: 'expired' } });
    await DoctorSlot.findOneAndUpdate(
      { _id: slot._id, isBooked: true, appointmentId: null },
      { $set: { isBooked: false } }
    );
    throw new AppError('The doctor is no longer available for booking', 409);
  }

  let appointment;
  try {
    appointment = await Appointment.create({
      patientId,
      doctorId: waitlist.doctorId,
      providerId: slot.providerId,
      slotId: slot._id,
      status: 'booked',
      bookingDetails: {
        slotStartTime: slot.startTime,
        slotEndTime: slot.endTime,
        doctorName: `${profile.userId.firstName} ${profile.userId.lastName}`,
        providerName: profile.providerId.name,
        consultationFee: profile.consultationFee,
      },
    });
    const linkedSlot = await DoctorSlot.findOneAndUpdate(
      { _id: slot._id, isBooked: true, appointmentId: null, startTime: { $gt: now } },
      { $set: { appointmentId: appointment._id } },
      { new: true }
    );
    if (!linkedSlot) {
      await Appointment.deleteOne({ _id: appointment._id });
      throw new AppError('The offered slot could not be claimed. Please refresh availability.', 409);
    }
  } catch (error) {
    await Waitlist.findOneAndUpdate(
      { _id: waitlist._id, status: 'accepted' },
      { $set: { status: 'offered' } }
    );
    throw error;
  }

  waitlist.acceptedAppointmentId = appointment._id;
  await waitlist.save();
  return appointment;
}
