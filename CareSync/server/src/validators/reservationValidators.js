import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export const createReservationSchema = z.object({
  inventoryId: objectIdSchema,
  quantity: z.number().int().min(1).max(1000),
  patientNotes: z.string().trim().max(300).optional(),
});

export const reservationListSchema = z.object({
  pharmacyId: objectIdSchema.optional(),
  status: z.enum(['pending', 'confirmed', 'rejected', 'cancelled', 'expired', 'fulfilled']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const respondReservationSchema = z.object({
  status: z.enum(['confirmed', 'rejected', 'fulfilled']),
  rejectionReason: z.string().trim().max(300).optional(),
});

export const cancelReservationSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});
