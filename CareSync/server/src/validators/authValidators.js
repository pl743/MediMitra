/**
 * authValidators.js — Zod schemas for authentication request bodies.
 *
 * These are used with the validate() middleware in auth routes.
 * Only the fields defined here will be passed to controllers —
 * mass assignment protection is built-in.
 */

import { z } from 'zod';

export const registerSchema = z.object({
  firstName: z
    .string({ required_error: 'First name is required' })
    .trim()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name cannot exceed 50 characters'),

  lastName: z
    .string({ required_error: 'Last name is required' })
    .trim()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name cannot exceed 50 characters'),

  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address'),

  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password cannot exceed 72 characters') // bcrypt limit
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),

  phone: z.string().trim().max(15).optional(),

  // Patients can self-register. Provider accounts require admin verification.
  // Admin accounts are created ONLY through the seed/admin creation script —
  // registering as admin via API is intentionally blocked.
  role: z
    .enum(['patient', 'doctor', 'lab_staff', 'pharmacist'], {
      errorMap: () => ({ message: 'Role must be one of: patient, doctor, lab_staff, pharmacist' }),
    })
    .default('patient'),
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address'),

  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(50).optional(),
  lastName: z.string().trim().min(2).max(50).optional(),
  phone: z.string().trim().max(15).optional(),
});
