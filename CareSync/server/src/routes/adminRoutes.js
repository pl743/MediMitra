/**
 * adminRoutes.js — Administrator dashboard and management.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate, validateQuery } from '../middleware/validate.js';
import * as adminController from '../controllers/adminController.js';
import {
  adminListSchema,
  providerVerificationSchema,
  userStatusSchema,
} from '../validators/adminValidators.js';

const router = Router();

// All admin routes require authentication AND admin role
router.use(authenticate, authorize('admin'));

router.get('/analytics', adminController.getAnalytics);
router.get('/users', validateQuery(adminListSchema), adminController.getUsers);
router.patch('/users/:id/status', validate(userStatusSchema), adminController.updateUserStatus);
router.get('/providers', validateQuery(adminListSchema), adminController.getProviders);
router.patch('/providers/:id/verification', validate(providerVerificationSchema), adminController.verifyProvider);
router.post('/imports', adminController.handleImport);
router.get('/imports', adminController.getImportJobs);
router.get('/audit-logs', validateQuery(adminListSchema), adminController.getAuditLogs);

export default router;
