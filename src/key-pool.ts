// Several OpenAlex API keys, used one at a time in the configured order. A key whose daily
// budget is spent is set aside until the next midnight-UTC refill, and a key OpenAlex refuses
// (HTTP 401) for the life of the process; the request then goes out again with the next key.
// Keys never appear in logs or errors: callers name a key by its 1-based position.

import { readFileSync } from 'node:fs';

/**
 * Split configured keys: one per line, or separated by commas, semicolons or blanks. `#` starts
 * a comment that runs to the end of its line.
 */
export function parseApiKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .flatMap((line) => line.replace(/#.*$/, '').split(/[\s,;]+/))
    .filter((key) => key.length > 0);
}

export interface ApiKeySources {
  apiKey?: string;
  apiKeys?: string;
  apiKeysFile?: string;
}

/**
 * Every configured key, in order: OPENALEX_API_KEY, then OPENALEX_API_KEYS, then the
 * OPENALEX_API_KEYS_FILE file. A key file that cannot be read stops the server at startup,
 * rather than leaving it, silently, with fewer keys than configured.
 */
export function collectApiKeys(
  sources: ApiKeySources,
  readFile: (path: string) => string = readKeysFile,
): string[] {
  return [
    ...parseApiKeys(sources.apiKey),
    ...parseApiKeys(sources.apiKeys),
    ...(sources.apiKeysFile ? parseApiKeys(readFile(sources.apiKeysFile)) : []),
  ];
}

function readKeysFile(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`OPENALEX_API_KEYS_FILE could not be read (${path}): ${reason}`);
  }
}

/** Epoch milliseconds of the first midnight UTC after `now`, when OpenAlex refills daily budgets. */
export function nextMidnightUtc(now: number): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
}

/** A key handed out by the pool, with its 1-based position in the configured order, for logs. */
export interface PooledKey {
  key: string;
  position: number;
}

export class ApiKeyPool {
  private readonly keys: readonly string[];
  /** Per key, the epoch milliseconds until which it is set aside: 0 while usable, Infinity once refused. */
  private readonly asideUntil: number[];
  private readonly now: () => number;

  constructor(keys: readonly string[], now: () => number = Date.now) {
    this.keys = [...new Set(keys.filter((key) => key.length > 0))];
    this.asideUntil = this.keys.map(() => 0);
    this.now = now;
  }

  /** Number of distinct keys configured. */
  get size(): number {
    return this.keys.length;
  }

  /** Number of keys usable now. */
  usable(): number {
    const now = this.now();
    return this.asideUntil.filter((until) => until <= now).length;
  }

  /**
   * The key for the next request: the first one, in the configured order, that is not set
   * aside, so each day starts again from the first key. When every key is set aside, the one
   * that comes back first, so the request still goes out and fails with OpenAlex's own answer.
   * Undefined only for an empty pool, that is, anonymous access.
   */
  current(): PooledKey | undefined {
    const now = this.now();
    let soonest: number | undefined;
    for (const [index, until] of this.asideUntil.entries()) {
      if (until <= now) return this.at(index);
      if (soonest === undefined || until < (this.asideUntil[soonest] ?? Number.POSITIVE_INFINITY)) {
        soonest = index;
      }
    }
    return soonest === undefined ? undefined : this.at(soonest);
  }

  /** Set `key` aside until its budget refills at midnight UTC; true when another key is usable. */
  setAsideUntilReset(key: string): boolean {
    return this.setAside(key, nextMidnightUtc(this.now()));
  }

  /** Set `key` aside for the life of the process (OpenAlex refused it); true when another key is usable. */
  setAsideForGood(key: string): boolean {
    return this.setAside(key, Number.POSITIVE_INFINITY);
  }

  private at(index: number): PooledKey | undefined {
    const key = this.keys[index];
    return key === undefined ? undefined : { key, position: index + 1 };
  }

  private setAside(key: string, until: number): boolean {
    const index = this.keys.indexOf(key);
    if (index >= 0) this.asideUntil[index] = Math.max(this.asideUntil[index] ?? 0, until);
    return this.usable() > 0;
  }
}

/** A 429 that means the key's daily budget is spent, not a per-second rate limit. */
export function isBudgetExhausted(error: any): boolean {
  if (error?.response?.status !== 429) return false;
  const data = error.response.data;
  const text = typeof data === 'string' ? data : JSON.stringify(data ?? '');
  return /insufficient budget|resets at midnight|budget[^.]*remaining/i.test(text);
}
