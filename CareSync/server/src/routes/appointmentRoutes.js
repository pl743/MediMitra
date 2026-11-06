/**
 * appointmentRoutes.js — Appointment booking and management.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import * as appointmentController from '../controllers/appointmentController.js';
import {
  cancelAppointmentSchema,
  createAppointmentSchema,
  rescheduleSchema,
  updateAppointmentStatusSchema,
} from '../validators/appointmentValidators.js';

const router = Router();

// All appointment routes require authentication
router.use(authenticate);

router.post('/', authorize('patient'), validate(createAppointmentSchema), appointmentController.bookAppointment);
router.get('/my', authorize('patient'), appointmentController.getMyAppointments);
router.get('/doctor-schedule', authorize('doctor'), appointmentController.getDoctorSchedule);
router.get('/:id', appointmentController.getAppointmentById);
router.patch('/:id/cancel', validate(cancelAppointmentSchema), appointmentController.cancelAppointment);
router.patch('/:id/reschedule', authorize('patient'), validate(rescheduleSchema), appointmentController.rescheduleAppointment);
router.patch(
  '/:id/status',
  authorize('doctor', 'admin'),
  validate(updateAppointmentStatusSchema),
  appointmentController.updateAppointmentStatus
);

export default router;
