/**
 * consentRoutes.js — Health record sharing consents.
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import * as consentController from '../controllers/consentController.js';
import { createConsentSchema } from '../validators/consentValidators.js';

const router = Router();

router.use(authenticate);

router.post('/', authorize('patient'), validate(createConsentSchema), consentController.createConsent);
router.get('/my', authorize('patient'), consentController.getMyConsents);
router.patch('/:id/revoke', authorize('patient'), consentController.revokeConsent);

export default router;
