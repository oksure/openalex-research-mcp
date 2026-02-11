import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { OpenAlexClient } from '../src/openalex-client.js';

vi.mock('axios');

// Helper to create a proper axios mock
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

describe('OpenAlexClient', () => {
  let client: OpenAlexClient;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock that just returns empty interceptors
    vi.mocked(axios.create).mockReturnValue(createMockAxios(vi.fn()) as any);
    client = new OpenAlexClient({
      email: 'test@example.com',
      enableCache: false,
    });
  });

  describe('Constructor', () => {
    it('should initialize with config', () => {
      expect(client).toBeDefined();
    });

    it('should be able to disable cache', () => {
      const noCacheClient = new OpenAlexClient({ enableCache: false });
      expect(noCacheClient).toBeDefined();
    });
  });

  describe('getEntity', () => {
    it('should fetch a work by ID', async () => {
      const mockWork = {
        id: 'W12345',
        title: 'Test Paper',
        publication_year: 2023,
      };

      vi.mocked(axios.create).mockReturnValue(createMockAxios(
        vi.fn().mockResolvedValue({ data: mockWork })
      ) as any);

      const testClient = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
      const result = await testClient.getEntity('works', 'W12345');

      expect(result).toEqual(mockWork);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(axios.create).mockReturnValue(createMockAxios(
        vi.fn().mockRejectedValue(new Error('Network error'))
      ) as any);

      const testClient = new OpenAlexClient({ email: 'test@example.com', enableCache: false });

      await expect(testClient.getEntity('works', 'W12345')).rejects.toThrow();
    });
  });

  describe('searchEntities', () => {
    it('should search for works with filters', async () => {
      const mockResponse = {
        meta: { count: 100, page: 1, per_page: 10 },
        results: [{ id: 'W1', title: 'Test' }],
      };

      vi.mocked(axios.create).mockReturnValue(createMockAxios(
        vi.fn().mockResolvedValue({ data: mockResponse })
      ) as any);

      const testClient = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
      const result = await testClient.getWorks({ search: 'machine learning' });

      expect(result).toEqual(mockResponse);
      expect(result.meta.count).toBe(100);
      expect(result.results).toHaveLength(1);
    });

    it('should handle empty results', async () => {
      const mockResponse = {
        meta: { count: 0, page: 1, per_page: 10 },
        results: [],
      };

      vi.mocked(axios.create).mockReturnValue(createMockAxios(
        vi.fn().mockResolvedValue({ data: mockResponse })
      ) as any);

      const testClient = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
      const result = await testClient.getWorks({ search: 'nonexistent' });

      expect(result.results).toHaveLength(0);
    });
  });

  describe('autocomplete', () => {
    it('should get autocomplete suggestions', async () => {
      const mockResults = {
        results: [
          { id: 'W1', display_name: 'Machine Learning' },
          { id: 'W2', display_name: 'Deep Learning' },
        ],
      };

      vi.mocked(axios.create).mockReturnValue(createMockAxios(
        vi.fn().mockResolvedValue({ data: mockResults })
      ) as any);

      const testClient = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
      const result = await testClient.autocomplete('works', 'machine');

      expect(result.results).toHaveLength(2);
    });
  });

  describe('Caching', () => {
    it('should cache results when enabled', async () => {
      const mockWork = { id: 'W12345', title: 'Test' };
      let callCount = 0;

      vi.mocked(axios.create).mockReturnValue(createMockAxios(
        vi.fn(() => {
          callCount++;
          return Promise.resolve({ data: mockWork });
        })
      ) as any);

      const cachedClient = new OpenAlexClient({ email: 'test@example.com', enableCache: true });

      await cachedClient.getEntity('works', 'W12345');
      await cachedClient.getEntity('works', 'W12345');

      expect(callCount).toBe(1);
    });

    it('should clear cache', async () => {
      vi.mocked(axios.create).mockReturnValue(createMockAxios(
        vi.fn().mockResolvedValue({ data: { id: 'W12345', title: 'Test' } })
      ) as any);

      const cachedClient = new OpenAlexClient({ email: 'test@example.com', enableCache: true });

      await cachedClient.getEntity('works', 'W12345');
      expect(cachedClient.getCacheSize()).toBeGreaterThan(0);

      cachedClient.clearCache();
      expect(cachedClient.getCacheSize()).toBe(0);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests', async () => {
      let attempts = 0;
      const mockWork = { id: 'W12345', title: 'Test' };

      vi.mocked(axios.create).mockReturnValue(createMockAxios(
        vi.fn(() => {
          attempts++;
          if (attempts < 2) {
            return Promise.reject(new Error('Network error'));
          }
          return Promise.resolve({ data: mockWork });
        })
      ) as any);

      const testClient = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
      const result = await testClient.getEntity('works', 'W12345');

      expect(result).toEqual(mockWork);
      expect(attempts).toBe(2);
    });

    it('should fail after max retries', async () => {
      vi.mocked(axios.create).mockReturnValue(createMockAxios(
        vi.fn().mockRejectedValue(new Error('Network error'))
      ) as any);

      const testClient = new OpenAlexClient({ email: 'test@example.com', enableCache: false });

      await expect(testClient.getEntity('works', 'W12345')).rejects.toThrow();
    });
  });

  describe('findSimilarWorks', () => {
    it('should find similar works with a query', async () => {
      const mockResponse = {
        meta: {
          count: 25,
          query: 'machine learning for drug discovery',
          filters_applied: {},
          timing: { embed_ms: 145, search_ms: 89, hydrate_ms: 156, total_ms: 412 },
        },
        results: [
          {
            score: 0.8934,
            work: {
              id: 'https://openalex.org/W4385012847',
              title: 'Deep learning approaches for molecular property prediction',
              publication_year: 2023,
            },
          },
        ],
      };

      vi.mocked(axios.create).mockReturnValue(createMockAxios(
        vi.fn().mockResolvedValue({ data: mockResponse })
      ) as any);

      const testClient = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
      const result = await testClient.findSimilarWorks({ query: 'machine learning for drug discovery' });

      expect(result).toEqual(mockResponse);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].score).toBe(0.8934);
      expect(result.results[0].work.title).toBe('Deep learning approaches for molecular property prediction');
    });

    it('should pass count and filter parameters', async () => {
      const mockResponse = {
        meta: { count: 10, query: 'climate change', filters_applied: { publication_year: '>2020' }, timing: {} },
        results: [],
      };

      const mockGet = vi.fn().mockResolvedValue({ data: mockResponse });
      vi.mocked(axios.create).mockReturnValue(createMockAxios(mockGet) as any);

      const testClient = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
      await testClient.findSimilarWorks({
        query: 'climate change',
        count: 10,
        filter: { publication_year: '>2020', is_oa: true },
      });

      const callArgs = mockGet.mock.calls[0];
      expect(callArgs[0]).toBe('/find/works');
      expect(callArgs[1].params.query).toBe('climate change');
      expect(callArgs[1].params.count).toBe('10');
      expect(callArgs[1].params.filter).toBe('publication_year:>2020,is_oa:true');
    });

    it('should handle empty results', async () => {
      const mockResponse = {
        meta: { count: 0, query: 'very obscure query', filters_applied: {}, timing: {} },
        results: [],
      };

      vi.mocked(axios.create).mockReturnValue(createMockAxios(
        vi.fn().mockResolvedValue({ data: mockResponse })
      ) as any);

      const testClient = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
      const result = await testClient.findSimilarWorks({ query: 'very obscure query' });

      expect(result.results).toHaveLength(0);
    });

    it('should cache results when enabled', async () => {
      const mockResponse = {
        meta: { count: 1, query: 'test', filters_applied: {}, timing: {} },
        results: [{ score: 0.9, work: { id: 'W1', title: 'Cached' } }],
      };

      let callCount = 0;
      vi.mocked(axios.create).mockReturnValue(createMockAxios(
        vi.fn(() => {
          callCount++;
          return Promise.resolve({ data: mockResponse });
        })
      ) as any);

      const cachedClient = new OpenAlexClient({ email: 'test@example.com', enableCache: true });
      await cachedClient.findSimilarWorks({ query: 'test' });
      await cachedClient.findSimilarWorks({ query: 'test' });

      expect(callCount).toBe(1);
    });

    it('should include api_key when configured', async () => {
      const mockResponse = {
        meta: { count: 0, query: 'test', filters_applied: {}, timing: {} },
        results: [],
      };

      const mockGet = vi.fn().mockResolvedValue({ data: mockResponse });
      vi.mocked(axios.create).mockReturnValue(createMockAxios(mockGet) as any);

      const testClient = new OpenAlexClient({ email: 'test@example.com', apiKey: 'test-key', enableCache: false });
      await testClient.findSimilarWorks({ query: 'test' });

      const callArgs = mockGet.mock.calls[0];
      expect(callArgs[0]).toBe('/find/works');
      expect(callArgs[1].params.api_key).toBe('test-key');
      expect(callArgs[1].params.mailto).toBeUndefined();
    });
  });
});
