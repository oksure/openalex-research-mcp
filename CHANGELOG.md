# Changelog

All notable changes to the OpenAlex MCP Server will be documented in this file.

## [0.2.2] - 2026-02-14

### Changed
- **Switched CI to npm trusted publishing (OIDC)**: Removed token-based npm auth in favor of OpenID Connect provenance-based publishing
- **Upgraded CI to Node 22**

### Fixed
- **Gitignored `.claude/settings.local.json`**: Machine-specific settings no longer tracked in the repo

### Chores
- Updated GitHub repo description and added 14 topic tags for discoverability

## [0.1.1] - 2025-10-06

### Added
- **Full work details in `get_work` tool**: Now returns complete information including ALL authors (not just first 5), full abstract reconstruction, all topics, complete bibliographic data, funding/grants, keywords, and reference lists. Addresses the issue where important author positions (e.g., last author/PI, corresponding author) were missing from summarized results.
  - Authors include position indicators (first, middle, last), institutions, ORCID IDs, corresponding author flags
  - Full abstract reconstructed from OpenAlex inverted index
  - All topics (not just primary)
  - Funding and grant information
  - Complete keyword list
  - Use `get_work` when you need detailed information about a specific paper

### Changed
- **Response optimization strategy**: Implemented two-tier response system
  - List operations (`search_works`, `get_citations`, etc.) return summarized results (~1.7 KB per work)
  - Single work retrieval (`get_work`) returns complete details for comprehensive analysis
- **Improved `get_top_cited_works` tool**: Now automatically filters for papers with at least 50 citations by default. Added `min_citations` parameter (default: 50) for customization.
- **Reduced default page size from 25 to 10**: Prevents context overflow in MCP clients. Configurable via `MCP_DEFAULT_PAGE_SIZE` environment variable.
- **Updated MCP SDK from 1.0.4 to 1.19.1**: Major version update with bug fixes and improved compatibility with MCP clients.

### Fixed
- **Fixed missing author information**: `get_work` now returns all authors including last author (often PI) and corresponding authors
- **Fixed "Context length limit reached" errors** in MCP clients through response size optimization
- **Improved TypingMind compatibility** through MCP SDK update and response optimizations
- Fixed issue where `get_top_cited_works` could return papers with zero citations

## [1.0.0] - 2025-10-05

### Added

#### Core Infrastructure
- OpenAlex API client with rate limiting and error handling
- MCP server implementation with stdio transport
- Support for email-based polite pool access
- Optional API key support for premium users
- Comprehensive error handling and retry logic for 429 errors

#### Literature Search & Discovery (5 tools)
- `search_works` - Advanced search with Boolean operators, filters, and sorting
- `get_work` - Retrieve detailed metadata for specific works by ID/DOI
- `get_related_works` - Find similar papers based on citations and topics
- `search_by_topic` - Explore literature in specific research domains
- `autocomplete_search` - Fast typeahead search for all entity types

#### Citation Analysis (4 tools)
- `get_work_citations` - Forward citation analysis (papers that cite a work)
- `get_work_references` - Backward citation analysis (papers cited by a work)
- `get_citation_network` - Build complete citation networks for visualization
- `get_top_cited_works` - Find most influential papers by citation count

#### Author & Institution Analysis (4 tools)
- `search_authors` - Find researchers with publication and citation metrics
- `get_author_works` - Analyze author publication history over time
- `get_author_collaborators` - Map co-authorship networks and collaboration patterns
- `search_institutions` - Find and filter academic institutions by research output

#### Research Landscape & Trends (4 tools)
- `analyze_topic_trends` - Track publication trends and research evolution over time
- `compare_research_areas` - Compare publication activity across different fields
- `get_trending_topics` - Discover emerging research areas and hot topics
- `analyze_geographic_distribution` - Map global research activity by country

#### Entity Lookup (2 tools)
- `get_entity` - Get detailed information for any OpenAlex entity type
- `search_sources` - Find journals, conferences, and publication venues

#### Features
- Boolean search operators (AND, OR, NOT) support
- Advanced filtering with inequality operators (>, <) for numerical fields
- Flexible pagination (up to 200 results per page)
- Field selection to optimize response sizes
- Grouping and aggregation capabilities
- Support for all major identifier types (OpenAlex IDs, DOIs, ORCIDs)
- Sorting by relevance, citation count, publication year

#### Documentation
- Comprehensive README with installation and usage instructions
- QUICKSTART guide for rapid setup
- Example queries for common research tasks
- Claude Desktop configuration examples
- Environment variable documentation
- API rate limit information

#### Developer Experience
- TypeScript implementation with strict type checking
- Full type definitions for all API responses
- Source maps for debugging
- Development watch mode
- Clean project structure with separation of concerns

### Technical Details
- Access to 240+ million scholarly works via OpenAlex API
- 18 specialized tools optimized for literature review workflows
- Rate limiting: 100K requests/day, 10 requests/second
- Support for both personal and institutional use
- Zero authentication required for basic access
- Enhanced access with email (polite pool) or API key

### Use Cases Enabled
- Systematic literature reviews
- Citation network analysis
- Research trend tracking
- Author collaboration mapping
- Geographic research distribution analysis
- Institution benchmarking
- Finding research gaps
- Comparative field analysis
- Author profiling and productivity tracking
- Impact assessment

## [Unreleased]

### Planned Features
- Caching layer for frequently accessed entities
- Batch operations for analyzing multiple papers
- Export formats for citation managers (BibTeX)
- Enhanced network visualization data
- Custom aggregation queries
- Advanced topic modeling integration
- Co-citation analysis
- Research impact metrics calculation

---

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
