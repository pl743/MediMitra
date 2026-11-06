import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export const joinWaitlistSchema = z.object({
  doctorId: objectId,
  preferredDateStart: z.string().datetime({ offset: true }),
  preferredDateEnd: z.string().datetime({ offset: true }),
  notes: z.string().trim().max(300).optional(),
});
