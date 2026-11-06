import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/Inventory.js', () => ({
  Inventory: {
    find: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
    findOneAndUpdate: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../models/Medicine.js', () => ({
  Medicine: {
    find: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('../models/InventoryEvent.js', () => ({
  InventoryEvent: {
    create: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock('../models/Provider.js', () => ({
  Provider: {
    find: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('../utils/logger.js', () => ({
  logger: { error: vi.fn() },
}));

import { Inventory } from '../models/Inventory.js';
import { Medicine } from '../models/Medicine.js';
import { Provider } from '../models/Provider.js';
import { getPharmacyInventory, updateInventoryItem } from './inventoryController.js';

describe('inventoryController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prevents a pharmacist from changing a different pharmacy inventory', async () => {
    const pharmacyQuery = { select: vi.fn().mockResolvedValue({ _id: 'my-pharmacy' }) };
    Provider.findOne.mockReturnValue(pharmacyQuery);
    const next = vi.fn();

    await updateInventoryItem(
      {
        params: { id: '507f1f77bcf86cd799439011' },
        user: { id: 'pharmacist-id', role: 'pharmacist' },
        validatedData: { pharmacyId: 'another-pharmacy', price: 4 },
      },
      {},
      next
    );

    expect(Inventory.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('does not permit stock to be reduced below its reserved quantity', async () => {
    Provider.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue({ _id: 'my-pharmacy' }),
    });
    Inventory.findOne.mockResolvedValue({
      _id: 'inventory-id',
      pharmacyId: 'my-pharmacy',
      quantity: 8,
      reservedQuantity: 5,
    });
    Inventory.findOneAndUpdate.mockResolvedValue(null);
    const next = vi.fn();

    await updateInventoryItem(
      {
        params: { id: '507f1f77bcf86cd799439011' },
        user: { id: 'pharmacist-id', role: 'pharmacist' },
        validatedData: { quantity: 3 },
      },
      {},
      next
    );

    expect(Inventory.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ $expr: { $lte: ['$reservedQuantity', 3] } }),
      expect.objectContaining({ $set: expect.objectContaining({ quantity: 3 }) }),
      { new: true, runValidators: true }
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
  });

  it('searches pharmacy inventory by escaped medicine fields', async () => {
    Provider.findOne.mockReturnValue({
      select: vi.fn().mockResolvedValue({ _id: 'my-pharmacy' }),
    });
    Medicine.find.mockReturnValue({ distinct: vi.fn().mockResolvedValue(['medicine-id']) });
    const inventoryQuery = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    };
    Inventory.find.mockReturnValue(inventoryQuery);
    Inventory.countDocuments.mockResolvedValue(0);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await getPharmacyInventory({
      user: { id: 'pharmacist-id', role: 'pharmacist' },
      validatedQuery: { q: 'aspirin.*', page: 1, limit: 20 },
    }, res, vi.fn());

    expect(Medicine.find).toHaveBeenCalledWith({
      $or: [
        { brandName: { $regex: 'aspirin\\.\\*', $options: 'i' } },
        { genericName: { $regex: 'aspirin\\.\\*', $options: 'i' } },
        { manufacturer: { $regex: 'aspirin\\.\\*', $options: 'i' } },
      ],
    });
    expect(Inventory.find).toHaveBeenCalledWith({
      pharmacyId: 'my-pharmacy',
      medicineId: { $in: ['medicine-id'] },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
