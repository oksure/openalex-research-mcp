import { z } from 'zod';

export const searchWorksSchema = z.object({
  query: z.string().optional(),
  from_publication_year: z.number().positive().optional(),
  to_publication_year: z.number().positive().optional(),
  cited_by_count: z.string().optional(),
  is_oa: z.boolean().optional(),
  type: z.string().optional(),
  sort: z.string().optional(),
  page: z.number().positive().optional(),
  per_page: z.number().positive().max(200).optional(),
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
  sort: z.string().optional(),
  per_page: z.number().positive().max(200).optional(),
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
  depth: z.number().positive().max(2).optional(),
  max_citing: z.number().positive().optional(),
  max_references: z.number().positive().optional(),
});

export const getTopCitedWorksSchema = z.object({
  query: z.string().optional(),
  topic: z.string().optional(),
  from_year: z.number().positive().optional(),
  to_year: z.number().positive().optional(),
  min_citations: z.number().positive().optional(),
  per_page: z.number().positive().max(200).optional(),
});

export const searchAuthorsSchema = z.object({
  query: z.string().optional(),
  works_count: z.string().optional(),
  cited_by_count: z.string().optional(),
  institution: z.string().optional(),
  per_page: z.number().positive().max(200).optional(),
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
});

export const analyzeTopicTrendsSchema = z.object({
  query: z.string().min(1),
  from_year: z.number().positive().optional(),
  to_year: z.number().positive().optional(),
});

export const compareResearchAreasSchema = z.object({
  topics: z.array(z.string().min(1)).min(2).max(5),
  from_year: z.number().positive().optional(),
  to_year: z.number().positive().optional(),
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
});

export const findSimilarWorksSchema = z.object({
  query: z.string().min(1).max(10000),
  count: z.number().positive().max(100).optional(),
  from_publication_year: z.number().positive().optional(),
  to_publication_year: z.number().positive().optional(),
  is_oa: z.boolean().optional(),
});

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
