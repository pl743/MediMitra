/**
 * server.js — HTTP server entry point.
 *
 * Responsibilities:
 * 1. Connect to MongoDB
 * 2. Start the Express HTTP server
 * 3. Handle graceful shutdown (SIGTERM, SIGINT)
 *
 * Keeping this separate from app.js means we can import app.js
 * in tests without accidentally starting the server.
 */

import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './utils/logger.js';
import app from './app.js';
import { startReservationExpiryJob } from './services/reservationExpiryService.js';
import { startWaitlistExpiryJob } from './services/waitlistService.js';

const PORT = parseInt(env.PORT, 10);
let reservationExpiryTimer;
let waitlistExpiryTimer;

async function startServer() {
  // Connect to MongoDB first — app can't work without a database
  await connectDB();
  reservationExpiryTimer = startReservationExpiryJob();
  waitlistExpiryTimer = startWaitlistExpiryJob();

  const server = app.listen(PORT, () => {
    logger.info(`CareSync server running on port ${PORT} in ${env.NODE_ENV} mode`);
    logger.info(`Health check: http://localhost:${PORT}/api/v1/health`);
  });

  // ─── Graceful shutdown ───────────────────────────────────────────────────────
  // When the hosting platform (Render) sends SIGTERM to stop the process,
  // we finish handling current requests before disconnecting the database.

  async function gracefulShutdown(signal) {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    if (reservationExpiryTimer) clearInterval(reservationExpiryTimer);
    if (waitlistExpiryTimer) clearInterval(waitlistExpiryTimer);

    server.close(async () => {
      logger.info('HTTP server closed');
      await disconnectDB();
      logger.info('Graceful shutdown complete');
      process.exit(0);
    });

    // If shutdown takes more than 10 seconds, force exit
    setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle unhandled promise rejections (programming errors)
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled Promise Rejection — shutting down');
    gracefulShutdown('UnhandledRejection');
  });
}

startServer();
