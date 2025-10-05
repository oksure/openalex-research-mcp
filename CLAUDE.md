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

- **Parameter Translation**: Tool parameters (e.g., `from_publication_year`) are mapped to OpenAlex API filter format (e.g., `publication_year:>2019`) in the `buildFilter()` helper
  - **CRITICAL**: OpenAlex uses `publication_year` filter, NOT `from_publication_date`
  - Year ranges: `publication_year:2020-2023` for range, `publication_year:>2019` for from-year, `publication_year:<2025` for to-year
- **Type Assertion**: Uses `const params = args as any` to handle MCP's unknown argument types
- **Citation Networks**: `get_citation_network` combines forward citations (via filter `cites:id`) and backward citations (from `referenced_works` field)
- **Collaborator Analysis**: `get_author_collaborators` fetches author's works, then counts co-author occurrences across all authorships

## Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run automated tests (REQUIRED before any release)
npm test

# Run comprehensive integration tests
npm run test:integration

# Run the server (after building)
npm start

# Development mode with auto-rebuild
npm run watch
```

## Testing

**CRITICAL: Always run tests before releasing or making changes.**

### Automated Testing

```bash
# Quick smoke tests (~15 seconds, required before every release)
npm test

# Full integration tests (~20 seconds, for major changes)
npm run test:integration
```

**Tests automatically run before `npm publish`** via `prepublishOnly` hook.

### What Tests Cover

- ✅ Basic search functionality
- ✅ Year filtering (from_year, to_year, ranges)
- ✅ Search + filter + sort combinations
- ✅ Single entity retrieval
- ✅ Author/institution search
- ✅ Citation filtering
- ✅ Open access filtering
- ✅ Grouping/aggregation

### Test Files

- `tests/quick-test.js` - 4 critical tests for pre-release validation
- `tests/integration.test.js` - 10 comprehensive tests
- See `TESTING.md` for complete testing procedures

### Manual Testing with MCP Clients

**Claude Desktop:**

1. Build: `npm run build`
2. Add to config (`~/Library/Application Support/Claude/claude_desktop_config.json`):
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
4. Test with: "Find the most influential papers on AI safety published since 2020"

**TypingMind or other MCP clients:** Same config format

### Debug Logging

The server includes extensive debug logging to stderr:
- Server startup and configuration
- Tool calls received with arguments
- API requests being made
- Errors with stack traces

Check console/logs when troubleshooting.

## Publishing to npm

**ALWAYS follow this workflow before releasing:**

```bash
# 1. Make changes and build
npm run build

# 2. Run tests (REQUIRED - also runs automatically on publish)
npm test

# 3. Manual test in MCP client (test 2-3 queries)

# 4. Update CHANGELOG.md with changes

# 5. Commit changes
git add .
git commit -m "Description of changes"

# 6. Version bump (triggers tests again via prepublishOnly)
npm version patch  # or minor/major

# 7. Push and create release (triggers GitHub Actions npm publish)
git push && git push --tags
gh release create v0.1.1 --title "v0.1.1" --notes "Release notes"
```

**Tests run automatically via `prepublishOnly` hook to prevent broken releases.**

Full instructions in `NPM_PUBLISHING.md` and `TESTING.md`. Requires `NPM_TOKEN` secret in GitHub repo settings.

## Adding New Tools

When adding a new tool:

1. **Add tool definition** to `tools` array in `src/index.ts` with:
   - `name`: Tool name (snake_case)
   - `description`: What it does and when to use it
   - `inputSchema`: JSON Schema for parameters

2. **Add case handler** in the `switch(name)` statement:
   - Extract parameters from `params` (NOT `args`)
   - Use `buildFilter(params)` for year/filter handling
   - Build appropriate filters or search options
   - Call OpenAlexClient methods
   - Return JSON response in MCP format

3. **Add API methods** if needed:
   - If the tool needs new OpenAlex API functionality, add methods to `OpenAlexClient` class first
   - Ensure proper error handling and logging

4. **Add tests** in `tests/quick-test.js`:
   - Test with at least 2-3 parameter combinations
   - Verify error handling
   - Ensure OpenAlex API returns expected data

5. **Test manually** in MCP client:
   - Build: `npm run build`
   - Test with realistic queries
   - Check debug logs for issues

6. **Update documentation:**
   - README.md (add to tool list with examples)
   - CHANGELOG.md (document new feature)
   - CLAUDE.md (if architecture changes)

7. **Run full test suite** before committing:
   ```bash
   npm test
   ```

## OpenAlex API Quirks & Common Bugs

### Critical Filter Format Issues

- **MUST use `publication_year` filter** - NOT `from_publication_date` or `publication_date`
  - ✅ Correct: `filter=publication_year:>2019`
  - ❌ Wrong: `filter=from_publication_date:2020`
  - Year ranges: `publication_year:2020-2023`
  - From year: `publication_year:>2019` (note: use year-1 to be inclusive)
  - To year: `publication_year:<2025`

### API Behavior

- **Filter syntax**: Multiple filters are AND by default, use `|` for OR, `!` for NOT
  - Combine with comma: `filter=publication_year:2020,cited_by_count:>100`
- **Identifier flexibility**: Accepts OpenAlex IDs (W123), DOIs, ORCIDs, or full URLs
- **Grouped responses**: When using `groupBy`, response includes `group_by` array instead of paginated results
- **Related works**: Stored as array of IDs in `related_works` field, must fetch individually
- **Citation searching**: Use filter `cites:<work-id>` to find citing works (forward citations)
- **Author filtering**: Use `authorships.author.id` filter, not just `author.id`
- **Rate limiting**: 10 req/s, 100K req/day - tests include delays to respect this

### Common Implementation Bugs to Avoid

1. **Using `args` instead of `params`** in tool handlers
   - ✅ Correct: `buildFilter(params)`
   - ❌ Wrong: `buildFilter(args)`

2. **Overwriting filters** when both from_year and to_year provided
   - ✅ Use range format when both present
   - ❌ Second assignment overwrites first

3. **Wrong date format** - API expects years, not full dates
   - ✅ `publication_year:2020`
   - ❌ `from_publication_date:2020-01-01`

4. **Not testing before release** - Always run `npm test`

## Environment Variables

- `OPENALEX_EMAIL`: Email for polite pool (better rate limits)
- `OPENALEX_API_KEY`: Premium API key (optional)

Both are automatically picked up by `OpenAlexClient` constructor.
