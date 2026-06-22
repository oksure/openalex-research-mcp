import { z } from 'zod';

export const searchWorksSchema = z.object({
  query: z.string().optional(),
  from_year: z.number().positive().optional(),
  to_year: z.number().positive().optional(),
  min_citations: z.number().nonnegative().optional(),
  cited_by_count: z.string().optional(),
  source_name: z.string().optional(),
  source_id: z.string().optional(),
  source_issn: z.string().optional(),
  author_institution: z.string().optional(),
  institution_group: z.string().optional(),
  is_oa: z.boolean().optional(),
  type: z.string().optional(),
  sort: z.string().optional(),
  page: z.number().positive().optional(),
  per_page: z.number().positive().max(200).optional(),
  exact_phrase: z.boolean().optional(),
  search_field: z.enum(['title', 'abstract', 'fulltext']).optional(),
});

export const getWorkSchema = z.object({
  id: z.string().min(1),
});

export const getRelatedWorksSchema = z.object({
  id: z.string().min(1),
  per_page: z.number().positive().max(200).optional(),
});

export const searchByTopicSchema = z.object({
  topic: z.string().min(1),
  from_year: z.number().positive().optional(),
  to_year: z.number().positive().optional(),
  source_name: z.string().optional(),
  source_issn: z.string().optional(),
  min_citations: z.number().nonnegative().optional(),
  author_institution: z.string().optional(),
  institution_group: z.string().optional(),
  sort: z.string().optional(),
  per_page: z.number().positive().max(200).optional(),
  exact_phrase: z.boolean().optional(),
  search_field: z.enum(['title', 'abstract', 'fulltext']).optional(),
});

export const autocompleteSearchSchema = z.object({
  query: z.string().min(1),
  entity_type: z.enum(['works', 'authors', 'institutions', 'sources', 'topics', 'publishers', 'funders']),
});

export const getWorkCitationsSchema = z.object({
  id: z.string().min(1),
  page: z.number().positive().optional(),
  per_page: z.number().positive().max(200).optional(),
  sort: z.string().optional(),
});

export const getWorkReferencesSchema = z.object({
  id: z.string().min(1),
});

export const getCitationNetworkSchema = z.object({
  id: z.string().min(1),
  max_citing: z.number().positive().optional(),
  max_references: z.number().positive().optional(),
});

export const getTopCitedWorksSchema = z.object({
  query: z.string().optional(),
  topic: z.string().optional(),
  from_year: z.number().positive().optional(),
  to_year: z.number().positive().optional(),
  min_citations: z.number().nonnegative().optional(),
  source_name: z.string().optional(),
  source_issn: z.string().optional(),
  source_id: z.string().optional(),
  author_institution: z.string().optional(),
  institution_group: z.string().optional(),
  per_page: z.number().positive().max(200).optional(),
  exact_phrase: z.boolean().optional(),
  search_field: z.enum(['title', 'abstract', 'fulltext']).optional(),
});

export const searchAuthorsSchema = z.object({
  query: z.string().optional(),
  works_count: z.string().optional(),
  cited_by_count: z.string().optional(),
  institution: z.string().optional(),
  sort: z.string().optional(),
  per_page: z.number().positive().max(200).optional(),
  exact_phrase: z.boolean().optional(),
});

export const getAuthorWorksSchema = z.object({
  author_id: z.string().min(1),
  from_year: z.number().positive().optional(),
  to_year: z.number().positive().optional(),
  sort: z.string().optional(),
  per_page: z.number().positive().max(200).optional(),
});

export const getAuthorCollaboratorsSchema = z.object({
  author_id: z.string().min(1),
  min_collaborations: z.number().positive().optional(),
});

export const searchInstitutionsSchema = z.object({
  query: z.string().optional(),
  country_code: z.string().length(2).optional(),
  type: z.string().optional(),
  works_count: z.string().optional(),
  per_page: z.number().positive().max(200).optional(),
  exact_phrase: z.boolean().optional(),
});

export const analyzeTopicTrendsSchema = z.object({
  query: z.string().min(1),
  from_year: z.number().positive().optional(),
  to_year: z.number().positive().optional(),
  exact_phrase: z.boolean().optional(),
  search_field: z.enum(['title', 'abstract', 'fulltext']).optional(),
});

export const compareResearchAreasSchema = z.object({
  topics: z.array(z.string().min(1)).min(2).max(5),
  from_year: z.number().positive().optional(),
  to_year: z.number().positive().optional(),
  exact_phrase: z.boolean().optional(),
});

export const getTrendingTopicsSchema = z.object({
  min_works: z.number().positive().optional(),
  time_period_years: z.number().positive().optional(),
  per_page: z.number().positive().max(200).optional(),
});

export const analyzeGeographicDistributionSchema = z.object({
  query: z.string().min(1),
  from_year: z.number().positive().optional(),
  to_year: z.number().positive().optional(),
  exact_phrase: z.boolean().optional(),
  search_field: z.enum(['title', 'abstract', 'fulltext']).optional(),
});

export const getEntitySchema = z.object({
  entity_type: z.enum(['works', 'authors', 'sources', 'institutions', 'topics', 'publishers', 'funders']),
  id: z.string().min(1),
});

export const searchSourcesSchema = z.object({
  query: z.string().optional(),
  type: z.string().optional(),
  is_oa: z.boolean().optional(),
  works_count: z.string().optional(),
  per_page: z.number().positive().max(200).optional(),
  exact_phrase: z.boolean().optional(),
});

