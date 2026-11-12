// Handlers of the author tools (get_author_profile, get_author_works, get_author_collaborators),
// separated from the MCP server so they can be tested with a mock client.

import type { FilterOptions, OpenAlexResponse, SearchOptions } from './openalex-client.js';
import { summarizeAuthor, summarizeWork, summarizeWorksList } from './formatters.js';
import {
  isOpenAlexAuthorId, normalizeOpenAlexAuthorId, normalizeOpenAlexAuthorLookupId, sameOpenAlexAuthorId,
} from './author-ids.js';

/** The client calls the author tools make. */
export interface AuthorToolsClient {
  getAuthor(id: string): Promise<any>;
  getWorks(options?: SearchOptions): Promise<OpenAlexResponse<any>>;
}

/**
 * The bare OpenAlex author ID (A123) for an author_id parameter, and the author record when a
 * lookup was needed. An OpenAlex ID or URL is used as it is; an ORCID (bare or URL) or any other
 * identifier goes through an author lookup, because the works filter authorships.author.id
 * accepts OpenAlex IDs only.
 */
export async function resolveAuthorId(
  client: AuthorToolsClient,
  input: string,
): Promise<{ id: string; author?: any }> {
  const value = input.trim();
  if (isOpenAlexAuthorId(value)) {
    return { id: normalizeOpenAlexAuthorId(value) };
  }
  const author = await client.getAuthor(normalizeOpenAlexAuthorLookupId(value));
  if (!author?.id) {
    throw new Error(`Unable to resolve author ID: ${input}`);
  }
  return { id: normalizeOpenAlexAuthorId(author.id), author };
}

export async function getAuthorWorks(client: AuthorToolsClient, params: any, defaultPageSize: number) {
  const { id: authorId } = await resolveAuthorId(client, params.author_id);
  const filter: FilterOptions = {
    'authorships.author.id': authorId,
  };
  // Use correct publication_year filter (NOT from_publication_date)
  if (params.from_year && params.to_year) {
    filter['publication_year'] = `${params.from_year}-${params.to_year}`;
  } else if (params.from_year) {
    filter['publication_year'] = `>${params.from_year - 1}`;
  } else if (params.to_year) {
    filter['publication_year'] = `<${params.to_year + 1}`;
  }

  const options: SearchOptions = {
    filter,
    sort: params.sort,
    perPage: params.per_page || defaultPageSize,
  };
  const results = await client.getWorks(options);
  return summarizeWorksList(results);
}

export async function getAuthorCollaborators(client: AuthorToolsClient, params: any, pageSize: number) {
  const { id: authorId } = await resolveAuthorId(client, params.author_id);

  // Paginate through author's works to handle prolific authors
  const authorFilter: FilterOptions = {
    'authorships.author.id': authorId,
  };
  let allWorks: any[] = [];
  let page = 1;
  const maxPages = 5; // Cap at 1000 works to avoid excessive API calls

  while (page <= maxPages) {
    const batch = await client.getWorks({
      filter: authorFilter,
      perPage: pageSize,
      page,
      select: ['id', 'authorships'],
    });
    allWorks = allWorks.concat(batch.results);
    if (allWorks.length >= batch.meta.count || batch.results.length < pageSize) break;
    page++;
  }

  // Count collaborators
  const collaboratorCounts: { [key: string]: { count: number; name: string; id: string } } = {};

  for (const work of allWorks) {
    if (work.authorships) {
      for (const authorship of work.authorships) {
        const coauthorId = authorship.author?.id;
        if (coauthorId && !sameOpenAlexAuthorId(coauthorId, authorId)) {
          if (!collaboratorCounts[coauthorId]) {
            collaboratorCounts[coauthorId] = {
              count: 0,
              name: authorship.author?.display_name || 'Unknown',
              id: coauthorId,
            };
          }
          collaboratorCounts[coauthorId].count++;
        }
      }
    }
  }

  // Filter and sort
  const minCollabs = params.min_collaborations || 1;
  const collaborators = Object.values(collaboratorCounts)
    .filter(c => c.count >= minCollabs)
    .sort((a, b) => b.count - a.count);

  return {
    author_id: params.author_id,
    total_works_analyzed: allWorks.length,
    collaborators,
  };
}

export async function getAuthorProfile(client: AuthorToolsClient, params: any) {
  const resolved = await resolveAuthorId(client, params.author_id);
  const authorId = resolved.id;
  const author = resolved.author ?? await client.getAuthor(authorId);
  const topWorksCount = params.top_works_count || 5;
  const recentWorksCount = params.recent_works_count || 5;

  // Fetch top-cited works
  const topWorksResult = await client.getWorks({
    filter: { 'authorships.author.id': authorId },
    sort: 'cited_by_count:desc',
    perPage: topWorksCount,
  });

  // Fetch recent works
  const recentWorksResult = await client.getWorks({
    filter: { 'authorships.author.id': authorId },
    sort: 'publication_year:desc',
    perPage: recentWorksCount,
  });

  return {
    ...summarizeAuthor(author),
    top_cited_works: topWorksResult.results.map(summarizeWork),
    recent_works: recentWorksResult.results.map(summarizeWork),
    // Full affiliations history
    affiliations: author.affiliations?.map((a: any) => ({
      institution: a.institution?.display_name,
      country: a.institution?.country_code,
      years: a.years
    })) || [],
  };
}
