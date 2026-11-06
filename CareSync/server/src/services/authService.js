/**
 * authService.js — Business logic for authentication.
 *
 * Controllers call service functions — they don't touch models directly.
 * Services handle the "how" of business rules.
 *
 * This keeps controllers thin and business logic testable in isolation.
 */

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';

const BCRYPT_ROUNDS = 12; // Adjust higher = more secure, slower. 12 is industry standard.

/**
 * Register a new user account.
 * Returns the created user (without passwordHash) and both tokens.
 */
export async function registerUser(userData) {
  const { firstName, lastName, email, password, phone, role } = userData;

  // Check if email already exists — gives a clear error rather than generic DB error
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('An account with this email already exists', 409);
  }

  // Hash the password — NEVER store plaintext
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Create user — note we pass role from validated data (not raw req.body)
  // The validator already rejects 'admin' as a registerable role
  const user = await User.create({
    firstName,
    lastName,
    email,
    passwordHash,
    phone,
    role,
    // Provider accounts start as unverified — admin must approve
    isVerified: role === 'patient',
  });

  const tokens = generateAndStoreTokens(user);
  await user.save();

  return { user, ...tokens };
}

/**
 * Login with email + password.
 * Uses generic error messages to prevent email enumeration attacks.
 */
export async function loginUser(email, password) {
  // We explicitly select passwordHash since it's select: false in the schema
  const user = await User.findOne({ email }).select('+passwordHash');

  // Generic message — don't reveal whether the email exists
  const authError = new AppError('Invalid email or password', 401);

  if (!user) throw authError;

  // Check account is active before verifying password
  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Please contact support.', 403);
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) throw authError;

  // Update last login timestamp
  user.lastLoginAt = new Date();

  const tokens = generateAndStoreTokens(user);
  await user.save();

  return { user, ...tokens };
}

/**
 * Issue new access token using a valid refresh token.
 * This allows users to stay logged in without re-entering their password.
 */
export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw new AppError('Refresh token not provided', 401);
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  // Look up user and verify the stored token hash matches
  const user = await User.findById(decoded.id).select('+refreshTokenHash');
  if (!user || !user.isActive) {
    throw new AppError('User not found or deactivated', 401);
  }

  // Verify the stored hash matches the provided refresh token
  // This allows us to invalidate all refresh tokens on logout by clearing the hash
  const tokenHash = hashToken(refreshToken);
  if (user.refreshTokenHash !== tokenHash) {
    throw new AppError('Refresh token has been invalidated', 401);
  }

  const accessToken = signAccessToken({ id: user._id, role: user.role, email: user.email });
  return { accessToken };
}

/**
 * Invalidate the user's refresh token (logout).
 */
export async function logoutUser(userId) {
  await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
}

/**
 * Get current user by ID (for the /auth/me endpoint).
 */
export async function getCurrentUser(userId) {
  const user = await User.findById(userId);
  if (!user || !user.isActive) {
    throw new AppError('User not found', 404);
  }
  return user;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateAndStoreTokens(user) {
  const payload = { id: user._id, role: user.role, email: user.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken({ id: user._id });

  // Store a hash of the refresh token (not the token itself)
  // This way if the DB is compromised, raw tokens aren't exposed
  user.refreshTokenHash = hashToken(refreshToken);

  return { accessToken, refreshToken };
}
