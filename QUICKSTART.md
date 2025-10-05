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
      "args": ["/Users/yourusername/path/to/openalex-mcp/build/index.js"],
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

The server provides 18 specialized tools:

**Literature Search:**
- `search_works` - Advanced search for papers
- `get_work` - Get detailed paper information
- `get_related_works` - Find similar papers
- `search_by_topic` - Explore specific research domains
- `autocomplete_search` - Fast typeahead search

**Citation Analysis:**
- `get_work_citations` - Who cites this paper
- `get_work_references` - What this paper cites
- `get_citation_network` - Complete citation graph
- `get_top_cited_works` - Most influential papers

**Author & Institutions:**
- `search_authors` - Find researchers
- `get_author_works` - Author's publications
- `get_author_collaborators` - Co-authorship networks
- `search_institutions` - Find universities/organizations

**Research Trends:**
- `analyze_topic_trends` - Track research evolution
- `compare_research_areas` - Compare different fields
- `get_trending_topics` - Discover emerging areas
- `analyze_geographic_distribution` - Global research mapping

**Entity Lookup:**
- `get_entity` - Get any OpenAlex entity
- `search_sources` - Find journals/venues

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
