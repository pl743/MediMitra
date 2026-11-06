/**
 * Provider.js — Hospitals, Clinics, Labs, and Pharmacies.
 *
 * A Provider is any participating healthcare facility.
 * Doctors are linked to a Provider through DoctorProfile.
 * Lab staff and pharmacists are linked through their User + Provider relationship.
 */

import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true, required: true },
    state: { type: String, trim: true, required: true },
    pincode: { type: String, trim: true },
    latitude: Number,
    longitude: Number,
  },
  { _id: false }
);

const providerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Provider name is required'],
      trim: true,
      maxlength: [100, 'Provider name cannot exceed 100 characters'],
    },
    type: {
      type: String,
      enum: ['hospital', 'clinic', 'laboratory', 'pharmacy'],
      required: true,
    },
    address: {
      type: addressSchema,
      required: true,
    },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    website: { type: String, trim: true },
    description: { type: String, maxlength: 500 },
    operatingHours: { type: String }, // e.g., "Mon-Sat 9AM-6PM"
    // The user account that manages this provider
    managedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Admin must verify before provider appears in searches
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes for directory search
providerSchema.index({ type: 1, 'address.city': 1 });
providerSchema.index({ name: 'text', 'address.city': 'text' });
providerSchema.index({ verificationStatus: 1 });

export const Provider = mongoose.model('Provider', providerSchema);
