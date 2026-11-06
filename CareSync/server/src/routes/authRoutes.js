/**
 * authRoutes.js — Authentication endpoints.
 *
 * POST /api/v1/auth/register  — Create new account
 * POST /api/v1/auth/login     — Login and receive tokens
 * POST /api/v1/auth/logout    — Logout and clear cookies
 * GET  /api/v1/auth/me        — Get current user info (requires auth)
 * POST /api/v1/auth/refresh   — Get new access token using refresh token
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { registerSchema, loginSchema } from '../validators/authValidators.js';
import * as authController from '../controllers/authController.js';
import { env } from '../config/env.js';

const router = Router();

// Rate limiter — max 10 attempts per 15 minutes per IP
// Prevents brute-force login and registration spam
const authLimiter = rateLimit({
  windowMs: parseInt(env.RATE_LIMIT_AUTH_WINDOW_MINUTES) * 60 * 1000,
  max: parseInt(env.RATE_LIMIT_AUTH_MAX),
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true, // Send RateLimit-* headers
  legacyHeaders: false,
});

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.post('/refresh', authController.refresh);

export default router;
