/**
 * appointmentController.js — Appointment booking and management.
 * Concurrency-safe booking implemented in Phase 4.
 */

import { Appointment } from '../models/Appointment.js';
import { DoctorSlot } from '../models/DoctorSlot.js';
import { DoctorProfile } from '../models/DoctorProfile.js';
import { AppError } from '../utils/AppError.js';
import { createNotification } from '../services/notificationService.js';
import { addJourneyEvent } from '../services/careJourneyService.js';
import { logger } from '../utils/logger.js';
import { offerAvailableSlot } from '../services/waitlistService.js';
import { findActiveConsent } from '../services/consentService.js';
import { writeAuditLog } from '../utils/audit.js';

export async function bookAppointment(req, res, next) {
  try {
    const { slotId, reasonForVisit } = req.validatedData;
    const patientId = req.user.id;

    // Atomically claim the slot — only succeeds if slot is still available
    // findOneAndUpdate with { isBooked: false } condition prevents double booking
    const slot = await DoctorSlot.findOneAndUpdate(
      { _id: slotId, isBooked: false, startTime: { $gt: new Date() }, endTime: { $gt: new Date() } },
      { isBooked: true },
      { new: true }
    );

    if (!slot) {
      throw new AppError('This slot is no longer available. Please choose another slot.', 409);
    }

    let appointment;
    try {
      const doctorProfile = await DoctorProfile.findOne({ userId: slot.doctorId })
        .populate('userId', 'firstName lastName')
        .populate('providerId', 'name');

      appointment = await Appointment.create({
        patientId,
        doctorId: slot.doctorId,
        providerId: slot.providerId,
        slotId: slot._id,
        status: 'booked',
        reasonForVisit,
        bookingDetails: {
          slotStartTime: slot.startTime,
          slotEndTime: slot.endTime,
          doctorName: doctorProfile?.userId
            ? `${doctorProfile.userId.firstName} ${doctorProfile.userId.lastName}`
            : 'Doctor',
          providerName: doctorProfile?.providerId?.name,
          consultationFee: doctorProfile?.consultationFee,
        },
      });
    } catch (error) {
      await DoctorSlot.findOneAndUpdate(
        { _id: slot._id, isBooked: true, appointmentId: null },
        { isBooked: false },
        { new: true }
      );
      throw error;
    }

    // Link appointment back to slot
    slot.appointmentId = appointment._id;
    await slot.save();

    try {
      await addJourneyEvent(patientId, {
        type: 'appointment_booked',
        title: `Appointment booked with ${appointment.bookingDetails.doctorName}`,
        refModel: 'Appointment',
        refId: appointment._id,
      });
    } catch (error) {
      logger.error(
        { error: error.message, appointmentId: String(appointment._id) },
        'Appointment booked, but the care journey event could not be recorded'
      );
    }

    try {
      await createNotification({
        userId: patientId,
        type: 'appointment_booked',
        title: 'Appointment Booked',
        message: `Your appointment on ${slot.startTime.toLocaleDateString()} has been booked.`,
        relatedModel: 'Appointment',
        relatedId: appointment._id,
        dedupeKey: `appointment_booked:${appointment._id}`,
      });
    } catch (error) {
      logger.error(
        { error: error.message, appointmentId: String(appointment._id) },
        'Appointment booked, but the patient notification could not be created'
      );
    }

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: { appointment },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyAppointments(req, res, next) {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = { patientId: req.user.id };
    if (status) filter.status = status;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, parseInt(limit));

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .populate('doctorId', 'firstName lastName')
        .populate('providerId', 'name address')
        .sort({ 'bookingDetails.slotStartTime': -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Appointment.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: { appointments, pagination: { page: pageNum, limit: limitNum, total } },
    });
  } catch (error) {
    next(error);
  }
}

export async function getDoctorSchedule(req, res, next) {
  try {
    const { date } = req.query;
    const filter = { doctorId: req.user.id };

    if (date) {
      const day = new Date(date);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      filter['bookingDetails.slotStartTime'] = { $gte: day, $lt: nextDay };
    }

    const appointments = await Appointment.find(filter)
      .populate('patientId', 'firstName lastName phone email')
      .sort({ 'bookingDetails.slotStartTime': 1 });

    res.status(200).json({ success: true, data: { appointments } });
  } catch (error) {
    next(error);
  }
}

