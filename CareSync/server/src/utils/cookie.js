/**
 * cookie.js — Helper functions to set and clear authentication cookies.
 *
 * HTTP-only: Browser JS cannot read these cookies → XSS protection
 * Secure: Only sent over HTTPS in production
 * SameSite: Lax prevents CSRF for cross-site top-level navigations
 *
 * We use separate cookies for access token and refresh token so the
 * refresh endpoint can be hit without sending the (short-lived) access token.
 */

import { env } from '../config/env.js';

const isProduction = env.NODE_ENV === 'production';

// Access token cookie — expires when browser closes or after 15 min
export function setAccessTokenCookie(res, token) {
  res.cookie('accessToken', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
    maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
  });
}

// Refresh token cookie — expires in 7 days
export function setRefreshTokenCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/v1/auth', // Only sent to auth routes — minimizes exposure
  });
}

// Clear both cookies on logout
export function clearAuthCookies(res) {
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
  });
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
    path: '/api/v1/auth',
  });
}
