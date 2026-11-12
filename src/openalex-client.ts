import axios, { AxiosInstance, AxiosError } from 'axios';
import { CONFIG, debug } from './config.js';
import { ApiKeyPool, PooledKey, collectApiKeys, isBudgetExhausted } from './key-pool.js';

export interface OpenAlexConfig {
  email?: string;
  apiKey?: string;
  /** Further keys, separated by commas, semicolons or blanks (OPENALEX_API_KEYS). */
  apiKeys?: string;
  /** Text file of further keys, one per line (OPENALEX_API_KEYS_FILE). */
  apiKeysFile?: string;
  baseUrl?: string;
  enableCache?: boolean;
}

export interface FilterOptions {
  [key: string]: string | number | boolean;
}

/**
 * Extract the bare W-ID from an OpenAlex work identifier or response ID.
 */
export function extractOpenAlexWorkId(id: unknown): string {
  if (typeof id !== 'string') {
    throw new Error('OpenAlex work response did not include an id');
  }

  const trimmed = id.trim().replace(/\/+$/, '');
  const workId = trimmed.split('/').pop();
  if (!workId || !/^W\d+$/.test(workId)) {
    throw new Error(`Invalid OpenAlex work ID: ${id}`);
  }

  return workId;
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
  /** The configured API keys, used one at a time; empty for anonymous access. */
  private keys: ApiKeyPool;
  private cache: SimpleCache<any>;
  private enableCache: boolean;

  constructor(config: OpenAlexConfig = {}) {
    this.email = config.email || process.env.OPENALEX_EMAIL;
    this.keys = new ApiKeyPool(collectApiKeys({
      apiKey: config.apiKey || process.env.OPENALEX_API_KEY,
      apiKeys: config.apiKeys || process.env.OPENALEX_API_KEYS,
      apiKeysFile: config.apiKeysFile || process.env.OPENALEX_API_KEYS_FILE,
    }));
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

    // Add response interceptor for 429 rate-limit handling with bounded retry
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        // A spent daily budget does not come back in seconds: leave it to retryWithBackoff,
        // which moves on to the next API key.
        if (error.response?.status === 429 && error.config && !isBudgetExhausted(error)) {
          const config = error.config as any;
          config._429RetryCount = (config._429RetryCount || 0) + 1;
          if (config._429RetryCount > CONFIG.API.RETRY.MAX_429_RETRIES) {
            const err = new Error('Rate limit exceeded after multiple retries. Please wait before making more requests.');
            (err as any).isRateLimitExhausted = true;
            throw err;
          }
          const retryAfter = parseInt(error.response.headers['retry-after'] || '5', 10);
          const delayMs = Math.min(retryAfter * 1000, CONFIG.API.RETRY.MAX_DELAY_MS);
          debug(`429 rate limited (attempt ${config._429RetryCount}/${CONFIG.API.RETRY.MAX_429_RETRIES}) — sleeping ${delayMs}ms`);
          await this.sleep(delayMs);
          return this.client.request(config);
        }
        throw error;
      }
    );
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Number of distinct API keys configured (0 for anonymous access). */
  get apiKeyCount(): number {
    return this.keys.size;
  }

  /** The authentication parameters of one attempt: the pool's current key, else mailto. */
  private authParams(pooled: PooledKey | undefined): Record<string, string> {
    if (pooled) return { api_key: pooled.key };
    return this.email ? { mailto: this.email } : {};
  }

  /**
   * Set the attempt's key aside when its daily budget is spent or OpenAlex refused it (401), and
   * return the reason; undefined when the error has another cause or no other key is usable.
   */
  private setKeyAside(error: any, pooled: PooledKey | undefined): string | undefined {
    if (!pooled || this.keys.size < 2) return undefined;
    if (isBudgetExhausted(error)) {
      return this.keys.setAsideUntilReset(pooled.key) ? 'daily budget spent' : undefined;
    }
    if (error?.response?.status === 401) {
      return this.keys.setAsideForGood(pooled.key) ? 'key refused (HTTP 401)' : undefined;
    }
    return undefined;
  }

  /**
   * Run `fn` with the authentication parameters of the current API key, retrying transient
   * failures. A key whose budget is spent, or that OpenAlex refuses, is set aside and the request
   * goes out again at once with the next key; these switches do not count as attempts.
   */
  private async retryWithBackoff<T>(
    fn: (auth: Record<string, string>) => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;
    let switches = 0;

    for (let attempt = 0; attempt < CONFIG.API.RETRY.MAX_RETRIES; attempt++) {
      const pooled = this.keys.current();
      try {
        return await fn(this.authParams(pooled));
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));

        const reason = this.setKeyAside(error, pooled);
        if (reason && switches < this.keys.size) {
          switches++;
          attempt--;
          debug(`${context}: API key ${pooled?.position} set aside (${reason}); trying the next key`);
          continue;
        }

        // A spent budget does not come back by retrying: fail at once, saying so.
        if (isBudgetExhausted(error)) {
          throw new Error(
            this.keys.size > 1
              ? 'OpenAlex daily budget spent on every configured API key; it refills at midnight UTC.'
              : 'OpenAlex daily budget spent; it refills at midnight UTC. ' +
                'Further keys can be added with OPENALEX_API_KEYS or OPENALEX_API_KEYS_FILE.'
          );
        }

        // Don't retry rate-limit exhaustion (already retried by the 429 interceptor)
        if (error?.isRateLimitExhausted) {
          throw lastError;
        }

        // Don't retry non-retryable client errors (4xx except 429, which the interceptor handles)
        const status = error?.response?.status;
        if (status && status >= 400 && status < 500 && status !== 429) {
          throw lastError;
        }

        if (attempt < CONFIG.API.RETRY.MAX_RETRIES - 1) {
          const delay = Math.min(
            CONFIG.API.RETRY.INITIAL_DELAY_MS * Math.pow(CONFIG.API.RETRY.BACKOFF_FACTOR, attempt),
            CONFIG.API.RETRY.MAX_DELAY_MS
          );
          debug(`${context}: Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
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
    // Authentication (api_key or mailto) is added per attempt by retryWithBackoff, so that a
    // retry can use the next API key and cache keys do not depend on the key in use.
    const params: Record<string, string> = {};

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
      // "relevance_score" without a suffix causes 400 errors from OpenAlex
      // (only :desc is valid for relevance_score). Default to :desc when omitted.
      const sort = options.sort;
      params.sort = sort.includes(':') ? sort : `${sort}:desc`;
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
   * Normalize an entity ID for use in API requests.
   * - Bare DOIs (e.g. "10.1234/foo") are prefixed with "doi:" so the slash
   *   is not misinterpreted as a path separator.
   * - Full URLs (e.g. "https://doi.org/...") are percent-encoded so axios
   *   does not treat them as absolute URLs.
   * - OpenAlex IDs (e.g. "W2741809807") and prefixed IDs (e.g. "doi:...")
   *   are returned as-is.
   */
  private normalizeId(id: string): string {
    // Bare DOI: starts with "10." and contains a slash
    if (/^10\.\d{4,9}\//.test(id)) {
      return `doi:${id}`;
    }
    // Full URL: encode so axios keeps it as a path segment, not an absolute URL
    if (/^https?:\/\//i.test(id)) {
      return encodeURIComponent(id);
    }
    return id;
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

    const normalizedId = this.normalizeId(id);
    const result = await this.retryWithBackoff(async (auth) => {
      const params: Record<string, string> = { ...auth };

      const response = await this.client.get(`/${entityType}/${normalizedId}`, { params });
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

    const result = await this.retryWithBackoff(async (auth) => {
      debug('searchEntities', entityType, JSON.stringify(params));
      const response = await this.client.get(`/${entityType}`, { params: { ...params, ...auth } });
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

    const result = await this.retryWithBackoff(async (auth) => {
      const params: Record<string, string> = { q: query, ...auth };

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
   * Resolve a work identifier to the bare W-ID required by citation filters.
   */
  async getWorkId(id: string): Promise<string> {
    const candidate = id.trim().replace(/\/+$/, '').split('/').pop();
    if (candidate && /^W\d+$/.test(candidate)) {
      return candidate;
    }

    const work = await this.getWork(id);
    return extractOpenAlexWorkId(work?.id);
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
}
