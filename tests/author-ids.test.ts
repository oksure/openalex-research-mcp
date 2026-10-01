import { describe, expect, it } from 'vitest';
import {
  isOpenAlexAuthorId,
  normalizeOpenAlexAuthorId,
  sameOpenAlexAuthorId,
} from '../src/author-ids.js';

describe('OpenAlex author ID normalization', () => {
  it('treats a bare ID and API URL as the same author', () => {
    expect(sameOpenAlexAuthorId(
      'https://openalex.org/A5033043101',
      'A5033043101',
    )).toBe(true);
  });

  it('normalizes case and a trailing slash', () => {
    expect(normalizeOpenAlexAuthorId(' https://openalex.org/a5033043101/ '))
      .toBe('A5033043101');
  });

  it('recognizes OpenAlex IDs but not ORCIDs', () => {
    expect(isOpenAlexAuthorId('A5033043101')).toBe(true);
    expect(isOpenAlexAuthorId('https://orcid.org/0000-0002-4189-3154')).toBe(false);
  });

  it('does not equate different authors', () => {
    expect(sameOpenAlexAuthorId('A5033043101', 'A5012033205')).toBe(false);
  });
});
