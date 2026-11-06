/**
 * User.js — Mongoose schema for all user accounts.
 *
 * One User document per account. Role determines which dashboard
 * and permissions they have. Profile details are in separate
 * collection (DoctorProfile, etc.) linked by userId.
 *
 * Security notes:
 * - passwordHash: never store plaintext passwords
 * - role: set by the server only, never from user input directly
 * - isActive: admin can deactivate accounts without deleting them
 * - isVerified: for provider accounts needing admin approval
 */

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Never returned in queries unless explicitly requested
    },
    role: {
      type: String,
      enum: {
        values: ['patient', 'doctor', 'lab_staff', 'pharmacist', 'admin'],
        message: 'Invalid role: {VALUE}',
      },
      required: true,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [15, 'Phone number too long'],
    },
    // Whether the account is active (admin can deactivate)
    isActive: {
      type: Boolean,
      default: true,
    },
    // For provider accounts (doctor, lab_staff, pharmacist): admin must verify
    isVerified: {
      type: Boolean,
      default: false,
    },
    // Timestamp of last successful login (useful for security review)
    lastLoginAt: {
      type: Date,
    },
    // Refresh token stored hashed — used to invalidate sessions on logout
    refreshTokenHash: {
      type: String,
      select: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Index for admin queries filtering by role
userSchema.index({ role: 1 });

// Virtual for full name — not stored in DB, computed when accessed
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Never accidentally return passwordHash in toJSON output
userSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