export async function getAppointmentById(req, res, next) {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('doctorId', 'firstName lastName email')
      .populate('patientId', 'firstName lastName email phone')
      .populate('providerId', 'name address');

    if (!appointment) throw new AppError('Appointment not found', 404);

    // Access control: patient can only see their own, doctor can only see theirs
    const userId = req.user.id;
    const role = req.user.role;
    const isPatient = appointment.patientId._id.toString() === userId;
    const isAssignedDoctor = appointment.doctorId._id.toString() === userId;
    if (role !== 'admin' && !isPatient && !isAssignedDoctor) {
      const consent = role === 'doctor'
        ? await findActiveConsent({
          recipientId: userId,
          recordType: 'Appointment',
          recordId: appointment._id,
        })
        : null;
      await writeAuditLog(req, {
        action: 'consent.access',
        resourceType: 'Appointment',
        resourceId: appointment._id,
        metadata: { consentGranted: Boolean(consent) },
        success: Boolean(consent),
        failureReason: consent ? undefined : 'No active record-specific consent',
      });
      if (!consent) throw new AppError('Access denied', 403);
    }

    res.status(200).json({ success: true, data: { appointment } });
  } catch (error) {
    next(error);
  }
}

export async function cancelAppointment(req, res, next) {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) throw new AppError('Appointment not found', 404);

    const userId = req.user.id;
    const role = req.user.role;

    // Only patient, doctor, or admin can cancel
    const isPatient = appointment.patientId.toString() === userId;
    const isDoctor = appointment.doctorId.toString() === userId;
    if (!isPatient && !isDoctor && role !== 'admin') {
      throw new AppError('Access denied', 403);
    }

    if (!['booked', 'confirmed'].includes(appointment.status)) {
      throw new AppError(`Cannot cancel an appointment with status: ${appointment.status}`, 409);
    }

    const cancelledAppointment = await Appointment.findOneAndUpdate(
      { _id: appointment._id, status: { $in: ['booked', 'confirmed'] } },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: isPatient ? 'patient' : isDoctor ? 'doctor' : 'admin',
          cancellationReason: req.validatedData?.reason ?? req.body?.reason ?? '',
        },
      },
      { new: true, runValidators: true }
    );
    if (!cancelledAppointment) {
      throw new AppError('Appointment status changed. Refresh and try again.', 409);
    }

    const releasedSlot = await DoctorSlot.findOneAndUpdate(
      { _id: appointment.slotId, appointmentId: appointment._id, isBooked: true },
      { $set: { isBooked: false, appointmentId: null } },
      { new: true }
    );
    if (releasedSlot) {
      try {
        await offerAvailableSlot(releasedSlot._id);
      } catch (error) {
        logger.error(
          { error: error.message, slotId: String(releasedSlot._id) },
          'Appointment cancelled, but a waitlist offer could not be created'
        );
      }
    }

    try {
      await addJourneyEvent(cancelledAppointment.patientId.toString(), {
        type: 'appointment_cancelled',
        title: 'Appointment Cancelled',
        status: 'cancelled',
        refModel: 'Appointment',
        refId: cancelledAppointment._id,
        transitionId: cancelledAppointment.updatedAt?.toISOString(),
      });
    } catch (error) {
      logger.error(
        { error: error.message, appointmentId: String(cancelledAppointment._id) },
        'Appointment cancelled, but the care journey event could not be recorded'
      );
    }

    try {
      const transitionId = cancelledAppointment.updatedAt?.toISOString();
      await createNotification({
        userId: cancelledAppointment.patientId,
        type: 'appointment_cancelled',
        title: 'Appointment cancelled',
        message: 'Your appointment was cancelled. You can browse doctors to choose another available time.',
        relatedModel: 'Appointment',
        relatedId: cancelledAppointment._id,
        dedupeKey: `appointment_cancelled:${cancelledAppointment._id}${transitionId ? `:${transitionId}` : ''}`,
      });
    } catch (error) {
      logger.error(
        { error: error.message, appointmentId: String(cancelledAppointment._id) },
        'Appointment cancelled, but the patient notification could not be created'
      );
    }

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled',
      data: { appointment: cancelledAppointment },
    });
  } catch (error) {
    next(error);
  }
}

