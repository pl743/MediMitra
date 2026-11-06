/**
 * Public medicine catalog search and administrator catalog maintenance.
 */

import { Medicine } from '../models/Medicine.js';
import { AppError } from '../utils/AppError.js';

function validateId(id) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new AppError('Invalid ID format', 400);
}

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function searchMedicines(req, res, next) {
  try {
    const { q, category, strength, form, page = 1, limit = 20 } = req.validatedQuery;
    const filter = { isActive: true };
    if (q) {
      const matcher = { $regex: escaped(q), $options: 'i' };
      filter.$or = [
        { brandName: matcher },
        { genericName: matcher },
        { manufacturer: matcher },
      ];
    }
    if (category) filter.category = { $regex: escaped(category), $options: 'i' };
    if (strength) filter.strength = { $regex: escaped(strength), $options: 'i' };
    if (form) filter.form = form;

    const skip = (page - 1) * limit;
    const [medicines, total] = await Promise.all([
      Medicine.find(filter).sort({ genericName: 1, brandName: 1 }).skip(skip).limit(limit).lean(),
      Medicine.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        medicines,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMedicineById(req, res, next) {
  try {
    validateId(req.params.id);
    const medicine = await Medicine.findOne({ _id: req.params.id, isActive: true }).lean();
    if (!medicine) throw new AppError('Medicine not found', 404);
    res.status(200).json({ success: true, data: { medicine } });
  } catch (error) {
    next(error);
  }
}

export async function createMedicine(req, res, next) {
  try {
    res.status(501).json({ success: false, message: 'Not yet implemented' });
  } catch (error) {
    next(error);
  }
}

export async function updateMedicine(req, res, next) {
  try {
    res.status(501).json({ success: false, message: 'Not yet implemented' });
  } catch (error) {
    next(error);
  }
}
