import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/Medicine.js', () => ({
  Medicine: {
    find: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

import { Medicine } from '../models/Medicine.js';
import { searchMedicines } from './medicineController.js';

describe('medicineController.searchMedicines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('searches brand, generic name, strength, form, and category fields', async () => {
    const query = {
      sort: vi.fn(),
      skip: vi.fn(),
      limit: vi.fn(),
      lean: vi.fn().mockResolvedValue([]),
    };
    query.sort.mockReturnValue(query);
    query.skip.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    Medicine.find.mockReturnValue(query);
    Medicine.countDocuments.mockResolvedValue(0);
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await searchMedicines({
      validatedQuery: {
        q: 'sample',
        category: 'analgesic',
        strength: '500mg',
        form: 'tablet',
        page: 1,
        limit: 20,
      },
    }, response, vi.fn());

    const filter = Medicine.find.mock.calls[0][0];
    expect(filter.isActive).toBe(true);
    expect(filter.$or).toEqual(expect.arrayContaining([
      { brandName: { $regex: 'sample', $options: 'i' } },
      { genericName: { $regex: 'sample', $options: 'i' } },
    ]));
    expect(filter.strength).toEqual({ $regex: '500mg', $options: 'i' });
    expect(filter.form).toBe('tablet');
    expect(filter.category).toEqual({ $regex: 'analgesic', $options: 'i' });
    expect(response.status).toHaveBeenCalledWith(200);
  });
});
