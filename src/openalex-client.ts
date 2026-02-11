import axios, { AxiosInstance, AxiosError } from 'axios';
import { CONFIG } from './config.js';

export interface OpenAlexConfig {
  email?: string;
  apiKey?: string;
  baseUrl?: string;
  enableCache?: boolean;
}

export interface FilterOptions {
  [key: string]: string | number | boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class SimpleCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number, ttl: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, { data: value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export interface SearchOptions {
  search?: string;
  filter?: FilterOptions;
  sort?: string;
  page?: number;
  perPage?: number;
  select?: string[];
  groupBy?: string;
  sample?: number;
}

export interface FindSimilarWorksOptions {
  query: string;
  count?: number;
  filter?: FilterOptions;
}

export interface OpenAlexResponse<T> {
  meta: {
    count: number;
    db_response_time_ms: number;
    page: number;
    per_page: number;
  };
  results: T[];
  group_by?: any[];
}

export class OpenAlexClient {
  private client: AxiosInstance;
  private email?: string;
  private apiKey?: string;
  private cache: SimpleCache<any>;
  private enableCache: boolean;

  constructor(config: OpenAlexConfig = {}) {
    this.email = config.email || process.env.OPENALEX_EMAIL;
    this.apiKey = config.apiKey || process.env.OPENALEX_API_KEY;
    this.enableCache = config.enableCache ?? true;

    const baseUrl = config.baseUrl || CONFIG.API.BASE_URL;

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: CONFIG.API.TIMEOUT,
      headers: {
        'User-Agent': this.email
          ? `OpenAlexMCP/1.0 (mailto:${this.email})`
          : 'OpenAlexMCP/1.0',
      },
    });

    this.cache = new SimpleCache<any>(CONFIG.CACHE.MAX_SIZE, CONFIG.CACHE.TTL_MS);

    // Add response interceptor for error handling and retry
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded. Please wait before making more requests.');
        }
        throw error;
      }
    );
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < CONFIG.API.RETRY.MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < CONFIG.API.RETRY.MAX_RETRIES - 1) {
          const delay = Math.min(
            CONFIG.API.RETRY.INITIAL_DELAY_MS * Math.pow(CONFIG.API.RETRY.BACKOFF_FACTOR, attempt),
            CONFIG.API.RETRY.MAX_DELAY_MS
          );
          console.error(`${context}: Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`${context}: Failed after ${CONFIG.API.RETRY.MAX_RETRIES} attempts. Last error: ${lastError?.message}`);
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Build query parameters from search options
   */
  private buildQueryParams(options: SearchOptions = {}): Record<string, string> {
    const params: Record<string, string> = {};

    if (this.email && !this.apiKey) {
      params.mailto = this.email;
    }
    if (this.apiKey) {
      params.api_key = this.apiKey;
    }

    if (options.search) {
      params.search = options.search;
    }

    if (options.filter) {
      const filters: string[] = [];
      for (const [key, value] of Object.entries(options.filter)) {
        filters.push(`${key}:${value}`);
      }
      if (filters.length > 0) {
        params.filter = filters.join(',');
      }
    }

    if (options.sort) {
      params.sort = options.sort;
    }

    if (options.page) {
      params.page = options.page.toString();
    }

    if (options.perPage) {
      params.per_page = options.perPage.toString();
    }

    if (options.select && options.select.length > 0) {
      params.select = options.select.join(',');
    }

    if (options.groupBy) {
      params.group_by = options.groupBy;
    }

    if (options.sample) {
      params.sample = options.sample.toString();
    }

    return params;
  }

  /**
   * Get a single entity by ID
   */
  async getEntity(entityType: string, id: string): Promise<any> {
    const cacheKey = `${entityType}/${id}`;

    if (this.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const result = await this.retryWithBackoff(async () => {
      const params: Record<string, string> = {};
      if (this.email && !this.apiKey) params.mailto = this.email;
      if (this.apiKey) params.api_key = this.apiKey;

      const response = await this.client.get(`/${entityType}/${id}`, { params });
      return response.data;
    }, `getEntity(${entityType}, ${id})`);

    if (this.enableCache) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Search/list entities with filters
   */
  async searchEntities<T = any>(
    entityType: string,
    options: SearchOptions = {}
  ): Promise<OpenAlexResponse<T>> {
    const params = this.buildQueryParams(options);
    const cacheKey = `${entityType}?${JSON.stringify(params)}`;

    if (this.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const result = await this.retryWithBackoff(async () => {
      console.error('SearchEntities called:');
      console.error('  Entity type:', entityType);
      console.error('  Options:', JSON.stringify(options, null, 2));
      console.error('  Query params:', JSON.stringify(params, null, 2));
      const response = await this.client.get(`/${entityType}`, { params });
      console.error('  Response status:', response.status);
      return response.data;
    }, `searchEntities(${entityType})`);

    if (this.enableCache) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Get autocomplete suggestions
   */
  async autocomplete(entityType: string, query: string): Promise<any> {
    const cacheKey = `autocomplete/${entityType}?q=${query}`;

    if (this.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const result = await this.retryWithBackoff(async () => {
      const params: Record<string, string> = { q: query };
      if (this.email && !this.apiKey) params.mailto = this.email;
      if (this.apiKey) params.api_key = this.apiKey;

      const response = await this.client.get(`/autocomplete/${entityType}`, { params });
      return response.data;
    }, `autocomplete(${entityType}, ${query})`);

    if (this.enableCache) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Get random sample of entities
   */
  async randomSample<T = any>(
    entityType: string,
    count: number,
    filter?: FilterOptions
  ): Promise<OpenAlexResponse<T>> {
    return this.searchEntities<T>(entityType, {
      sample: count,
      filter,
    });
  }

  /**
   * Get works with pagination
   */
  async getWorks(options: SearchOptions = {}): Promise<OpenAlexResponse<any>> {
    return this.searchEntities('works', options);
  }

  /**
   * Get a single work by ID or DOI
   */
  async getWork(id: string): Promise<any> {
    return this.getEntity('works', id);
  }

  /**
   * Get authors
   */
  async getAuthors(options: SearchOptions = {}): Promise<OpenAlexResponse<any>> {
    return this.searchEntities('authors', options);
  }

  /**
   * Get a single author
   */
  async getAuthor(id: string): Promise<any> {
    return this.getEntity('authors', id);
  }

  /**
   * Get sources (journals)
   */
  async getSources(options: SearchOptions = {}): Promise<OpenAlexResponse<any>> {
    return this.searchEntities('sources', options);
  }

  /**
   * Get institutions
   */
  async getInstitutions(options: SearchOptions = {}): Promise<OpenAlexResponse<any>> {
    return this.searchEntities('institutions', options);
  }

  /**
   * Get topics
   */
  async getTopics(options: SearchOptions = {}): Promise<OpenAlexResponse<any>> {
    return this.searchEntities('topics', options);
  }

  /**
   * Get publishers
   */
  async getPublishers(options: SearchOptions = {}): Promise<OpenAlexResponse<any>> {
    return this.searchEntities('publishers', options);
  }

  /**
   * Get funders
   */
  async getFunders(options: SearchOptions = {}): Promise<OpenAlexResponse<any>> {
    return this.searchEntities('funders', options);
  }

  /**
   * Find semantically similar works using AI embeddings.
   * Uses the /find/works endpoint which requires an API key.
   */
  async findSimilarWorks(options: FindSimilarWorksOptions): Promise<any> {
    const params: Record<string, string> = {};

    if (this.email && !this.apiKey) params.mailto = this.email;
    if (this.apiKey) params.api_key = this.apiKey;

    params.query = options.query;

    if (options.count) {
      params.count = options.count.toString();
    }

    if (options.filter) {
      const filters: string[] = [];
      for (const [key, value] of Object.entries(options.filter)) {
        filters.push(`${key}:${value}`);
      }
      if (filters.length > 0) {
        params.filter = filters.join(',');
      }
    }

    const cacheKey = `find/works?${JSON.stringify(params)}`;

    if (this.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const result = await this.retryWithBackoff(async () => {
      console.error('findSimilarWorks called:');
      console.error('  Options:', JSON.stringify(options, null, 2));
      console.error('  Query params:', JSON.stringify(params, null, 2));
      const response = await this.client.get('/find/works', { params });
      console.error('  Response status:', response.status);
      return response.data;
    }, 'findSimilarWorks');

    if (this.enableCache) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }
}
