/**
 * labRoutes.js — Lab directory and test catalog endpoints.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as labController from '../controllers/labController.js';

const router = Router();

// Public
router.get('/', labController.getLabs);
router.get('/tests', labController.getTestCatalog);
router.get('/tests/:id', labController.getTestById);
router.get('/:id', labController.getLabById);

// Lab staff / admin only
router.post('/tests', authenticate, authorize('lab_staff', 'admin'), labController.createTestCatalogEntry);
router.put('/tests/:id', authenticate, authorize('lab_staff', 'admin'), labController.updateTestCatalogEntry);

export default router;
