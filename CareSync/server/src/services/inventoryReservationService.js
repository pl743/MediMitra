import { Inventory } from '../models/Inventory.js';
import { InventoryEvent } from '../models/InventoryEvent.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export async function releaseReservedStock(reservation, performedBy, type = 'reservation_release') {
  const inventory = await Inventory.findOneAndUpdate(
    { _id: reservation.inventoryId, reservedQuantity: { $gte: reservation.quantity } },
    { $inc: { reservedQuantity: -reservation.quantity } },
    { new: true }
  );
  if (!inventory) throw new AppError('Reserved stock could not be released; inventory requires review.', 409);

  await recordReservationEvent(inventory, reservation, performedBy, type, 0);
  return inventory;
}

export async function fulfillReservedStock(reservation, performedBy) {
  const inventory = await Inventory.findOneAndUpdate(
    {
      _id: reservation.inventoryId,
      quantity: { $gte: reservation.quantity },
      reservedQuantity: { $gte: reservation.quantity },
    },
    {
      $inc: {
        quantity: -reservation.quantity,
        reservedQuantity: -reservation.quantity,
      },
    },
    { new: true }
  );
  if (!inventory) throw new AppError('Reserved stock could not be fulfilled; inventory requires review.', 409);

  await recordReservationEvent(inventory, reservation, performedBy, 'stock_remove', -reservation.quantity);
  return inventory;
}

export async function recordReservationEvent(inventory, reservation, performedBy, type, quantityDelta) {
  try {
    await InventoryEvent.create({
      inventoryId: inventory._id,
      pharmacyId: inventory.pharmacyId,
      medicineId: inventory.medicineId,
      type,
      quantityDelta,
      quantityAfter: inventory.quantity,
      performedBy,
      relatedReservationId: reservation._id,
    });
  } catch (error) {
    logger.error(
      { error: error.message, reservationId: String(reservation._id) },
      'Reservation stock changed, but its inventory audit event could not be recorded'
    );
  }
}