// ── Schemas for named-preset and top-journal research tools (added in 0.5.0) ──
// These mirror each tool's inputSchema in index.ts. per_page is capped at the
// absolute API max (200); handlers that expose a lower cap clamp via Math.min,
// so validation stays lenient (clamps rather than rejects).

export const listJournalPresetsSchema = z.object({
  category: z.enum(['venues', 'institutions']).optional(),
});

export const searchInJournalListSchema = z.object({
  journal_list: z.string().min(1),
  query: z.string().optional(),
  from_year: z.number().positive().optional(),
  to_year: z.number().positive().optional(),
  min_citations: z.number().nonnegative().optional(),
  author_institution: z.string().optional(),
  institution_group: z.string().optional(),
  sort: z.string().optional(),
  per_page: z.number().positive().max(200).optional(),
  exact_phrase: z.boolean().optional(),
  search_field: z.enum(['title', 'abstract', 'fulltext']).optional(),
});

export const searchWorksInVenueSchema = z.object({
  query: z.string().optional(),
  venue_name: z.string().optional(),
  venue_issn: z.string().optional(),
  venue_id: z.string().optional(),
  from_year: z.number().positive().optional(),
  to_year: z.number().positive().optional(),
  min_citations: z.number().nonnegative().optional(),
  sort: z.string().optional(),
  per_page: z.number().positive().max(200).optional(),
  exact_phrase: z.boolean().optional(),
  search_field: z.enum(['title', 'abstract', 'fulltext']).optional(),
});

export const getTopVenuesForFieldSchema = z.object({
  query: z.string().min(1),
  type: z.enum(['journal', 'conference', 'repository']).optional(),
  per_page: z.number().positive().max(200).optional(),
  exact_phrase: z.boolean().optional(),
});

export const checkVenueQualitySchema = z.object({
  venue_name: z.string().optional(),
  venue_issn: z.string().optional(),
  venue_id: z.string().optional(),
});

export const getAuthorProfileSchema = z.object({
  author_id: z.string().min(1),
  top_works_count: z.number().positive().optional(),
  recent_works_count: z.number().positive().optional(),
});

export const searchAuthorsByExpertiseSchema = z.object({
  topic: z.string().min(1),
  min_h_index: z.number().nonnegative().optional(),
  min_cited_by_count: z.number().nonnegative().optional(),
  institution: z.string().optional(),
  per_page: z.number().positive().max(200).optional(),
  exact_phrase: z.boolean().optional(),
});

export const findReviewArticlesSchema = z.object({
  query: z.string().min(1),
  from_year: z.number().positive().optional(),
  to_year: z.number().positive().optional(),
  source_name: z.string().optional(),
  min_citations: z.number().nonnegative().optional(),
  per_page: z.number().positive().max(200).optional(),
  exact_phrase: z.boolean().optional(),
  search_field: z.enum(['title', 'abstract', 'fulltext']).optional(),
});

export const findSeminalPapersSchema = z.object({
  query: z.string().min(1),
  min_citations: z.number().nonnegative().optional(),
  published_before: z.number().positive().optional(),
  source_name: z.string().optional(),
  per_page: z.number().positive().max(200).optional(),
  exact_phrase: z.boolean().optional(),
  search_field: z.enum(['title', 'abstract', 'fulltext']).optional(),
});

export const batchResolveReferencesSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export const findOpenAccessVersionSchema = z.object({
  query: z.string().min(1),
  from_year: z.number().positive().optional(),
  source_name: z.string().optional(),
  min_citations: z.number().nonnegative().optional(),
  per_page: z.number().positive().max(200).optional(),
  exact_phrase: z.boolean().optional(),
  search_field: z.enum(['title', 'abstract', 'fulltext']).optional(),
});

/**
 * Central map of tool name → input schema. Every tool that takes arguments is
 * listed here so the request handler can validate uniformly (health_check takes
 * no arguments and is intentionally absent).
 */
export const TOOL_SCHEMAS: Record<string, z.ZodTypeAny> = {
  search_works: searchWorksSchema,
  get_work: getWorkSchema,
  get_related_works: getRelatedWorksSchema,
  search_by_topic: searchByTopicSchema,
  autocomplete_search: autocompleteSearchSchema,
  get_work_citations: getWorkCitationsSchema,
  get_work_references: getWorkReferencesSchema,
  get_citation_network: getCitationNetworkSchema,
  get_top_cited_works: getTopCitedWorksSchema,
  search_authors: searchAuthorsSchema,
  get_author_works: getAuthorWorksSchema,
  get_author_collaborators: getAuthorCollaboratorsSchema,
  search_institutions: searchInstitutionsSchema,
  analyze_topic_trends: analyzeTopicTrendsSchema,
  compare_research_areas: compareResearchAreasSchema,
  get_trending_topics: getTrendingTopicsSchema,
  analyze_geographic_distribution: analyzeGeographicDistributionSchema,
  get_entity: getEntitySchema,
  search_sources: searchSourcesSchema,
  list_journal_presets: listJournalPresetsSchema,
  search_in_journal_list: searchInJournalListSchema,
  search_works_in_venue: searchWorksInVenueSchema,
  get_top_venues_for_field: getTopVenuesForFieldSchema,
  check_venue_quality: checkVenueQualitySchema,
  get_author_profile: getAuthorProfileSchema,
  search_authors_by_expertise: searchAuthorsByExpertiseSchema,
  find_review_articles: findReviewArticlesSchema,
  find_seminal_papers: findSeminalPapersSchema,
  batch_resolve_references: batchResolveReferencesSchema,
  find_open_access_version: findOpenAccessVersionSchema,
};

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      throw new Error(`Validation error for ${context}: ${errorMessages}`);
    }
    throw error;
  }
}
