/**
 * authController.js — HTTP layer for authentication.
 *
 * Controllers:
 * 1. Extract data from the request
 * 2. Call the appropriate service function
 * 3. Set cookies, format, and send the response
 *
 * No business logic here — keep controllers thin.
 */

import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  refreshAccessToken,
} from '../services/authService.js';
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
} from '../utils/cookie.js';

export async function register(req, res, next) {
  try {
    const { user, accessToken, refreshToken } = await registerUser(req.validatedData);

    // Set both tokens in HTTP-only cookies
    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.validatedData;
    const { user, accessToken, refreshToken } = await loginUser(email, password);

    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    // Invalidate the refresh token in the database
    if (req.user?.id) {
      await logoutUser(req.user.id);
    }

    clearAuthCookies(res);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await getCurrentUser(req.user.id);

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const { accessToken } = await refreshAccessToken(refreshToken);

    setAccessTokenCookie(res, accessToken);

    res.status(200).json({
      success: true,
      message: 'Access token refreshed',
    });
  } catch (error) {
    next(error);
  }
}
