import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/Appointment.js', () => ({ Appointment: {} }));
vi.mock('../models/AuditLog.js', () => ({ AuditLog: {} }));
vi.mock('../models/ImportJob.js', () => ({ ImportJob: {} }));
vi.mock('../models/LabBooking.js', () => ({ LabBooking: {} }));
vi.mock('../models/Provider.js', () => ({ Provider: { findById: vi.fn() } }));
vi.mock('../models/Reservation.js', () => ({ Reservation: {} }));
vi.mock('../models/User.js', () => ({ User: { findByIdAndUpdate: vi.fn() } }));
vi.mock('../utils/audit.js', () => ({ writeAuditLog: vi.fn() }));

import { Provider } from '../models/Provider.js';
import { User } from '../models/User.js';
import { writeAuditLog } from '../utils/audit.js';
import { updateUserStatus, verifyProvider } from './adminController.js';

describe('adminController', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses an administrator request to deactivate their own account', async () => {
    const next = vi.fn();
    await updateUserStatus(
      { params: { id: 'admin-id' }, validatedData: { isActive: false }, user: { id: 'admin-id' } },
      {},
      next
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('updates and audits a supported user account status without changing its role', async () => {
    const user = { _id: 'user-id', role: 'patient', isActive: false };
    User.findByIdAndUpdate.mockResolvedValue(user);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await updateUserStatus(
      { params: { id: 'user-id' }, validatedData: { isActive: false }, user: { id: 'admin-id' } },
      res,
      vi.fn()
    );
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'user-id',
      { isActive: false },
      { new: true, runValidators: true }
    );
    expect(writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'admin.update_user_status',
      metadata: { isActive: false },
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('updates provider verification and the linked account, then audits the action', async () => {
    const provider = {
      _id: 'provider-id',
      managedBy: 'provider-user-id',
      verificationStatus: 'pending',
      save: vi.fn().mockResolvedValue(undefined),
    };
    Provider.findById.mockResolvedValue(provider);
    User.findByIdAndUpdate.mockResolvedValue({ _id: 'provider-user-id' });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await verifyProvider(
      { params: { id: 'provider-id' }, validatedData: { status: 'verified' }, user: { id: 'admin-id' } },
      res,
      vi.fn()
    );
    expect(provider.verificationStatus).toBe('verified');
    expect(provider.verifiedBy).toBe('admin-id');
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'provider-user-id',
      { isVerified: true },
      { runValidators: true }
    );
    expect(writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'admin.verify_provider',
      metadata: { status: 'verified' },
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
