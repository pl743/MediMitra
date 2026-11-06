/**
 * db.js — MongoDB connection using Mongoose.
 *
 * connectDB() is called once when the server starts.
 * Mongoose handles connection pooling internally.
 */

import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export async function connectDB() {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      // These options are defaults in Mongoose 8+ but good to be explicit
      serverSelectionTimeoutMS: 5000, // Fail fast if DB is unreachable
    });

    logger.info(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error({ err: error.message }, 'MongoDB connection failed');
    // Exit the process — the app cannot work without a database
    process.exit(1);
  }
}

// Graceful disconnect (called on server shutdown)
export async function disconnectDB() {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
