/**
 * errorHandler.js — Centralized Express error handler.
 *
 * This is the LAST middleware in app.js (4-argument middleware = error handler).
 * All errors thrown with next(err) end up here.
 *
 * Responsibilities:
 * - AppError (operational): return the exact status code and message
 * - Mongoose validation error: return 400 with field-level detail
 * - Mongoose duplicate key: return 409
 * - JWT errors: return 401
 * - Unknown errors: log full details, return generic 500 (no stack trace to client)
 */

import { logger } from '../utils/logger.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Default to 500
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';

  // Mongoose schema validation errors (e.g., required field missing)
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const fields = Object.values(err.errors).map((e) => e.message);
    message = fields.join(', ');
  }

  // Mongoose duplicate key error (e.g., duplicate email)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A record with this ${field} already exists`;
  }

  // Invalid MongoDB ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    message = 'Invalid ID format';
  }

  // JWT errors → treat as 401 Unauthorized
  if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
  }

  if (statusCode >= 500) {
    message = 'Something went wrong';
  }

  // Log unexpected server errors with full details (but NOT to client)
  if (statusCode >= 500) {
    logger.error({ err, url: req.url, method: req.method }, 'Unexpected server error');
  }

  const response = {
    success: false,
    message,
  };

  res.status(statusCode).json(response);
}
