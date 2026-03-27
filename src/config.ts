// Debug logging gated on OPENALEX_DEBUG env var (stderr is safe for MCP stdio servers)
const DEBUG_ENABLED = process.env.OPENALEX_DEBUG === '1' || process.env.OPENALEX_DEBUG === 'true';
export function debug(...args: unknown[]): void {
  if (DEBUG_ENABLED) console.error('[openalex]', ...args);
}

export const CONFIG = {
  API: {
    BASE_URL: 'https://api.openalex.org',
    TIMEOUT: 30000,
    RATE_LIMIT: {
      REQUESTS_PER_SECOND: 10,
      REQUESTS_PER_DAY: 100000,
    },
    RETRY: {
      MAX_RETRIES: 3,
      MAX_429_RETRIES: 3,
      INITIAL_DELAY_MS: 1000,
      MAX_DELAY_MS: 10000,
      BACKOFF_FACTOR: 2,
    },
  },
  CACHE: {
    TTL_MS: 5 * 60 * 1000, // 5 minutes
    MAX_SIZE: 1000,
  },
  MCP: {
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 200,
    MAX_AUTHORS_IN_SUMMARY: 5,
    MAX_ABSTRACT_LENGTH: 500,
    MAX_TOPICS: 5,
    MAX_KEYWORDS: 10,
    MAX_GRANTS: 5,
    MIN_CITATIONS_FOR_INFLUENTIAL: 50,
  },
};