export async function rescheduleAppointment(req, res, next) {
  try {
    const { newSlotId } = req.validatedData;
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) throw new AppError('Appointment not found', 404);

    if (appointment.patientId.toString() !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    if (!['booked', 'confirmed'].includes(appointment.status)) {
      throw new AppError('Cannot reschedule this appointment', 409);
    }

    // Atomically claim the new slot
    const newSlot = await DoctorSlot.findOneAndUpdate(
      {
        _id: newSlotId,
        isBooked: false,
        doctorId: appointment.doctorId,
        startTime: { $gt: new Date() },
        endTime: { $gt: new Date() },
      },
      { $set: { isBooked: true } },
      { new: true }
    );
    if (!newSlot) throw new AppError('New slot not available', 409);

    const linkedNewSlot = await DoctorSlot.findOneAndUpdate(
      { _id: newSlot._id, isBooked: true, appointmentId: null, startTime: { $gt: new Date() } },
      { $set: { appointmentId: appointment._id } },
      { new: true }
    );
    if (!linkedNewSlot) {
      await DoctorSlot.findOneAndUpdate(
        { _id: newSlot._id, isBooked: true, appointmentId: null },
        { $set: { isBooked: false } }
      );
      throw new AppError('New slot could not be secured. Refresh and try again.', 409);
    }

    const updatedAppointment = await Appointment.findOneAndUpdate(
      {
        _id: appointment._id,
        patientId: req.user.id,
        status: appointment.status,
        slotId: appointment.slotId,
      },
      {
        $set: {
          slotId: newSlot._id,
          status: 'booked',
          'bookingDetails.slotStartTime': newSlot.startTime,
          'bookingDetails.slotEndTime': newSlot.endTime,
        },
      },
      { new: true, runValidators: true }
    );
    if (!updatedAppointment) {
      await DoctorSlot.findOneAndUpdate(
        { _id: newSlot._id, isBooked: true, appointmentId: appointment._id },
        { $set: { isBooked: false, appointmentId: null } }
      );
      throw new AppError('Appointment status changed. Refresh and try again.', 409);
    }

    // Release the former slot only while it is still linked to this appointment.
    const releasedSlot = await DoctorSlot.findOneAndUpdate(
      { _id: appointment.slotId, appointmentId: appointment._id, isBooked: true },
      { $set: { isBooked: false, appointmentId: null } },
      { new: true }
    );
    if (releasedSlot) {
      try {
        await offerAvailableSlot(releasedSlot._id);
      } catch (error) {
        logger.error(
          { error: error.message, slotId: String(releasedSlot._id) },
          'Appointment rescheduled, but a waitlist offer could not be created'
        );
      }
    }

    res.status(200).json({ success: true, message: 'Appointment rescheduled', data: { appointment: updatedAppointment } });
  } catch (error) {
    next(error);
  }
}

export async function updateAppointmentStatus(req, res, next) {
  try {
    const { status } = req.validatedData;
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw new AppError('Invalid appointment ID format', 400);
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) throw new AppError('Appointment not found', 404);

    if (req.user.role === 'doctor' && appointment.doctorId.toString() !== req.user.id) {
      throw new AppError('Access denied', 403);
    }

    const allowedTransitions = {
      booked: ['confirmed', 'no_show'],
      confirmed: ['completed', 'no_show'],
    };
    if (!allowedTransitions[appointment.status]?.includes(status)) {
      throw new AppError(`Cannot change an appointment from ${appointment.status} to ${status}`, 409);
    }

    const updates = { status };
    if (status === 'completed') updates.completedAt = new Date();
    const updatedAppointment = await Appointment.findOneAndUpdate(
      { _id: appointment._id, status: appointment.status },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!updatedAppointment) throw new AppError('The appointment status changed. Refresh and try again.', 409);

    if (status === 'confirmed' || status === 'completed' || status === 'no_show') {
      const eventType = status === 'completed'
        ? 'consultation_completed'
        : status === 'no_show'
          ? 'appointment_no_show'
          : 'appointment_confirmed';
      try {
        await addJourneyEvent(appointment.patientId.toString(), {
          type: eventType,
          title: status === 'completed'
            ? 'Consultation completed'
            : status === 'no_show'
              ? 'Appointment marked as no-show'
              : 'Appointment confirmed',
          refModel: 'Appointment',
          refId: appointment._id,
          transitionId: updatedAppointment.updatedAt?.toISOString(),
        });
      } catch (error) {
        logger.error(
          { error: error.message, appointmentId: String(appointment._id) },
          'Appointment status changed, but its care journey event could not be recorded'
        );
      }

      if (status !== 'no_show') {
        try {
          const transitionId = updatedAppointment.updatedAt?.toISOString();
          await createNotification({
            userId: appointment.patientId,
            type: status === 'completed' ? 'appointment_completed' : 'appointment_confirmed',
            title: status === 'completed' ? 'Appointment completed' : 'Appointment confirmed',
            message: status === 'completed'
              ? 'Your consultation has been marked complete.'
              : 'Your appointment has been confirmed.',
            relatedModel: 'Appointment',
            relatedId: appointment._id,
            dedupeKey: `appointment_${status}:${appointment._id}${transitionId ? `:${transitionId}` : ''}`,
          });
        } catch (error) {
          logger.error(
            { error: error.message, appointmentId: String(appointment._id) },
            'Appointment status changed, but the patient notification could not be created'
          );
        }
      }
    }

    res.status(200).json({ success: true, data: { appointment: updatedAppointment } });
  } catch (error) {
    next(error);
  }
}
