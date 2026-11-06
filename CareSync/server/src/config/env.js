/**
 * env.js — Validates and exports all environment variables.
 *
 * Using Zod to validate on startup so the server fails fast with a clear
 * error message if any required variable is missing, rather than crashing
 * somewhere deep in the app with a confusing error.
 */

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  MONGODB_URI: z.string().min(10, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),

  RATE_LIMIT_AUTH_MAX: z.string().default('10'),
  RATE_LIMIT_AUTH_WINDOW_MINUTES: z.string().default('15'),

  UPLOAD_MAX_SIZE_BYTES: z.string().default('5242880'),

  // Optional — email sending is skipped if not provided
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
