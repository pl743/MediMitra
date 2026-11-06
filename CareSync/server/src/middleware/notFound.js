/**
 * notFound.js — 404 handler for unmatched routes.
 *
 * Placed AFTER all route definitions in app.js.
 * If no route matches, this throws a 404 AppError which
 * the centralized errorHandler then formats as JSON.
 */

import { AppError } from '../utils/AppError.js';

export function notFound(req, res, next) {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
}
