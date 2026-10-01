const OPENALEX_AUTHOR_ID = /^A\d+$/i;
const OPENALEX_AUTHOR_URL = /^https?:\/\/openalex\.org\/(A\d+)\/?$/i;

/**
 * Normalize an OpenAlex author identifier for comparisons.
 * OpenAlex returns author IDs as URLs even when callers provide bare IDs.
 */
export function normalizeOpenAlexAuthorId(id: string): string {
  const value = id.trim();
  const match = value.match(OPENALEX_AUTHOR_URL);
  return (match?.[1] ?? value).toUpperCase();
}

export function isOpenAlexAuthorId(id: string): boolean {
  return OPENALEX_AUTHOR_ID.test(normalizeOpenAlexAuthorId(id));
}

export function sameOpenAlexAuthorId(first: string, second: string): boolean {
  return normalizeOpenAlexAuthorId(first) === normalizeOpenAlexAuthorId(second);
}
