import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { OpenAlexClient, VENUE_NAME_FILTER, matchSourceIds } from '../src/openalex-client.js';

vi.mock('axios');

const RP = { id: 'https://openalex.org/S9731383', display_name: 'Research Policy', abbreviated_title: 'Res. Policy', alternate_titles: [] };
const HRPS = { id: 'https://openalex.org/S201446958', display_name: 'Health Research Policy and Systems', alternate_titles: [] };
const NEURIPS = { id: 'https://openalex.org/S4306420609', display_name: 'Neural Information Processing Systems', alternate_titles: ['NeurIPS', 'NIPS'] };

/** A mock axios instance: /sources answers from `sources[search]`, /works records its params. */
function mockAxios(sources: Record<string, any[]>) {
  const worksParams: any[] = [];
  const get = vi.fn((url: string, config: any) => {
    if (url === '/sources') {
      return Promise.resolve({ data: { meta: { count: 0 }, results: sources[config.params.search] ?? [] } });
    }
    if (url === '/works') {
      worksParams.push(config.params);
      return Promise.resolve({ data: { meta: { count: 0 }, results: [] } });
    }
    return Promise.reject(Object.assign(new Error('unexpected ' + url), { response: { status: 404 } }));
  });
  vi.mocked(axios.create).mockReturnValue({ get, interceptors: { response: { use: vi.fn() } } } as any);
  return { get, worksParams };
}

describe('matchSourceIds', () => {
  it('prefers an exact name over names that contain it', () => {
    expect(matchSourceIds('Research Policy', [HRPS, RP])).toEqual(['S9731383']);
  });

  it('matches abbreviations and alternate titles exactly, ignoring case', () => {
    expect(matchSourceIds('neurips', [NEURIPS])).toEqual(['S4306420609']);
    expect(matchSourceIds('Res. Policy', [HRPS, RP])).toEqual(['S9731383']);
  });

  it('falls back to every source whose name contains the given name', () => {
    expect(matchSourceIds('Policy', [RP, HRPS])).toEqual(['S9731383', 'S201446958']);
  });

  it('falls back to the top search result, and returns nothing for no result', () => {
    expect(matchSourceIds('ICML', [NEURIPS])).toEqual(['S4306420609']);
    expect(matchSourceIds('Unknown', [])).toEqual([]);
  });
});

describe('Venue names in works requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends source IDs instead of the venue-name filter OpenAlex rejects', async () => {
    const { worksParams } = mockAxios({ 'Research Policy': [HRPS, RP] });
    const client = new OpenAlexClient({ enableCache: false });
    await client.getWorks({ search: 'novelty', filter: { [VENUE_NAME_FILTER]: 'Research Policy', is_oa: true } });
    expect(worksParams).toHaveLength(1);
    expect(worksParams[0].filter).toContain('primary_location.source.id:S9731383');
    expect(worksParams[0].filter).toContain('is_oa:true');
    expect(worksParams[0].filter).not.toContain('display_name.search');
  });

  it('resolves several names joined with "|"', async () => {
    const { worksParams } = mockAxios({ 'Research Policy': [RP], 'Neural Information Processing Systems': [NEURIPS] });
    const client = new OpenAlexClient({ enableCache: false });
    await client.getWorks({ filter: { [VENUE_NAME_FILTER]: 'Research Policy|Neural Information Processing Systems' } });
    expect(worksParams[0].filter).toBe('primary_location.source.id:S9731383|S4306420609');
  });

  it('fails with a clear message when a name matches no source', async () => {
    const { worksParams } = mockAxios({});
    const client = new OpenAlexClient({ enableCache: false });
    await expect(client.getWorks({ filter: { [VENUE_NAME_FILTER]: 'No Such Journal' } }))
      .rejects.toThrow('No OpenAlex source matches the venue name "No Such Journal"');
    expect(worksParams).toHaveLength(0);
  });

  it('keeps an explicit source ID and does not look the name up', async () => {
    const { get, worksParams } = mockAxios({ 'Research Policy': [RP] });
    const client = new OpenAlexClient({ enableCache: false });
    await client.getWorks({ filter: { 'primary_location.source.id': 'S1', [VENUE_NAME_FILTER]: 'Research Policy' } });
    expect(get.mock.calls.filter(([url]) => url === '/sources')).toHaveLength(0);
    expect(worksParams[0].filter).toBe('primary_location.source.id:S1');
  });
});
