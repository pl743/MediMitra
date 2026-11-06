import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export const createLabBookingSchema = z
  .object({
    labId: objectIdSchema,
    testId: objectIdSchema,
    collectionType: z.enum(['lab_visit', 'home_collection']),
    scheduledAt: z.string().datetime({ offset: true }),
    collectionAddress: z.string().trim().min(5).max(500).optional(),
  })
  .superRefine((booking, context) => {
    if (new Date(booking.scheduledAt).getTime() <= Date.now()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduledAt'],
        message: 'scheduledAt must be in the future',
      });
    }

    if (booking.collectionType === 'home_collection' && !booking.collectionAddress) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['collectionAddress'],
        message: 'collectionAddress is required for home collection',
      });
    }
  });

export const cancelLabBookingSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const updateLabBookingStatusSchema = z.object({
  status: z.enum(['confirmed', 'sample_collected', 'processing', 'report_ready', 'cancelled']),
});
