import axios, { AxiosInstance, AxiosError } from 'axios';
import { CONFIG, debug } from './config.js';

export interface OpenAlexConfig {
  email?: string;
  apiKey?: string;
  baseUrl?: string;
  enableCache?: boolean;
}

export interface FilterOptions {
  [key: string]: string | number | boolean;
}

/**
 * Filter key for a venue given by name ("Research Policy", "NeurIPS"; several names joined with
 * "|"). OpenAlex has no free-text filter on a work's source name: requesting
 * `primary_location.source.display_name.search` answers HTTP 400. So this key never reaches
 * the API: before a works request the client resolves each name to OpenAlex source IDs (exact
 * name, abbreviation or alternate title first; otherwise sources whose name contains it; otherwise
 * the top match) and filters on `primary_location.source.id` instead.
 */
export const VENUE_NAME_FILTER = 'primary_location.source.display_name.search';

const SOURCE_ID_FILTER = 'primary_location.source.id';
const MAX_SOURCES_PER_NAME = 10;

/** The source IDs that a venue name stands for, from a /sources search result page. */
export function matchSourceIds(name: string, sources: any[]): string[] {
  const wanted = name.trim().toLowerCase();
  const titles = (s: any): string[] =>
    [s?.display_name, s?.abbreviated_title, ...(Array.isArray(s?.alternate_titles) ? s.alternate_titles : [])]
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().toLowerCase());
  const shortId = (s: any): string => String(s.id).split('/').pop() as string;
  const valid = sources.filter((s) => typeof s?.id === 'string');

  const exact = valid.filter((s) => titles(s).includes(wanted));
  if (exact.length > 0) return exact.map(shortId);
  const containing = valid.filter((s) => titles(s).some((t) => t.includes(wanted)));
  if (containing.length > 0) return containing.slice(0, MAX_SOURCES_PER_NAME).map(shortId);
  return valid.length > 0 ? [shortId(valid[0])] : [];
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

    // Add response interceptor for 429 rate-limit handling with bounded retry
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 429 && error.config) {
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

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < CONFIG.API.RETRY.MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));

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
    const result = await this.retryWithBackoff(async () => {
      const params: Record<string, string> = {};
      if (this.email && !this.apiKey) params.mailto = this.email;
      if (this.apiKey) params.api_key = this.apiKey;

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
    if (entityType === 'works' && options.filter && options.filter[VENUE_NAME_FILTER] !== undefined) {
      options = await this.resolveVenueNames(options);
    }
    const params = this.buildQueryParams(options);
    const cacheKey = `${entityType}?${JSON.stringify(params)}`;

    if (this.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const result = await this.retryWithBackoff(async () => {
      debug('searchEntities', entityType, JSON.stringify(params));
      const response = await this.client.get(`/${entityType}`, { params });
      return response.data;
    }, `searchEntities(${entityType})`);

    if (this.enableCache) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Replace a VENUE_NAME_FILTER by the OpenAlex source IDs its names stand for. A source ID
   * filter given as well is the more precise one and is kept as it is. A name that matches no
   * source is an error, rather than a silently empty or unfiltered result.
   */
  private async resolveVenueNames(options: SearchOptions): Promise<SearchOptions> {
    const filter: FilterOptions = { ...options.filter };
    const names = String(filter[VENUE_NAME_FILTER])
      .split('|')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    delete filter[VENUE_NAME_FILTER];

    if (filter[SOURCE_ID_FILTER] === undefined && names.length > 0) {
      const ids: string[] = [];
      for (const name of names) {
        const page = await this.searchEntities('sources', {
          search: name,
          perPage: MAX_SOURCES_PER_NAME,
          select: ['id', 'display_name', 'abbreviated_title', 'alternate_titles'],
        });
        const matched = matchSourceIds(name, page.results ?? []);
        if (matched.length === 0) {
          throw new Error(
            `No OpenAlex source matches the venue name "${name}". ` +
            'Pass the ISSN (source_issn / venue_issn) or the OpenAlex source ID instead.'
          );
        }
        debug(`venue name "${name}" -> ${matched.join('|')}`);
        ids.push(...matched);
      }
      filter[SOURCE_ID_FILTER] = [...new Set(ids)].join('|');
    }
    return { ...options, filter };
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
