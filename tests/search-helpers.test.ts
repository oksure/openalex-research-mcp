import { describe, it, expect } from 'vitest';
import { wrapPhraseSearch, applySearchField } from '../src/search-helpers.js';

describe('wrapPhraseSearch', () => {
  it('returns undefined for undefined input', () => {
    expect(wrapPhraseSearch(undefined, true)).toBeUndefined();
  });
  it('returns query unchanged when exactPhrase is false', () => {
    expect(wrapPhraseSearch('privacy paradox', false)).toBe('privacy paradox');
  });
  it('returns query unchanged when exactPhrase is undefined', () => {
    expect(wrapPhraseSearch('privacy paradox')).toBe('privacy paradox');
  });
  it('wraps query in double quotes when exactPhrase is true', () => {
    expect(wrapPhraseSearch('privacy paradox', true)).toBe('"privacy paradox"');
  });
  it('strips existing outer quotes before wrapping', () => {
    expect(wrapPhraseSearch('"privacy paradox"', true)).toBe('"privacy paradox"');
  });
  it('trims whitespace before wrapping', () => {
    expect(wrapPhraseSearch('  privacy paradox  ', true)).toBe('"privacy paradox"');
  });
  it('returns undefined for empty string with exactPhrase', () => {
    expect(wrapPhraseSearch('', true)).toBeUndefined();
  });
  it('returns undefined for whitespace-only string with exactPhrase', () => {
    expect(wrapPhraseSearch('   ', true)).toBeUndefined();
  });
  it('handles single word with exactPhrase', () => {
    expect(wrapPhraseSearch('privacy', true)).toBe('"privacy"');
  });
  it('strips interior double quotes', () => {
    expect(wrapPhraseSearch('supply "chain" resilience', true)).toBe('"supply chain resilience"');
  });
  it('handles mismatched outer quote (leading only)', () => {
    expect(wrapPhraseSearch('"foo bar', true)).toBe('"foo bar"');
  });
  it('handles mismatched outer quote (trailing only)', () => {
    expect(wrapPhraseSearch('foo bar"', true)).toBe('"foo bar"');
  });
  it('handles string of only quotes', () => {
    expect(wrapPhraseSearch('""', true)).toBeUndefined();
  });
});

describe('applySearchField', () => {
  it('returns search when no searchField', () => {
    const result = applySearchField('machine learning', undefined, false);
    expect(result.search).toBe('machine learning');
    expect(result.filterAdditions).toBeUndefined();
  });
  it('wraps search when exactPhrase and no searchField', () => {
    const result = applySearchField('privacy paradox', undefined, true);
    expect(result.search).toBe('"privacy paradox"');
    expect(result.filterAdditions).toBeUndefined();
  });
  it('moves query to title.search filter', () => {
    const result = applySearchField('privacy paradox', 'title', false);
    expect(result.search).toBeUndefined();
    expect(result.filterAdditions).toEqual({ 'title.search': 'privacy paradox' });
  });
  it('moves query to abstract.search filter', () => {
    const result = applySearchField('privacy paradox', 'abstract', false);
    expect(result.search).toBeUndefined();
    expect(result.filterAdditions).toEqual({ 'abstract.search': 'privacy paradox' });
  });
  it('moves query to fulltext.search filter', () => {
    const result = applySearchField('privacy paradox', 'fulltext', false);
    expect(result.search).toBeUndefined();
    expect(result.filterAdditions).toEqual({ 'fulltext.search': 'privacy paradox' });
  });
  it('prefers phrase search over field scoping when both set', () => {
    const result = applySearchField('privacy paradox', 'title', true);
    expect(result.search).toBe('"privacy paradox"');
    expect(result.filterAdditions).toBeUndefined();
  });
  it('returns undefined search for undefined query', () => {
    const result = applySearchField(undefined, undefined, false);
    expect(result.search).toBeUndefined();
  });
  it('returns raw search for undefined query with searchField', () => {
    const result = applySearchField(undefined, 'title', false);
    expect(result.search).toBeUndefined();
    expect(result.filterAdditions).toBeUndefined();
  });
  it('returns raw search for unknown searchField value', () => {
    const result = applySearchField('test query', 'unknown' as any, false);
    expect(result.search).toBe('test query');
    expect(result.filterAdditions).toBeUndefined();
  });
});
