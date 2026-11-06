/**
 * doctorRoutes.js — Doctor directory and profile endpoints.
 * GET /api/v1/doctors          — Search/list doctors
 * GET /api/v1/doctors/:id      — Doctor profile
 * GET /api/v1/doctors/:id/slots — Available slots for a doctor
 * POST /api/v1/doctors/:id/slots — Doctor creates slots (auth: doctor/admin)
 * PUT /api/v1/doctors/profile  — Update doctor profile (auth: doctor)
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as doctorController from '../controllers/doctorController.js';

const router = Router();

// Public routes — no auth needed
router.get('/', doctorController.getDoctors);
router.get('/:id', doctorController.getDoctorById);
router.get('/:id/slots', doctorController.getDoctorSlots);

// Protected routes
router.post('/:id/slots', authenticate, authorize('doctor', 'admin'), doctorController.createSlots);
router.put('/profile', authenticate, authorize('doctor'), doctorController.updateDoctorProfile);

export default router;
