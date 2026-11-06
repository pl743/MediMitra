/**
 * notificationRoutes.js — In-app notifications.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { validateQuery } from '../middleware/validate.js';
import * as notificationController from '../controllers/notificationController.js';
import { notificationListSchema } from '../validators/notificationValidators.js';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(notificationListSchema), notificationController.getNotifications);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/read-all', notificationController.markAllAsRead);

export default router;
