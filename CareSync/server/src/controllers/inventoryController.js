/**
 * Pharmacy inventory search, management, and stock confirmation.
 */

import { Inventory } from '../models/Inventory.js';
import { InventoryEvent } from '../models/InventoryEvent.js';
import { Medicine } from '../models/Medicine.js';
import { Provider } from '../models/Provider.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const stockFreshnessMs = 24 * 60 * 60 * 1000;

function validateId(id) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new AppError('Invalid ID format', 400);
}

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getManagedPharmacyId(user, requestedId) {
  if (user.role === 'admin') {
    if (!requestedId) throw new AppError('pharmacyId is required for administrator inventory access', 400);
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
    throw new AppError('You can only manage your own pharmacy inventory', 403);
  }
  return pharmacy._id;
}

function getPagination(query) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  return { page, limit, skip: (page - 1) * limit };
}

function presentInventory(item) {
  const availableQuantity = Math.max(0, item.quantity - item.reservedQuantity);
  const isStale = !item.confirmedAt || Date.now() - new Date(item.confirmedAt).getTime() > stockFreshnessMs;
  return {
    ...item,
    availableQuantity,
    isStale,
    stockStatus: isStale
      ? 'confirmation_needed'
      : availableQuantity > 0
        ? 'in_stock'
        : 'out_of_stock',
  };
}

async function recordInventoryEvent(event) {
  try {
    await InventoryEvent.create(event);
  } catch (error) {
    logger.error(
      { error: error.message, inventoryId: String(event.inventoryId), eventType: event.type },
      'Inventory changed, but its audit event could not be recorded'
    );
  }
}

