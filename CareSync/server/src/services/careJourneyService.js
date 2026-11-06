/**
 * Care journey events are derived from owned booking records and created only
 * by trusted server workflows, never directly from client-supplied event data.
 */

import { Appointment } from '../models/Appointment.js';
import { CareJourney } from '../models/CareJourney.js';
import { LabBooking } from '../models/LabBooking.js';
import { LabReport } from '../models/LabReport.js';
import { AppError } from '../utils/AppError.js';

const appointmentEventStatuses = {
  appointment_booked: ['booked', 'confirmed', 'cancelled', 'completed', 'no_show'],
  appointment_confirmed: ['confirmed', 'completed', 'no_show'],
  appointment_cancelled: ['cancelled'],
  appointment_no_show: ['no_show'],
  consultation_completed: ['completed'],
};

const labEventStatuses = {
  lab_booking_created: ['requested', 'confirmed', 'cancelled', 'sample_collected', 'processing', 'report_ready'],
  lab_booking_confirmed: ['confirmed', 'sample_collected', 'processing', 'report_ready'],
  lab_booking_cancelled: ['cancelled'],
  sample_collected: ['sample_collected', 'processing', 'report_ready'],
  lab_processing: ['processing', 'report_ready'],
  report_ready: ['report_ready'],
};

function getEventIdentity(event) {
  if (!event || !['Appointment', 'LabBooking'].includes(event.refModel)) {
    throw new AppError('Invalid care journey event source', 400);
  }
  if (!/^[a-f\d]{24}$/i.test(String(event.refId || ''))) {
    throw new AppError('Care journey events require a valid source record', 400);
  }

  const allowedStatuses = event.refModel === 'Appointment'
    ? appointmentEventStatuses[event.type]
    : labEventStatuses[event.type];
  if (!allowedStatuses) throw new AppError('Unsupported care journey event type', 400);
  const transitionId = event.transitionId ? String(event.transitionId) : '';
  if (transitionId.length > 100) throw new AppError('Invalid care journey transition identifier', 400);

  return {
    allowedStatuses,
    dedupeKey: `${event.type}:${event.refModel}:${event.refId}${transitionId ? `:${transitionId}` : ''}`,
  };
}

async function validateSourceRecord(patientId, event, allowedStatuses) {
  const Model = event.refModel === 'Appointment' ? Appointment : LabBooking;
  const record = await Model.findOne({
    _id: event.refId,
    patientId,
  }).select('_id status reportId');
  if (!record) throw new AppError('Care journey source record not found', 404);
  if (!allowedStatuses.includes(record.status)) {
    throw new AppError('Care journey event does not match the source record status', 409);
  }

  if (event.type === 'report_ready') {
    if (!record.reportId || !(await LabReport.exists({
      _id: record.reportId,
      labBookingId: record._id,
      patientId,
    }))) {
      throw new AppError('A verified report is required for this journey event', 409);
    }
  }
}

export async function addJourneyEvent(patientId, event) {
  if (!patientId) throw new AppError('Patient is required for a care journey event', 400);
  const { allowedStatuses, dedupeKey } = getEventIdentity(event);
  const existing = await CareJourney.findOne({
    patientId,
    events: { $elemMatch: { dedupeKey } },
  });
  if (existing) return existing;

  await validateSourceRecord(patientId, event, allowedStatuses);
  const journeyEvent = { ...event, dedupeKey };

  try {
    await CareJourney.updateOne(
      { patientId },
      { $setOnInsert: { patientId } },
      { upsert: true }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }

  const journey = await CareJourney.findOneAndUpdate(
    {
      patientId,
      events: { $not: { $elemMatch: { dedupeKey } } },
    },
    { $push: { events: journeyEvent } },
    { new: true, runValidators: true }
  );
  return journey || CareJourney.findOne({ patientId });
}
