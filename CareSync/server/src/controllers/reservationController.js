/**
 * Patient stock reservations and pharmacy reservation responses.
 */

import { Inventory } from '../models/Inventory.js';
import { Provider } from '../models/Provider.js';
import { Reservation } from '../models/Reservation.js';
import { AppError } from '../utils/AppError.js';
import {
  fulfillReservedStock,
  recordReservationEvent,
  releaseReservedStock,
} from '../services/inventoryReservationService.js';
import { logger } from '../utils/logger.js';
import {
  expirePendingReservations,
  expireReservationById,
} from '../services/reservationExpiryService.js';

const stockFreshnessMs = 24 * 60 * 60 * 1000;
const pendingReservationHours = 24;

function validateId(id) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new AppError('Invalid ID format', 400);
}

function getPagination(query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  return { page, limit, skip: (page - 1) * limit };
}

async function getManagedPharmacyId(user, requestedId) {
  if (user.role === 'admin') {
    if (!requestedId) return null;
    validateId(requestedId);
    const pharmacy = await Provider.findOne({ _id: requestedId, type: 'pharmacy' }).select('_id');
    if (!pharmacy) throw new AppError('Pharmacy not found', 404);
    return pharmacy._id;
  }

  const pharmacy = await Provider.findOne({
    managedBy: user.id,
    type: 'pharmacy',
    isActive: true,
  }).select('_id');
  if (!pharmacy) throw new AppError('No pharmacy is linked to this account', 404);
  if (requestedId && pharmacy._id.toString() !== requestedId) {
    throw new AppError('You can only view reservations for your own pharmacy', 403);
  }
  return pharmacy._id;
}

async function restoreReservation(reservationId, fromStatus, toStatus, fields = []) {
  const unset = Object.fromEntries(fields.map((field) => [field, 1]));
  const restored = await Reservation.findOneAndUpdate(
    { _id: reservationId, status: fromStatus },
    {
      $set: { status: toStatus },
      ...(fields.length ? { $unset: unset } : {}),
    },
    { new: true }
  );
  if (!restored) {
    throw new AppError('Reservation state could not be restored after a stock update failure.', 500);
  }
}

async function changeReservationStockState(reservation, nextStatus, user, reason) {
  const now = new Date();
  const update = {
    status: nextStatus,
    respondedAt: now,
    respondedBy: user.id,
  };
  if (nextStatus === 'cancelled') update.cancellationReason = reason || '';
  if (nextStatus === 'rejected') update.rejectionReason = reason || '';

  const filter = {
    _id: reservation._id,
    status: reservation.status,
  };
  if (reservation.status === 'pending') filter.expiresAt = { $gt: now };

  const updated = await Reservation.findOneAndUpdate(
    filter,
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!updated) throw new AppError('Reservation status changed or expired. Refresh and try again.', 409);

  try {
    if (nextStatus === 'cancelled' || nextStatus === 'rejected') {
      await releaseReservedStock(reservation, user.id);
    } else if (nextStatus === 'fulfilled') {
      await fulfillReservedStock(reservation, user.id);
    }
  } catch (error) {
    try {
      await restoreReservation(updated._id, nextStatus, reservation.status, [
        'respondedAt',
        'respondedBy',
        ...(nextStatus === 'cancelled' ? ['cancellationReason'] : []),
        ...(nextStatus === 'rejected' ? ['rejectionReason'] : []),
      ]);
    } catch (restoreError) {
      logger.error(
        { error: restoreError.message, reservationId: String(updated._id) },
        'Reservation stock update failed and its previous state could not be restored'
      );
      throw new AppError('Reservation stock could not be updated consistently; manual review is required.', 500);
    }
    throw error;
  }

  return updated;
}

