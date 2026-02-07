# OpenAlex MCP Server

A Model Context Protocol (MCP) server that provides access to OpenAlex, a comprehensive open catalog of scholarly papers, authors, institutions, and more. Designed to empower AI assistants to conduct literature reviews, analyze research trends, and map the scholarly landscape.

**Features:**
- ⚡️ **In-memory caching** with TTL for fast repeated requests
- 🔄 **Retry logic** with exponential backoff for resilient API calls
- ✅ **Input validation** with Zod schemas
- 🏥 **Health check** tool for monitoring
- 📊 **18+ specialized tools** for research

## Features

Access 240+ million scholarly works through 18 specialized tools:

### Literature Search & Discovery
- **search_works**: Advanced search with Boolean operators, filters, and sorting
- **get_work**: Get detailed metadata for a specific work
- **get_related_works**: Find similar papers based on citations and topics
- **search_by_topic**: Explore literature in specific research domains
- **autocomplete_search**: Fast typeahead search for all entity types

### Citation Analysis
- **get_work_citations**: Forward citation analysis (who cites this work)
- **get_work_references**: Backward citation analysis (what this work cites)
- **get_citation_network**: Build complete citation networks for visualization
- **get_top_cited_works**: Find the most influential papers in a field

### Author & Institution Analysis
- **search_authors**: Find researchers with publication and citation metrics
- **get_author_works**: Analyze an author's publication history
- **get_author_collaborators**: Map co-authorship networks
- **search_institutions**: Find leading academic institutions

### Research Landscape & Trends
- **analyze_topic_trends**: Track research evolution over time
- **compare_research_areas**: Compare activity across different fields
- **get_trending_topics**: Discover emerging research areas
- **analyze_geographic_distribution**: Map global research activity

### Entity Lookup
- **get_entity**: Get detailed information for any OpenAlex entity
- **search_sources**: Find journals, conferences, and publication venues

## Installation

### Option 1: Install from npm (Recommended)

```bash
# Install globally
npm install -g openalex-research-mcp

# Or use directly with npx (no installation needed)
npx openalex-research-mcp
```

### Option 2: Install from source

```bash
# Clone the repository
git clone https://github.com/oksure/openalex-research-mcp.git
cd openalex-research-mcp

# Install dependencies
npm install

# Build the TypeScript code
npm run build
```

## Configuration

### Environment Variables (Optional but Recommended)

Set your email to join the "polite pool" for better rate limits:

```bash
export OPENALEX_EMAIL="your.email@example.com"
```

For premium users with an API key:

```bash
export OPENALEX_API_KEY="your-api-key"
```

### Claude Desktop Configuration

Add to your Claude Desktop config file:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

**If you installed via npm/npx:**
```json
{
  "mcpServers": {
    "openalex": {
      "command": "npx",
      "args": ["-y", "openalex-research-mcp"],
      "env": {
        "OPENALEX_EMAIL": "your.email@example.com"
      }
    }
  }
}
```

**If you installed from source:**
```json
{
  "mcpServers": {
    "openalex": {
      "command": "node",
      "args": ["/absolute/path/to/openalex-research-mcp/build/index.js"],
      "env": {
        "OPENALEX_EMAIL": "your.email@example.com"
      }
    }
  }
}
```

### TypingMind and Other MCP Clients

The same configuration format works for TypingMind and other MCP-compatible clients.

> **⚠️ TypingMind Users**: If you encounter "tool_use_id" errors, see [TYPINGMIND.md](TYPINGMIND.md) for troubleshooting steps and best practices. **TL;DR**: Start a new chat, request fewer results (5-10), and use specific queries with filters.

## Usage Examples

### Example 1: Literature Review for AI Safety

```
Find the most influential papers on AI safety published since 2020
```

The assistant will use `get_top_cited_works` with appropriate filters to find highly-cited papers in AI safety research. The tool automatically filters for papers with at least 50 citations by default, ensuring results focus on influential work. For the most impactful papers, you can specify a higher threshold like `min_citations: 200`.

### Example 2: Citation Network Analysis

```
Get the citation network for the paper "Attention Is All You Need" (DOI: 10.48550/arXiv.1706.03762)
```

The assistant will use `get_citation_network` to build a network of citing and referenced papers, enabling visualization of research impact.

### Example 3: Research Trend Analysis

```
Show me how quantum computing research has evolved over the past 10 years
```

The assistant will use `analyze_topic_trends` to group publications by year and show growth patterns.

