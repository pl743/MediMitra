import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const stateChangingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const trustedOrigin = new URL(env.CLIENT_ORIGIN).origin;

export function enforceCsrfOrigin(req, res, next) {
  if (!stateChangingMethods.has(req.method)) return next();

  const requestOrigin = req.get('origin') || req.get('referer');
  if (!requestOrigin) {
    if (req.cookies?.accessToken) {
      return next(new AppError('A trusted request origin is required', 403));
    }
    return next();
  }

  let origin;
  try {
    origin = new URL(requestOrigin).origin;
  } catch {
    return next(new AppError('Invalid request origin', 403));
  }

  if (origin !== trustedOrigin) {
    return next(new AppError('Request origin is not allowed', 403));
  }
  return next();
}