export async function createReservation(req, res, next) {
  try {
    const { inventoryId, quantity, patientNotes } = req.validatedData;
    await expirePendingReservations(new Date(), { inventoryId });
    const inventoryQuery = Inventory.findById(inventoryId)
      .populate('pharmacyId', 'name type isActive verificationStatus')
      .populate('medicineId', 'brandName genericName isActive');
    const currentInventory = await inventoryQuery;
    if (
      !currentInventory ||
      !currentInventory.isAvailable ||
      !currentInventory.pharmacyId?.isActive ||
      currentInventory.pharmacyId?.type !== 'pharmacy' ||
      currentInventory.pharmacyId?.verificationStatus !== 'verified' ||
      !currentInventory.medicineId?.isActive
    ) {
      throw new AppError('This pharmacy stock listing is unavailable', 404);
    }

    const freshSince = new Date(Date.now() - stockFreshnessMs);
    const claimedInventory = await Inventory.findOneAndUpdate(
      {
        _id: inventoryId,
        isAvailable: true,
        confirmedAt: { $gte: freshSince },
        $expr: { $gte: [{ $subtract: ['$quantity', '$reservedQuantity'] }, quantity] },
      },
      { $inc: { reservedQuantity: quantity } },
      { new: true }
    );
    if (!claimedInventory) {
      throw new AppError('Stock is unavailable or needs pharmacy confirmation. Refresh the listing and try again.', 409);
    }

    const expiresAt = new Date(Date.now() + pendingReservationHours * 60 * 60 * 1000);
    let reservation;
    try {
      reservation = await Reservation.create({
        patientId: req.user.id,
        inventoryId: claimedInventory._id,
        pharmacyId: claimedInventory.pharmacyId,
        medicineId: claimedInventory.medicineId,
        quantity,
        status: 'pending',
        priceAtReservation: claimedInventory.price,
        expiresAt,
        patientNotes,
      });
    } catch (error) {
      try {
        const released = await Inventory.findOneAndUpdate(
          { _id: claimedInventory._id, reservedQuantity: { $gte: quantity } },
          { $inc: { reservedQuantity: -quantity } },
          { new: true }
        );
        if (!released) throw new Error('Reserved quantity was not released');
      } catch (rollbackError) {
        logger.error(
          { error: rollbackError.message, inventoryId: String(claimedInventory._id), quantity },
          'Failed to roll back a stock claim after reservation creation failed'
        );
        throw new AppError('Reservation could not be saved and stock rollback needs review.', 500);
      }
      throw error;
    }

    await recordReservationEvent(
      claimedInventory,
      reservation,
      req.user.id,
      'reservation',
      0
    );

    res.status(201).json({
      success: true,
      message: 'Reservation request submitted; pharmacy confirmation is required',
      data: { reservation },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyReservations(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.validatedQuery);
    await expirePendingReservations(new Date(), { patientId: req.user.id });
    const filter = { patientId: req.user.id };
    if (req.validatedQuery.status) filter.status = req.validatedQuery.status;
    const [reservations, total] = await Promise.all([
      Reservation.find(filter)
        .populate('inventoryId', 'quantity reservedQuantity confirmedAt price')
        .populate('pharmacyId', 'name address phone')
        .populate('medicineId', 'brandName genericName strength form requiresPrescription')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Reservation.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      data: { reservations, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
}

export async function getPharmacyReservations(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.validatedQuery);
    const pharmacyId = await getManagedPharmacyId(req.user, req.validatedQuery.pharmacyId);
    await expirePendingReservations(new Date(), pharmacyId ? { pharmacyId } : {});
    const filter = {};
    if (pharmacyId) filter.pharmacyId = pharmacyId;
    if (req.validatedQuery.status) filter.status = req.validatedQuery.status;
    const [reservations, total] = await Promise.all([
      Reservation.find(filter)
        .populate('patientId', 'firstName lastName')
        .populate('medicineId', 'brandName genericName strength form')
        .populate('inventoryId', 'price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Reservation.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      data: { reservations, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
}

export async function getReservationById(req, res, next) {
  try {
    validateId(req.params.id);
    const reservation = await Reservation.findById(req.params.id)
      .populate('pharmacyId', 'name address')
      .populate('medicineId', 'brandName genericName strength form')
      .populate('inventoryId', 'price confirmedAt');
    if (!reservation) throw new AppError('Reservation not found', 404);

    if (!['patient', 'pharmacist', 'admin'].includes(req.user.role)) {
      throw new AppError('Access denied', 403);
    }
    if (req.user.role === 'patient' && reservation.patientId.toString() !== req.user.id) {
      throw new AppError('Access denied', 403);
    }
    if (req.user.role === 'pharmacist') {
      const pharmacyId = reservation.pharmacyId._id || reservation.pharmacyId;
      await getManagedPharmacyId(req.user, pharmacyId.toString());
    }

    res.status(200).json({ success: true, data: { reservation } });
  } catch (error) {
    next(error);
  }
}

export async function cancelReservation(req, res, next) {
  try {
    validateId(req.params.id);
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) throw new AppError('Reservation not found', 404);
    if (reservation.patientId.toString() !== req.user.id) throw new AppError('Access denied', 403);
    if (reservation.status !== 'pending') {
      throw new AppError('Only pending reservations can be cancelled by the patient', 409);
    }
    if (reservation.expiresAt <= new Date()) {
      await expireReservationById(reservation);
      throw new AppError('This reservation has expired', 409);
    }

    const updated = await changeReservationStockState(
      reservation,
      'cancelled',
      req.user,
      req.validatedData.reason
    );
    res.status(200).json({ success: true, data: { reservation: updated } });
  } catch (error) {
    next(error);
  }
}

export async function respondToReservation(req, res, next) {
  try {
    validateId(req.params.id);
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) throw new AppError('Reservation not found', 404);
    await getManagedPharmacyId(req.user, reservation.pharmacyId.toString());

    const { status, rejectionReason } = req.validatedData;
    const validTransition =
      (reservation.status === 'pending' && ['confirmed', 'rejected'].includes(status)) ||
      (reservation.status === 'confirmed' && status === 'fulfilled');
    if (!validTransition) {
      throw new AppError(`Cannot change reservation from ${reservation.status} to ${status}`, 409);
    }
    if (reservation.status === 'pending' && reservation.expiresAt <= new Date()) {
      await expireReservationById(reservation);
      throw new AppError('This reservation has expired and cannot be processed', 409);
    }

    const updated = status === 'confirmed'
      ? await Reservation.findOneAndUpdate(
        { _id: reservation._id, status: 'pending', expiresAt: { $gt: new Date() } },
        { $set: { status, respondedAt: new Date(), respondedBy: req.user.id } },
        { new: true, runValidators: true }
      )
      : await changeReservationStockState(
        reservation,
        status,
        req.user,
        rejectionReason
      );
    if (!updated) throw new AppError('Reservation status changed or expired. Refresh and try again.', 409);

    res.status(200).json({ success: true, data: { reservation: updated } });
  } catch (error) {
    next(error);
  }
}
