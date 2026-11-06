/**
 * validate.js — Zod schema validation middleware factory.
 *
 * Usage in a route file:
 *   import { validate } from '../middleware/validate.js';
 *   import { registerSchema } from '../validators/authValidators.js';
 *
 *   router.post('/register', validate(registerSchema), authController.register);
 *
 * The middleware:
 * 1. Parses req.body against the given Zod schema
 * 2. On success: attaches the parsed (safe, typed) data to req.validatedData
 * 3. On failure: returns a 400 with all validation error messages
 */

import { AppError } from '../utils/AppError.js';

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Collect all Zod validation errors into a readable message
      const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return next(new AppError(errors.join('; '), 400));
    }

    // Replace req.body with the validated/sanitized data
    // This protects against mass assignment — only schema-defined fields pass through
    req.validatedData = result.data;
    next();
  };
}

/**
 * validateQuery — Same as validate but for req.query (search/filter params)
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const errors = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return next(new AppError(errors.join('; '), 400));
    }

    req.validatedQuery = result.data;
    next();
  };
}
