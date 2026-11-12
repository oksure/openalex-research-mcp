import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { OpenAlexClient } from '../src/openalex-client.js';

vi.mock('axios');

const spent = () => Object.assign(new Error('Request failed with status code 429'), {
  response: { status: 429, data: { error: 'Insufficient budget', message: 'Daily budget resets at midnight UTC.' } },
});
const refused = () => Object.assign(new Error('Request failed with status code 401'), {
  response: { status: 401, data: { error: 'Invalid API key' } },
});

/** A mock axios instance whose /works answer depends on the api_key of the request. */
function mockAxios(answer: (key: string | undefined) => any) {
  const keysUsed: (string | undefined)[] = [];
  const get = vi.fn((_url: string, config: any) => {
    const key = config?.params?.api_key;
    keysUsed.push(key);
    const out = answer(key);
    return out instanceof Error ? Promise.reject(out) : Promise.resolve({ data: out });
  });
  vi.mocked(axios.create).mockReturnValue({ get, interceptors: { response: { use: vi.fn() } } } as any);
  return { get, keysUsed };
}

const OK = { meta: { count: 1 }, results: [{ id: 'https://openalex.org/W1' }] };

describe('Several API keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sends the request again with the next key when the first has spent its budget', async () => {
    const { keysUsed } = mockAxios((key) => (key === 'k1' ? spent() : OK));
    const client = new OpenAlexClient({ apiKey: 'k1', apiKeys: 'k2', enableCache: false });
    await expect(client.getWorks({ search: 'x' })).resolves.toEqual(OK);
    await client.getWorks({ search: 'y' });
    expect(keysUsed).toEqual(['k1', 'k2', 'k2']);
  });

  it('sets aside a key OpenAlex refuses', async () => {
    const { keysUsed } = mockAxios((key) => (key === 'k1' ? refused() : OK));
    const client = new OpenAlexClient({ apiKey: 'k1', apiKeys: 'k2', enableCache: false });
    await client.getEntity('works', 'W1');
    await client.autocomplete('works', 'novelty');
    expect(keysUsed).toEqual(['k1', 'k2', 'k2']);
  });

  it('fails with the budget message, without retrying, once every key has spent its budget', async () => {
    const { keysUsed } = mockAxios(() => spent());
    const client = new OpenAlexClient({ apiKey: 'k1', apiKeys: 'k2', enableCache: false });
    await expect(client.getWorks({ search: 'x' })).rejects.toThrow('budget spent on every configured API key');
    expect(keysUsed).toEqual(['k1', 'k2']);
  });

  it('does not move on for an error that has nothing to do with the key', async () => {
    const notFound = Object.assign(new Error('Not found'), { response: { status: 404 } });
    const { keysUsed } = mockAxios(() => notFound);
    const client = new OpenAlexClient({ apiKey: 'k1', apiKeys: 'k2', enableCache: false });
    await expect(client.getEntity('works', 'W404')).rejects.toThrow('Not found');
    expect(keysUsed).toEqual(['k1']);
  });

  it('with one key, fails fast on a spent budget and suggests adding keys', async () => {
    const { keysUsed } = mockAxios(() => spent());
    const client = new OpenAlexClient({ apiKey: 'k1', enableCache: false });
    await expect(client.getWorks({ search: 'x' })).rejects.toThrow('OPENALEX_API_KEYS');
    expect(keysUsed).toEqual(['k1']);
  });

  it('reads further keys from OPENALEX_API_KEYS', async () => {
    vi.stubEnv('OPENALEX_API_KEY', 'e1');
    vi.stubEnv('OPENALEX_API_KEYS', 'e2;e3');
    const { keysUsed } = mockAxios((key) => (key === 'e1' || key === 'e2' ? spent() : OK));
    const client = new OpenAlexClient({ enableCache: false });
    expect(client.apiKeyCount).toBe(3);
    await client.getWorks({ search: 'x' });
    expect(keysUsed).toEqual(['e1', 'e2', 'e3']);
  });

  it('sends mailto and no api_key without keys', async () => {
    vi.stubEnv('OPENALEX_API_KEY', '');
    const get = vi.fn((_url: string, _config: any) => Promise.resolve({ data: OK }));
    vi.mocked(axios.create).mockReturnValue({ get, interceptors: { response: { use: vi.fn() } } } as any);
    const client = new OpenAlexClient({ email: 'me@example.org', enableCache: false });
    await client.getWorks({ search: 'x' });
    expect(get.mock.calls[0][1].params).toMatchObject({ mailto: 'me@example.org' });
    expect(get.mock.calls[0][1].params.api_key).toBeUndefined();
  });

  it('keeps cached results when the key changes', async () => {
    const { get } = mockAxios((key) => (key === 'k1' ? spent() : OK));
    const client = new OpenAlexClient({ apiKey: 'k1', apiKeys: 'k2' });
    await client.getWorks({ search: 'same' });
    await client.getWorks({ search: 'same' });
    expect(get).toHaveBeenCalledTimes(2); // k1 refused for budget, k2 answered; the repeat came from the cache
  });
});
