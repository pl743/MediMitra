import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/Inventory.js', () => ({
  Inventory: {
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../models/Medicine.js', () => ({
  Medicine: {},
}));

vi.mock('../models/Provider.js', () => ({
  Provider: {
    findOne: vi.fn(),
  },
}));

vi.mock('../models/Reservation.js', () => ({
  Reservation: {
    create: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock('../services/inventoryReservationService.js', () => ({
  fulfillReservedStock: vi.fn(),
  recordReservationEvent: vi.fn(),
  releaseReservedStock: vi.fn(),
}));

vi.mock('../services/reservationExpiryService.js', () => ({
  expirePendingReservations: vi.fn(),
  expireReservationById: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  logger: { error: vi.fn() },
}));

import { Inventory } from '../models/Inventory.js';
import { Reservation } from '../models/Reservation.js';
import { recordReservationEvent, releaseReservedStock } from '../services/inventoryReservationService.js';
import {
  cancelReservation,
  createReservation,
  getReservationById,
} from './reservationController.js';

function createResponse() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() };
}

describe('reservationController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('atomically claims available stock before creating a reservation', async () => {
    const inventory = {
      _id: 'inventory-id',
      isAvailable: true,
      confirmedAt: new Date(),
      price: 12.5,
      pharmacyId: {
        _id: 'pharmacy-id',
        type: 'pharmacy',
        isActive: true,
        verificationStatus: 'verified',
      },
      medicineId: { _id: 'medicine-id', isActive: true },
    };
    const inventoryQuery = {
      populate: vi.fn().mockReturnThis(),
      then: (resolve, reject) => Promise.resolve(inventory).then(resolve, reject),
    };
    Inventory.findById.mockReturnValue(inventoryQuery);
    Inventory.findOneAndUpdate.mockResolvedValue(inventory);
    Reservation.create.mockResolvedValue({ _id: 'reservation-id', status: 'pending' });
    const req = {
      user: { id: 'patient-id', role: 'patient' },
      validatedData: { inventoryId: 'inventory-id', quantity: 2 },
    };
    const res = createResponse();

    await createReservation(req, res, vi.fn());

    expect(Inventory.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'inventory-id',
        isAvailable: true,
        $expr: { $gte: [{ $subtract: ['$quantity', '$reservedQuantity'] }, 2] },
      }),
      { $inc: { reservedQuantity: 2 } },
      { new: true }
    );
    expect(Reservation.create).toHaveBeenCalledWith(expect.objectContaining({
      patientId: 'patient-id',
      quantity: 2,
      status: 'pending',
      priceAtReservation: 12.5,
    }));
    expect(recordReservationEvent).toHaveBeenCalledWith(
      inventory,
      expect.objectContaining({ _id: 'reservation-id' }),
      'patient-id',
      'reservation',
      0
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects a reservation when the atomic stock claim finds insufficient stock', async () => {
    const inventory = {
      _id: 'inventory-id',
      isAvailable: true,
      confirmedAt: new Date(),
      pharmacyId: { type: 'pharmacy', isActive: true, verificationStatus: 'verified' },
      medicineId: { isActive: true },
    };
    Inventory.findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      then: (resolve, reject) => Promise.resolve(inventory).then(resolve, reject),
    });
    Inventory.findOneAndUpdate.mockResolvedValue(null);
    const next = vi.fn();

    await createReservation({
      user: { id: 'patient-id', role: 'patient' },
      validatedData: { inventoryId: 'inventory-id', quantity: 1 },
    }, createResponse(), next);

    expect(Reservation.create).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
  });

  it('releases the claimed quantity if reservation persistence fails', async () => {
    const inventory = {
      _id: 'inventory-id',
      isAvailable: true,
      confirmedAt: new Date(),
      price: 12.5,
      pharmacyId: {
        _id: 'pharmacy-id',
        type: 'pharmacy',
        isActive: true,
        verificationStatus: 'verified',
      },
      medicineId: { _id: 'medicine-id', isActive: true },
    };
    const createError = new Error('reservation persistence failed');
    Inventory.findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      then: (resolve, reject) => Promise.resolve(inventory).then(resolve, reject),
    });
    Inventory.findOneAndUpdate
      .mockResolvedValueOnce(inventory)
      .mockResolvedValueOnce(inventory);
    Reservation.create.mockRejectedValue(createError);
    const next = vi.fn();

    await createReservation({
      user: { id: 'patient-id', role: 'patient' },
      validatedData: { inventoryId: 'inventory-id', quantity: 2 },
    }, createResponse(), next);

    expect(Inventory.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { _id: 'inventory-id', reservedQuantity: { $gte: 2 } },
      { $inc: { reservedQuantity: -2 } },
      { new: true }
    );
    expect(next).toHaveBeenCalledWith(createError);
  });

  it('prevents concurrent requests from reserving more than the available stock', async () => {
    const inventory = {
      _id: 'inventory-id',
      quantity: 5,
      reservedQuantity: 0,
      isAvailable: true,
      confirmedAt: new Date(),
      price: 12.5,
      pharmacyId: {
        _id: 'pharmacy-id',
        type: 'pharmacy',
        isActive: true,
        verificationStatus: 'verified',
      },
      medicineId: { _id: 'medicine-id', isActive: true },
    };
    Inventory.findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      then: (resolve, reject) => Promise.resolve(inventory).then(resolve, reject),
    });
    Inventory.findOneAndUpdate.mockImplementation(async (_filter, update) => {
      const requestedQuantity = update.$inc.reservedQuantity;
      if (inventory.quantity - inventory.reservedQuantity < requestedQuantity) return null;
      inventory.reservedQuantity += requestedQuantity;
      return inventory;
    });
    let reservationCount = 0;
    Reservation.create.mockImplementation(async () => ({
      _id: `reservation-${++reservationCount}`,
      status: 'pending',
    }));
    const makeRequest = () => ({
      req: {
        user: { id: 'patient-id', role: 'patient' },
        validatedData: { inventoryId: 'inventory-id', quantity: 3 },
      },
      res: createResponse(),
      next: vi.fn(),
    });
    const requests = [makeRequest(), makeRequest()];

    await Promise.all(requests.map(({ req, res, next }) => createReservation(req, res, next)));

    expect(inventory.reservedQuantity).toBe(3);
    expect(reservationCount).toBe(1);
    expect(requests.map(({ res }) => res.status.mock.calls[0]?.[0]).sort()).toEqual([201, undefined]);
    expect(requests.filter(({ next }) => next.mock.calls.length).length).toBe(1);
    expect(requests.find(({ next }) => next.mock.calls.length).next)
      .toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
  });

  it('cancels a pending reservation owned by the requesting patient and releases stock', async () => {
    const reservation = {
      _id: 'reservation-id',
      patientId: { toString: () => 'patient-id' },
      inventoryId: 'inventory-id',
      quantity: 1,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
    };
    Reservation.findById.mockResolvedValue(reservation);
    Reservation.findOneAndUpdate.mockResolvedValue({ ...reservation, status: 'cancelled' });
    releaseReservedStock.mockResolvedValue({});
    const res = createResponse();

    await cancelReservation({
      params: { id: '507f1f77bcf86cd799439011' },
      user: { id: 'patient-id', role: 'patient' },
      validatedData: { reason: 'No longer needed' },
    }, res, vi.fn());

    expect(Reservation.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
      expect.objectContaining({ $set: expect.objectContaining({
        status: 'cancelled',
        cancellationReason: 'No longer needed',
      }) }),
      { new: true, runValidators: true }
    );
    expect(releaseReservedStock).toHaveBeenCalledWith(reservation, 'patient-id');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('restores reservation status when releasing its stock fails', async () => {
    const reservation = {
      _id: 'reservation-id',
      patientId: { toString: () => 'patient-id' },
      inventoryId: 'inventory-id',
      quantity: 1,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
    };
    Reservation.findById.mockResolvedValue(reservation);
    Reservation.findOneAndUpdate
      .mockResolvedValueOnce({ ...reservation, status: 'cancelled' })
      .mockResolvedValueOnce(reservation);
    releaseReservedStock.mockRejectedValue(new Error('inventory update failed'));
    const next = vi.fn();

    await cancelReservation({
      params: { id: '507f1f77bcf86cd799439011' },
      user: { id: 'patient-id', role: 'patient' },
      validatedData: {},
    }, createResponse(), next);

    expect(Reservation.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { _id: 'reservation-id', status: 'cancelled' },
      expect.objectContaining({
        $set: { status: 'pending' },
        $unset: expect.objectContaining({ respondedAt: 1, respondedBy: 1 }),
      }),
      { new: true }
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'inventory update failed' }));
  });

  it('rejects cancellation by a different patient', async () => {
    Reservation.findById.mockResolvedValue({
      patientId: { toString: () => 'another-patient' },
      status: 'pending',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const next = vi.fn();

    await cancelReservation({
      params: { id: '507f1f77bcf86cd799439011' },
      user: { id: 'patient-id', role: 'patient' },
      validatedData: {},
    }, createResponse(), next);

    expect(releaseReservedStock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('denies reservation details to authenticated roles without reservation access', async () => {
    const reservation = { patientId: 'patient-id', pharmacyId: 'pharmacy-id' };
    Reservation.findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      then: (resolve, reject) => Promise.resolve(reservation).then(resolve, reject),
    });
    const next = vi.fn();

    await getReservationById({
      params: { id: '507f1f77bcf86cd799439011' },
      user: { id: 'doctor-id', role: 'doctor' },
    }, createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});
