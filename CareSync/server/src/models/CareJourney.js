/**
 * CareJourney.js — Patient-specific timeline of healthcare events.
 *
 * One CareJourney document per patient.
 * Events array records each significant step with a link to the source record.
 *
 * Events are added by services when state transitions occur —
 * never directly from user input.
 */

import mongoose from 'mongoose';

const journeyEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'appointment_booked',
        'appointment_confirmed',
        'appointment_cancelled',
        'appointment_no_show',
        'consultation_completed',
        'lab_test_recommended',
        'lab_booking_created',
        'lab_booking_confirmed',
        'lab_booking_cancelled',
        'sample_collected',
        'lab_processing',
        'report_ready',
        'medicine_reserved',
        'reservation_confirmed',
        'follow_up_pending',
        'follow_up_completed',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['completed', 'pending', 'cancelled', 'failed'],
      default: 'completed',
    },
    title: { type: String, required: true },
    description: { type: String },
    // Link to the actual source record
    refModel: {
      type: String,
      enum: ['Appointment', 'LabBooking', 'Reservation', 'LabReport'],
    },
    refId: { type: mongoose.Schema.Types.ObjectId },
    dedupeKey: { type: String },
    transitionId: { type: String },
    // For recovery engine: suggested next action
    nextAction: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const careJourneySchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    events: [journeyEventSchema],
  },
  { timestamps: true }
);

export const CareJourney = mongoose.model('CareJourney', careJourneySchema);
