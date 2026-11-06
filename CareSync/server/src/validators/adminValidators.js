import { z } from 'zod';

export const adminListSchema = z.object({
  role: z.enum(['patient', 'doctor', 'lab_staff', 'pharmacist', 'admin']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  type: z.enum(['hospital', 'clinic', 'laboratory', 'pharmacy']).optional(),
  verificationStatus: z.enum(['pending', 'verified', 'rejected']).optional(),
  action: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const userStatusSchema = z.object({
  isActive: z.boolean(),
});

export const providerVerificationSchema = z.object({
  status: z.enum(['verified', 'rejected']),
});