### Example 4: Finding Collaborators

```
Who are the main collaborators of Geoffrey Hinton?
```

The assistant will use `get_author_collaborators` to analyze co-authorship patterns.

### Example 5: Comparative Research Analysis

```
Compare research activity in "deep learning", "reinforcement learning", and "federated learning" from 2018-2024
```

The assistant will use `compare_research_areas` to show relative publication volumes.

### Example 6: Geographic Research Mapping

```
Which countries are leading research in climate change mitigation?
```

The assistant will use `analyze_geographic_distribution` to map research activity by country.

## Response Format

The MCP server uses a **two-tier response system** to balance performance and completeness:

### Summarized Responses (Search Results)

For list operations (`search_works`, `get_citations`, `get_author_works`, etc.), responses include only essential information:

**Included:**
- Core identifiers (ID, DOI, title)
- Publication metadata (year, date, type)
- Citation metrics (cited_by_count)
- First 5 authors (with `authors_truncated` flag if more exist)
- Primary topic classification
- Open access status and URLs
- Source/journal name
- Abstract preview (first 500 chars)

**Excluded to reduce size:**
- Full author lists beyond 5 authors
- All secondary topics/concepts
- Complete affiliation details
- Full reference lists
- Detailed bibliographic data

This optimization reduces response sizes by ~80-90% (from ~10 KB to ~1.7 KB per work), making the server compatible with all MCP clients including TypingMind and Claude Desktop.

### Full Details (`get_work` tool)

When you need **complete information** about a specific paper, use the `get_work` tool with a work ID or DOI. This returns:

**Complete Author Information:**
- ALL authors (not just first 5)
- Position indicators (first, middle, last author)
- Institutions and affiliations
- ORCID IDs
- Corresponding author flags
- Country information

**Complete Content:**
- Full abstract (reconstructed from OpenAlex index)
- All topics (not just primary)
- Complete bibliographic data
- Funding and grant information
- Keywords
- Complete reference and citation lists

**Use Cases:**
- Identifying PIs (often last author in biomedical fields)
- Finding corresponding authors
- Getting complete author affiliations
- Accessing full abstracts
- Comprehensive paper analysis

## Tool Reference

### Search Parameters

Most search tools support these common parameters:

- **from_year / to_year**: Filter by publication year range
- **cited_by_count**: Filter by citation count (e.g., ">100")
- **is_oa**: Filter for open access works only
- **sort**: Sort results (relevance_score, cited_by_count, publication_year)
- **page / per_page**: Pagination (max 200 per page)

### Boolean Search

The `search_works` and related tools support Boolean operators:

```
"machine learning" AND (ethics OR fairness)
"climate change" NOT "climate denial"
(AI OR "artificial intelligence") AND safety
```

### Identifiers

OpenAlex accepts multiple identifier formats:

- **OpenAlex IDs**: W2741809807, A5023888391
- **DOIs**: 10.1371/journal.pone.0000000
- **ORCIDs**: 0000-0001-2345-6789
- **URLs**: Full OpenAlex URLs

## API Rate Limits

- **Default**: 100,000 requests/day, 10 requests/second
- **Polite Pool** (with email): Better performance and reliability
- **Premium** (with API key): Higher limits and exclusive filters

## Development

```bash
# Watch mode for development
npm run watch

# Build
npm run build

# Run
npm start
```

## Data Source

All data comes from [OpenAlex](https://openalex.org), an open and comprehensive catalog of scholarly papers, authors, institutions, and more. OpenAlex indexes:

- 240+ million works (papers, books, datasets)
- 50,000+ new works added daily
- Full citation network and metadata
- Author affiliations and collaboration data
- Publication venues and impact metrics

## Use Cases

This MCP server is ideal for:

- **Literature Reviews**: Systematically search and analyze research papers
- **Citation Analysis**: Understand research impact and influence
- **Trend Analysis**: Track how research topics evolve over time
- **Collaboration Mapping**: Identify research networks and partnerships
- **Gap Analysis**: Find understudied areas in research
- **Comparative Studies**: Compare research activity across fields
- **Institution Benchmarking**: Analyze research output by institution
- **Author Profiling**: Study researcher publication patterns

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Resources

- [OpenAlex Documentation](https://docs.openalex.org)
- [OpenAlex API](https://docs.openalex.org/how-to-use-the-api/api-overview)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP Specification](https://spec.modelcontextprotocol.io)
