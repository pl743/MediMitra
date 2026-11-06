import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from './errorHandler.js';

describe('errorHandler', () => {
  it('does not expose internal messages or stack traces for server errors', () => {
    const error = new Error('Sensitive database connection details');
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    errorHandler(error, { url: '/private', method: 'GET' }, response, vi.fn());

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: 'Something went wrong',
    });
  });
});
