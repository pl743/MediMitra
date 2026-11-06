/**
 * Patient timeline reads are scoped to source bookings owned by the session user.
 */

import { Appointment } from '../models/Appointment.js';
import { CareJourney } from '../models/CareJourney.js';
import { LabBooking } from '../models/LabBooking.js';
import { LabReport } from '../models/LabReport.js';
import { AppError } from '../utils/AppError.js';

const appointmentStates = {
  confirmed: ['appointment_confirmed', 'Appointment confirmed'],
  cancelled: ['appointment_cancelled', 'Appointment cancelled'],
  completed: ['consultation_completed', 'Consultation completed'],
  no_show: ['appointment_no_show', 'Appointment marked as no-show'],
};

const labStates = {
  confirmed: ['lab_booking_confirmed', 'Lab booking confirmed'],
  cancelled: ['lab_booking_cancelled', 'Lab booking cancelled'],
  sample_collected: ['sample_collected', 'Sample collected'],
  processing: ['lab_processing', 'Lab test processing'],
  report_ready: ['report_ready', 'Report ready'],
};

function eventStatus(type) {
  if (type.includes('cancelled')) return 'cancelled';
  if (type.includes('no_show')) return 'failed';
  if (type === 'consultation_completed' || type === 'report_ready' || type === 'sample_collected') {
    return 'completed';
  }
  return 'pending';
}

function buildEvent(type, title, refModel, refId, timestamp, status = eventStatus(type), transitionId) {
  const sourceKey = `${type}:${refModel}:${refId}`;
  return {
    type,
    title,
    status,
    refModel,
    refId,
    timestamp,
    transitionId,
    dedupeKey: `${sourceKey}${transitionId ? `:${transitionId}` : ''}`,
  };
}

function addIfMissing(eventsByKey, event) {
  const legacyKey = `${event.type}:${event.refModel}:${event.refId}`;
  if (!eventsByKey.has(event.dedupeKey) && !eventsByKey.has(legacyKey)) {
    eventsByKey.set(event.dedupeKey, event);
  }
}

async function buildPatientTimeline(patientId) {
  const [journey, appointments, labBookings] = await Promise.all([
    CareJourney.findOne({ patientId }).lean(),
    Appointment.find({ patientId })
      .select('_id status createdAt updatedAt cancelledAt completedAt bookingDetails')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    LabBooking.find({ patientId })
      .select('_id status createdAt updatedAt scheduledAt reportId bookingDetails')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ]);

  const appointmentIds = new Set(appointments.map((appointment) => String(appointment._id)));
  const labBookingIds = new Set(labBookings.map((booking) => String(booking._id)));
  const eventsByKey = new Map();
  for (const event of journey?.events || []) {
    const sourceIds = event.refModel === 'Appointment'
      ? appointmentIds
      : event.refModel === 'LabBooking'
        ? labBookingIds
        : null;
    if (!sourceIds?.has(String(event.refId))) continue;
    eventsByKey.set(
      event.dedupeKey || `${event.type}:${event.refModel}:${event.refId}`,
      event
    );
  }

  for (const appointment of appointments) {
    const doctorName = appointment.bookingDetails?.doctorName || 'your doctor';
    const booked = buildEvent(
      'appointment_booked',
      `Appointment booked with ${doctorName}`,
      'Appointment',
      appointment._id,
      appointment.createdAt
    );
    addIfMissing(eventsByKey, booked);

    const state = appointmentStates[appointment.status];
    if (state) {
      const [type, title] = state;
      const timestamp = appointment.cancelledAt || appointment.completedAt || appointment.updatedAt;
      const event = buildEvent(
        type,
        title,
        'Appointment',
        appointment._id,
        timestamp,
        eventStatus(type),
        appointment.updatedAt ? new Date(appointment.updatedAt).toISOString() : undefined
      );
      addIfMissing(eventsByKey, event);
    }
  }

  const reportBookings = labBookings.filter(
    (booking) => booking.status === 'report_ready' && booking.reportId
  );
  const reportIds = reportBookings.map((booking) => booking.reportId);
  const existingReports = reportIds.length
    ? await LabReport.find({
      patientId,
      $or: reportBookings.map((booking) => ({
        _id: booking.reportId,
        labBookingId: booking._id,
      })),
    }).select('_id labBookingId').lean()
    : [];
  const verifiedReportBookingIds = new Set(existingReports.map((report) => String(report.labBookingId)));
  for (const [key, event] of eventsByKey) {
    if (event.type === 'report_ready' && !verifiedReportBookingIds.has(String(event.refId))) {
      eventsByKey.delete(key);
    }
  }

  for (const booking of labBookings) {
    const testName = booking.bookingDetails?.testName || 'diagnostic test';
    const labName = booking.bookingDetails?.labName || 'the laboratory';
    const created = buildEvent(
      'lab_booking_created',
      `${testName} requested at ${labName}`,
      'LabBooking',
      booking._id,
      booking.createdAt
    );
    addIfMissing(eventsByKey, created);

    const state = labStates[booking.status];
    if (state && (booking.status !== 'report_ready' || verifiedReportBookingIds.has(String(booking._id)))) {
      const [type, title] = state;
      const transitionId = booking.updatedAt ? new Date(booking.updatedAt).toISOString() : undefined;
      const event = buildEvent(type, title, 'LabBooking', booking._id, booking.updatedAt, eventStatus(type), transitionId);
      addIfMissing(eventsByKey, event);
    }
  }

  return [...eventsByKey.values()]
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
    .slice(0, 200);
}

export async function getMyJourney(req, res, next) {
  try {
    const events = await buildPatientTimeline(req.user.id);
    res.status(200).json({ success: true, data: { events } });
  } catch (error) {
    next(error);
  }
}

export async function getJourneyById(req, res, next) {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw new AppError('Invalid journey ID format', 400);
    const journey = await CareJourney.findOne({
      _id: req.params.id,
      patientId: req.user.id,
    }).select('_id');
    if (!journey) throw new AppError('Care journey not found', 404);

    const events = await buildPatientTimeline(req.user.id);
    res.status(200).json({ success: true, data: { events } });
  } catch (error) {
    next(error);
  }
}
