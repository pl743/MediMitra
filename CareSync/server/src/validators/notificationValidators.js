import { z } from 'zod';

export const notificationListSchema = z.object({
  unread: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
