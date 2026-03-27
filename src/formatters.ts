// Response formatting helpers — pure functions for summarizing OpenAlex API responses.
// Two-tier strategy: summarized results for list operations, full details for single-work lookups.

export function reconstructAbstract(invertedIndex: any): string {
  const words: { [key: number]: string } = {};

  for (const [word, positions] of Object.entries(invertedIndex)) {
    if (Array.isArray(positions)) {
      positions.forEach((pos: number) => {
        words[pos] = word;
      });
    }
  }

  const sortedPositions = Object.keys(words).map(Number).sort((a, b) => a - b);
  return sortedPositions.map(pos => words[pos]).join(' ');
}

export function summarizeWork(work: any) {
  return {
    id: work.id,
    doi: work.doi,
    title: work.title || work.display_name,
    publication_year: work.publication_year,
    publication_date: work.publication_date,
    cited_by_count: work.cited_by_count,
    type: work.type,
    authors: work.authorships?.slice(0, 5).map((a: any) => ({
      name: a.author?.display_name,
      institutions: a.institutions?.slice(0, 2).map((i: any) => i.display_name)
    })) || [],
    authors_truncated: work.authorships?.length > 5,
    primary_topic: work.primary_topic ? {
      display_name: work.primary_topic.display_name,
      field: work.primary_topic.field?.display_name,
      subfield: work.primary_topic.subfield?.display_name
    } : null,
    open_access: {
      is_oa: work.open_access?.is_oa,
      oa_status: work.open_access?.oa_status,
      oa_url: work.open_access?.oa_url
    },
    landing_page_url: work.primary_location?.landing_page_url,
    pdf_url: work.best_oa_location?.pdf_url,
    source: work.primary_location?.source?.display_name,
    source_id: work.primary_location?.source?.id,
    source_issn_l: work.primary_location?.source?.issn_l,
    source_type: work.primary_location?.source?.type,
    fwci: work.fwci ?? null,
    abstract: work.abstract_inverted_index ?
      reconstructAbstract(work.abstract_inverted_index).substring(0, 600) : null
  };
}

export function summarizeAuthor(author: any) {
  return {
    id: author.id,
    name: author.display_name,
    orcid: author.orcid,
    works_count: author.works_count,
    cited_by_count: author.cited_by_count,
    h_index: author.summary_stats?.h_index ?? null,
    i10_index: author.summary_stats?.i10_index ?? null,
    two_year_mean_citedness: author.summary_stats?.['2yr_mean_citedness'] ?? null,
    last_known_institutions: author.last_known_institutions?.slice(0, 2).map((i: any) => ({
      display_name: i.display_name,
      country_code: i.country_code,
      type: i.type
    })) || [],
    top_topics: author.topics?.slice(0, 4).map((t: any) => ({
      name: t.display_name,
      count: t.count
    })) || []
  };
}

export function summarizeSource(source: any) {
  return {
    id: source.id,
    display_name: source.display_name,
    issn_l: source.issn_l,
    issn: source.issn,
    type: source.type,
    h_index: source.summary_stats?.h_index ?? null,
    two_year_mean_citedness: source.summary_stats?.['2yr_mean_citedness'] ?? null,
    works_count: source.works_count,
    cited_by_count: source.cited_by_count,
    is_oa: source.is_oa,
    is_in_doaj: source.is_in_doaj,
    homepage_url: source.homepage_url,
    host_organization: source.host_organization_name,
    topics: source.topics?.slice(0, 4).map((t: any) => t.display_name) || []
  };
}

export function summarizeWorksList(response: any) {
  return {
    meta: {
      count: response.meta?.count,
      page: response.meta?.page,
      per_page: response.meta?.per_page
    },
    results: response.results?.map(summarizeWork) || []
  };
}

export function getFullWorkDetails(work: any) {
  return {
    id: work.id,
    doi: work.doi,
    title: work.title || work.display_name,
    publication_year: work.publication_year,
    publication_date: work.publication_date,
    cited_by_count: work.cited_by_count,
    type: work.type,
    authors: work.authorships?.map((a: any, index: number) => ({
      position: index === 0 ? 'first' : index === work.authorships.length - 1 ? 'last' : 'middle',
      author_position: a.author_position,
      name: a.author?.display_name,
      id: a.author?.id,
      orcid: a.author?.orcid,
      institutions: a.institutions?.map((i: any) => ({
        id: i.id,
        display_name: i.display_name,
        ror: i.ror,
        country_code: i.country_code,
        type: i.type
      })) || [],
      countries: a.countries || [],
      is_corresponding: a.is_corresponding,
      raw_affiliation_strings: a.raw_affiliation_strings || []
    })) || [],
    primary_topic: work.primary_topic ? {
      id: work.primary_topic.id,
      display_name: work.primary_topic.display_name,
      score: work.primary_topic.score,
      field: work.primary_topic.field?.display_name,
      subfield: work.primary_topic.subfield?.display_name,
      domain: work.primary_topic.domain?.display_name
    } : null,
    topics: work.topics?.slice(0, 5).map((t: any) => ({
      id: t.id,
      display_name: t.display_name,
      score: t.score
    })) || [],
    open_access: {
      is_oa: work.open_access?.is_oa,
      oa_status: work.open_access?.oa_status,
      oa_url: work.open_access?.oa_url,
      any_repository_has_fulltext: work.open_access?.any_repository_has_fulltext
    },
    landing_page_url: work.primary_location?.landing_page_url,
    pdf_url: work.best_oa_location?.pdf_url,
    primary_location: work.primary_location ? {
      is_oa: work.primary_location.is_oa,
      landing_page_url: work.primary_location.landing_page_url,
      pdf_url: work.primary_location.pdf_url,
      source: work.primary_location.source ? {
        id: work.primary_location.source.id,
        display_name: work.primary_location.source.display_name,
        issn_l: work.primary_location.source.issn_l,
        issn: work.primary_location.source.issn,
        type: work.primary_location.source.type,
        host_organization: work.primary_location.source.host_organization_name
      } : null,
      license: work.primary_location.license,
      version: work.primary_location.version
    } : null,
    abstract: work.abstract_inverted_index ?
      reconstructAbstract(work.abstract_inverted_index) : null,
    biblio: work.biblio,
    referenced_works_count: work.referenced_works_count,
    cited_by_percentile_year: work.cited_by_percentile_year,
    fwci: work.fwci,
    keywords: work.keywords?.slice(0, 10).map((k: any) => ({
      keyword: k.keyword || k.display_name,
      score: k.score
    })) || [],
    grants: work.grants?.slice(0, 5).map((g: any) => ({
      funder: g.funder,
      funder_display_name: g.funder_display_name,
      award_id: g.award_id
    })) || [],
    referenced_works: work.referenced_works || [],
    related_works: work.related_works || []
  };
}
