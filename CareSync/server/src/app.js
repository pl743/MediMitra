/**
 * app.js — Express application configuration.
 *
 * This file sets up all middleware and mounts routes.
 * It does NOT start the HTTP server — that's in server.js.
 * This separation makes it easier to test (import app without starting a server).
 *
 * Middleware order matters in Express:
 * 1. Security headers (Helmet)
 * 2. CORS (must be before routes)
 * 3. Body parsers
 * 4. Cookie parser
 * 5. Routes
 * 6. 404 handler (after all routes)
 * 7. Error handler (must be last)
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { enforceCsrfOrigin } from './middleware/csrfOrigin.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import labRoutes from './routes/labRoutes.js';
import labBookingRoutes from './routes/labBookingRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import reservationRoutes from './routes/reservationRoutes.js';
import careJourneyRoutes from './routes/careJourneyRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import consentRoutes from './routes/consentRoutes.js';
import waitlistRoutes from './routes/waitlistRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

const app = express();

// ─── Security headers ──────────────────────────────────────────────────────────
// Helmet sets ~14 HTTP headers that protect against common attacks
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Only allow requests from our React frontend
// credentials: true is required for cookies to be sent cross-origin
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true, // Allow cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body and cookie parsing ───────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' })); // Limit request body size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser()); // Parse cookies from requests
app.use(enforceCsrfOrigin);

// ─── Health check ─────────────────────────────────────────────────────────────
// Simple endpoint for deployment health monitoring
// No auth required — used by Render/hosting to check if app is up
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CareSync API is running',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/labs', labRoutes);
app.use('/api/v1/lab-bookings', labBookingRoutes);
app.use('/api/v1/medicines', medicineRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/reservations', reservationRoutes);
app.use('/api/v1/care-journey', careJourneyRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/consents', consentRoutes);
app.use('/api/v1/waitlists', waitlistRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/reports', reportRoutes);

// ─── 404 and Error handlers ────────────────────────────────────────────────────
app.use(notFound);       // Catch all unmatched routes
app.use(errorHandler);   // Format all errors as JSON

export default app;
