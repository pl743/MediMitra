import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/Provider.js', () => ({
  Provider: {
    find: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock('../models/TestCatalog.js', () => ({
  TestCatalog: {
    find: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

import { Provider } from '../models/Provider.js';
import { TestCatalog } from '../models/TestCatalog.js';
import { getLabById, getTestById } from './labController.js';

describe('labController details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns only an active verified laboratory profile', async () => {
    const lab = { _id: '507f1f77bcf86cd799439011', name: 'Verified Lab' };
    Provider.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(lab) });
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await getLabById({ params: { id: lab._id } }, response, vi.fn());

    expect(Provider.findOne).toHaveBeenCalledWith({
      _id: lab._id,
      type: 'laboratory',
      isActive: true,
      verificationStatus: 'verified',
    });
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('returns an active diagnostic test detail', async () => {
    const test = { _id: '507f1f77bcf86cd799439011', name: 'Blood panel' };
    TestCatalog.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(test) });
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await getTestById({ params: { id: test._id } }, response, vi.fn());

    expect(TestCatalog.findOne).toHaveBeenCalledWith({ _id: test._id, isActive: true });
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it('rejects malformed detail IDs without querying the database', async () => {
    const next = vi.fn();

    await getLabById({ params: { id: 'not-an-id' } }, {}, next);

    expect(Provider.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });
});
