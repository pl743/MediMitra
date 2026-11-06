/**
 * adminController.js — Administrator dashboard and management endpoints.
 */

import { Appointment } from '../models/Appointment.js';
import { AuditLog } from '../models/AuditLog.js';
import { ImportJob } from '../models/ImportJob.js';
import { LabBooking } from '../models/LabBooking.js';
import { Provider } from '../models/Provider.js';
import { Reservation } from '../models/Reservation.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { writeAuditLog } from '../utils/audit.js';

function getPagination(query, defaultLimit = 20, maxLimit = 100) {
  if ((query.page !== undefined && !['string', 'number'].includes(typeof query.page))
      || (query.limit !== undefined && !['string', 'number'].includes(typeof query.limit))) {
    throw new AppError('page and limit must be single integer values', 400);
  }

  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);

  if (!Number.isInteger(page) || page < 1) {
    throw new AppError('page must be a positive integer', 400);
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new AppError(`limit must be an integer between 1 and ${maxLimit}`, 400);
  }

  return { page, limit, skip: (page - 1) * limit };
}

export async function getAnalytics(req, res, next) {
  try {
    const [users, appointments, providers, labBookings, reservations, providerStatuses,
      appointmentStatuses, labBookingStatuses, recentActivity] = await Promise.all([
      User.countDocuments(),
      Appointment.countDocuments(),
      Provider.countDocuments(),
      LabBooking.countDocuments(),
      Reservation.countDocuments(),
      Provider.aggregate([{ $group: { _id: '$verificationStatus', count: { $sum: 1 } } }]),
      Appointment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      LabBooking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      AuditLog.find().sort({ createdAt: -1 }).limit(10)
        .populate('actorId', 'firstName lastName')
        .select('actorId action resourceType createdAt success')
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
        appointments,
        providers,
        labBookings,
        reservations,
        providerStatuses: Object.fromEntries(providerStatuses.map(({ _id, count }) => [_id, count])),
        appointmentStatuses: Object.fromEntries(appointmentStatuses.map(({ _id, count }) => [_id, count])),
        labBookingStatuses: Object.fromEntries(labBookingStatuses.map(({ _id, count }) => [_id, count])),
        recentActivity,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getUsers(req, res, next) {
  try {
    const query = req.validatedQuery ?? req.query;
    const { page, limit, skip } = getPagination(query);
    const filter = {};

    if (query.role !== undefined) {
      const roles = ['patient', 'doctor', 'lab_staff', 'pharmacist', 'admin'];
      if (typeof query.role !== 'string' || !roles.includes(query.role)) {
        throw new AppError('Invalid user role', 400);
      }
      filter.role = query.role;
    }

    if (query.isActive !== undefined) {
      if (typeof query.isActive !== 'string' || !['true', 'false'].includes(query.isActive)) {
        throw new AppError('isActive must be true or false', 400);
      }
      filter.isActive = query.isActive === 'true';
    }

    const [users, total] = await Promise.all([
      User.find(filter).select('-passwordHash -passwordResetToken -refreshTokens')
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUserStatus(req, res, next) {
  try {
    const { isActive } = req.validatedData ?? req.body;
    if (req.params.id === req.user.id && !isActive) {
      throw new AppError('You cannot deactivate your own account', 400);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true, runValidators: true }
    );
    if (!user) throw new AppError('User not found', 404);
    await writeAuditLog(req, {
      action: 'admin.update_user_status',
      resourceType: 'User',
      resourceId: user._id,
      metadata: { isActive },
    });

    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
}

export async function getProviders(req, res, next) {
  try {
    const query = req.validatedQuery ?? req.query;
    const { page, limit, skip } = getPagination(query);
    const filter = {};

    if (query.type !== undefined) {
      const types = ['hospital', 'clinic', 'laboratory', 'pharmacy'];
      if (typeof query.type !== 'string' || !types.includes(query.type)) {
        throw new AppError('Invalid provider type', 400);
      }
      filter.type = query.type;
    }
    if (query.verificationStatus !== undefined) {
      const statuses = ['pending', 'verified', 'rejected'];
      if (typeof query.verificationStatus !== 'string'
          || !statuses.includes(query.verificationStatus)) {
        throw new AppError('Invalid provider verification status', 400);
      }
      filter.verificationStatus = query.verificationStatus;
    }

    const [providers, total] = await Promise.all([
      Provider.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Provider.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: { providers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyProvider(req, res, next) {
  try {
    const { status } = req.validatedData ?? req.body;

    const provider = await Provider.findById(req.params.id);
    if (!provider) throw new AppError('Provider not found', 404);
    if (provider.verificationStatus === status) {
      throw new AppError(`Provider is already ${status}`, 409);
    }

    provider.verificationStatus = status;
    provider.verifiedAt = status === 'verified' ? new Date() : undefined;
    provider.verifiedBy = status === 'verified' ? req.user.id : undefined;
    await provider.save();

    if (provider.managedBy) {
      await User.findByIdAndUpdate(provider.managedBy, {
        isVerified: status === 'verified',
      }, { runValidators: true });
    }
    await writeAuditLog(req, {
      action: 'admin.verify_provider',
      resourceType: 'Provider',
      resourceId: provider._id,
      metadata: { status },
    });

    res.status(200).json({ success: true, data: { provider } });
  } catch (error) {
    next(error);
  }
}

export async function handleImport(req, res, next) {
  try {
    throw new AppError('Bulk import is not implemented yet', 501);
  } catch (error) {
    next(error);
  }
}

export async function getImportJobs(req, res, next) {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.query.type !== undefined) {
      const types = ['test_catalog', 'medicine_catalog', 'pharmacy_inventory'];
      if (typeof req.query.type !== 'string' || !types.includes(req.query.type)) {
        throw new AppError('Invalid import type', 400);
      }
      filter.type = req.query.type;
    }

    const [jobs, total] = await Promise.all([
      ImportJob.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ImportJob.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: { jobs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
}

export async function getAuditLogs(req, res, next) {
  try {
    const query = req.validatedQuery ?? req.query;
    const { page, limit, skip } = getPagination(query);
    const filter = {};
    if (query.action !== undefined) {
      if (typeof query.action !== 'string') throw new AppError('Invalid audit action', 400);
      filter.action = query.action;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('actorId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: { logs, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    next(error);
  }
}
