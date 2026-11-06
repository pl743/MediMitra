/**
 * jwt.js — JWT signing and verification helpers.
 *
 * We use TWO tokens:
 * 1. Access token  — short-lived (15 min), used to authenticate requests
 * 2. Refresh token — long-lived (7 days), used ONLY to get new access tokens
 *
 * Both are stored in HTTP-only cookies, so JavaScript in the browser
 * cannot read them (protection against XSS token theft).
 */

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Signs an access token containing the user's id and role.
 * Role is included so middleware can authorize without a DB lookup on every request.
 */
export function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

/**
 * Signs a refresh token containing only the user's id.
 * Minimal payload — refresh tokens are used for token rotation, not authorization.
 */
export function signRefreshToken(payload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

/**
 * Verifies an access token and returns the decoded payload.
 * Throws a JsonWebTokenError or TokenExpiredError on failure.
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

/**
 * Verifies a refresh token and returns the decoded payload.
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}
