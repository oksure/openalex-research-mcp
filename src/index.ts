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

// ─────────────────────────────────────────────────────────────────────────────
// VENUE PRESETS — curated journal & conference lists by academic ranking system
// ISSNs are used for journals (exact matches via | OR filter in OpenAlex).
// source_names are used for conferences (display_name OR filter).
// These lists match the official rankings as of 2025/2026.
// ─────────────────────────────────────────────────────────────────────────────
const VENUE_PRESETS: Record<string, {
  name: string;
  description: string;
  issns?: string[];
  source_names?: string[];
  note?: string;
}> = {

  // ── UT Dallas 24 (UTD) ─────────────────────────────────────────────────────
  // Official list maintained by UT Dallas Jindal School of Management.
  // Used for ranking business school research productivity worldwide.
  'utd24': {
    name: 'UT Dallas 24 (UTD)',
    description: 'Official UT Dallas journal list used for global business school research rankings',
    issns: [
      '0001-4826', // The Accounting Review
      '0001-8392', // Administrative Science Quarterly
      '0011-7315', // Decision Sciences
      '1042-2587', // Entrepreneurship Theory and Practice
      '0090-4848', // Human Resource Management
      '1047-7047', // Information Systems Research
      '0165-4101', // Journal of Accounting and Economics
      '0021-8456', // Journal of Accounting Research
      '0167-4544', // Journal of Business Ethics
      '0883-9026', // Journal of Business Venturing
      '1057-7408', // Journal of Consumer Psychology
      '0093-5301', // Journal of Consumer Research
      '0022-1082', // Journal of Finance
      '0022-1090', // Journal of Financial and Quantitative Analysis
      '0304-405X', // Journal of Financial Economics
      '0047-2506', // Journal of International Business Studies
      '0149-2063', // Journal of Management
      '0742-1222', // Journal of Management Information Systems
      '0022-2380', // Journal of Management Studies
      '0022-2429', // Journal of Marketing
      '0022-2437', // Journal of Marketing Research
      '0272-6963', // Journal of Operations Management
      '0022-3808', // Journal of Political Economy
      '0022-4359', // Journal of Retailing
      '0276-7783', // MIS Quarterly
      '0025-1909', // Management Science
      '1523-4614', // Manufacturing and Service Operations Management (M&SOM)
      '0732-2399', // Marketing Science
      '0030-364X', // Operations Research
      '1047-7039', // Organization Science
      '1059-1478', // Production and Operations Management
      '1380-6653', // Review of Accounting Studies
      '0893-9454', // Review of Financial Studies
      '0143-2095', // Strategic Management Journal
    ],
  },

  // ── Financial Times 50 (FT50) ──────────────────────────────────────────────
  // Used by the Financial Times in their global MBA and business school rankings.
  'ft50': {
    name: 'FT50 Journals',
    description: 'Financial Times 50 journals — used for FT global MBA/business school rankings',
    issns: [
      '0001-4826', // The Accounting Review
      '0361-3682', // Accounting, Organizations and Society
      '0001-8392', // Administrative Science Quarterly
      '0002-8282', // American Economic Review
      '0823-9150', // Contemporary Accounting Research
      '0011-7315', // Decision Sciences
      '0012-9682', // Econometrica
      '1042-2587', // Entrepreneurship Theory and Practice
      '0018-7267', // Human Relations
      '0090-4848', // Human Resource Management
      '1047-7047', // Information Systems Research
      '0165-4101', // Journal of Accounting and Economics
      '0021-8456', // Journal of Accounting Research
      '0021-9010', // Journal of Applied Psychology
      '0167-4544', // Journal of Business Ethics
      '0883-9026', // Journal of Business Venturing
      '1057-7408', // Journal of Consumer Psychology
      '0093-5301', // Journal of Consumer Research
      '1058-6407', // Journal of Economics and Management Strategy
      '0022-1082', // Journal of Finance
      '0022-1090', // Journal of Financial and Quantitative Analysis
      '0304-405X', // Journal of Financial Economics
      '0047-2506', // Journal of International Business Studies
      '0149-2063', // Journal of Management
      '0742-1222', // Journal of Management Information Systems
      '0022-2380', // Journal of Management Studies
      '0022-2429', // Journal of Marketing
      '0022-2437', // Journal of Marketing Research
      '0272-6963', // Journal of Operations Management
      '0022-3808', // Journal of Political Economy
      '0022-4359', // Journal of Retailing
      '0092-0703', // Journal of the Academy of Marketing Science
      '0276-7783', // MIS Quarterly
      '0025-1909', // Management Science
      '1523-4614', // Manufacturing and Service Operations Management (M&SOM)
      '0732-2399', // Marketing Science
      '0030-364X', // Operations Research
      '1047-7039', // Organization Science
      '0170-8406', // Organization Studies
      '1059-1478', // Production and Operations Management
      '0033-5533', // Quarterly Journal of Economics
      '0741-6261', // Rand Journal of Economics
      '0048-7333', // Research Policy
      '1380-6653', // Review of Accounting Studies
      '0034-6527', // Review of Economic Studies
      '1572-3097', // Review of Finance
      '0893-9454', // Review of Financial Studies
      '1532-9194', // Sloan Management Review (MIT SMR)
      '0143-2095', // Strategic Management Journal
      '0734-306X', // Journal of Labor Economics
      '0008-1256', // California Management Review
    ],
  },

  // ── AJG / ABS 4* ────────────────────────────────────────────────────────────
  // Chartered Association of Business Schools (CABS) Academic Journal Guide.
  // 4* = "World Elite" — the very top journals every field considers flagship.
  'abs4star': {
    name: 'AJG/ABS 4* (World Elite)',
    description: 'Chartered ABS Academic Journal Guide 4* — world elite journals, the most prestigious tier',
    issns: [
      '0001-8392', // Administrative Science Quarterly
      '0002-8282', // American Economic Review
      '0012-9682', // Econometrica
      '0021-9010', // Journal of Applied Psychology
      '1057-7408', // Journal of Consumer Psychology
      '0093-5301', // Journal of Consumer Research
      '0022-1082', // Journal of Finance
      '0304-405X', // Journal of Financial Economics
      '0149-2063', // Journal of Management
      '0022-2429', // Journal of Marketing
      '0276-7783', // MIS Quarterly
      '0025-1909', // Management Science
      '0030-364X', // Operations Research
      '1047-7039', // Organization Science
      '0022-3808', // Journal of Political Economy
      '0033-5533', // Quarterly Journal of Economics
      '0741-6261', // Rand Journal of Economics
      '0034-6527', // Review of Economic Studies
      '0893-9454', // Review of Financial Studies
      '0143-2095', // Strategic Management Journal
      '0022-2380', // Journal of Management Studies
      '0047-2506', // Journal of International Business Studies
      '1047-7047', // Information Systems Research
      '0165-4101', // Journal of Accounting and Economics
    ],
    note: 'Representative 4* journals. The full AJG list covers 100+ categories — add ISSNs for your specific subfield.',
  },

  // ── AJG / ABS 4 ─────────────────────────────────────────────────────────────
  // Top international journals — excellent quality, below only the 4* elite.
  'abs4': {
    name: 'AJG/ABS 4 (Top International)',
    description: 'ABS Academic Journal Guide 4 — top international journals, excellent quality',
    issns: [
      '0001-4826', // The Accounting Review
      '0823-9150', // Contemporary Accounting Research
      '0011-7315', // Decision Sciences
      '1042-2587', // Entrepreneurship Theory and Practice
      '0018-7267', // Human Relations
      '0090-4848', // Human Resource Management
      '0021-8456', // Journal of Accounting Research
      '0167-4544', // Journal of Business Ethics
      '0883-9026', // Journal of Business Venturing
      '0022-1090', // Journal of Financial and Quantitative Analysis
      '0742-1222', // Journal of Management Information Systems
      '0022-2437', // Journal of Marketing Research
      '0272-6963', // Journal of Operations Management
      '0022-4359', // Journal of Retailing
      '1523-4614', // M&SOM
      '0732-2399', // Marketing Science
      '0170-8406', // Organization Studies
      '1059-1478', // Production and Operations Management
      '0048-7333', // Research Policy
      '1380-6653', // Review of Accounting Studies
      '1572-3097', // Review of Finance
      '0165-4101', // Journal of Accounting and Economics
      '0092-0703', // Journal of the Academy of Marketing Science
      '1058-6407', // Journal of Economics and Management Strategy
      '0361-3682', // Accounting, Organizations and Society
      '0734-306X', // Journal of Labor Economics
    ],
    note: 'Representative AJG 4 journals. The full AJG list covers 100+ categories.',
  },

  // ── AJG / ABS 3 ─────────────────────────────────────────────────────────────
  // Internationally recognised journals — strong quality, good citation impact.
  'abs3': {
    name: 'AJG/ABS 3 (Internationally Recognised)',
    description: 'ABS Academic Journal Guide 3 — internationally recognised, solid quality journals',
    issns: [
      '0008-1256', // California Management Review
      '1532-9194', // Sloan Management Review (MIT SMR)
      '0017-8012', // Harvard Business Review
      '0022-2399', // Journal of Retailing and Consumer Services
      '1462-8732', // Strategic Organization
      '0925-5273', // International Journal of Production Economics
      '0969-7012', // British Journal of Management
      '0263-2373', // European Journal of Operational Research (some rate this higher)
      '0305-0483', // Omega
      '1366-4387', // Venture Capital
      '0148-2963', // Journal of Business Research
      '1059-1478', // Production and Operations Management (some rate 4)
      '0020-7543', // International Journal of Production Research
      '1757-5818', // Journal of Supply Chain Management
    ],
    note: 'Representative AJG 3 journals. The AJG 3 tier has 500+ journals — these are key examples across business disciplines.',
  },

  // ── Management Science + Operations Journals ────────────────────────────────
  // Specific combo often used in business analytics / operations research
  'ms_misq_ops': {
    name: 'Management Science + IS + Operations Core',
    description: 'Management Science, M&SOM, MIS Quarterly, ISR, JMIS, Operations Research, POM — the core quant-methods journals in business',
    issns: [
      '0025-1909', // Management Science
      '1523-4614', // Manufacturing and Service Operations Management (M&SOM)
      '0276-7783', // MIS Quarterly
      '1047-7047', // Information Systems Research
      '0742-1222', // Journal of Management Information Systems
      '0030-364X', // Operations Research
      '1059-1478', // Production and Operations Management
      '0272-6963', // Journal of Operations Management
      '0732-2399', // Marketing Science
    ],
  },

  // ── Top AI Conferences ──────────────────────────────────────────────────────
  // Used by ML/AI researchers — these proceedings are where the field moves.
  'top_ai_conferences': {
    name: 'Top AI Conferences',
    description: 'Leading AI/ML conference proceedings: NeurIPS, ICML, ICLR, AAAI, CVPR, ICCV, ECCV, ACL, EMNLP, KDD, IJCAI',
    source_names: [
      'Advances in Neural Information Processing Systems',   // NeurIPS
      'International Conference on Machine Learning',        // ICML
      'International Conference on Learning Representations',// ICLR
      'Proceedings of the AAAI Conference on Artificial Intelligence', // AAAI
      'IEEE/CVF Conference on Computer Vision and Pattern Recognition', // CVPR
      'International Conference on Computer Vision',         // ICCV
      'European Conference on Computer Vision',              // ECCV
      'Proceedings of the Annual Meeting of the Association for Computational Linguistics', // ACL
      'Proceedings of the Conference on Empirical Methods in Natural Language Processing',  // EMNLP
      'Proceedings of the ACM SIGKDD Conference on Knowledge Discovery and Data Mining',    // KDD
      'International Joint Conference on Artificial Intelligence', // IJCAI
      'The Web Conference',                                   // WWW
    ],
    note: 'Conference names match OpenAlex display_name. If a conference is missing, look it up via search_sources.',
  },

  // ── Top CS/Systems Conferences ─────────────────────────────────────────────
  'top_cs_conferences': {
    name: 'Top CS Systems & HCI Conferences',
    description: 'Top systems, HCI, and networking conferences: SOSP, OSDI, SIGCOMM, CHI, UIST, VLDB, SIGMOD, PLDI, POPL',
    source_names: [
      'Symposium on Operating Systems Principles',
      'USENIX Symposium on Operating Systems Design and Implementation',
      'ACM SIGCOMM Conference',
      'Proceedings of the ACM CHI Conference on Human Factors in Computing Systems',
      'UIST',
      'Proceedings of the VLDB Endowment',
      'International Conference on Management of Data',
      'Programming Language Design and Implementation',
      'Principles of Programming Languages',
    ],
  },

  // ── Nature / Science family ─────────────────────────────────────────────────
  'nature_science': {
    name: 'Nature & Science Family',
    description: 'Nature, Science, and their branded sub-journals — highest prestige multidisciplinary outlets',
    issns: [
      '0028-0836', // Nature
      '0036-8075', // Science
      '1745-2473', // Nature Physics
      '1745-2481', // Nature Chemistry (wait, Nature Chemistry is 1755-4330)
      '2041-1723', // Nature Communications
      '1755-4330', // Nature Chemistry
      '1087-0156', // Nature Biotechnology
      '1548-7091', // Nature Methods
      '1476-4687', // Nature (online)
      '2052-4463', // Scientific Data
    ],
    note: 'Core Nature/Science family. Sub-journal ISSNs vary — verify via check_venue_quality for specific sub-journals.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// INSTITUTION GROUPS — named presets for filtering by author affiliation.
// Institution names match OpenAlex display_name (case-insensitive exact match).
// Use | separator for OR across multiple institutions in one API call.
// ─────────────────────────────────────────────────────────────────────────────
const INSTITUTION_GROUPS: Record<string, {
  name: string;
  description: string;
  institutions: string[];
}> = {
  'harvard_stanford_mit': {
    name: 'Harvard / Stanford / MIT',
    description: 'Big Three US research universities',
    institutions: ['Harvard University', 'Stanford University', 'Massachusetts Institute of Technology'],
  },
  'ivy_league': {
    name: 'Ivy League',
    description: 'All eight Ivy League universities',
    institutions: [
      'Harvard University', 'Yale University', 'Princeton University',
      'Columbia University', 'University of Pennsylvania', 'Brown University',
      'Dartmouth College', 'Cornell University',
    ],
  },
  'top_us': {
    name: 'Top US Research Universities',
    description: 'Top 10 US research universities by research output',
    institutions: [
      'Harvard University', 'Stanford University', 'Massachusetts Institute of Technology',
      'University of California, Berkeley', 'California Institute of Technology',
      'University of Chicago', 'Princeton University', 'Yale University',
      'Columbia University', 'University of Pennsylvania',
    ],
  },
  'top_us_business': {
    name: 'Top US Business Schools',
    description: 'Harvard, Stanford, Wharton, Booth, Kellogg, Sloan, Columbia, Stern, Darden, Tuck',
    institutions: [
      'Harvard University', 'Stanford University', 'University of Pennsylvania',
      'University of Chicago', 'Northwestern University', 'Massachusetts Institute of Technology',
      'Columbia University', 'New York University', 'University of Virginia',
      'Dartmouth College',
    ],
  },
  'insead_london': {
    name: 'INSEAD + London Schools',
    description: 'INSEAD, London Business School, Imperial, LSE, Oxford, Cambridge',
    institutions: [
      'INSEAD', 'London Business School', 'Imperial College London',
      'London School of Economics and Political Science', 'University of Oxford',
      'University of Cambridge',
    ],
  },
  'top_global_business': {
    name: 'Top Global Business Schools',
    description: 'Elite global business schools for management research',
    institutions: [
      'Harvard University', 'Stanford University', 'University of Pennsylvania',
      'INSEAD', 'London Business School', 'University of Chicago',
      'Massachusetts Institute of Technology', 'Northwestern University',
      'Columbia University', 'University of Oxford', 'University of Cambridge',
    ],
  },
  'top_china': {
    name: 'Top Chinese Universities',
    description: 'Peking University, Tsinghua, Fudan, Shanghai Jiao Tong, ZJU, CUHK',
    institutions: [
      'Peking University', 'Tsinghua University', 'Fudan University',
      'Shanghai Jiao Tong University', 'Zhejiang University',
      'Chinese University of Hong Kong', 'University of Hong Kong',
    ],
  },
};

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
    // Source (journal/venue) with quality identifiers
    source: work.primary_location?.source?.display_name,
    source_id: work.primary_location?.source?.id,
    source_issn_l: work.primary_location?.source?.issn_l,
    source_type: work.primary_location?.source?.type,
    // Field-Weighted Citation Impact (quality signal)
    fwci: work.fwci ?? null,
    // Abstract (properly reconstructed, capped at 600 chars)
    abstract: work.abstract_inverted_index ?
      reconstructAbstract(work.abstract_inverted_index).substring(0, 600) : null
  };
}

