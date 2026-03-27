#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { OpenAlexClient, FilterOptions, SearchOptions } from './openalex-client.js';
import { z } from 'zod';
import { CONFIG, debug } from './config.js';
import { validateInput } from './validation.js';
import { runSetup } from './setup.js';
import { VENUE_PRESETS, INSTITUTION_GROUPS } from './presets.js';
import {
  summarizeWork, summarizeAuthor, summarizeSource,
  summarizeWorksList, getFullWorkDetails, reconstructAbstract,
} from './formatters.js';
import { buildFilter } from './filter.js';

// Handle `openalex-research-mcp setup [flags]` before starting the MCP server
if (process.argv[2] === 'setup') {
  runSetup(process.argv.slice(3)).then(() => process.exit(0)).catch(err => {
    console.error('Setup failed:', err.message);
    process.exit(1);
  });
} else {

debug('Server starting...');
debug('Email:', process.env.OPENALEX_EMAIL);
debug('API Key:', process.env.OPENALEX_API_KEY ? 'Set' : 'Not set');

// Initialize OpenAlex client
const openAlexClient = new OpenAlexClient();

// Default page size for MCP clients (can be overridden with MCP_DEFAULT_PAGE_SIZE env var)
const DEFAULT_PAGE_SIZE = parseInt(process.env.MCP_DEFAULT_PAGE_SIZE || String(CONFIG.MCP.DEFAULT_PAGE_SIZE), 10);

// Define all tools
const tools: Tool[] = [
  // Literature Search & Discovery
  {
    name: 'search_works',
    description:
      'Search scholarly works with advanced filtering. Supports Boolean operators, year ranges, citation thresholds, venue/journal filtering (source_name, source_issn, source_id), and institution filtering (author_institution, institution_group). The most flexible search tool. Use search_in_journal_list for preset journal lists like UTD24 or FT50.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query. Supports Boolean operators (AND, OR, NOT). Example: "machine learning AND (neural networks OR deep learning)"',
        },
        from_year: {
          type: 'number',
          description: 'Filter works published from this year onwards',
        },
        to_year: {
          type: 'number',
          description: 'Filter works published up to this year',
        },
        min_citations: {
          type: 'number',
          description: 'Minimum citation count. E.g., 50 for solid papers, 200 for highly influential.',
        },
        cited_by_count: {
          type: 'string',
          description: 'Citation filter with operator: ">100", "<50". Prefer min_citations for simplicity.',
        },
        source_name: {
          type: 'string',
          description: 'Filter by journal/conference name (partial match). E.g., "Nature", "NeurIPS", "Management Science".',
        },
        source_id: {
          type: 'string',
          description: 'Filter by exact OpenAlex source ID (most reliable for conferences).',
        },
        source_issn: {
          type: 'string',
          description: 'Filter by journal ISSN. E.g., "0025-1909" for Management Science.',
        },
        author_institution: {
          type: 'string',
          description: 'Filter by author institution (OpenAlex display_name). Use | for OR. E.g., "Harvard University|Stanford University|MIT".',
        },
        institution_group: {
          type: 'string',
          description: 'Named institution group preset. Use list_journal_presets to see all. E.g., harvard_stanford_mit, ivy_league, top_us, insead_london, top_global_business.',
          enum: ['harvard_stanford_mit', 'ivy_league', 'top_us', 'top_us_business', 'insead_london', 'top_global_business', 'top_china'],
        },
        is_oa: {
          type: 'boolean',
          description: 'Filter for open access works only',
        },
        type: {
          type: 'string',
          description: 'Filter by work type: article, review, book-chapter, dataset, etc.',
        },
        sort: {
          type: 'string',
          description: 'Sort: relevance_score (default), cited_by_count:desc, publication_year:desc',
        },
        page: {
          type: 'number',
          description: 'Page number for pagination (default: 1)',
        },
        per_page: {
          type: 'number',
          description: 'Results per page, max 200 (default: 10; use 20 for broader coverage)',
          maximum: 200,
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
          maximum: 200,
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'search_by_topic',
    description:
      'Search for works within specific research topics or domains. Use this to explore literature in a particular field or subfield. Supports venue filtering to restrict results to top journals/conferences.',
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
        source_name: {
          type: 'string',
          description: 'Restrict to a specific journal or conference by name (e.g., "Nature", "ICML", "PNAS")',
        },
        source_issn: {
          type: 'string',
          description: 'Restrict to a specific journal/conference by ISSN (most precise)',
        },
        min_citations: {
          type: 'number',
          description: 'Minimum citation count threshold to filter low-impact papers',
        },
        author_institution: {
          type: 'string',
          description: 'Filter by author institution (exact OpenAlex display_name). Use | for OR, e.g., "Harvard University|Stanford University"',
        },
        institution_group: {
          type: 'string',
          description: 'Named institution group preset. Options: harvard_stanford_mit, ivy_league, top_us, top_us_business, insead_london, top_global_business, top_china. Use list_journal_presets to see all.',
          enum: ['harvard_stanford_mit', 'ivy_league', 'top_us', 'top_us_business', 'insead_london', 'top_global_business', 'top_china'],
        },
        sort: {
          type: 'string',
          description: 'Sort by: cited_by_count:desc, publication_year:desc, relevance_score (default)',
        },
        per_page: {
          type: 'number',
          description: 'Results per page (default: 10, use 20 for broader coverage, max 200)',
          maximum: 200,
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
          maximum: 200,
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
      'Get a citation network for a work including both citing works (forward) and referenced works (backward). Returns immediate connections only. Citing works are returned as summaries; referenced works as IDs (use batch_resolve_references to hydrate).',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Work identifier (OpenAlex ID, DOI, or URL)',
        },
        max_citing: {
          type: 'number',
          description: 'Maximum number of citing works to include (default: 50, max: 200)',
          maximum: 200,
        },
        max_references: {
          type: 'number',
          description: 'Maximum number of referenced works to include (default: 50, max: 200)',
          maximum: 200,
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_top_cited_works',
    description:
      'Find the most highly cited works in a research area or matching specific criteria. Identifies influential and seminal papers. Automatically filters for papers with significant citations. Combine with source_name or source_issn to find the most-cited papers in a specific top journal/conference.',
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
        source_name: {
          type: 'string',
          description: 'Restrict to a specific journal or conference by name (e.g., "Nature", "NeurIPS", "ICML")',
        },
        source_issn: {
          type: 'string',
          description: 'Restrict to a specific journal/conference by ISSN (most precise)',
        },
        author_institution: {
          type: 'string',
          description: 'Filter by author institution. Use | for OR. E.g., "Harvard University|MIT"',
        },
        institution_group: {
          type: 'string',
          description: 'Named institution group: harvard_stanford_mit, ivy_league, top_us, insead_london, top_global_business, top_china',
          enum: ['harvard_stanford_mit', 'ivy_league', 'top_us', 'top_us_business', 'insead_london', 'top_global_business', 'top_china'],
        },
        per_page: {
          type: 'number',
          description: 'Number of top works to return (default: 10, use 20 for broader coverage, max: 200)',
          maximum: 200,
        },
      },
    },
  },

  // Author & Institution Analysis
  {
    name: 'search_authors',
    description:
      'Search for authors/researchers. Returns h-index, citation count, and affiliation data. Best for finding experts when you know the name. Use search_authors_by_expertise to find experts by research area.',
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
          description: 'Filter by total citation count. Use >X or <X. Example: ">1000"',
        },
        institution: {
          type: 'string',
          description: 'Filter by institution name or ID',
        },
        sort: {
          type: 'string',
          description: 'Sort results: cited_by_count:desc (default), works_count:desc, publication_year:desc',
        },
        per_page: {
          type: 'number',
          description: 'Results per page (default: 10, max: 200)',
          maximum: 200,
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
          maximum: 200,
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
          maximum: 200,
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
          description: 'Number of trending topics to return (default: 10, max: 200)',
          maximum: 200,
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
      'Search for journals, conferences, and other publication sources. Results are sorted by h-index descending by default, making it easy to identify top-tier venues. Returns h-index, impact metrics, and open access status. Use check_venue_quality for detailed metrics on a specific venue, or get_top_venues_for_field to discover the best venues in a research area.',
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
          maximum: 200,
        },
      },
    },
  },
  // ── Named preset tools ─────────────────────────────────────────────────────

  {
    name: 'list_journal_presets',
    description:
      'List all available named journal/conference presets and institution group presets. Call this first to discover which preset keys to pass to search_in_journal_list or the institution_group parameter. Presets include: UTD24, FT50, AJG/ABS 4*/4/3 tiers, top AI conferences, Management Science group, Nature/Science family, and institution groups (Ivy League, Top US, INSEAD+London, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by category: venues (journals/conferences) or institutions. Omit for all.',
          enum: ['venues', 'institutions'],
        },
      },
    },
  },

  {
    name: 'search_in_journal_list',
    description:
      'Search for papers in a named list of top journals or conferences (preset) rather than specifying individual venues. This is the main tool for credibility-gated searches. Examples: search in UTD24 journals, FT50, AJG 4*, top AI conferences. Combine with author_institution or institution_group to answer questions like "AI papers in top AI conferences by Harvard/Stanford/MIT authors".',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Topic or keyword query (e.g., "artificial intelligence", "LLMs", "supply chain")',
        },
        journal_list: {
          type: 'string',
          description: 'Preset journal list key. Use list_journal_presets to see all options. Common values: utd24, ft50, abs4star, abs4, abs3, top_ai_conferences, ms_misq_ops, nature_science, top_cs_conferences',
        },
        from_year: { type: 'number', description: 'From publication year' },
        to_year: { type: 'number', description: 'To publication year' },
        min_citations: { type: 'number', description: 'Minimum citation count (default: 0 = no filter)' },
        author_institution: {
          type: 'string',
          description: 'Only papers by authors at this institution. Single name or pipe-separated OR list. E.g., "INSEAD" or "Harvard University|Stanford University"',
        },
        institution_group: {
          type: 'string',
          description: 'Named institution group: harvard_stanford_mit, ivy_league, top_us, top_us_business, insead_london, top_global_business, top_china',
          enum: ['harvard_stanford_mit', 'ivy_league', 'top_us', 'top_us_business', 'insead_london', 'top_global_business', 'top_china'],
        },
        sort: {
          type: 'string',
          description: 'Sort: cited_by_count:desc (default), publication_year:desc, relevance_score',
        },
        per_page: { type: 'number', description: 'Results per page (default: 10, use 20 for broader coverage, max: 200)', maximum: 200 },
      },
      required: ['journal_list'],
    },
  },

  // ── New tools for top-journal research ────────────────────────────────────

  {
    name: 'search_works_in_venue',
    description:
      'Search for papers published in a specific journal or conference. This is the primary tool for restricting citations to credible, high-impact venues. Identify the venue first via check_venue_quality or search_sources, then use its name, ISSN, or ID here.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Topic or keyword query to search within the venue',
        },
        venue_name: {
          type: 'string',
          description: 'Journal/conference name (partial match). E.g., "Nature", "NeurIPS", "ICML", "PNAS", "AAAI"',
        },
        venue_issn: {
          type: 'string',
          description: 'Journal ISSN for precise identification (e.g., "0028-0836" for Nature)',
        },
        venue_id: {
          type: 'string',
          description: 'OpenAlex source ID for precise identification',
        },
        from_year: { type: 'number', description: 'From publication year' },
        to_year: { type: 'number', description: 'To publication year' },
        min_citations: { type: 'number', description: 'Minimum citation count' },
        sort: {
          type: 'string',
          description: 'Sort: cited_by_count:desc (default for credibility), publication_year:desc, relevance_score',
        },
        per_page: { type: 'number', description: 'Results per page (default: 10, use 20 for broader coverage, max 200)', maximum: 200 },
      },
    },
  },

  {
    name: 'get_top_venues_for_field',
    description:
      'Get the top journals and conferences for a specific research field ranked by h-index. Essential first step before searching for citations — use this to identify credible venues, then use search_works_in_venue to restrict searches to them.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Field or topic name (e.g., "machine learning", "climate science", "genetics")',
        },
        type: {
          type: 'string',
          description: 'Venue type: journal, conference, repository (default: journal)',
          enum: ['journal', 'conference', 'repository'],
        },
        per_page: { type: 'number', description: 'Number of venues to return (default: 10, max: 50)', maximum: 50 },
      },
      required: ['query'],
    },
  },

  {
    name: 'check_venue_quality',
    description:
      'Check the quality and prestige metrics of a journal or conference. Returns h-index, citation impact, and indexing status. Use before citing a paper to confirm the venue is reputable.',
    inputSchema: {
      type: 'object',
      properties: {
        venue_name: {
          type: 'string',
          description: 'Journal or conference name to look up',
        },
        venue_issn: {
          type: 'string',
          description: 'ISSN for precise lookup',
        },
        venue_id: {
          type: 'string',
          description: 'OpenAlex source ID',
        },
      },
    },
  },

  {
    name: 'get_author_profile',
    description:
      'Get a comprehensive research profile for an author: h-index, i10-index, total citations, top-cited works, recent works, and main research topics. Use this to identify key researchers, potential reviewers, or to study an expert\'s body of work.',
    inputSchema: {
      type: 'object',
      properties: {
        author_id: {
          type: 'string',
          description: 'Author identifier: OpenAlex ID (A1234), ORCID (0000-0001-2345-6789), or full URL',
        },
        top_works_count: {
          type: 'number',
          description: 'Number of top-cited works to return (default: 5)',
        },
        recent_works_count: {
          type: 'number',
          description: 'Number of recent works to return (default: 5)',
        },
      },
      required: ['author_id'],
    },
  },

  {
    name: 'search_authors_by_expertise',
    description:
      'Find leading researchers/experts in a specific topic or research area, ranked by h-index or citation count. More useful than search_authors when you do not know names but need to identify key figures in a field.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Research topic or field (e.g., "transformer models", "CRISPR gene editing")',
        },
        min_h_index: {
          type: 'number',
          description: 'Minimum h-index to filter senior researchers (e.g., 20 for established researchers)',
        },
        min_cited_by_count: {
          type: 'number',
          description: 'Minimum total citations (alternative to min_h_index)',
        },
        institution: {
          type: 'string',
          description: 'Filter by institution',
        },
        per_page: { type: 'number', description: 'Results per page (default: 10, max: 50)', maximum: 50 },
      },
      required: ['topic'],
    },
  },

  {
    name: 'find_review_articles',
    description:
      'Find review articles, systematic reviews, and meta-analyses on a topic. Reviews summarize the state-of-the-art and are high-value citations that establish context in top papers. Optionally restrict to specific high-impact journals.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Topic or research question',
        },
        from_year: { type: 'number', description: 'From year' },
        to_year: { type: 'number', description: 'To year' },
        source_name: {
          type: 'string',
          description: 'Restrict to a specific journal (e.g., "Nature Reviews", "Annual Review")',
        },
        min_citations: {
          type: 'number',
          description: 'Minimum citations (default: 10; use 50+ for highly-cited reviews)',
        },
        per_page: { type: 'number', description: 'Results per page (default: 10, max: 50)', maximum: 50 },
      },
      required: ['query'],
    },
  },

  {
    name: 'find_seminal_papers',
    description:
      'Find seminal/foundational papers in a research area — those published more than 5 years ago with very high citations. These are the "must-cite" papers that establish the intellectual lineage of a field. Use to identify citations that reviewers expect to see.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Research topic or concept',
        },
        min_citations: {
          type: 'number',
          description: 'Minimum citation count (default: 200 since these are foundational papers)',
        },
        published_before: {
          type: 'number',
          description: 'Only papers published before this year (default: current year - 5)',
        },
        source_name: {
          type: 'string',
          description: 'Restrict to a specific venue (e.g., "Nature", "Science", "NeurIPS")',
        },
        per_page: { type: 'number', description: 'Results per page (default: 10, max: 50)', maximum: 50 },
      },
      required: ['query'],
    },
  },

  {
    name: 'batch_resolve_references',
    description:
      'Resolve a list of DOIs or work IDs to full work metadata in one call. Useful for checking reference lists: validate that a set of citations are real, credible, and appropriately cited.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of DOIs (e.g., "10.1038/nature12373") or OpenAlex IDs (e.g., "W2741809807"). Max 20 per call.',
        },
      },
      required: ['ids'],
    },
  },

  {
    name: 'find_open_access_version',
    description:
      'Find freely available (open access) versions of papers, including preprints on arXiv, bioRxiv, and institutional repositories. Useful for accessing full text without a subscription.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Topic query to find OA papers on',
        },
        from_year: { type: 'number', description: 'From publication year' },
        source_name: {
          type: 'string',
          description: 'Optional: restrict to a specific venue',
        },
        min_citations: { type: 'number', description: 'Minimum citation count' },
        per_page: { type: 'number', description: 'Results per page (default: 10, max: 50)', maximum: 50 },
      },
      required: ['query'],
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
    version: '0.4.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  debug('ListTools:', tools.length, 'tools');
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  debug('Tool call:', name, JSON.stringify(args));

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

        // Fetch related works in parallel
        const limit = Math.min(params.per_page || DEFAULT_PAGE_SIZE, relatedIds.length);
        const relatedResults = await Promise.allSettled(
          relatedIds.slice(0, limit).map((id: string) => openAlexClient.getWork(id))
        );
        const relatedWorks = relatedResults
          .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
          .map(r => summarizeWork(r.value));

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
          sort: params.sort || 'cited_by_count:desc',
          perPage: params.per_page || DEFAULT_PAGE_SIZE,
        };
        const results = await openAlexClient.getAuthors(options);
        const authorSummary = {
          meta: {
            count: results.meta?.count,
            page: results.meta?.page,
            per_page: results.meta?.per_page
          },
          results: results.results.map(summarizeAuthor)
        };
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(authorSummary, null, 2),
            },
          ],
        };
      }

      case 'get_author_works': {
        const filter: FilterOptions = {
          'authorships.author.id': params.author_id,
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
        // Paginate through author's works to handle prolific authors
        const authorFilter: FilterOptions = {
          'authorships.author.id': params.author_id,
        };
        const pageSize = CONFIG.MCP.MAX_PAGE_SIZE; // 200
        let allWorks: any[] = [];
        let page = 1;
        const maxPages = 5; // Cap at 1000 works to avoid excessive API calls

        while (page <= maxPages) {
          const batch = await openAlexClient.getWorks({
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
                total_works_analyzed: allWorks.length,
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
          'publication_year': `>${fromYear - 1}`,
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
          sort: 'summary_stats.h_index:desc',
          perPage: params.per_page || DEFAULT_PAGE_SIZE,
        };
        const results = await openAlexClient.getSources(options);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                meta: { count: results.meta?.count, page: results.meta?.page, per_page: results.meta?.per_page },
                sources: results.results.map(summarizeSource)
              }, null, 2),
            },
          ],
        };
      }

      // ── Named preset handlers ──────────────────────────────────────────────

      case 'list_journal_presets': {
        const includeVenues = !params.category || params.category === 'venues';
        const includeInstitutions = !params.category || params.category === 'institutions';

        const response: any = {};

        if (includeVenues) {
          response.journal_and_conference_presets = Object.entries(VENUE_PRESETS).map(([key, p]) => ({
            key,
            name: p.name,
            description: p.description,
            venue_count: (p.issns?.length ?? 0) + (p.source_names?.length ?? 0),
            filter_type: p.issns ? 'issn' : 'display_name',
            note: p.note ?? null,
          }));
        }

        if (includeInstitutions) {
          response.institution_group_presets = Object.entries(INSTITUTION_GROUPS).map(([key, g]) => ({
            key,
            name: g.name,
            description: g.description,
            institutions: g.institutions,
          }));
        }

        response.usage = {
          search_in_journal_list: 'Pass a preset key as journal_list parameter',
          institution_filter: 'Pass a preset key as institution_group, or a pipe-separated list as author_institution',
          examples: [
            'search_in_journal_list(query="artificial intelligence", journal_list="utd24")',
            'search_in_journal_list(query="LLMs", journal_list="top_ai_conferences", institution_group="harvard_stanford_mit")',
            'search_in_journal_list(query="AI", journal_list="ft50", from_year=2020, min_citations=50)',
            'search_works(query="AI", institution_group="insead_london")',
          ],
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
        };
      }

      case 'search_in_journal_list': {
        const preset = VENUE_PRESETS[params.journal_list];

        if (!preset) {
          const available = Object.keys(VENUE_PRESETS).join(', ');
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: `Unknown journal_list preset: "${params.journal_list}"`,
                available_presets: available,
                tip: 'Call list_journal_presets to see all options with descriptions.',
              }, null, 2),
            }],
          };
        }

        const filter: FilterOptions = {};

        // ── Venue filter ──────────────────────────────────────────────────
        if (preset.issns && preset.issns.length > 0) {
          // Journals: filter by ISSN (reliable, exact match with OR)
          filter['primary_location.source.issn'] = preset.issns.join('|');
        } else if (preset.source_names && preset.source_names.length > 0) {
          // Conferences: filter by display_name search (fuzzy match for long names)
          filter['primary_location.source.display_name.search'] = preset.source_names.join('|');
        }

        // ── Institution filter ────────────────────────────────────────────
        if (params.institution_group) {
          const group = INSTITUTION_GROUPS[params.institution_group];
          if (group) {
            filter['authorships.institutions.display_name'] = group.institutions.join('|');
          }
        } else if (params.author_institution) {
          filter['authorships.institutions.display_name'] = params.author_institution;
        }

        // ── Year range ────────────────────────────────────────────────────
        if (params.from_year && params.to_year) {
          filter['publication_year'] = `${params.from_year}-${params.to_year}`;
        } else if (params.from_year) {
          filter['publication_year'] = `>${params.from_year - 1}`;
        } else if (params.to_year) {
          filter['publication_year'] = `<${params.to_year + 1}`;
        }

        // ── Citation threshold ────────────────────────────────────────────
        if (params.min_citations !== undefined && params.min_citations > 0) {
          filter['cited_by_count'] = `>${params.min_citations - 1}`;
        }

        const options: SearchOptions = {
          search: params.query,
          filter,
          sort: params.sort || 'cited_by_count:desc',
          perPage: params.per_page || DEFAULT_PAGE_SIZE,
        };

        const results = await openAlexClient.getWorks(options);
        const summary = summarizeWorksList(results);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              preset_used: { key: params.journal_list, name: preset.name },
              institution_filter: params.institution_group
                ? INSTITUTION_GROUPS[params.institution_group]?.name
                : (params.author_institution ?? null),
              ...summary,
            }, null, 2),
          }],
        };
      }

      // ── New handlers ──────────────────────────────────────────────────────

      case 'search_works_in_venue': {
        const filter: FilterOptions = {};

        // Venue identification (in priority order: ID > ISSN > name)
        if (params.venue_id) {
          filter['primary_location.source.id'] = params.venue_id;
        } else if (params.venue_issn) {
          filter['primary_location.source.issn'] = params.venue_issn;
        } else if (params.venue_name) {
          filter['primary_location.source.display_name.search'] = params.venue_name;
        }

        // Year range
        if (params.from_year && params.to_year) {
          filter['publication_year'] = `${params.from_year}-${params.to_year}`;
        } else if (params.from_year) {
          filter['publication_year'] = `>${params.from_year - 1}`;
        } else if (params.to_year) {
          filter['publication_year'] = `<${params.to_year + 1}`;
        }

        if (params.min_citations !== undefined && params.min_citations > 0) {
          filter['cited_by_count'] = `>${params.min_citations - 1}`;
        }

        const options: SearchOptions = {
          search: params.query,
          filter,
          sort: params.sort || 'cited_by_count:desc',
          perPage: params.per_page || DEFAULT_PAGE_SIZE,
        };
        const results = await openAlexClient.getWorks(options);
        const summary = summarizeWorksList(results);
        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        };
      }

      case 'get_top_venues_for_field': {
        const venueType = params.type || 'journal';
        const options: SearchOptions = {
          search: params.query,
          filter: { 'type': venueType },
          sort: 'summary_stats.h_index:desc',
          perPage: Math.min(params.per_page || DEFAULT_PAGE_SIZE, 50),
        };
        const results = await openAlexClient.getSources(options);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              meta: { count: results.meta?.count, query: params.query, type: venueType },
              venues: results.results.map(summarizeSource)
            }, null, 2)
          }],
        };
      }

      case 'check_venue_quality': {
        // Try to find the venue by ISSN, ID, or name search
        let venueData: any = null;

        if (params.venue_id) {
          venueData = await openAlexClient.getEntity('sources', params.venue_id);
        } else {
          const filter: FilterOptions = params.venue_issn
            ? { 'issn': params.venue_issn }
            : {};

          const results = await openAlexClient.getSources({
            search: params.venue_issn ? undefined : params.venue_name,
            filter: params.venue_issn ? filter : {},
            perPage: 5,
            sort: 'summary_stats.h_index:desc',
          });

          if (results.results.length > 0) {
            venueData = results.results[0];
          }
        }

        if (!venueData) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'Venue not found. Try a different name, ISSN, or ID.' }) }],
          };
        }

        const quality = {
          ...summarizeSource(venueData),
          // Additional quality signals
          apc_usd: venueData.apc_usd ?? null,
          apc_prices: venueData.apc_prices ?? null,
          societies: venueData.societies ?? [],
          homepage_url: venueData.homepage_url ?? null,
          issn: venueData.issn ?? [],
          issn_l: venueData.issn_l ?? null,
        };
        return {
          content: [{ type: 'text', text: JSON.stringify(quality, null, 2) }],
        };
      }

      case 'get_author_profile': {
        const author = await openAlexClient.getAuthor(params.author_id);
        const topWorksCount = params.top_works_count || 5;
        const recentWorksCount = params.recent_works_count || 5;

        // Fetch top-cited works
        const topWorksResult = await openAlexClient.getWorks({
          filter: { 'authorships.author.id': params.author_id },
          sort: 'cited_by_count:desc',
          perPage: topWorksCount,
        });

        // Fetch recent works
        const recentWorksResult = await openAlexClient.getWorks({
          filter: { 'authorships.author.id': params.author_id },
          sort: 'publication_year:desc',
          perPage: recentWorksCount,
        });

        const profile = {
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
        return {
          content: [{ type: 'text', text: JSON.stringify(profile, null, 2) }],
        };
      }

      case 'search_authors_by_expertise': {
        const filter: FilterOptions = {};
        if (params.institution) filter['institutions.display_name'] = params.institution;
        if (params.min_cited_by_count) filter['cited_by_count'] = `>${params.min_cited_by_count - 1}`;
        // h-index filter is via summary_stats
        if (params.min_h_index) filter['summary_stats.h_index'] = `>${params.min_h_index - 1}`;

        const options: SearchOptions = {
          search: params.topic,
          filter,
          sort: 'summary_stats.h_index:desc',
          perPage: Math.min(params.per_page || DEFAULT_PAGE_SIZE, 50),
        };
        const results = await openAlexClient.getAuthors(options);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              meta: { count: results.meta?.count, topic: params.topic },
              experts: results.results.map(summarizeAuthor)
            }, null, 2)
          }],
        };
      }

      case 'find_review_articles': {
        const filter: FilterOptions = { 'type': 'review' };
        if (params.source_name) {
          filter['primary_location.source.display_name.search'] = params.source_name;
        }
        if (params.from_year && params.to_year) {
          filter['publication_year'] = `${params.from_year}-${params.to_year}`;
        } else if (params.from_year) {
          filter['publication_year'] = `>${params.from_year - 1}`;
        } else if (params.to_year) {
          filter['publication_year'] = `<${params.to_year + 1}`;
        }
        const minCit = params.min_citations !== undefined ? params.min_citations : 10;
        if (minCit > 0) filter['cited_by_count'] = `>${minCit - 1}`;

        const options: SearchOptions = {
          search: params.query,
          filter,
          sort: 'cited_by_count:desc',
          perPage: Math.min(params.per_page || DEFAULT_PAGE_SIZE, 50),
        };
        const results = await openAlexClient.getWorks(options);
        return {
          content: [{ type: 'text', text: JSON.stringify(summarizeWorksList(results), null, 2) }],
        };
      }

      case 'find_seminal_papers': {
        const currentYear = new Date().getFullYear();
        const publishedBefore = params.published_before || (currentYear - 5);
        const minCit = params.min_citations !== undefined ? params.min_citations : 200;

        const filter: FilterOptions = {
          'publication_year': `<${publishedBefore + 1}`,
        };
        if (minCit > 0) filter['cited_by_count'] = `>${minCit - 1}`;
        if (params.source_name) {
          filter['primary_location.source.display_name.search'] = params.source_name;
        }

        const options: SearchOptions = {
          search: params.query,
          filter,
          sort: 'cited_by_count:desc',
          perPage: Math.min(params.per_page || DEFAULT_PAGE_SIZE, 50),
        };
        const results = await openAlexClient.getWorks(options);
        return {
          content: [{ type: 'text', text: JSON.stringify(summarizeWorksList(results), null, 2) }],
        };
      }

      case 'batch_resolve_references': {
        const ids: string[] = (params.ids || []).slice(0, 20);
        const results = await Promise.allSettled(
          ids.map(id => openAlexClient.getWork(id))
        );
        const resolved = results.map((r, i) =>
          r.status === 'fulfilled'
            ? summarizeWork(r.value)
            : { id: ids[i], error: 'Not found or invalid ID' }
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              requested: ids.length,
              resolved: resolved.filter((r: any) => !r.error).length,
              results: resolved
            }, null, 2)
          }],
        };
      }

      case 'find_open_access_version': {
        const filter: FilterOptions = { 'is_oa': true };
        if (params.source_name) {
          filter['primary_location.source.display_name.search'] = params.source_name;
        }
        if (params.from_year) filter['publication_year'] = `>${params.from_year - 1}`;
        if (params.min_citations !== undefined && params.min_citations > 0) {
          filter['cited_by_count'] = `>${params.min_citations - 1}`;
        }

        const options: SearchOptions = {
          search: params.query,
          filter,
          sort: 'cited_by_count:desc',
          perPage: Math.min(params.per_page || DEFAULT_PAGE_SIZE, 50),
        };
        const results = await openAlexClient.getWorks(options);
        // Enrich with OA URL info
        const summary = summarizeWorksList(results);
        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
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

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Log full details to stderr for debugging; keep client response clean
    console.error(`[openalex] Error in ${name}:`, errorMessage);
    if (error instanceof Error && error.stack) {
      debug('Stack:', error.stack);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: errorMessage,
            tool: name,
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
  debug('Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
}
