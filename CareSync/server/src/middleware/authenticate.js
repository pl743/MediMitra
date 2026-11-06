/**
 * authenticate.js — JWT authentication middleware.
 *
 * Reads the accessToken from the HTTP-only cookie and verifies it.
 * If valid, attaches the decoded user info (id, role, email) to req.user.
 * If invalid or missing, returns 401 Unauthorized.
 *
 * Routes that require authentication must use this middleware.
 * Public routes (landing page, search) do NOT use this middleware.
 */

import { verifyAccessToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';

export function authenticate(req, res, next) {
  const token = req.cookies?.accessToken;

  if (!token) {
    return next(new AppError('You must be logged in to access this resource', 401));
  }

  try {
    const decoded = verifyAccessToken(token);
    // Attach minimal user info to request — controllers can use this
    // without hitting the database on every single request
    req.user = {
      id: decoded.id,
      role: decoded.role,
      email: decoded.email,
    };
    next();
  } catch (error) {
    // Pass JWT errors to the centralized error handler
    next(error);
  }
}
