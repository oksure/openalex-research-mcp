// buildFilter — maps MCP tool parameters to OpenAlex API filter format.
// Exported so it can be unit-tested directly.

import { FilterOptions } from './openalex-client.js';
import { INSTITUTION_GROUPS } from './presets.js';
import { debug } from './config.js';

export function buildFilter(params: any): FilterOptions {
  const filter: FilterOptions = {};

  // Handle publication year range (all tools now use from_year/to_year)
  const fromYear = params.from_year || params.from_publication_year;
  const toYear = params.to_year || params.to_publication_year;

  if (fromYear && toYear) {
    filter['publication_year'] = `${fromYear}-${toYear}`;
  } else if (fromYear) {
    filter['publication_year'] = `>${fromYear - 1}`;
  } else if (toYear) {
    filter['publication_year'] = `<${toYear + 1}`;
  }

  if (params.cited_by_count) {
    filter['cited_by_count'] = params.cited_by_count;
  }
  if (params.is_oa !== undefined) {
    filter['is_oa'] = params.is_oa;
  }
  if (params.type) {
    filter['type'] = params.type;
  }
  if (params.works_count) {
    filter['works_count'] = params.works_count;
  }
  if (params.country_code) {
    filter['country_code'] = params.country_code;
  }
  if (params.institution) {
    filter['institutions.display_name'] = params.institution;
  }
  if (params.institution_group) {
    const group = INSTITUTION_GROUPS[params.institution_group];
    if (group) {
      filter['authorships.institutions.display_name'] = group.institutions.join('|');
    }
  } else if (params.author_institution) {
    filter['authorships.institutions.display_name'] = params.author_institution;
  }
  if (params.source_id) {
    filter['primary_location.source.id'] = params.source_id;
  }
  if (params.source_name) {
    filter['primary_location.source.display_name.search'] = params.source_name;
  }
  if (params.source_issn) {
    filter['primary_location.source.issn'] = params.source_issn;
  }
  if (params.min_citations !== undefined && params.min_citations > 0) {
    filter['cited_by_count'] = `>${params.min_citations - 1}`;
  }

  debug('buildFilter result:', JSON.stringify(filter));
  return filter;
}
