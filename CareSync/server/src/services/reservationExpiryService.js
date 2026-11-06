import { Reservation } from '../models/Reservation.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { releaseReservedStock } from './inventoryReservationService.js';

export async function expirePendingReservations(now = new Date(), scope = {}) {
  const expiredCandidates = await Reservation.find({
    status: 'pending',
    expiresAt: { $lte: now },
    ...scope,
  })
    .sort({ expiresAt: 1 })
    .limit(200)
    .lean();

  let expiredCount = 0;
  for (const candidate of expiredCandidates) {
    const reservation = await Reservation.findOneAndUpdate(
      { _id: candidate._id, status: 'pending', expiresAt: { $lte: now } },
      { $set: { status: 'expired', respondedAt: now } },
      { new: true }
    );
    if (!reservation) continue;

    try {
      await releaseReservedStock(reservation, reservation.patientId);
      expiredCount += 1;
    } catch (error) {
      try {
        const restored = await Reservation.findOneAndUpdate(
          { _id: reservation._id, status: 'expired' },
          { $set: { status: 'pending' }, $unset: { respondedAt: 1 } },
          { new: true }
        );
        if (!restored) throw new Error('Expired reservation could not be restored');
        logger.error(
          { error: error.message, reservationId: String(reservation._id) },
          'Reservation expiry could not release held stock; reservation was restored for retry'
        );
      } catch (restoreError) {
        logger.error(
          {
            error: error.message,
            restoreError: restoreError.message,
            reservationId: String(reservation._id),
          },
          'Reservation expiry could not release stock or restore its pending state; manual review is required'
        );
      }
    }
  }
  return expiredCount;
}

export function startReservationExpiryJob(intervalMs = 60_000) {
  const run = () => {
    expirePendingReservations().catch((error) => {
      logger.error({ error: error.message }, 'Reservation expiry sweep failed');
    });
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return timer;
}

export async function expireReservationById(reservation) {
  const now = new Date();
  const expired = await Reservation.findOneAndUpdate(
    { _id: reservation._id, status: 'pending', expiresAt: { $lte: now } },
    { $set: { status: 'expired', respondedAt: now } },
    { new: true }
  );
  if (!expired) return false;
  try {
    await releaseReservedStock(expired, expired.patientId);
  } catch (error) {
    try {
      const restored = await Reservation.findOneAndUpdate(
        { _id: expired._id, status: 'expired' },
        { $set: { status: 'pending' }, $unset: { respondedAt: 1 } },
        { new: true }
      );
      if (!restored) throw new Error('Expired reservation could not be restored');
    } catch (restoreError) {
      logger.error(
        {
          error: error.message,
          restoreError: restoreError.message,
          reservationId: String(expired._id),
        },
        'Reservation expiry could not release stock or restore its pending state; manual review is required'
      );
      throw new AppError('Expired reservation stock could not be released consistently; manual review is required.', 500);
    }
    throw new AppError('Expired reservation stock could not be released; please retry shortly.', 409);
  }
  return true;
}
