import { DoctorProfile } from '../models/DoctorProfile.js';
import { DoctorSlot } from '../models/DoctorSlot.js';
import { Waitlist } from '../models/Waitlist.js';
import { AppError } from '../utils/AppError.js';
import { acceptWaitlistOffer as acceptOffer, expireWaitlistOffers, offerAvailableSlot } from '../services/waitlistService.js';
import { addJourneyEvent } from '../services/careJourneyService.js';
import { createNotification } from '../services/notificationService.js';
import { logger } from '../utils/logger.js';

export async function joinWaitlist(req, res, next) {
  try {
    await expireWaitlistOffers();
    const { doctorId, preferredDateStart, preferredDateEnd, notes } = req.validatedData;
    const start = new Date(preferredDateStart);
    const end = new Date(preferredDateEnd);
    const now = new Date();
    if (start <= now || end <= start || end.getTime() - start.getTime() > 90 * 24 * 60 * 60 * 1000) {
      throw new AppError('Choose a future date range no longer than 90 days', 400);
    }
    const doctor = await DoctorProfile.findOne({ userId: doctorId, acceptingPatients: true })
      .populate('userId', 'role isActive isVerified')
      .populate('providerId', 'verificationStatus isActive');
    if (
      !doctor ||
      doctor.userId?.role !== 'doctor' ||
      !doctor.userId.isActive ||
      !doctor.userId.isVerified ||
      !doctor.providerId?.isActive ||
      doctor.providerId.verificationStatus !== 'verified'
    ) {
      throw new AppError('Doctor is not available for waitlist requests', 404);
    }
    const activeEntry = await Waitlist.findOne({
      patientId: req.user.id,
      doctorId,
      status: { $in: ['waiting', 'offered'] },
    });
    if (activeEntry) throw new AppError('You already have an active waitlist entry for this doctor', 409);

    let waitlist;
    try {
      waitlist = await Waitlist.create({
        patientId: req.user.id,
        doctorId,
        providerId: doctor.providerId._id,
        preferredDateStart: start,
        preferredDateEnd: end,
        notes,
      });
    } catch (error) {
      if (error.code === 11000) {
        throw new AppError('You already have an active waitlist entry for this doctor', 409);
      }
      throw error;
    }
    res.status(201).json({ success: true, data: { waitlist } });
  } catch (error) {
    next(error);
  }
}

export async function getMyWaitlist(req, res, next) {
  try {
    await expireWaitlistOffers();
    const waitlist = await Waitlist.find({ patientId: req.user.id })
      .populate('doctorId', 'firstName lastName')
      .populate('offeredSlotId', 'startTime endTime')
      .populate('acceptedAppointmentId', 'status bookingDetails')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, data: { waitlist } });
  } catch (error) {
    next(error);
  }
}

export async function cancelWaitlist(req, res, next) {
  try {
    await expireWaitlistOffers();
    const entry = await Waitlist.findOneAndUpdate(
      { _id: req.params.id, patientId: req.user.id, status: { $in: ['waiting', 'offered'] } },
      { $set: { status: 'cancelled' } },
      { new: true }
    );
    if (!entry) throw new AppError('Active waitlist entry not found', 404);
    if (entry.offeredSlotId) {
      const released = await DoctorSlot.findOneAndUpdate(
        { _id: entry.offeredSlotId, isBooked: true, appointmentId: null },
        { $set: { isBooked: false } },
        { new: true }
      );
      if (released) await offerAvailableSlot(released._id);
    }
    res.status(200).json({ success: true, data: { waitlist: entry } });
  } catch (error) {
    next(error);
  }
}

export async function acceptWaitlistOffer(req, res, next) {
  try {
    const appointment = await acceptOffer(req.params.id, req.user.id);
    try {
      await addJourneyEvent(req.user.id, {
        type: 'appointment_booked',
        title: `Appointment booked with ${appointment.bookingDetails.doctorName}`,
        refModel: 'Appointment',
        refId: appointment._id,
      });
      await createNotification({
        userId: req.user.id,
        type: 'appointment_booked',
        title: 'Appointment booked',
        message: 'Your waitlist offer was accepted and the appointment is booked.',
        relatedModel: 'Appointment',
        relatedId: appointment._id,
        dedupeKey: `appointment_booked:${appointment._id}`,
      });
    } catch (error) {
      logger.error({ error: error.message, appointmentId: String(appointment._id) },
        'Waitlist appointment was booked, but related notifications could not be created');
    }
    res.status(201).json({ success: true, data: { appointment } });
  } catch (error) {
    next(error);
  }
}
