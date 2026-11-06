/**
 * Lab booking requests and patient booking history.
 */

import { LabBooking } from '../models/LabBooking.js';
import { Provider } from '../models/Provider.js';
import { TestCatalog } from '../models/TestCatalog.js';
import { LabReport } from '../models/LabReport.js';
import { AppError } from '../utils/AppError.js';
import { addJourneyEvent } from '../services/careJourneyService.js';
import { createNotification } from '../services/notificationService.js';
import { logger } from '../utils/logger.js';

const bookingStatuses = [
  'requested',
  'confirmed',
  'sample_collected',
  'processing',
  'report_ready',
  'cancelled',
];

const allowedTransitions = {
  requested: ['confirmed', 'cancelled'],
  confirmed: ['sample_collected', 'cancelled'],
  sample_collected: ['processing'],
  processing: ['report_ready'],
  report_ready: [],
  cancelled: [],
};

function validateId(id) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new AppError('Invalid ID format', 400);
}

function getPagination(query) {
  if (
    (query.page !== undefined && typeof query.page !== 'string') ||
    (query.limit !== undefined && typeof query.limit !== 'string')
  ) {
    throw new AppError('page and limit must be single integer values', 400);
  }
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 10);
  if (!Number.isInteger(page) || page < 1) {
    throw new AppError('page must be a positive integer', 400);
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new AppError('limit must be a positive integer', 400);
  }
  const safeLimit = Math.min(50, limit);
  return { page, limit: safeLimit, skip: (page - 1) * safeLimit };
}

async function canManageLab(user, labId) {
  if (user.role === 'admin') return true;
  return Boolean(await Provider.exists({
    _id: labId,
    type: 'laboratory',
    managedBy: user.id,
  }));
}

