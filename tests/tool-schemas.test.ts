import { describe, it, expect } from 'vitest';
import {
  TOOL_SCHEMAS,
  validateInput,
  searchByTopicSchema,
  getTopCitedWorksSchema,
} from '../src/validation.js';

describe('TOOL_SCHEMAS map', () => {
  it('covers every argument-taking tool (30) and excludes health_check', () => {
    const names = Object.keys(TOOL_SCHEMAS);
    expect(names.length).toBe(30);
    expect(names).not.toContain('health_check');
    // Spot-check a few tools that previously had no schema (added in 0.5.0)
    for (const t of [
      'search_in_journal_list',
      'get_author_profile',
      'batch_resolve_references',
      'check_venue_quality',
      'find_seminal_papers',
    ]) {
      expect(TOOL_SCHEMAS[t]).toBeDefined();
    }
  });
});

describe('Required-field enforcement (previously unvalidated tools)', () => {
  it('search_in_journal_list requires journal_list', () => {
    expect(() => validateInput(TOOL_SCHEMAS.search_in_journal_list, { query: 'AI' }, 'test')).toThrow();
    expect(validateInput(TOOL_SCHEMAS.search_in_journal_list, { journal_list: 'utd24' }, 'test')).toBeDefined();
  });

  it('get_author_profile requires author_id', () => {
    expect(() => validateInput(TOOL_SCHEMAS.get_author_profile, {}, 'test')).toThrow();
    expect(validateInput(TOOL_SCHEMAS.get_author_profile, { author_id: 'A123' }, 'test')).toBeDefined();
  });

  it('batch_resolve_references requires a non-empty ids array', () => {
    expect(() => validateInput(TOOL_SCHEMAS.batch_resolve_references, { ids: [] }, 'test')).toThrow();
    expect(validateInput(TOOL_SCHEMAS.batch_resolve_references, { ids: ['W1'] }, 'test')).toBeDefined();
  });

  it('find_review_articles / find_seminal_papers / find_open_access_version require query', () => {
    expect(() => validateInput(TOOL_SCHEMAS.find_review_articles, {}, 'test')).toThrow();
    expect(() => validateInput(TOOL_SCHEMAS.find_seminal_papers, {}, 'test')).toThrow();
    expect(() => validateInput(TOOL_SCHEMAS.find_open_access_version, {}, 'test')).toThrow();
  });
});

describe('Enum + type enforcement', () => {
  it('get_top_venues_for_field rejects an invalid type enum', () => {
    expect(() => validateInput(TOOL_SCHEMAS.get_top_venues_for_field, { query: 'ml', type: 'blog' }, 'test')).toThrow();
    expect(validateInput(TOOL_SCHEMAS.get_top_venues_for_field, { query: 'ml', type: 'conference' }, 'test')).toBeDefined();
  });

  it('rejects non-numeric per_page', () => {
    expect(() => validateInput(TOOL_SCHEMAS.search_works_in_venue, { per_page: 'lots' }, 'test')).toThrow();
  });
});

describe('Completed schemas accept the params their handlers consume', () => {
  it('searchByTopicSchema accepts institution_group / source_name / min_citations (0.5.0 completeness fix)', () => {
    const out = searchByTopicSchema.parse({
      topic: 'AI',
      institution_group: 'ivy_league',
      source_name: 'Nature',
      min_citations: 50,
      author_institution: 'Harvard University',
    });
    expect(out.institution_group).toBe('ivy_league');
    expect(out.source_name).toBe('Nature');
  });

  it('getTopCitedWorksSchema accepts author_institution / institution_group and min_citations:0', () => {
    const out = getTopCitedWorksSchema.parse({
      query: 'AI',
      author_institution: 'MIT',
      institution_group: 'top_us',
      min_citations: 0,
    });
    expect(out.author_institution).toBe('MIT');
    expect(out.min_citations).toBe(0);
  });
});
