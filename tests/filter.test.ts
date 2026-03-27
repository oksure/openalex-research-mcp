import { describe, it, expect } from 'vitest';
import { buildFilter } from '../src/filter.js';

describe('buildFilter', () => {
  it('should handle from_year only (inclusive)', () => {
    const filter = buildFilter({ from_year: 2020 });
    expect(filter['publication_year']).toBe('>2019');
  });

  it('should handle to_year only (inclusive)', () => {
    const filter = buildFilter({ to_year: 2023 });
    expect(filter['publication_year']).toBe('<2024');
  });

  it('should handle year range (both from and to)', () => {
    const filter = buildFilter({ from_year: 2020, to_year: 2023 });
    expect(filter['publication_year']).toBe('2020-2023');
  });

  it('should handle min_citations threshold', () => {
    const filter = buildFilter({ min_citations: 50 });
    expect(filter['cited_by_count']).toBe('>49');
  });

  it('should handle min_citations of 1', () => {
    const filter = buildFilter({ min_citations: 1 });
    expect(filter['cited_by_count']).toBe('>0');
  });

  it('should skip min_citations when 0', () => {
    const filter = buildFilter({ min_citations: 0 });
    expect(filter['cited_by_count']).toBeUndefined();
  });

  it('should resolve institution_group preset', () => {
    const filter = buildFilter({ institution_group: 'harvard_stanford_mit' });
    expect(filter['authorships.institutions.display_name']).toBe(
      'Harvard University|Stanford University|Massachusetts Institute of Technology'
    );
  });

  it('should pass through author_institution when no group', () => {
    const filter = buildFilter({ author_institution: 'MIT' });
    expect(filter['authorships.institutions.display_name']).toBe('MIT');
  });

  it('should prefer institution_group over author_institution', () => {
    const filter = buildFilter({
      institution_group: 'ivy_league',
      author_institution: 'MIT',
    });
    // institution_group takes precedence
    expect(filter['authorships.institutions.display_name']).toContain('Harvard University');
    expect(filter['authorships.institutions.display_name']).not.toBe('MIT');
  });

  it('should handle source filters', () => {
    const filter = buildFilter({
      source_name: 'Nature',
      source_issn: '0028-0836',
    });
    expect(filter['primary_location.source.display_name.search']).toBe('Nature');
    expect(filter['primary_location.source.issn']).toBe('0028-0836');
  });

  it('should handle combined filters', () => {
    const filter = buildFilter({
      from_year: 2020,
      to_year: 2024,
      min_citations: 100,
      is_oa: true,
    });
    expect(filter['publication_year']).toBe('2020-2024');
    expect(filter['cited_by_count']).toBe('>99');
    expect(filter['is_oa']).toBe(true);
  });

  it('should return empty filter for empty params', () => {
    const filter = buildFilter({});
    expect(Object.keys(filter)).toHaveLength(0);
  });

  it('should accept legacy from_publication_year', () => {
    const filter = buildFilter({ from_publication_year: 2020 });
    expect(filter['publication_year']).toBe('>2019');
  });
});
