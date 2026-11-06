/**
 * medicineRoutes.js — Medicine catalog search.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validateQuery } from '../middleware/validate.js';
import * as medicineController from '../controllers/medicineController.js';
import { medicineSearchSchema } from '../validators/medicineValidators.js';

const router = Router();

// Public medicine search
router.get('/search', validateQuery(medicineSearchSchema), medicineController.searchMedicines);
router.get('/:id', medicineController.getMedicineById);

// Admin only — manage catalog
router.post('/', authenticate, authorize('admin'), medicineController.createMedicine);
router.put('/:id', authenticate, authorize('admin'), medicineController.updateMedicine);

export default router;
