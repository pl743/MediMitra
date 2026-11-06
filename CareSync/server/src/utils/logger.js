/**
 * logger.js — Pino logger with sensitive-data redaction.
 *
 * In production, logs are JSON (machine-readable for log aggregators).
 * In development, logs are pretty-printed (human-readable in terminal).
 *
 * Redacted paths ensure that even if someone accidentally logs a user
 * object, passwords, tokens, and cookies are never stored in logs.
 */

import pino from 'pino';
import { env } from '../config/env.js';

const redact = {
  paths: [
    'password',
    'passwordHash',
    'token',
    'accessToken',
    'refreshToken',
    'authorization',
    'cookie',
    'req.headers.cookie',
    'req.headers.authorization',
    '*.password',
    '*.passwordHash',
    '*.token',
  ],
  censor: '[REDACTED]',
};

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact,
  transport:
    env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});
