import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { OpenAlexClient } from '../src/openalex-client.js';

vi.mock('axios');

function createMockAxios(mockGet: any) {
  return {
    get: mockGet,
    interceptors: {
      response: {
        use: vi.fn(),
      },
    },
  };
}

describe('Sort parameter normalization', () => {
  it('should append :desc to bare sort values like "relevance_score"', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: { meta: { count: 1, page: 1, per_page: 10 }, results: [] },
    });
    vi.mocked(axios.create).mockReturnValue(createMockAxios(mockGet) as any);

    const client = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
    await client.getWorks({ search: 'machine learning', sort: 'relevance_score' });

    const params = mockGet.mock.calls[0][1].params;
    expect(params.sort).toBe('relevance_score:desc');
  });

  it('should append :desc to bare "cited_by_count"', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: { meta: { count: 1, page: 1, per_page: 10 }, results: [] },
    });
    vi.mocked(axios.create).mockReturnValue(createMockAxios(mockGet) as any);

    const client = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
    await client.getWorks({ search: 'machine learning', sort: 'cited_by_count' });

    const params = mockGet.mock.calls[0][1].params;
    expect(params.sort).toBe('cited_by_count:desc');
  });

  it('should preserve sort values that already have a direction suffix', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: { meta: { count: 1, page: 1, per_page: 10 }, results: [] },
    });
    vi.mocked(axios.create).mockReturnValue(createMockAxios(mockGet) as any);

    const client = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
    await client.getWorks({ search: 'machine learning', sort: 'publication_year:asc' });

    const params = mockGet.mock.calls[0][1].params;
    expect(params.sort).toBe('publication_year:asc');
  });

  it('should not set sort param when sort is not provided', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: { meta: { count: 1, page: 1, per_page: 10 }, results: [] },
    });
    vi.mocked(axios.create).mockReturnValue(createMockAxios(mockGet) as any);

    const client = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
    await client.getWorks({ search: 'machine learning' });

    const params = mockGet.mock.calls[0][1].params;
    expect(params.sort).toBeUndefined();
  });
});
