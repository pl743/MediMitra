/**
 * labBookingRoutes.js — Lab test booking management.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import * as labBookingController from '../controllers/labBookingController.js';
import {
  cancelLabBookingSchema,
  createLabBookingSchema,
  updateLabBookingStatusSchema,
} from '../validators/labBookingValidators.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize('patient'), validate(createLabBookingSchema), labBookingController.createLabBooking);
router.get('/my', authorize('patient'), labBookingController.getMyLabBookings);
router.get('/lab-queue', authorize('lab_staff', 'admin'), labBookingController.getLabQueue);
router.get('/:id', labBookingController.getLabBookingById);
router.patch('/:id/cancel', validate(cancelLabBookingSchema), labBookingController.cancelLabBooking);
router.patch(
  '/:id/status',
  authorize('lab_staff', 'admin'),
  validate(updateLabBookingStatusSchema),
  labBookingController.updateLabBookingStatus
);

export default router;
