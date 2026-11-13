import { describe, it, expect } from 'vitest';
import { ApiKeyPool, collectApiKeys, isBudgetExhausted, nextMidnightUtc, parseApiKeys } from '../src/key-pool.js';

describe('parseApiKeys', () => {
  it('splits on lines, commas, semicolons and blanks, and drops comments', () => {
    expect(parseApiKeys('a,b; c\n# comment\n d  # trailing\n\n')).toEqual(['a', 'b', 'c', 'd']);
    expect(parseApiKeys(undefined)).toEqual([]);
  });
});

describe('collectApiKeys', () => {
  it('orders OPENALEX_API_KEY, then OPENALEX_API_KEYS, then the key file', () => {
    const keys = collectApiKeys({ apiKey: 'k1', apiKeys: 'k2,k3', apiKeysFile: 'keys.txt' }, () => 'k4\nk5');
    expect(keys).toEqual(['k1', 'k2', 'k3', 'k4', 'k5']);
  });

  it('reads no file when none is configured', () => {
    expect(collectApiKeys({ apiKey: 'k1' }, () => { throw new Error('should not read'); })).toEqual(['k1']);
  });

  it('names the variable when the key file cannot be read', () => {
    expect(() => collectApiKeys({ apiKeysFile: '/no/such/folder/openalex_keys.txt' }))
      .toThrow('OPENALEX_API_KEYS_FILE could not be read');
  });
});

describe('nextMidnightUtc', () => {
  it('returns the next midnight UTC', () => {
    expect(nextMidnightUtc(Date.UTC(2026, 10, 12, 13, 5))).toBe(Date.UTC(2026, 10, 13));
    expect(nextMidnightUtc(Date.UTC(2026, 11, 31, 23, 59))).toBe(Date.UTC(2027, 0, 1));
  });
});

describe('ApiKeyPool', () => {
  it('hands out no key for anonymous access', () => {
    const pool = new ApiKeyPool([]);
    expect(pool.size).toBe(0);
    expect(pool.current()).toBeUndefined();
  });

  it('drops empty and repeated keys, keeping the first position', () => {
    const pool = new ApiKeyPool(['a', '', 'b', 'a']);
    expect(pool.size).toBe(2);
    expect(pool.current()).toEqual({ key: 'a', position: 1 });
  });

  it('moves to the next key when one is spent, and back to the first after midnight UTC', () => {
    let now = Date.UTC(2026, 10, 12, 10);
    const pool = new ApiKeyPool(['a', 'b'], () => now);
    expect(pool.setAsideUntilReset('a')).toBe(true);
    expect(pool.current()?.key).toBe('b');
    now = Date.UTC(2026, 10, 13, 0, 0, 1);
    expect(pool.current()?.key).toBe('a');
  });

  it('never hands out a refused key again while another is usable', () => {
    const pool = new ApiKeyPool(['a', 'b']);
    expect(pool.setAsideForGood('a')).toBe(true);
    expect(pool.current()?.key).toBe('b');
  });

  it('says when no key is left, and then hands out the one that comes back first', () => {
    const now = Date.UTC(2026, 10, 12, 10);
    const pool = new ApiKeyPool(['a', 'b'], () => now);
    pool.setAsideForGood('a');
    expect(pool.setAsideUntilReset('b')).toBe(false);
    expect(pool.usable()).toBe(0);
    expect(pool.current()?.key).toBe('b');
  });
});

describe('isBudgetExhausted', () => {
  it('recognizes the 429 of a spent daily budget, not other 429s', () => {
    const spent = { response: { status: 429, data: { error: 'Insufficient budget', message: 'Your daily budget resets at midnight UTC.' } } };
    const rate = { response: { status: 429, data: { error: 'Too many requests' } } };
    expect(isBudgetExhausted(spent)).toBe(true);
    expect(isBudgetExhausted(rate)).toBe(false);
    expect(isBudgetExhausted({ response: { status: 401, data: 'Insufficient budget' } })).toBe(false);
  });
});