export async function searchInventory(req, res, next) {
  try {
    const {
      q,
      medicineIds,
      pharmacyId,
      inStock,
      sort = 'recent',
      page = 1,
      limit = 20,
    } = req.validatedQuery;
    const filter = { isAvailable: true };

    const pharmacies = await Provider.find({
      type: 'pharmacy',
      isActive: true,
      verificationStatus: 'verified',
      ...(pharmacyId ? { _id: pharmacyId } : {}),
    }).distinct('_id');
    filter.pharmacyId = { $in: pharmacies };

    if (medicineIds) {
      const requestedIds = medicineIds.split(',');
      const activeIds = await Medicine.find({ _id: { $in: requestedIds }, isActive: true }).distinct('_id');
      filter.medicineId = { $in: activeIds };
    } else if (q) {
      const matcher = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      const medicines = await Medicine.find({
        isActive: true,
        $or: [{ brandName: matcher }, { genericName: matcher }, { manufacturer: matcher }],
      }).distinct('_id');
      filter.medicineId = { $in: medicines };
    } else {
      const medicines = await Medicine.find({ isActive: true }).distinct('_id');
      filter.medicineId = { $in: medicines };
    }

    if (inStock === 'true') {
      filter.$expr = { $gt: [{ $subtract: ['$quantity', '$reservedQuantity'] }, 0] };
    } else if (inStock === 'false') {
      filter.$expr = { $lte: [{ $subtract: ['$quantity', '$reservedQuantity'] }, 0] };
    }

    const sortBy = sort === 'price_asc'
      ? { price: 1, _id: 1 }
      : sort === 'price_desc'
        ? { price: -1, _id: 1 }
        : { updatedAt: -1 };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Inventory.find(filter)
        .populate('medicineId', 'brandName genericName manufacturer category strength form requiresPrescription')
        .populate('pharmacyId', 'name address phone')
        .sort(sortBy)
        .skip(skip)
        .limit(limit)
        .lean(),
      Inventory.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        items: items.map(presentInventory),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getPharmacyInventory(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.validatedQuery);
    const pharmacyId = await getManagedPharmacyId(req.user, req.validatedQuery.pharmacyId);
    const filter = { pharmacyId };
    if (req.validatedQuery.q) {
      const matcher = { $regex: escaped(req.validatedQuery.q), $options: 'i' };
      const medicineIds = await Medicine.find({
        $or: [{ brandName: matcher }, { genericName: matcher }, { manufacturer: matcher }],
      }).distinct('_id');
      filter.medicineId = { $in: medicineIds };
    }
    const [items, total] = await Promise.all([
      Inventory.find(filter)
        .populate('medicineId', 'brandName genericName manufacturer category strength form')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Inventory.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      data: {
        items: items.map(presentInventory),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function addInventoryItem(req, res, next) {
  try {
    const pharmacyId = await getManagedPharmacyId(req.user, req.validatedData.pharmacyId);
    const medicine = await Medicine.findOne({ _id: req.validatedData.medicineId, isActive: true }).select('_id');
    if (!medicine) throw new AppError('Active medicine not found', 404);

    const item = await Inventory.create({
      pharmacyId,
      medicineId: medicine._id,
      quantity: req.validatedData.quantity,
      reservedQuantity: 0,
      price: req.validatedData.price,
      lowStockThreshold: req.validatedData.lowStockThreshold,
      confirmedAt: new Date(),
      updatedBy: req.user.id,
    }).catch((error) => {
      if (error.code === 11000) throw new AppError('This medicine is already listed in the pharmacy inventory', 409);
      throw error;
    });

    await recordInventoryEvent({
      inventoryId: item._id,
      pharmacyId,
      medicineId: medicine._id,
      type: 'stock_add',
      quantityDelta: item.quantity,
      quantityAfter: item.quantity,
      performedBy: req.user.id,
      notes: req.validatedData.notes,
    });
    res.status(201).json({ success: true, data: { item } });
  } catch (error) {
    next(error);
  }
}

export async function updateInventoryItem(req, res, next) {
  try {
    validateId(req.params.id);
    const pharmacyId = await getManagedPharmacyId(req.user, req.validatedData.pharmacyId);
    const current = await Inventory.findOne({ _id: req.params.id, pharmacyId });
    if (!current) throw new AppError('Inventory item not found', 404);

    const { quantity, price, lowStockThreshold, isAvailable, notes } = req.validatedData;
    const updates = { updatedBy: req.user.id };
    if (quantity !== undefined) {
      updates.quantity = quantity;
      updates.confirmedAt = new Date();
    }
    if (price !== undefined) updates.price = price;
    if (lowStockThreshold !== undefined) updates.lowStockThreshold = lowStockThreshold;
    if (isAvailable !== undefined) updates.isAvailable = isAvailable;

    const filter = { _id: current._id, pharmacyId };
    if (quantity !== undefined) filter.$expr = { $lte: ['$reservedQuantity', quantity] };
    const item = await Inventory.findOneAndUpdate(
      filter,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!item) throw new AppError('Quantity cannot be lower than already reserved stock', 409);

    const quantityDelta = quantity === undefined ? 0 : quantity - current.quantity;
    await recordInventoryEvent({
      inventoryId: item._id,
      pharmacyId,
      medicineId: item.medicineId,
      type: quantityDelta > 0 ? 'stock_add' : quantityDelta < 0 ? 'stock_remove' : 'adjustment',
      quantityDelta,
      quantityAfter: item.quantity,
      performedBy: req.user.id,
      notes,
    });
    res.status(200).json({ success: true, data: { item } });
  } catch (error) {
    next(error);
  }
}

export async function confirmStock(req, res, next) {
  try {
    validateId(req.params.id);
    const pharmacyId = await getManagedPharmacyId(req.user);
    const current = await Inventory.findOne({ _id: req.params.id, pharmacyId });
    if (!current) throw new AppError('Inventory item not found', 404);

    const { quantity, notes } = req.validatedData;
    const item = await Inventory.findOneAndUpdate(
      { _id: current._id, pharmacyId, $expr: { $lte: ['$reservedQuantity', quantity] } },
      { $set: { quantity, confirmedAt: new Date(), updatedBy: req.user.id } },
      { new: true, runValidators: true }
    );
    if (!item) throw new AppError('Confirmed quantity cannot be lower than already reserved stock', 409);

    await recordInventoryEvent({
      inventoryId: item._id,
      pharmacyId,
      medicineId: item.medicineId,
      type: 'confirmation',
      quantityDelta: quantity - current.quantity,
      quantityAfter: quantity,
      performedBy: req.user.id,
      notes,
    });
    res.status(200).json({ success: true, data: { item } });
  } catch (error) {
    next(error);
  }
}

export async function getInventoryHistory(req, res, next) {
  try {
    validateId(req.params.id);
    const { page, limit, skip } = getPagination(req.validatedQuery);
    const pharmacyId = await getManagedPharmacyId(req.user, req.validatedQuery.pharmacyId);
    const item = await Inventory.findOne({ _id: req.params.id, pharmacyId }).select('_id');
    if (!item) throw new AppError('Inventory item not found', 404);
    const filter = { inventoryId: item._id, pharmacyId };
    const [events, total] = await Promise.all([
      InventoryEvent.find(filter)
        .populate('performedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InventoryEvent.countDocuments(filter),
    ]);
    res.status(200).json({
      success: true,
      data: { events, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
}