export async function createLabBooking(req, res, next) {
  try {
    const {
      labId,
      testId,
      collectionType,
      scheduledAt,
      collectionAddress,
    } = req.validatedData;

    const [lab, test] = await Promise.all([
      Provider.findOne({
        _id: labId,
        type: 'laboratory',
        isActive: true,
        verificationStatus: 'verified',
      }).lean(),
      TestCatalog.findOne({ _id: testId, isActive: true }).lean(),
    ]);

    if (!lab) throw new AppError('The selected laboratory is unavailable', 404);
    if (!test) throw new AppError('The selected diagnostic test is unavailable', 404);

    const scheduledDate = new Date(scheduledAt);
    const duplicate = await LabBooking.exists({
      patientId: req.user.id,
      labId: lab._id,
      testId: test._id,
      scheduledAt: scheduledDate,
      status: { $ne: 'cancelled' },
    });
    if (duplicate) throw new AppError('You already have an active request for this test and time.', 409);

    const booking = await LabBooking.create({
      patientId: req.user.id,
      labId: lab._id,
      testId: test._id,
      collectionType,
      scheduledAt: scheduledDate,
      status: 'requested',
      bookingDetails: {
        testName: test.name,
        labName: lab.name,
        collectionAddress: collectionType === 'home_collection' ? collectionAddress : undefined,
      },
    });

    await recordLabEvent({
      patientId: req.user.id,
      booking,
      eventType: 'lab_booking_created',
      title: 'Diagnostic test request submitted',
      notificationType: 'lab_booking_created',
      notificationTitle: 'Lab booking request submitted',
      notificationMessage: 'Your diagnostic test request has been submitted to the laboratory.',
    });

    res.status(201).json({
      success: true,
      message: 'Lab booking request submitted',
      data: { booking },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyLabBookings(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = { patientId: req.user.id };
    if (req.query.status !== undefined) {
      if (typeof req.query.status !== 'string' || !bookingStatuses.includes(req.query.status)) {
        throw new AppError('Invalid booking status', 400);
      }
      filter.status = req.query.status;
    }

    const [bookings, total] = await Promise.all([
      LabBooking.find(filter)
        .populate('labId', 'name address phone')
        .populate('testId', 'name category sampleType reportTurnaround')
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LabBooking.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: { bookings, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
}

export async function getLabQueue(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.user.role !== 'admin') {
      const managedLabs = await Provider.find({
        type: 'laboratory',
        managedBy: req.user.id,
      }).distinct('_id');
      filter.labId = { $in: managedLabs };
    }

    const [bookings, total] = await Promise.all([
      LabBooking.find(filter)
        .populate('patientId', 'firstName lastName')
        .populate('labId', 'name')
        .populate('testId', 'name category')
        .sort({ scheduledAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LabBooking.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: { bookings, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
}

export async function getLabBookingById(req, res, next) {
  try {
    validateId(req.params.id);
    const booking = await LabBooking.findById(req.params.id)
      .populate('labId', 'name address phone')
      .populate('testId', 'name category sampleType reportTurnaround');
    if (!booking) throw new AppError('Lab booking not found', 404);

    const isOwner = booking.patientId.toString() === req.user.id;
    if (!isOwner && !(await canManageLab(req.user, booking.labId._id || booking.labId))) {
      throw new AppError('Access denied', 403);
    }

    res.status(200).json({ success: true, data: { booking } });
  } catch (error) {
    next(error);
  }
}

export async function cancelLabBooking(req, res, next) {
  try {
    validateId(req.params.id);
    const booking = await LabBooking.findById(req.params.id);
    if (!booking) throw new AppError('Lab booking not found', 404);
    if (booking.patientId.toString() !== req.user.id) throw new AppError('Access denied', 403);

    const cancelled = await LabBooking.findOneAndUpdate(
      { _id: booking._id, patientId: req.user.id, status: 'requested' },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: req.validatedData.reason || '',
        },
      },
      { new: true, runValidators: true }
    );
    if (!cancelled) throw new AppError('Only requested lab bookings can be cancelled', 409);

    await recordLabEvent({
      patientId: req.user.id,
      booking: cancelled,
      eventType: 'lab_booking_cancelled',
      title: 'Lab booking cancelled',
      notificationType: 'lab_booking_updated',
      notificationTitle: 'Lab booking cancelled',
      notificationMessage: 'Your lab booking request was cancelled.',
    });

    res.status(200).json({
      success: true,
      message: 'Lab booking cancelled',
      data: { booking: cancelled },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateLabBookingStatus(req, res, next) {
  try {
    validateId(req.params.id);
    const { status } = req.validatedData;
    const booking = await LabBooking.findById(req.params.id);
    if (!booking) throw new AppError('Lab booking not found', 404);
    if (!(await canManageLab(req.user, booking.labId))) throw new AppError('Access denied', 403);
    if (!allowedTransitions[booking.status]?.includes(status)) {
      throw new AppError(`Cannot change a booking from ${booking.status} to ${status}`, 409);
    }
    if (status === 'confirmed') {
      const requestedTime = new Date(booking.scheduledAt).getTime();
      if (!Number.isFinite(requestedTime) || requestedTime <= Date.now()) {
        throw new AppError('The requested collection time has passed and cannot be confirmed.', 409);
      }
    }
    if (status === 'report_ready' && (!booking.reportId || !(await LabReport.exists({
      _id: booking.reportId,
      labBookingId: booking._id,
      patientId: booking.patientId,
    })))) {
      throw new AppError('A report must be uploaded and linked before this booking can be marked report ready.', 409);
    }

    const update = { status };
    if (status === 'cancelled') update.cancelledAt = new Date();
    const updated = await LabBooking.findOneAndUpdate(
      { _id: booking._id, status: booking.status },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!updated) throw new AppError('The booking status changed. Refresh and try again.', 409);

    const journeyEvents = {
      confirmed: ['lab_booking_confirmed', 'Lab booking confirmed'],
      sample_collected: ['sample_collected', 'Sample collected'],
      processing: ['lab_processing', 'Lab test processing'],
      report_ready: ['report_ready', 'Diagnostic report ready'],
    };
    const [eventType, eventTitle] = journeyEvents[status] || [];
    if (eventType) {
      await recordLabEvent({
        patientId: booking.patientId.toString(),
        booking: updated,
        eventType,
        title: eventTitle,
        notificationType: status === 'confirmed' ? 'lab_booking_confirmed' : 'lab_booking_updated',
        notificationTitle: eventTitle,
        notificationMessage: eventTitle,
      });
    }

    res.status(200).json({ success: true, data: { booking: updated } });
  } catch (error) {
    next(error);
  }
}

async function recordLabEvent({
  patientId,
  booking,
  eventType,
  title,
  notificationType,
  notificationTitle,
  notificationMessage,
}) {
  try {
    await addJourneyEvent(patientId, {
      type: eventType,
      title,
      refModel: 'LabBooking',
      refId: booking._id,
      transitionId: (eventType === 'lab_booking_created' ? booking.createdAt : booking.updatedAt)?.toISOString(),
    });
  } catch (error) {
    logger.error(
      { error: error.message, labBookingId: String(booking._id) },
      'Lab booking changed, but its care journey event could not be recorded'
    );
  }

  try {
    const transitionId = (eventType === 'lab_booking_created' ? booking.createdAt : booking.updatedAt)?.toISOString();
    await createNotification({
      userId: patientId,
      type: notificationType,
      title: notificationTitle,
      message: notificationMessage,
      relatedModel: 'LabBooking',
      relatedId: booking._id,
      dedupeKey: `${eventType}:${booking._id}${transitionId ? `:${transitionId}` : ''}`,
    });
  } catch (error) {
    logger.error(
      { error: error.message, labBookingId: String(booking._id) },
      'Lab booking changed, but its patient notification could not be created'
    );
  }
}
