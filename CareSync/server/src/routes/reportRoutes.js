/**
 * reportRoutes.js — Protected lab report upload and download.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as reportController from '../controllers/reportController.js';

const router = Router();

router.use(authenticate);

router.get('/my', authorize('patient'), reportController.getMyReports);
// Lab staff uploads a report for a booking
router.post('/upload/:bookingId', authorize('lab_staff', 'admin'), reportController.uploadReport);

// Patient (or authorized recipient) downloads their report
router.get('/:id/download', reportController.downloadReport);

export default router;
