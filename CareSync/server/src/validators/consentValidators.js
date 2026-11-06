import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export const createConsentSchema = z.object({
  recipientId: objectId,
  recordType: z.enum(['LabReport', 'Appointment']),
  recordId: objectId,
  expiresAt: z.string().datetime({ offset: true }),
});
