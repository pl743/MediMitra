import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from './app.js';
import { signAccessToken } from './utils/jwt.js';

describe('GET /api/v1/health', () => {
  it('returns the service status without connecting to MongoDB', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        message: 'CareSync API is running',
        environment: 'test',
      })
    );
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('rejects requests without an access cookie', async () => {
    const response = await request(app).get('/api/v1/auth/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: 'You must be logged in to access this resource',
    });
  });
});

describe('admin route authorization', () => {
  it('requires an authenticated administrator before serving metrics', async () => {
    const anonymous = await request(app).get('/api/v1/admin/analytics');
    expect(anonymous.status).toBe(401);

    const patientToken = signAccessToken({
      id: '507f1f77bcf86cd799439011',
      role: 'patient',
      email: 'patient@example.test',
    });
    const patient = await request(app)
      .get('/api/v1/admin/analytics')
      .set('Cookie', `accessToken=${patientToken}`);
    expect(patient.status).toBe(403);
  });

  it('keeps the patient report-list endpoint restricted to patient accounts', async () => {
    const doctorToken = signAccessToken({
      id: '507f1f77bcf86cd799439012',
      role: 'doctor',
      email: 'doctor@example.test',
    });
    const response = await request(app)
      .get('/api/v1/reports/my')
      .set('Cookie', `accessToken=${doctorToken}`);
    expect(response.status).toBe(403);
  });
});

describe('cookie-authenticated state-changing requests', () => {
  const patientToken = signAccessToken({
    id: '507f1f77bcf86cd799439011',
    role: 'patient',
    email: 'patient@example.test',
  });

  it('rejects a cross-origin request before appointment processing', async () => {
    const response = await request(app)
      .post('/api/v1/appointments')
      .set('Cookie', `accessToken=${patientToken}`)
      .set('Origin', 'https://attacker.example')
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Request origin is not allowed');
  });

  it('rejects cross-origin login form submissions to prevent login CSRF', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://attacker.example')
      .type('form')
      .send({ email: 'person@example.test', password: 'not-a-real-password' });
    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Request origin is not allowed');
  });

  it('requires an origin or referer when a cookie-authenticated request changes state', async () => {
    const response = await request(app)
      .post('/api/v1/appointments')
      .set('Cookie', `accessToken=${patientToken}`)
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.message).toBe('A trusted request origin is required');
  });

  it('allows the configured frontend origin to proceed to normal request validation', async () => {
    const response = await request(app)
      .post('/api/v1/appointments')
      .set('Cookie', `accessToken=${patientToken}`)
      .set('Origin', 'http://localhost:5173')
      .send({});
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('slotId');
  });
});

describe('lab booking route access', () => {
  it('requires authentication before reading patient lab bookings', async () => {
    const response = await request(app).get('/api/v1/lab-bookings/my');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});

describe('medicine search validation', () => {
  it('rejects unsupported catalog filters before querying MongoDB', async () => {
    const response = await request(app).get('/api/v1/medicines/search?form=liquid');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('rejects malformed medicine IDs in stock search before querying MongoDB', async () => {
    const response = await request(app).get('/api/v1/inventory/search?medicineIds=not-an-id');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

describe('care journey and notification access', () => {
  it('requires authentication and patient authorization for care journey reads', async () => {
    const response = await request(app).get('/api/v1/care-journey/my');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('requires authentication for notification reads', async () => {
    const response = await request(app).get('/api/v1/notifications');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it('authenticates before parsing notification query parameters', async () => {
    const response = await request(app).get('/api/v1/notifications?page=0');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});

describe('lab detail validation', () => {
  it('rejects malformed lab detail IDs without requiring a database connection', async () => {
    const response = await request(app).get('/api/v1/labs/not-an-id');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('rejects malformed test detail IDs without requiring a database connection', async () => {
    const response = await request(app).get('/api/v1/labs/tests/not-an-id');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

describe('POST /api/v1/auth/register', () => {
  it('rejects invalid registration input before accessing the database', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      firstName: 'A',
      lastName: '',
      email: 'not-an-email',
      password: 'weak',
      role: 'admin',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('firstName');
    expect(response.body.message).toContain('email');
    expect(response.body.message).toContain('role');
  });
});
