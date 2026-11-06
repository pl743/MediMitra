/**
 * reservationRoutes.js — Medicine reservation requests.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate, validateQuery } from '../middleware/validate.js';
import * as reservationController from '../controllers/reservationController.js';
import {
  cancelReservationSchema,
  createReservationSchema,
  reservationListSchema,
  respondReservationSchema,
} from '../validators/reservationValidators.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize('patient'), validate(createReservationSchema), reservationController.createReservation);
router.get('/my', authorize('patient'), validateQuery(reservationListSchema), reservationController.getMyReservations);
router.get('/pharmacy', authorize('pharmacist', 'admin'), validateQuery(reservationListSchema), reservationController.getPharmacyReservations);
router.get('/:id', reservationController.getReservationById);
router.patch('/:id/cancel', authorize('patient'), validate(cancelReservationSchema), reservationController.cancelReservation);
router.patch('/:id/respond', authorize('pharmacist'), validate(respondReservationSchema), reservationController.respondToReservation);

export default router;
