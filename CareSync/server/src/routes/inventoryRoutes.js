/**
 * inventoryRoutes.js — Pharmacy inventory management.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate, validateQuery } from '../middleware/validate.js';
import * as inventoryController from '../controllers/inventoryController.js';
import {
  confirmStockSchema,
  createInventorySchema,
  inventoryHistorySchema,
  inventoryListSchema,
  inventorySearchSchema,
  updateInventorySchema,
} from '../validators/medicineValidators.js';

const router = Router();

// Public — patients can search inventory to see medicine availability
router.get('/search', validateQuery(inventorySearchSchema), inventoryController.searchInventory);

// Pharmacist routes
router.use(authenticate);
router.get('/pharmacy', authorize('pharmacist', 'admin'), validateQuery(inventoryListSchema), inventoryController.getPharmacyInventory);
router.post('/', authorize('pharmacist', 'admin'), validate(createInventorySchema), inventoryController.addInventoryItem);
router.put('/:id', authorize('pharmacist', 'admin'), validate(updateInventorySchema), inventoryController.updateInventoryItem);
router.post('/:id/confirm', authorize('pharmacist'), validate(confirmStockSchema), inventoryController.confirmStock);
router.get('/:id/history', authorize('pharmacist', 'admin'), validateQuery(inventoryHistorySchema), inventoryController.getInventoryHistory);

export default router;
