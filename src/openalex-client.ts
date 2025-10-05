import axios, { AxiosInstance, AxiosError } from 'axios';

export interface OpenAlexConfig {
  email?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface FilterOptions {
  [key: string]: string | number | boolean;
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

  constructor(config: OpenAlexConfig = {}) {
    this.email = config.email || process.env.OPENALEX_EMAIL;
    this.apiKey = config.apiKey || process.env.OPENALEX_API_KEY;

    const baseUrl = config.baseUrl || 'https://api.openalex.org';

    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'User-Agent': this.email
          ? `OpenAlexMCP/1.0 (mailto:${this.email})`
          : 'OpenAlexMCP/1.0',
      },
    });

    // Add response interceptor for error handling
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
    try {
      const params: Record<string, string> = {};
      if (this.email && !this.apiKey) params.mailto = this.email;
      if (this.apiKey) params.api_key = this.apiKey;

      const response = await this.client.get(`/${entityType}/${id}`, { params });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get ${entityType}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Search/list entities with filters
   */
  async searchEntities<T = any>(
    entityType: string,
    options: SearchOptions = {}
  ): Promise<OpenAlexResponse<T>> {
    try {
      const params = this.buildQueryParams(options);
      console.error('SearchEntities called:');
      console.error('  Entity type:', entityType);
      console.error('  Options:', JSON.stringify(options, null, 2));
      console.error('  Query params:', JSON.stringify(params, null, 2));
      const response = await this.client.get(`/${entityType}`, { params });
      console.error('  Response status:', response.status);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('  API Error:', error.response?.status, error.response?.data);
        throw new Error(`Failed to search ${entityType}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get autocomplete suggestions
   */
  async autocomplete(entityType: string, query: string): Promise<any> {
    try {
      const params: Record<string, string> = { q: query };
      if (this.email && !this.apiKey) params.mailto = this.email;
      if (this.apiKey) params.api_key = this.apiKey;

      const response = await this.client.get(`/autocomplete/${entityType}`, { params });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to autocomplete ${entityType}: ${error.message}`);
      }
      throw error;
    }
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
}
