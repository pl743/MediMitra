/**
 * authorize.js — Role-based access control middleware.
 *
 * Used AFTER authenticate middleware. Checks that the logged-in user
 * has one of the allowed roles for the route.
 *
 * Usage in a route file:
 *   router.get('/admin/data', authenticate, authorize('admin'), controller)
 *   router.post('/slots', authenticate, authorize('doctor', 'admin'), controller)
 *
 * Security note: Role is read from the JWT payload (set at login).
 * Users cannot change their own role by editing local storage or requests.
 * The role in the JWT is signed by the server — tampering is detected by signature verification.
 */

import { AppError } from '../utils/AppError.js';

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      // This should not happen if authenticate middleware ran first
      return next(new AppError('Not authenticated', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`,
          403
        )
      );
    }

    next();
  };
}
