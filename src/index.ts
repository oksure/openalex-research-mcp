#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { OpenAlexClient, FilterOptions, SearchOptions, FindSimilarWorksOptions } from './openalex-client.js';
import { z } from 'zod';
import { CONFIG } from './config.js';
import { validateInput } from './validation.js';

// Debug logging
console.error('OpenAlex MCP Server starting...');
console.error('Email:', process.env.OPENALEX_EMAIL);
console.error('API Key:', process.env.OPENALEX_API_KEY ? 'Set' : 'Not set');

// Initialize OpenAlex client
const openAlexClient = new OpenAlexClient();

// Default page size for MCP clients (can be overridden with MCP_DEFAULT_PAGE_SIZE env var)
const DEFAULT_PAGE_SIZE = parseInt(process.env.MCP_DEFAULT_PAGE_SIZE || String(CONFIG.MCP.DEFAULT_PAGE_SIZE), 10);

// Helper function to filter work data to essential fields only (reduces context usage)
function summarizeWork(work: any) {
  return {
    id: work.id,
    doi: work.doi,
    title: work.title || work.display_name,
    publication_year: work.publication_year,
    publication_date: work.publication_date,
    cited_by_count: work.cited_by_count,
    type: work.type,
    // Only first 5 authors to avoid huge lists
    authors: work.authorships?.slice(0, 5).map((a: any) => ({
      name: a.author?.display_name,
      institutions: a.institutions?.slice(0, 2).map((i: any) => i.display_name)
    })) || [],
    authors_truncated: work.authorships?.length > 5,
    // Primary topic only
    primary_topic: work.primary_topic ? {
      display_name: work.primary_topic.display_name,
      field: work.primary_topic.field?.display_name,
      subfield: work.primary_topic.subfield?.display_name
    } : null,
    // Open access info
    open_access: {
      is_oa: work.open_access?.is_oa,
      oa_status: work.open_access?.oa_status,
      oa_url: work.open_access?.oa_url
    },
    // Key URLs
    landing_page_url: work.primary_location?.landing_page_url,
    pdf_url: work.best_oa_location?.pdf_url,
    // Source (journal/venue)
    source: work.primary_location?.source?.display_name,
    // Abstract if available (truncated to 500 chars)
    abstract: work.abstract_inverted_index ?
      Object.keys(work.abstract_inverted_index).slice(0, 100).join(' ').substring(0, 500) + '...' : null
  };
}

// Helper function to filter response data
function summarizeWorksList(response: any) {
  return {
    meta: {
      count: response.meta?.count,
      page: response.meta?.page,
      per_page: response.meta?.per_page
    },
    results: response.results?.map(summarizeWork) || []
  };
}

// Helper function to return full work details (for get_work tool)
function getFullWorkDetails(work: any) {
  return {
    id: work.id,
    doi: work.doi,
    title: work.title || work.display_name,
    publication_year: work.publication_year,
    publication_date: work.publication_date,
    cited_by_count: work.cited_by_count,
    type: work.type,
    // ALL authors with full details
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
    // Full topics (not just primary)
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
    // Open access info
    open_access: {
      is_oa: work.open_access?.is_oa,
      oa_status: work.open_access?.oa_status,
      oa_url: work.open_access?.oa_url,
      any_repository_has_fulltext: work.open_access?.any_repository_has_fulltext
    },
    // URLs and locations
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
    // Abstract (reconstructed from inverted index)
    abstract: work.abstract_inverted_index ?
      reconstructAbstract(work.abstract_inverted_index) : null,
    // Bibliographic info
    biblio: work.biblio,
    // Key metrics and identifiers
    referenced_works_count: work.referenced_works_count,
    cited_by_percentile_year: work.cited_by_percentile_year,
    fwci: work.fwci,
    // Keywords
    keywords: work.keywords?.slice(0, 10).map((k: any) => ({
      keyword: k.keyword || k.display_name,
      score: k.score
    })) || [],
    // Grants/funding
    grants: work.grants?.slice(0, 5).map((g: any) => ({
      funder: g.funder,
      funder_display_name: g.funder_display_name,
      award_id: g.award_id
    })) || [],
    // Reference and citation counts
    referenced_works: work.referenced_works || [],
    related_works: work.related_works || []
  };
}

