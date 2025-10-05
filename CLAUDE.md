# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that provides access to OpenAlex API for literature review and research landscaping. It exposes 18 specialized tools through the MCP protocol, allowing AI assistants to search 240+ million scholarly works, analyze citations, track research trends, and map collaboration networks.

## Architecture

### Two-Layer Design

1. **OpenAlex Client Layer** (`src/openalex-client.ts`)
   - Handles all HTTP communication with OpenAlex API (api.openalex.org)
   - Manages rate limiting (10 req/s, 100K req/day) and 429 error handling
   - Implements "polite pool" access via email parameter or API key
   - Provides typed interfaces for search/filter operations
   - Key methods: `getEntity()`, `searchEntities()`, `autocomplete()`, `getWorks()`, `getAuthors()`, etc.

2. **MCP Server Layer** (`src/index.ts`)
   - Implements stdio transport for MCP protocol
   - Defines 18 tools organized into 5 categories (see README for tool list)
   - Each tool handler translates MCP parameters to OpenAlexClient calls
   - Uses helper function `buildFilter()` to map common params to OpenAlex filter format
   - Returns JSON responses via MCP content blocks

### Key Design Patterns

- **Parameter Translation**: Tool parameters (e.g., `from_publication_year`) are mapped to OpenAlex API filter format (e.g., `from_publication_date`) in the `buildFilter()` helper
- **Type Assertion**: Uses `const params = args as any` to handle MCP's unknown argument types
- **Citation Networks**: `get_citation_network` combines forward citations (via filter `cites:id`) and backward citations (from `referenced_works` field)
- **Collaborator Analysis**: `get_author_collaborators` fetches author's works, then counts co-author occurrences across all authorships

## Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run the server (after building)
npm start

# Development mode with auto-rebuild
npm run watch

# Test the server manually
# (Run in one terminal, then send MCP messages via stdin)
npm start
```

## Testing the Server

To test locally with Claude Desktop:

1. Build: `npm run build`
2. Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):
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
3. Restart Claude Desktop
4. Test with prompts like: "Find the top 10 most cited papers on quantum computing"

## Publishing to npm

Automated via GitHub Actions (`.github/workflows/npm-publish.yml`):

```bash
# Bump version and create release (triggers npm publish)
npm version patch  # or minor/major
git push && git push --tags
gh release create v1.0.1 --title "v1.0.1" --notes "Release notes"
```

Full instructions in `NPM_PUBLISHING.md`. Requires `NPM_TOKEN` secret in GitHub repo settings.

## Adding New Tools

When adding a new tool:

1. Add tool definition to `tools` array in `src/index.ts` with:
   - `name`: Tool name (snake_case)
   - `description`: What it does and when to use it
   - `inputSchema`: JSON Schema for parameters

2. Add case handler in the `switch(name)` statement:
   - Extract parameters from `params`
   - Build appropriate filters or search options
   - Call OpenAlexClient methods
   - Return JSON response in MCP format

3. If the tool needs new OpenAlex API functionality, add methods to `OpenAlexClient` class first

4. Update README.md and CHANGELOG.md

## OpenAlex API Quirks

- **Filter syntax**: Multiple filters are AND by default, use `|` for OR, `!` for NOT
- **Identifier flexibility**: Accepts OpenAlex IDs (W123), DOIs, ORCIDs, or full URLs
- **Grouped responses**: When using `groupBy`, response includes `group_by` array instead of paginated results
- **Related works**: Stored as array of IDs in `related_works` field, must fetch individually
- **Citation searching**: Use filter `cites:<work-id>` to find citing works (forward citations)
- **Author filtering**: Use `authorships.author.id` filter, not just `author.id`

## Environment Variables

- `OPENALEX_EMAIL`: Email for polite pool (better rate limits)
- `OPENALEX_API_KEY`: Premium API key (optional)

Both are automatically picked up by `OpenAlexClient` constructor.
