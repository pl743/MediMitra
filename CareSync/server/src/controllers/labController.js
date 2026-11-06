/**
 * labController.js — Lab directory and test catalog management.
 * Public lab directory and active test catalog reads.
 * Catalog create/update are separate staff-management operations.
 */

import { Provider } from '../models/Provider.js';
import { TestCatalog } from '../models/TestCatalog.js';
import { AppError } from '../utils/AppError.js';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPagination(query, defaultLimit, maxLimit = 100) {
  if (
    (query.page !== undefined && typeof query.page !== 'string') ||
    (query.limit !== undefined && typeof query.limit !== 'string')
  ) {
    throw new AppError('page and limit must be single integer values', 400);
  }
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? defaultLimit);
  if (!Number.isInteger(page) || page < 1) {
    throw new AppError('page must be a positive integer', 400);
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new AppError('limit must be a positive integer', 400);
  }
  const safeLimit = Math.min(maxLimit, limit);
  return { page, limit: safeLimit, skip: (page - 1) * safeLimit };
}

function validateId(id) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new AppError('Invalid ID format', 400);
}

export async function getLabs(req, res, next) {
  try {
    const { city, name } = req.query;
    if ((name !== undefined && typeof name !== 'string') || (city !== undefined && typeof city !== 'string')) {
      throw new AppError('name and city must be single text values', 400);
    }
    const { page: pageNum, limit: limitNum, skip } = getPagination(req.query, 12, 50);

    const filter = {
      type: 'laboratory',
      isActive: true,
      verificationStatus: 'verified',
    };

    if (name?.trim()) filter.name = { $regex: escapeRegex(name.trim()), $options: 'i' };
    if (city?.trim()) filter['address.city'] = { $regex: escapeRegex(city.trim()), $options: 'i' };

    const [labs, total] = await Promise.all([
      Provider.find(filter).skip(skip).limit(limitNum).lean(),
      Provider.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        labs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTestCatalog(req, res, next) {
  try {
    const { category, name } = req.query;
    if (
      (name !== undefined && typeof name !== 'string') ||
      (category !== undefined && typeof category !== 'string')
    ) {
      throw new AppError('name and category must be single text values', 400);
    }
    const { page: pageNum, limit: limitNum, skip } = getPagination(req.query, 20);

    const filter = { isActive: true };
    if (category?.trim()) filter.category = { $regex: escapeRegex(category.trim()), $options: 'i' };
    if (name?.trim()) filter.name = { $regex: escapeRegex(name.trim()), $options: 'i' };

    const [tests, total] = await Promise.all([
      TestCatalog.find(filter).skip(skip).limit(limitNum).lean(),
      TestCatalog.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        tests,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getTestById(req, res, next) {
  try {
    validateId(req.params.id);
    const test = await TestCatalog.findOne({ _id: req.params.id, isActive: true }).lean();
    if (!test) throw new AppError('Lab test not found', 404);
    res.status(200).json({ success: true, data: { test } });
  } catch (error) {
    next(error);
  }
}

export async function getLabById(req, res, next) {
  try {
    validateId(req.params.id);
    const lab = await Provider.findOne({
      _id: req.params.id,
      type: 'laboratory',
      isActive: true,
      verificationStatus: 'verified',
    }).lean();
    if (!lab) throw new AppError('Laboratory not found', 404);
    res.status(200).json({ success: true, data: { lab } });
  } catch (error) {
    next(error);
  }
}

export async function createTestCatalogEntry(req, res, next) {
  try {
    res.status(501).json({ success: false, message: 'Not yet implemented' });
  } catch (error) {
    next(error);
  }
}

export async function updateTestCatalogEntry(req, res, next) {
  try {
    res.status(501).json({ success: false, message: 'Not yet implemented' });
  } catch (error) {
    next(error);
  }
}
