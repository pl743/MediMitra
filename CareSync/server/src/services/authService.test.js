import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/User.js', () => ({
  User: {
    findOne: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
  },
}));

import { User } from '../models/User.js';
import { refreshAccessToken, registerUser } from './authService.js';

describe('registerUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists the hashed refresh token after creating the account', async () => {
    const user = {
      _id: '507f1f77bcf86cd799439011',
      isActive: true,
      save: vi.fn().mockResolvedValue(undefined),
    };
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue(user);

    const result = await registerUser({
      firstName: 'Care',
      lastName: 'User',
      email: 'care@example.com',
      password: 'StrongPass123',
      role: 'patient',
    });

    expect(user.refreshTokenHash).toMatch(/^[a-f\d]{64}$/);
    expect(user.save).toHaveBeenCalledOnce();
    expect(result.refreshToken).toBeDefined();
    expect(result.accessToken).toBeDefined();

    User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });
    await expect(refreshAccessToken(result.refreshToken)).resolves.toHaveProperty('accessToken');
  });
});
