/**
 * DoctorProfile.js — Extended information for doctor users.
 *
 * Every user with role 'doctor' should have one DoctorProfile.
 * Linked to both User (userId) and Provider (providerId — their clinic/hospital).
 */

import mongoose from 'mongoose';

const doctorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true, // One profile per doctor
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    specialty: {
      type: String,
      required: [true, 'Specialty is required'],
      trim: true,
    },
    qualifications: [{ type: String, trim: true }], // ["MBBS", "MD (Cardiology)"]
    experience: { type: Number, min: 0 }, // Years of experience
    bio: { type: String, maxlength: 1000 },
    consultationFee: { type: Number, min: 0 },
    languages: [{ type: String, trim: true }],
    // Whether this doctor accepts new patients through the platform
    acceptingPatients: { type: Boolean, default: true },
    profileImage: { type: String }, // URL to profile image
  },
  { timestamps: true }
);

// For searching doctors by specialty
doctorProfileSchema.index({ specialty: 1 });
doctorProfileSchema.index({ providerId: 1 });

export const DoctorProfile = mongoose.model('DoctorProfile', doctorProfileSchema);
