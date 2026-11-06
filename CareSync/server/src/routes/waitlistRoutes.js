/**
 * waitlistRoutes.js — Smart waitlist for unavailable slots.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import * as waitlistController from '../controllers/waitlistController.js';
import { joinWaitlistSchema } from '../validators/waitlistValidators.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize('patient'), validate(joinWaitlistSchema), waitlistController.joinWaitlist);
router.get('/my', authorize('patient'), waitlistController.getMyWaitlist);
router.patch('/:id/cancel', authorize('patient'), waitlistController.cancelWaitlist);
router.patch('/:id/accept', authorize('patient'), waitlistController.acceptWaitlistOffer);

export default router;
