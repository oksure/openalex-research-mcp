import { debug } from './config.js';

/**
 * Wrap a search query in double quotes for exact phrase matching.
 * Strips existing outer quotes and whitespace before wrapping.
 */
export function wrapPhraseSearch(query: string | undefined, exactPhrase?: boolean): string | undefined {
  if (query === undefined || !exactPhrase) return query;
  // Strip leading/trailing whitespace
  let cleaned = query.trim();
  // Strip existing outer double quotes
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  // Strip any remaining interior double quotes (would produce malformed API queries)
  cleaned = cleaned.replace(/"/g, '');
  // Strip again after removing quotes
  cleaned = cleaned.trim();
  if (!cleaned) return undefined;
  return `"${cleaned}"`;
}

/**
 * Apply search field scoping via OpenAlex filter keys.
 * When searchField is set without exactPhrase, moves the query into a filter key
 * (e.g., title.search, abstract.search). When both are set, phrase search wins
 * because OpenAlex does not support phrase matching inside field-scoped filters.
 */
export function applySearchField(
  query: string | undefined,
  searchField: string | undefined,
  exactPhrase?: boolean,
): { search?: string; filterAdditions?: Record<string, any> } {
  if (!searchField) {
    return { search: wrapPhraseSearch(query, exactPhrase) };
  }

  // Both searchField and exactPhrase — prefer phrase search (global search param)
  if (exactPhrase) {
    debug('search_field ignored because exact_phrase is true — phrase matching requires global search param');
    return { search: wrapPhraseSearch(query, true) };
  }

  // searchField without exactPhrase — move query into a filter key
  const fieldMap: Record<string, string> = {
    title: 'title.search',
    abstract: 'abstract.search',
    fulltext: 'fulltext.search',
  };
  const filterKey = fieldMap[searchField];
  if (!filterKey || !query) {
    return { search: query };
  }
  return { filterAdditions: { [filterKey]: query } };
}
