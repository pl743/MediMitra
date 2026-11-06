/**
 * AppError.js — Custom error class for predictable application errors.
 *
 * When we throw an AppError, the centralized errorHandler knows it's
 * an expected/operational error (e.g., 404 Not Found, 403 Forbidden)
 * and can return a clean JSON response to the client.
 *
 * Errors that are NOT AppError instances are treated as unexpected
 * server errors and logged with full detail but shown to client as 500.
 */

export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Marks this as a known/expected error

    // Maintains proper stack trace (V8 specific)
    Error.captureStackTrace(this, this.constructor);
  }
}
