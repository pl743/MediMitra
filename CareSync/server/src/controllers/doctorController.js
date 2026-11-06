/**
 * doctorController.js — Doctor directory and profile management.
 * Fully implemented in Phase 4.
 */

import { DoctorProfile } from '../models/DoctorProfile.js';
import { DoctorSlot } from '../models/DoctorSlot.js';
import { Provider } from '../models/Provider.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getDoctors(req, res, next) {
  try {
    const { q, specialty, providerName, city } = req.query;
    const pageNum = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
    const profileFilter = {};

    if (specialty) profileFilter.specialty = { $regex: escapeRegex(specialty), $options: 'i' };

    if (q) {
      const nameTerms = q.trim().split(/\s+/).filter(Boolean);
      if (nameTerms.length) {
        profileFilter.userId = {
          $in: await User.find({
            role: 'doctor',
            isActive: true,
            $and: nameTerms.map((term) => ({
              $or: [
                { firstName: { $regex: escapeRegex(term), $options: 'i' } },
                { lastName: { $regex: escapeRegex(term), $options: 'i' } },
              ],
            })),
          }).distinct('_id'),
        };
      }
    }

    if (providerName || city) {
      const providerFilter = { isActive: true, verificationStatus: 'verified' };
      if (providerName) providerFilter.name = { $regex: escapeRegex(providerName), $options: 'i' };
      if (city) providerFilter['address.city'] = { $regex: escapeRegex(city), $options: 'i' };
      profileFilter.providerId = { $in: await Provider.find(providerFilter).distinct('_id') };
    } else {
      profileFilter.providerId = {
        $in: await Provider.find({ isActive: true, verificationStatus: 'verified' }).distinct('_id'),
      };
    }

    profileFilter.userId = {
      ...(profileFilter.userId || {}),
      $in: profileFilter.userId?.$in
        ? profileFilter.userId.$in
        : await User.find({ role: 'doctor', isActive: true }).distinct('_id'),
    };

    const [doctors, total] = await Promise.all([
      DoctorProfile.find(profileFilter)
        .populate('userId', 'firstName lastName email isActive isVerified')
        .populate('providerId', 'name address verificationStatus isActive')
        .sort({ specialty: 1, _id: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      DoctorProfile.countDocuments(profileFilter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        doctors,
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

export async function getDoctorById(req, res, next) {
  try {
    const profile = await DoctorProfile.findOne({ userId: req.params.id })
      .populate('userId', 'firstName lastName email phone isActive')
      .populate('providerId', 'name address phone operatingHours isActive verificationStatus');

    if (
      !profile ||
      !profile.userId?.isActive ||
      !profile.providerId?.isActive ||
      profile.providerId?.verificationStatus !== 'verified'
    ) {
      throw new AppError('Doctor not found', 404);
    }

    res.status(200).json({ success: true, data: { doctor: profile } });
  } catch (error) {
    next(error);
  }
}

export async function getDoctorSlots(req, res, next) {
  try {
    const now = new Date();
    const filter = {
      doctorId: req.params.id,
      isBooked: false,
      startTime: { $gte: now },
      endTime: { $gt: now },
    };

    if (req.query.date) {
      const dateValue = req.query.date;
      const day = new Date(`${dateValue}T00:00:00.000Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(dateValue) ||
        Number.isNaN(day.getTime()) ||
        day.toISOString().slice(0, 10) !== dateValue
      ) {
        throw new AppError('date must be a valid YYYY-MM-DD value', 400);
      }
      const nextDay = new Date(day);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      filter.startTime = {
        $gte: new Date(Math.max(day.getTime(), now.getTime())),
        $lt: nextDay,
      };
    } else {
      filter.startTime.$lt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const slots = await DoctorSlot.find(filter).sort({ startTime: 1 }).limit(50);
    res.status(200).json({ success: true, data: { slots } });
  } catch (error) {
    next(error);
  }
}

export async function createSlots(req, res, next) {
  try {
    const { slots } = req.body;
    if (!Array.isArray(slots) || slots.length === 0) {
      throw new AppError('slots must be a non-empty array', 400);
    }

    const doctorId = req.params.id;

    // Verify the requester is the doctor or admin
    if (req.user.role === 'doctor' && req.user.id !== doctorId) {
      throw new AppError('You can only create slots for yourself', 403);
    }

    const profile = await DoctorProfile.findOne({ userId: doctorId });
    if (!profile) throw new AppError('Doctor profile not found', 404);

    const slotDocs = slots.map((s) => ({
      doctorId,
      providerId: profile.providerId,
      startTime: new Date(s.startTime),
      endTime: new Date(s.endTime),
    }));

    // insertMany with ordered:false continues even if some slots are duplicates
    const created = await DoctorSlot.insertMany(slotDocs, { ordered: false }).catch((err) => {
      if (err.code === 11000) {
        // Some duplicates — return what succeeded
        return err.insertedDocs || [];
      }
      throw err;
    });

    res.status(201).json({
      success: true,
      message: `${Array.isArray(created) ? created.length : 0} slot(s) created`,
      data: { slots: created },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDoctorProfile(req, res, next) {
  try {
    const allowedFields = ['specialty', 'qualifications', 'experience', 'bio', 'consultationFee', 'languages', 'acceptingPatients'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const profile = await DoctorProfile.findOneAndUpdate(
      { userId: req.user.id },
      updates,
      { new: true, runValidators: true }
    );

    if (!profile) throw new AppError('Doctor profile not found', 404);

    res.status(200).json({ success: true, data: { profile } });
  } catch (error) {
    next(error);
  }
}
