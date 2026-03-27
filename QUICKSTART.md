# Quick Start Guide

Get your OpenAlex MCP server running in under 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Build the Project

```bash
npm run build
```

## Step 3: Configure Claude Desktop

1. Open your Claude Desktop config file:
   - **MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

2. Add the OpenAlex server configuration (replace with your actual path):

```json
{
  "mcpServers": {
    "openalex": {
      "command": "node",
      "args": ["/Users/yourusername/path/to/openalex-research-mcp/build/index.js"],
      "env": {
        "OPENALEX_EMAIL": "your.email@example.com"
      }
    }
  }
}
```

3. Restart Claude Desktop

## Step 4: Test It Out!

Try these prompts in Claude Desktop:

### Find influential papers
```
Find the top 10 most cited papers on quantum computing from the last 5 years
```

### Analyze research trends
```
Show me how AI safety research has evolved from 2020 to 2024
```

### Citation network analysis
```
Get the citation network for the paper with DOI: 10.48550/arXiv.1706.03762
```

### Author collaboration analysis
```
Who are the main collaborators of Yann LeCun?
```

### Geographic research mapping
```
Which countries are leading research in renewable energy?
```

## Available Tools

The server provides 31 specialized tools:

**Literature Search & Discovery:**
- `search_works` - Advanced search with Boolean operators, venue/institution filters
- `get_work` - Get complete metadata for a specific work
- `get_related_works` - Find similar papers based on citations and topics
- `search_by_topic` - Explore literature in specific research domains
- `autocomplete_search` - Fast typeahead search for all entity types

**Credibility-Gated Search (Journal & Conference Presets):**
- `list_journal_presets` - List all available journal/conference and institution group presets
- `search_in_journal_list` - Search within a named preset (UTD24, FT50, AJG tiers, etc.)
- `search_works_in_venue` - Search within a specific venue by name, ISSN, or ID
- `get_top_venues_for_field` - Discover top journals/conferences ranked by h-index
- `check_venue_quality` - Inspect h-index, impact, and indexing status of any venue

**Citation Analysis:**
- `get_work_citations` - Forward citation analysis (who cites this work)
- `get_work_references` - Backward citation analysis (what this work cites)
- `get_citation_network` - Build citation networks (forward + backward)
- `get_top_cited_works` - Find the most influential papers in a field

**Author & Institution Analysis:**
- `search_authors` - Find researchers with h-index and citation metrics
- `search_authors_by_expertise` - Find experts in a topic ranked by h-index
- `get_author_profile` - Full profile: h-index, i10-index, top works, recent works
- `get_author_works` - Analyze an author's publication history
- `get_author_collaborators` - Map co-authorship networks
- `search_institutions` - Find academic institutions

**High-Value Citation Finding:**
- `find_review_articles` - Find review papers and meta-analyses
- `find_seminal_papers` - Find foundational "must-cite" papers
- `find_open_access_version` - Find freely available versions of papers
- `batch_resolve_references` - Validate up to 20 DOIs/IDs at once

**Research Landscape & Trends:**
- `analyze_topic_trends` - Track research evolution over time
- `compare_research_areas` - Compare activity across different fields
- `get_trending_topics` - Discover emerging research areas
- `analyze_geographic_distribution` - Map global research activity

**Entity Lookup:**
- `get_entity` - Get any OpenAlex entity (works, authors, sources, etc.)
- `search_sources` - Find journals/conferences sorted by h-index
- `health_check` - Verify server and API connectivity

## Tips

- **Add your email** to get better rate limits (100K requests/day)
- Use **Boolean operators** in searches: `"AI" AND (safety OR ethics)`
- Filter by **year ranges** to focus on recent research
- Sort by **citation count** to find influential work
- Use **per_page** parameter to get more results (max 200)

## Troubleshooting

**Server not showing up in Claude Desktop?**
- Check that the path in your config is absolute, not relative
- Verify the build was successful: `ls build/index.js`
- Restart Claude Desktop completely

**Rate limit errors?**
- Make sure `OPENALEX_EMAIL` is set in your config
- Slow down your requests if hitting 10 requests/second

**No results found?**
- Try broader search terms
- Check spelling and use Boolean operators
- Try searching by DOI or OpenAlex ID directly

## Next Steps

- Read the full [README.md](./README.md) for detailed documentation
- Check out [OpenAlex API docs](https://docs.openalex.org) for more filtering options
- Join the polite pool by adding your email for better performance

Happy researching! 🔬📚
