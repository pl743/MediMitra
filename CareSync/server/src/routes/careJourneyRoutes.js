/**
 * careJourneyRoutes.js — Smart Care Journey endpoints.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import * as careJourneyController from '../controllers/careJourneyController.js';

const router = Router();

router.use(authenticate);

router.get('/my', authorize('patient'), careJourneyController.getMyJourney);
router.get('/:id', authorize('patient'), careJourneyController.getJourneyById);

export default router;
