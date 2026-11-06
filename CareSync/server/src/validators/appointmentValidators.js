/**
 * appointmentValidators.js — Zod schemas for appointment requests.
 */

import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export const createAppointmentSchema = z.object({
  slotId: objectIdSchema,
  reasonForVisit: z.string().trim().max(500).optional(),
});

export const rescheduleSchema = z.object({
  newSlotId: objectIdSchema,
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(['confirmed', 'completed', 'no_show']),
});
