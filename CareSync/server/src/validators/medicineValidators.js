import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export const medicineSearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  strength: z.string().trim().max(40).optional(),
  form: z.enum(['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'other']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const inventorySearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  medicineIds: z.string().max(2500).optional().refine(
    (value) => !value || (value.split(',').length <= 100 && value.split(',').every((id) => objectIdSchema.safeParse(id).success)),
    'medicineIds must be a comma-separated list of up to 100 valid IDs'
  ),
  pharmacyId: objectIdSchema.optional(),
  inStock: z.enum(['true', 'false']).optional(),
  sort: z.enum(['price_asc', 'price_desc', 'recent']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const inventoryListSchema = z.object({
  pharmacyId: objectIdSchema.optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createInventorySchema = z.object({
  pharmacyId: objectIdSchema.optional(),
  medicineId: objectIdSchema,
  quantity: z.number().int().min(0),
  price: z.number().min(0),
  lowStockThreshold: z.number().int().min(0).optional(),
  notes: z.string().trim().max(200).optional(),
});

export const updateInventorySchema = z.object({
  pharmacyId: objectIdSchema.optional(),
  quantity: z.number().int().min(0).optional(),
  price: z.number().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  isAvailable: z.boolean().optional(),
  notes: z.string().trim().max(200).optional(),
}).refine(
  (value) => ['quantity', 'price', 'lowStockThreshold', 'isAvailable'].some((key) => value[key] !== undefined),
  'At least one inventory field must be provided'
);

export const confirmStockSchema = z.object({
  quantity: z.number().int().min(0),
  notes: z.string().trim().max(200).optional(),
});

export const inventoryHistorySchema = z.object({
  pharmacyId: objectIdSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
