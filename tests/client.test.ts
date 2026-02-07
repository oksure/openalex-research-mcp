import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { OpenAlexClient } from '../src/openalex-client.js';

vi.mock('axios');

describe('OpenAlexClient', () => {
  let client: OpenAlexClient;

  beforeEach(() => {
    vi.clearAllMocks();
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

      vi.mocked(axios.create).mockReturnValue({
        get: vi.fn().mockResolvedValue({ data: mockWork }),
      } as any);

      const testClient = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
      const result = await testClient.getEntity('works', 'W12345');

      expect(result).toEqual(mockWork);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(axios.create).mockReturnValue({
        get: vi.fn().mockRejectedValue(new Error('Network error')),
      } as any);

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

      vi.mocked(axios.create).mockReturnValue({
        get: vi.fn().mockResolvedValue({ data: mockResponse }),
      } as any);

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

      vi.mocked(axios.create).mockReturnValue({
        get: vi.fn().mockResolvedValue({ data: mockResponse }),
      } as any);

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

      vi.mocked(axios.create).mockReturnValue({
        get: vi.fn().mockResolvedValue({ data: mockResults }),
      } as any);

      const testClient = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
      const result = await testClient.autocomplete('works', 'machine');

      expect(result.results).toHaveLength(2);
    });
  });

  describe('Caching', () => {
    it('should cache results when enabled', async () => {
      const mockWork = { id: 'W12345', title: 'Test' };
      let callCount = 0;

      vi.mocked(axios.create).mockReturnValue({
        get: vi.fn(() => {
          callCount++;
          return Promise.resolve({ data: mockWork });
        }),
      } as any);

      const cachedClient = new OpenAlexClient({ email: 'test@example.com', enableCache: true });

      await cachedClient.getEntity('works', 'W12345');
      await cachedClient.getEntity('works', 'W12345');

      expect(callCount).toBe(1);
    });

    it('should clear cache', async () => {
      const cachedClient = new OpenAlexClient({ email: 'test@example.com', enableCache: true });

      const mockWork = { id: 'W12345', title: 'Test' };
      vi.mocked(axios.create).mockReturnValue({
        get: vi.fn().mockResolvedValue({ data: mockWork }),
      } as any);

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

      vi.mocked(axios.create).mockReturnValue({
        get: vi.fn(() => {
          attempts++;
          if (attempts < 2) {
            return Promise.reject(new Error('Network error'));
          }
          return Promise.resolve({ data: mockWork });
        }),
      } as any);

      const testClient = new OpenAlexClient({ email: 'test@example.com', enableCache: false });
      const result = await testClient.getEntity('works', 'W12345');

      expect(result).toEqual(mockWork);
      expect(attempts).toBe(2);
    });

    it('should fail after max retries', async () => {
      vi.mocked(axios.create).mockReturnValue({
        get: vi.fn().mockRejectedValue(new Error('Network error')),
      } as any);

      const testClient = new OpenAlexClient({ email: 'test@example.com', enableCache: false });

      await expect(testClient.getEntity('works', 'W12345')).rejects.toThrow();
    });
  });
});
