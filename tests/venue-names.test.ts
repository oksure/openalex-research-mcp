import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { OpenAlexClient, VENUE_NAME_FILTER, matchSourceIds } from '../src/openalex-client.js';

vi.mock('axios');
const RP = { id: 'https://openalex.org/S9731383', display_name: 'Research Policy', abbreviated_title: 'Res. Policy' };
const OTHER = { id: 'https://openalex.org/S201446958', display_name: 'Health Research Policy and Systems' };
const NIPS = { id: 'https://openalex.org/S4306420609', display_name: 'Neural Information Processing Systems', alternate_titles: ['NeurIPS'] };

function mockAxios(sources: Record<string, any[]>) {
  const worksParams: any[] = [];
  const get = vi.fn((url: string, config: any) => {
    if (url === '/sources') return Promise.resolve({ data: { meta: { count: 0 }, results: sources[config.params.search] ?? [] } });
    if (url === '/works') {
      worksParams.push(config.params);
      return Promise.resolve({ data: { meta: { count: 0 }, results: [] } });
    }
    return Promise.reject(new Error('unexpected ' + url));
  });
  vi.mocked(axios.create).mockReturnValue({ get, interceptors: { response: { use: vi.fn() } } } as any);
  return { get, worksParams };
}

describe('venue matching', () => {
  beforeEach(() => vi.clearAllMocks());
  it('prefers exact titles and recognizes alternate titles', () => {
    expect(matchSourceIds('Research Policy', [OTHER, RP])).toEqual(['S9731383']);
    expect(matchSourceIds('neurips', [NIPS])).toEqual(['S4306420609']);
    expect(matchSourceIds('policy', [RP, OTHER])).toEqual(['S9731383', 'S201446958']);
    expect(matchSourceIds('ICML', [NIPS])).toEqual([]);
    expect(matchSourceIds('', [RP])).toEqual([]);
  });
  it('resolves a name before sending works and preserves other filters', async () => {
    const { worksParams } = mockAxios({ 'Research Policy': [OTHER, RP] });
    await new OpenAlexClient({ enableCache: false }).getWorks({ filter: { [VENUE_NAME_FILTER]: 'Research Policy', is_oa: true } });
    expect(worksParams[0].filter).toContain('primary_location.source.id:S9731383');
    expect(worksParams[0].filter).toContain('is_oa:true');
    expect(worksParams[0].filter).not.toContain('display_name.search');
  });
  it('resolves multiple names', async () => {
    const { worksParams } = mockAxios({ 'Research Policy': [RP], NeurIPS: [NIPS] });
    await new OpenAlexClient({ enableCache: false }).getWorks({ filter: { [VENUE_NAME_FILTER]: 'Research Policy|NeurIPS' } });
    expect(worksParams[0].filter).toBe('primary_location.source.id:S9731383|S4306420609');
  });
  it.each([' | ', 'ICML'])('rejects unmatched or blank names without sending a works request: %s', async (name) => {
    const { worksParams } = mockAxios({ ICML: [NIPS] });
    await expect(new OpenAlexClient({ enableCache: false }).getWorks({ filter: { [VENUE_NAME_FILTER]: name } })).rejects.toThrow();
    expect(worksParams).toHaveLength(0);
  });
  it('keeps an explicit source ID without a lookup', async () => {
    const { get, worksParams } = mockAxios({});
    await new OpenAlexClient({ enableCache: false }).getWorks({ filter: { 'primary_location.source.id': 'S1', [VENUE_NAME_FILTER]: 'Research Policy' } });
    expect(get.mock.calls.filter(([url]) => url === '/sources')).toHaveLength(0);
    expect(worksParams[0].filter).toBe('primary_location.source.id:S1');
  });
});