// Helper function to summarize an author record (includes h-index and affiliations)
function summarizeAuthor(author: any) {
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

// Helper function to summarize a source/venue record
function summarizeSource(source: any) {
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
      'Search scholarly works with advanced filtering. Supports Boolean operators, year ranges, citation thresholds, venue/journal filtering (source_name, source_issn, source_id), and institution filtering (author_institution, institution_group). The most flexible search tool. Use search_in_journal_list for preset journal lists like UTD24 or FT50.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Search query. Supports Boolean operators (AND, OR, NOT). Example: "machine learning AND (neural networks OR deep learning)"',
        },
        from_publication_year: {
          type: 'number',
          description: 'Filter works published from this year onwards',
        },
        to_publication_year: {
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
        per_page: { type: 'number', description: 'Results per page (default: 10, use 20 for broader coverage, max: 200)' },
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
        per_page: { type: 'number', description: 'Results per page (default: 10, use 20 for broader coverage, max 200)' },
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
        per_page: { type: 'number', description: 'Number of venues to return (default: 10, max: 50)' },
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
        per_page: { type: 'number', description: 'Results per page (default: 10, max: 50)' },
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
        per_page: { type: 'number', description: 'Results per page (default: 10, max: 50)' },
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
        per_page: { type: 'number', description: 'Results per page (default: 10, max: 50)' },
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
        per_page: { type: 'number', description: 'Results per page (default: 10, max: 50)' },
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
    version: '0.3.0',
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
  // Author institution filter — restrict to papers by authors at specific institutions.
  // Accepts a single institution name, OR-separated names, or an institution_group preset key.
  if (params.institution_group) {
    const group = INSTITUTION_GROUPS[params.institution_group];
    if (group) {
      filter['authorships.institutions.display_name'] = group.institutions.join('|');
    }
  } else if (params.author_institution) {
    // Accepts single name ("Harvard University") or pipe-separated list
    filter['authorships.institutions.display_name'] = params.author_institution;
  }
  // Venue/source filters (critical for top-journal paper writing)
  if (params.source_id) {
    filter['primary_location.source.id'] = params.source_id;
  }
  if (params.source_name) {
    filter['primary_location.source.display_name.search'] = params.source_name;
  }
  // ISSN filter for precise venue identification
  if (params.source_issn) {
    filter['primary_location.source.issn'] = params.source_issn;
  }
  // Minimum citations shorthand
  if (params.min_citations !== undefined && params.min_citations > 0) {
    filter['cited_by_count'] = `>${params.min_citations - 1}`;
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
          // Conferences: filter by display_name (OR across full names)
          filter['primary_location.source.display_name'] = preset.source_names.join('|');
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
          const searchQuery = params.venue_issn
            ? `issn:${params.venue_issn}`
            : params.venue_name;

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
        const resolved = [];

        for (const id of ids) {
          try {
            const work = await openAlexClient.getWork(id);
            resolved.push(summarizeWork(work));
          } catch (err) {
            resolved.push({ id, error: 'Not found or invalid ID' });
          }
        }

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
