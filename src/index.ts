#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { OpenAlexClient, FilterOptions, SearchOptions } from './openalex-client.js';

// Debug logging
console.error('OpenAlex MCP Server starting...');
console.error('Email:', process.env.OPENALEX_EMAIL);
console.error('API Key:', process.env.OPENALEX_API_KEY ? 'Set' : 'Not set');

// Initialize OpenAlex client
const openAlexClient = new OpenAlexClient();

// Define all tools
const tools: Tool[] = [
  // Literature Search & Discovery
  {
    name: 'search_works',
    description:
      'Search for scholarly works (papers, articles, books) with advanced filtering. Supports Boolean operators (AND, OR, NOT), publication year ranges, citation counts, and more. Essential for finding relevant literature.',
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
          description: 'Results per page, max 200 (default: 25)',
        },
      },
    },
  },
  {
    name: 'get_work',
    description:
      'Get detailed information about a specific work by OpenAlex ID or DOI. Returns full metadata including title, authors, abstract, citations, references, and more.',
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
          description: 'Number of related works to return (default: 25, max: 200)',
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
          description: 'Results per page (default: 25, max: 200)',
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
          description: 'Citations per page (default: 25, max: 200)',
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
      'Find the most highly cited works in a research area or matching specific criteria. Identifies influential and seminal papers.',
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
        per_page: {
          type: 'number',
          description: 'Number of top works to return (default: 25, max: 200)',
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
          description: 'Results per page (default: 25, max: 200)',
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
          description: 'Works per page (default: 25, max: 200)',
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
          description: 'Results per page (default: 25, max: 200)',
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
          description: 'Number of trending topics to return (default: 25)',
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
          description: 'Results per page (default: 25, max: 200)',
        },
      },
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

  // Map common parameters to OpenAlex filter format
  if (params.from_publication_year) {
    filter['from_publication_date'] = params.from_publication_year;
  }
  if (params.to_publication_year) {
    filter['to_publication_date'] = params.to_publication_year;
  }
  if (params.from_year) {
    filter['from_publication_date'] = params.from_year;
  }
  if (params.to_year) {
    filter['to_publication_date'] = params.to_year;
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

  try {
    // Type assertion for args
    const params = args as any;

    switch (name) {
      case 'search_works': {
        const filter = buildFilter(params);
        const options: SearchOptions = {
          search: params.query,
          filter,
          sort: params.sort,
          page: params.page || 1,
          perPage: params.per_page || 25,
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

      case 'get_work': {
        const work = await openAlexClient.getWork(params.id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(work, null, 2),
            },
          ],
        };
      }

      case 'get_related_works': {
        const work = await openAlexClient.getWork(params.id);
        const relatedIds = work.related_works || [];

        // Fetch related works
        const relatedWorks = [];
        const limit = Math.min(params.per_page || 25, relatedIds.length);
        for (let i = 0; i < limit; i++) {
          try {
            const relatedWork = await openAlexClient.getWork(relatedIds[i]);
            relatedWorks.push(relatedWork);
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
        const filter = buildFilter(args);
        const options: SearchOptions = {
          search: params.topic,
          filter,
          sort: params.sort || 'relevance_score',
          perPage: params.per_page || 25,
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
          perPage: params.per_page || 25,
          sort: params.sort,
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
                  works: citingResults.results,
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
        const filter = buildFilter(args);
        const options: SearchOptions = {
          search: params.query,
          filter,
          sort: 'cited_by_count:desc',
          perPage: params.per_page || 25,
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

      case 'search_authors': {
        const filter = buildFilter(args);
        const options: SearchOptions = {
          search: params.query,
          filter,
          perPage: params.per_page || 25,
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
          perPage: params.per_page || 25,
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
        const filter = buildFilter(args);
        const options: SearchOptions = {
          search: params.query,
          filter,
          perPage: params.per_page || 25,
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
        const filter = buildFilter(args);
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
          const filter = buildFilter(args);
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
          perPage: params.per_page || 25,
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
        const filter = buildFilter(args);
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
        const filter = buildFilter(args);
        const options: SearchOptions = {
          search: params.query,
          filter,
          perPage: params.per_page || 25,
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

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error handling tool call:', errorMessage);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
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
