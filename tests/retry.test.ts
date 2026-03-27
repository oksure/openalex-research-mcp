import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { OpenAlexClient } from '../src/openalex-client.js';

vi.mock('axios');

function createMockAxios(mockGet: any) {
  return {
    get: mockGet,
    interceptors: {
      response: { use: vi.fn() },
    },
  };
}

describe('Retry behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should NOT retry on 404 errors (4xx fast-fail)', async () => {
    let attempts = 0;
    const error404 = Object.assign(new Error('Not found'), {
      response: { status: 404 },
    });

    vi.mocked(axios.create).mockReturnValue(createMockAxios(
      vi.fn(() => {
        attempts++;
        return Promise.reject(error404);
      })
    ) as any);

    const client = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
    await expect(client.getEntity('works', 'W99999')).rejects.toThrow('Not found');
    // Should fail immediately without retrying
    expect(attempts).toBe(1);
  });

  it('should NOT retry on 400 errors (bad request)', async () => {
    let attempts = 0;
    const error400 = Object.assign(new Error('Bad request'), {
      response: { status: 400 },
    });

    vi.mocked(axios.create).mockReturnValue(createMockAxios(
      vi.fn(() => {
        attempts++;
        return Promise.reject(error400);
      })
    ) as any);

    const client = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
    await expect(client.getEntity('works', 'bad-id')).rejects.toThrow('Bad request');
    expect(attempts).toBe(1);
  });

  it('should retry on 5xx errors', async () => {
    let attempts = 0;
    const error500 = Object.assign(new Error('Server error'), {
      response: { status: 500 },
    });
    const mockWork = { id: 'W12345', title: 'Test' };

    vi.mocked(axios.create).mockReturnValue(createMockAxios(
      vi.fn(() => {
        attempts++;
        if (attempts < 2) return Promise.reject(error500);
        return Promise.resolve({ data: mockWork });
      })
    ) as any);

    const client = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
    const result = await client.getEntity('works', 'W12345');
    expect(result).toEqual(mockWork);
    expect(attempts).toBe(2);
  });

  it('should NOT retry rate-limit exhaustion errors', async () => {
    let attempts = 0;
    const rateLimitError = Object.assign(
      new Error('Rate limit exceeded after multiple retries.'),
      { isRateLimitExhausted: true }
    );

    vi.mocked(axios.create).mockReturnValue(createMockAxios(
      vi.fn(() => {
        attempts++;
        return Promise.reject(rateLimitError);
      })
    ) as any);

    const client = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
    await expect(client.getEntity('works', 'W12345')).rejects.toThrow('Rate limit exceeded');
    // Should bail out immediately without retrying
    expect(attempts).toBe(1);
  });
});
