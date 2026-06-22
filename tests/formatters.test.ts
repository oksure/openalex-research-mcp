import { describe, it, expect } from 'vitest';
import { summarizeInstitution, reconstructAbstract } from '../src/formatters.js';

describe('summarizeInstitution', () => {
  const raw = {
    id: 'https://openalex.org/I123',
    display_name: 'Seoul National University',
    ror: 'https://ror.org/04h9pn542',
    country_code: 'KR',
    type: 'education',
    homepage_url: 'https://snu.ac.kr',
    works_count: 250000,
    cited_by_count: 9000000,
    summary_stats: { h_index: 600, i10_index: 90000, '2yr_mean_citedness': 3.4 },
    geo: { city: 'Seoul', region: 'Seoul', country: 'South Korea', latitude: 37.4 },
    associated_institutions: [
      { display_name: 'SNU Hospital', relationship: 'related' },
      { display_name: 'B', relationship: 'child' },
      { display_name: 'C', relationship: 'child' },
      { display_name: 'D', relationship: 'child' },
    ],
    topics: [{ display_name: 'T1' }, { display_name: 'T2' }, { display_name: 'T3' }, { display_name: 'T4' }, { display_name: 'T5' }],
    // Fields that should be dropped to keep responses compact:
    x_concepts: new Array(50).fill({ display_name: 'noise' }),
    counts_by_year: new Array(15).fill({ year: 2020, works_count: 1 }),
    international: { display_name: { en: 'x' } },
  };

  it('extracts the key metrics and drops bulky noise fields', () => {
    const s = summarizeInstitution(raw) as any;
    expect(s.display_name).toBe('Seoul National University');
    expect(s.country_code).toBe('KR');
    expect(s.h_index).toBe(600);
    expect(s.two_year_mean_citedness).toBe(3.4);
    expect(s.geo).toEqual({ city: 'Seoul', region: 'Seoul', country: 'South Korea' });
    // Noise fields must not leak through
    expect((s as any).x_concepts).toBeUndefined();
    expect((s as any).counts_by_year).toBeUndefined();
    expect((s as any).international).toBeUndefined();
  });

  it('truncates associated_institutions to 3 and topics to 4', () => {
    const s = summarizeInstitution(raw) as any;
    expect(s.associated_institutions).toHaveLength(3);
    expect(s.top_topics).toEqual(['T1', 'T2', 'T3', 'T4']);
  });

  it('handles missing optional fields gracefully', () => {
    const s = summarizeInstitution({ id: 'I9', display_name: 'X' }) as any;
    expect(s.h_index).toBeNull();
    expect(s.geo).toBeNull();
    expect(s.associated_institutions).toEqual([]);
    expect(s.top_topics).toEqual([]);
  });
});

describe('reconstructAbstract', () => {
  it('rebuilds word order from an inverted index', () => {
    // "the quick brown fox"
    const inverted = { the: [0], quick: [1], brown: [2], fox: [3] };
    expect(reconstructAbstract(inverted)).toBe('the quick brown fox');
  });
});