// Helper function to reconstruct abstract from inverted index
function reconstructAbstract(invertedIndex: any): string {
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

// Define all tools
const tools: Tool[] = [
  // Literature Search & Discovery
  {
    name: 'search_works',
    description:
      'Search for scholarly works (papers, articles, books) with advanced filtering. Supports Boolean operators (AND, OR, NOT), publication year ranges, citation counts, and more. Essential for finding relevant literature. Tip: For highly influential papers, use the cited_by_count filter (e.g., ">100") or consider using get_top_cited_works tool.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query. Supports Boolean operators in uppercase (AND, OR, NOT). Example: "machine learning AND (neural networks OR deep learning)"',
        },
        from_publication_year: {
          type: 'number',
          description: 'Filter works published from this year onwards',
        },
        to_publication_year: {
          type: 'number',
          description: 'Filter works published up to this year',
        },
        cited_by_count: {
          type: 'string',
          description:
            'Filter by citation count. Use >X for more than X citations, <X for less than X. Example: ">100"',
        },
        is_oa: {
          type: 'boolean',
          description: 'Filter for open access works only',
        },
        type: {
          type: 'string',
          description: 'Filter by work type: article, book, dataset, etc.',
        },
        sort: {
          type: 'string',
          description:
            'Sort results. Options: relevance_score (default), cited_by_count, publication_year',
        },
        page: {
          type: 'number',
          description: 'Page number for pagination (default: 1)',
        },
        per_page: {
          type: 'number',
          description: 'Results per page, max 200 (default: 10)',
        },
      },
    },
  },
  {
    name: 'get_work',
    description:
      'Get COMPLETE details about a specific work by OpenAlex ID or DOI. Unlike search results which are summarized, this returns ALL information including: complete author list (first, middle, and last authors with positions, institutions, ORCID, corresponding author flags), full abstract (reconstructed), all topics, complete bibliographic data, funding/grants, keywords, and reference lists. Use this when you need detailed information about a specific paper, especially for identifying PIs (often last author) or corresponding authors.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description:
            'Work identifier. Can be OpenAlex ID (W2741809807), DOI (10.1371/journal.pone.0000000), or full URL',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_related_works',
    description:
      'Find works related to a given work based on shared topics, citations, and references. Useful for discovering similar papers in a research area.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Work identifier (OpenAlex ID, DOI, or URL)',
        },
        per_page: {
          type: 'number',
          description: 'Number of related works to return (default: 10, max: 200)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'search_by_topic',
    description:
      'Search for works within specific research topics or domains. Use this to explore literature in a particular field or subfield.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description:
            'Topic name or keywords to search for (e.g., "artificial intelligence", "climate change", "quantum computing")',
        },
        from_year: {
          type: 'number',
          description: 'Filter works from this year onwards',
        },
        to_year: {
          type: 'number',
          description: 'Filter works up to this year',
        },
        sort: {
          type: 'string',
          description: 'Sort by: cited_by_count, publication_year, relevance_score (default)',
        },
        per_page: {
          type: 'number',
          description: 'Results per page (default: 10, max: 200)',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'autocomplete_search',
    description:
      'Fast autocomplete/typeahead search for works, authors, institutions, or other entities. Returns quick suggestions for partial queries.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Partial search query',
        },
        entity_type: {
          type: 'string',
          description:
            'Type of entity to search: works, authors, institutions, sources, topics, publishers, funders',
          enum: ['works', 'authors', 'institutions', 'sources', 'topics', 'publishers', 'funders'],
        },
      },
      required: ['query', 'entity_type'],
    },
  },
  {
    name: 'find_similar_works',
    description:
      'Find semantically similar works using AI embeddings. Unlike keyword search, this finds works about the same topic even if they use different terminology. Powered by the /find/works endpoint. Requires an API key (OPENALEX_API_KEY). Costs 1,000 credits per query. Only works with abstracts are indexed (~217M works). English-optimized.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'The text to find similar works for (required, max 10,000 chars). Can be a sentence, paragraph, or research question.',
        },
        count: {
          type: 'number',
          description: 'Number of results to return (1-100, default: 25)',
        },
        from_publication_year: {
          type: 'number',
          description: 'Filter works published from this year onwards',
        },
        to_publication_year: {
          type: 'number',
          description: 'Filter works published up to this year',
        },
        is_oa: {
          type: 'boolean',
          description: 'Filter for open access works only',
        },
      },
      required: ['query'],
    },
  },

  // Citation Analysis
  {
    name: 'get_work_citations',
    description:
      'Get all works that cite a given work. Essential for forward citation analysis and understanding research impact.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Work identifier (OpenAlex ID, DOI, or URL)',
        },
        page: {
          type: 'number',
          description: 'Page number for pagination',
        },
        per_page: {
          type: 'number',
          description: 'Citations per page (default: 10, max: 200)',
        },
        sort: {
          type: 'string',
          description: 'Sort by: publication_year, cited_by_count',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_work_references',
    description:
      'Get all works referenced/cited by a given work. Essential for backward citation analysis and finding foundational papers.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Work identifier (OpenAlex ID, DOI, or URL)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_citation_network',
    description:
      'Get a citation network for a work including both citing works (forward) and referenced works (backward). Returns structured data for network visualization and analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Work identifier (OpenAlex ID, DOI, or URL)',
        },
        depth: {
          type: 'number',
          description:
            'Network depth: 1 = immediate citations/references only, 2 = second-order connections (default: 1)',
        },
        max_citing: {
          type: 'number',
          description: 'Maximum number of citing works to include (default: 50)',
        },
        max_references: {
          type: 'number',
          description: 'Maximum number of referenced works to include (default: 50)',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_top_cited_works',
    description:
      'Find the most highly cited works in a research area or matching specific criteria. Identifies influential and seminal papers. Automatically filters for papers with significant citations.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query to filter works (optional)',
        },
        topic: {
          type: 'string',
          description: 'Filter by research topic',
        },
        from_year: {
          type: 'number',
          description: 'Consider works from this year onwards',
        },
        to_year: {
          type: 'number',
          description: 'Consider works up to this year',
        },
        min_citations: {
          type: 'number',
          description: 'Minimum citation count threshold (default: 50). Use higher values (e.g., 200) for only the most influential papers.',
        },
        per_page: {
          type: 'number',
          description: 'Number of top works to return (default: 10, max: 200)',
        },
      },
    },
  },

  // Author & Institution Analysis
  {
    name: 'search_authors',
    description:
      'Search for authors/researchers with filters for publication count, citations, affiliations, and more. Find experts in specific research areas.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Author name or search query',
        },
        works_count: {
          type: 'string',
          description: 'Filter by number of works. Use >X or <X. Example: ">50"',
        },
        cited_by_count: {
          type: 'string',
          description: 'Filter by citation count. Use >X or <X. Example: ">1000"',
        },
        institution: {
          type: 'string',
          description: 'Filter by institution name or ID',
        },
        per_page: {
          type: 'number',
          description: 'Results per page (default: 10, max: 200)',
        },
      },
    },
  },
  {
    name: 'get_author_works',
    description:
      "Get all publications by a specific author over time. Useful for analyzing an author's research trajectory and productivity.",
    inputSchema: {
      type: 'object',
      properties: {
        author_id: {
          type: 'string',
          description: 'Author identifier (OpenAlex ID, ORCID, or URL)',
        },
        from_year: {
          type: 'number',
          description: 'Get works from this year onwards',
        },
        to_year: {
          type: 'number',
          description: 'Get works up to this year',
        },
        sort: {
          type: 'string',
          description: 'Sort by: publication_year, cited_by_count',
        },
        per_page: {
          type: 'number',
          description: 'Works per page (default: 10, max: 200)',
        },
      },
      required: ['author_id'],
    },
  },
  {
    name: 'get_author_collaborators',
    description:
      'Analyze an author\'s co-authorship network. Returns frequent collaborators and collaboration statistics.',
    inputSchema: {
      type: 'object',
      properties: {
        author_id: {
          type: 'string',
          description: 'Author identifier (OpenAlex ID, ORCID, or URL)',
        },
        min_collaborations: {
          type: 'number',
          description: 'Minimum number of co-authored papers to include (default: 1)',
        },
      },
      required: ['author_id'],
    },
  },
  {
    name: 'search_institutions',
    description:
      'Search for academic institutions with filters for research output, citations, and geographical location. Find leading institutions in specific areas.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Institution name or search query',
        },
        country_code: {
          type: 'string',
          description: 'Filter by ISO 3166-1 alpha-2 country code (e.g., "US", "GB", "CN")',
        },
        type: {
          type: 'string',
          description: 'Institution type: education, healthcare, company, archive, nonprofit, government, facility, other',
        },
        works_count: {
          type: 'string',
          description: 'Filter by number of works. Use >X or <X',
        },
        per_page: {
          type: 'number',
          description: 'Results per page (default: 10, max: 200)',
        },
      },
    },
  },

  // Research Landscape & Trends
  {
    name: 'analyze_topic_trends',
    description:
      'Analyze publication trends over time for specific topics or queries. Returns works grouped by year to show research evolution and growth.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query or topic to analyze',
        },
        from_year: {
          type: 'number',
          description: 'Start year for trend analysis',
        },
        to_year: {
          type: 'number',
          description: 'End year for trend analysis',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'compare_research_areas',
    description:
      'Compare publication volume and citation metrics across different research topics or queries. Useful for understanding relative activity in different fields.',
    inputSchema: {
      type: 'object',
      properties: {
        topics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of topics/queries to compare (2-5 recommended)',
        },
        from_year: {
          type: 'number',
          description: 'Compare from this year onwards',
        },
        to_year: {
          type: 'number',
          description: 'Compare up to this year',
        },
      },
      required: ['topics'],
    },
  },
  {
    name: 'get_trending_topics',
    description:
      'Discover emerging and trending research topics based on recent publication activity. Identifies fast-growing research areas.',
    inputSchema: {
      type: 'object',
      properties: {
        min_works: {
          type: 'number',
          description: 'Minimum number of recent works for a topic to be considered trending (default: 100)',
        },
        time_period_years: {
          type: 'number',
          description: 'Consider works from the last N years (default: 3)',
        },
        per_page: {
          type: 'number',
          description: 'Number of trending topics to return (default: 10)',
        },
      },
    },
  },
  {
    name: 'analyze_geographic_distribution',
    description:
      'Analyze the geographical distribution of research activity for a topic or query. Shows which countries and institutions are most active.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query or topic to analyze',
        },
        from_year: {
          type: 'number',
          description: 'Analyze from this year onwards',
        },
        to_year: {
          type: 'number',
          description: 'Analyze up to this year',
        },
      },
      required: ['query'],
    },
  },

  // Entity Lookup
  {
    name: 'get_entity',
    description:
      'Get detailed information about any OpenAlex entity by ID. Supports works, authors, sources, institutions, topics, publishers, and funders.',
    inputSchema: {
      type: 'object',
      properties: {
        entity_type: {
          type: 'string',
          description: 'Type of entity',
          enum: ['works', 'authors', 'sources', 'institutions', 'topics', 'publishers', 'funders'],
        },
        id: {
          type: 'string',
          description: 'Entity identifier (OpenAlex ID, DOI, ORCID, or other supported ID)',
        },
      },
      required: ['entity_type', 'id'],
    },
  },
  {
    name: 'search_sources',
    description:
      'Search for journals, conferences, and other publication sources. Find venue information including impact metrics and open access policies.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Source name or search query',
        },
        type: {
          type: 'string',
          description: 'Source type: journal, conference, repository, ebook platform, book series',
        },
        is_oa: {
          type: 'boolean',
          description: 'Filter for open access sources only',
        },
        works_count: {
          type: 'string',
          description: 'Filter by number of works published. Use >X or <X',
        },
        per_page: {
          type: 'number',
          description: 'Results per page (default: 10, max: 200)',
        },
      },
    },
  },
  {
    name: 'health_check',
    description:
      'Check the health status of the OpenAlex MCP server and API connectivity. Returns cache status and configuration information.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Create server instance
const server = new Server(
  {
    name: 'openalex-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to build filter object
function buildFilter(params: any): FilterOptions {
  const filter: FilterOptions = {};

  // Handle publication year range
  const fromYear = params.from_publication_year || params.from_year;
  const toYear = params.to_publication_year || params.to_year;

  if (fromYear && toYear) {
    // Both from and to: use range format
    filter['publication_year'] = `${fromYear}-${toYear}`;
  } else if (fromYear) {
    // Only from: use > operator
    filter['publication_year'] = `>${fromYear - 1}`;
  } else if (toYear) {
    // Only to: use < operator
    filter['publication_year'] = `<${toYear + 1}`;
  }

  // Other filters
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

  console.error('buildFilter result:', JSON.stringify(filter));
  return filter;
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error('ListTools request received');
  console.error('Returning', tools.length, 'tools');
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.error('Tool call received:', name);
  console.error('Arguments:', JSON.stringify(args));
  console.error('Request ID:', (request as any).id || 'no-id');

  try {
    // Type assertion for args
    const params = args as any;

    switch (name) {
      case 'search_works': {
        const { searchWorksSchema } = await import('./validation.js');
        const validated = validateInput(searchWorksSchema, params, 'search_works');
        const filter = buildFilter(validated);
        const options: SearchOptions = {
          search: validated.query,
          filter,
          sort: validated.sort,
          page: validated.page || 1,
          perPage: validated.per_page || DEFAULT_PAGE_SIZE,
        };
        const results = await openAlexClient.getWorks(options);
        const summary = summarizeWorksList(results);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      }

      case 'get_work': {
        const work = await openAlexClient.getWork(params.id);
        const fullDetails = getFullWorkDetails(work);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(fullDetails, null, 2),
            },
          ],
        };
      }

      case 'get_related_works': {
        const work = await openAlexClient.getWork(params.id);
        const relatedIds = work.related_works || [];

        // Fetch related works
        const relatedWorks = [];
        const limit = Math.min(params.per_page || DEFAULT_PAGE_SIZE, relatedIds.length);
        for (let i = 0; i < limit; i++) {
          try {
            const relatedWork = await openAlexClient.getWork(relatedIds[i]);
            relatedWorks.push(summarizeWork(relatedWork));
          } catch (error) {
            // Skip if work not found
            continue;
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ related_works: relatedWorks }, null, 2),
            },
          ],
        };
      }

      case 'search_by_topic': {
        const filter = buildFilter(params);
        const options: SearchOptions = {
          search: params.topic,
          filter,
          sort: params.sort || 'relevance_score',
          perPage: params.per_page || DEFAULT_PAGE_SIZE,
        };
        const results = await openAlexClient.getWorks(options);
        const summary = summarizeWorksList(results);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      }

      case 'autocomplete_search': {
        const results = await openAlexClient.autocomplete(params.entity_type, params.query);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'get_work_citations': {
        const filter: FilterOptions = {
          'cites': params.id,
        };
        const options: SearchOptions = {
          filter,
          page: params.page || 1,
          perPage: params.per_page || DEFAULT_PAGE_SIZE,
          sort: params.sort,
        };
        const results = await openAlexClient.getWorks(options);
        const summary = summarizeWorksList(results);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      }

      case 'get_work_references': {
        const work = await openAlexClient.getWork(params.id);
        const referenceIds = work.referenced_works || [];

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                count: referenceIds.length,
                referenced_works: referenceIds,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_citation_network': {
        const work = await openAlexClient.getWork(params.id);
        const maxCiting = params.max_citing || 50;
        const maxReferences = params.max_references || 50;

        // Get citing works
        const citingFilter: FilterOptions = { 'cites': params.id };
        const citingResults = await openAlexClient.getWorks({
          filter: citingFilter,
          perPage: maxCiting,
        });

        // Get referenced works
        const referenceIds = (work.referenced_works || []).slice(0, maxReferences);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                central_work: {
                  id: work.id,
                  title: work.title,
                  publication_year: work.publication_year,
                  cited_by_count: work.cited_by_count,
                },
                citing_works: {
                  count: citingResults.meta.count,
                  works: citingResults.results.map(summarizeWork),
                },
                referenced_works: {
                  count: referenceIds.length,
                  work_ids: referenceIds,
                },
              }, null, 2),
            },
          ],
        };
      }

      case 'get_top_cited_works': {
        const filter = buildFilter(params);
        // Add default minimum citation threshold for influential papers
        const minCitations = params.min_citations !== undefined ? params.min_citations : 50;
        if (minCitations > 0) {
          filter.cited_by_count = `>${minCitations - 1}`;
        }
        const options: SearchOptions = {
          search: params.query || params.topic,
          filter,
          sort: 'cited_by_count:desc',
          perPage: params.per_page || DEFAULT_PAGE_SIZE,
        };
        const results = await openAlexClient.getWorks(options);
        const summary = summarizeWorksList(results);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      }

      case 'search_authors': {
        const filter = buildFilter(params);
        const options: SearchOptions = {
          search: params.query,
          filter,
          perPage: params.per_page || DEFAULT_PAGE_SIZE,
        };
        const results = await openAlexClient.getAuthors(options);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'get_author_works': {
        const filter: FilterOptions = {
          'authorships.author.id': params.author_id,
        };
        if (params.from_year) filter['from_publication_date'] = params.from_year;
        if (params.to_year) filter['to_publication_date'] = params.to_year;

        const options: SearchOptions = {
          filter,
          sort: params.sort,
          perPage: params.per_page || DEFAULT_PAGE_SIZE,
        };
        const results = await openAlexClient.getWorks(options);
        const summary = summarizeWorksList(results);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      }

      case 'get_author_collaborators': {
        // Get author's works
        const filter: FilterOptions = {
          'authorships.author.id': params.author_id,
        };
        const works = await openAlexClient.getWorks({
          filter,
          perPage: 200,
        });

        // Count collaborators
        const collaboratorCounts: { [key: string]: { count: number; name: string; id: string } } = {};

        for (const work of works.results) {
          if (work.authorships) {
            for (const authorship of work.authorships) {
              const coauthorId = authorship.author?.id;
              if (coauthorId && coauthorId !== params.author_id) {
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
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                author_id: params.author_id,
                total_works_analyzed: works.results.length,
                collaborators,
              }, null, 2),
            },
          ],
        };
      }

      case 'search_institutions': {
        const filter = buildFilter(params);
        const options: SearchOptions = {
          search: params.query,
          filter,
          perPage: params.per_page || DEFAULT_PAGE_SIZE,
        };
        const results = await openAlexClient.getInstitutions(options);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'analyze_topic_trends': {
        const filter = buildFilter(params);
        const options: SearchOptions = {
          search: params.query,
          filter,
          groupBy: 'publication_year',
        };
        const results = await openAlexClient.getWorks(options);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'compare_research_areas': {
        const comparisons = [];

        for (const topic of params.topics) {
          const filter = buildFilter(params);
          const options: SearchOptions = {
            search: topic,
            filter,
            perPage: 1,
          };
          const results = await openAlexClient.getWorks(options);

          comparisons.push({
            topic,
            total_works: results.meta.count,
          });
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ comparisons }, null, 2),
            },
          ],
        };
      }

      case 'get_trending_topics': {
        const currentYear = new Date().getFullYear();
        const yearsBack = params.time_period_years || 3;
        const fromYear = currentYear - yearsBack;

        const filter: FilterOptions = {
          'from_publication_date': fromYear,
        };

        const options: SearchOptions = {
          filter,
          groupBy: 'topics.id',
          perPage: params.per_page || DEFAULT_PAGE_SIZE,
        };

        const results = await openAlexClient.getWorks(options);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'analyze_geographic_distribution': {
        const filter = buildFilter(params);
        const options: SearchOptions = {
          search: params.query,
          filter,
          groupBy: 'institutions.country_code',
        };
        const results = await openAlexClient.getWorks(options);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'get_entity': {
        const entity = await openAlexClient.getEntity(params.entity_type, params.id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(entity, null, 2),
            },
          ],
        };
      }

      case 'search_sources': {
        const filter = buildFilter(params);
        const options: SearchOptions = {
          search: params.query,
          filter,
          perPage: params.per_page || DEFAULT_PAGE_SIZE,
        };
        const results = await openAlexClient.getSources(options);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'health_check': {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                api: {
                  baseUrl: CONFIG.API.BASE_URL,
                  timeout: CONFIG.API.TIMEOUT,
                  emailConfigured: !!process.env.OPENALEX_EMAIL,
                  apiKeyConfigured: !!process.env.OPENALEX_API_KEY,
                },
                cache: {
                  enabled: true,
                  size: openAlexClient.getCacheSize(),
                  maxSize: CONFIG.CACHE.MAX_SIZE,
                  ttlMs: CONFIG.CACHE.TTL_MS,
                },
                config: {
                  defaultPageSize: CONFIG.MCP.DEFAULT_PAGE_SIZE,
                  maxPageSize: CONFIG.MCP.MAX_PAGE_SIZE,
                  rateLimit: CONFIG.API.RATE_LIMIT,
                },
              }, null, 2),
            },
          ],
        };
      }

      case 'find_similar_works': {
        const { findSimilarWorksSchema } = await import('./validation.js');
        const validated = validateInput(findSimilarWorksSchema, params, 'find_similar_works');
        const filter: FilterOptions = {};

        const fromYear = validated.from_publication_year;
        const toYear = validated.to_publication_year;

        if (fromYear && toYear) {
          filter['publication_year'] = `${fromYear}-${toYear}`;
        } else if (fromYear) {
          filter['publication_year'] = `>${fromYear - 1}`;
        } else if (toYear) {
          filter['publication_year'] = `<${toYear + 1}`;
        }

        if (validated.is_oa !== undefined) {
          filter['is_oa'] = validated.is_oa;
        }

        const options: FindSimilarWorksOptions = {
          query: validated.query,
          count: validated.count,
          filter: Object.keys(filter).length > 0 ? filter : undefined,
        };
        const results = await openAlexClient.findSimilarWorks(options);

        const summarized = {
          meta: results.meta,
          results: results.results?.map((r: any) => ({
            score: r.score,
            work: summarizeWork(r.work),
          })) || [],
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summarized, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error handling tool call:', errorMessage);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');

    const errorDetails: any = {
      tool: name,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };

    if (error instanceof Error) {
      errorDetails.type = error.constructor.name;
      if (error.stack) {
        errorDetails.stack = error.stack.split('\n').slice(0, 3).join('\n');
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMessage,
            details: errorDetails,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('OpenAlex MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
