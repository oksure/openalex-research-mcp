# Developer Guide for Claude Code

This file provides guidance for AI assistants (particularly Claude Code) when working with this codebase.

## Project Overview

An MCP (Model Context Protocol) server providing access to the OpenAlex API for literature review and research landscaping. Exposes 18 specialized tools through the MCP protocol, enabling AI assistants to search 240+ million scholarly works, analyze citations, track research trends, and map collaboration networks.

## Architecture

### Two-Layer Design

1. **OpenAlex Client Layer** (`src/openalex-client.ts`)
   - Handles HTTP communication with OpenAlex API (api.openalex.org)
   - Manages rate limiting (10 req/s, 100K req/day) and 429 error handling
   - Implements "polite pool" access via email parameter or API key
   - Provides typed interfaces for search/filter operations
   - Key methods: `getEntity()`, `searchEntities()`, `autocomplete()`, `getWorks()`, `getAuthors()`, etc.

2. **MCP Server Layer** (`src/index.ts`)
   - Implements stdio transport for MCP protocol
   - Defines 18 tools organized into 5 categories (see README for tool list)
   - Translates MCP parameters to OpenAlexClient calls
   - Uses helper function `buildFilter()` to map common params to OpenAlex filter format
   - Returns JSON responses via MCP content blocks

### Key Design Patterns

#### Response Optimization
- **List operations** (search, citations, etc.): Use `summarizeWork()` to return compact summaries
  - Authors limited to first 5 (with `authors_truncated` flag)
  - Only primary topic included
  - Abstracts truncated to 500 chars
  - Typical response: ~1.7 KB per work (down from ~10+ KB)

- **Single work retrieval** (`get_work`): Use `getFullWorkDetails()` to return complete information
  - ALL authors with positions (first, middle, last), institutions, ORCID IDs, corresponding author flags
  - Full abstract reconstructed from inverted index
  - All topics (not just primary)
  - Complete bibliographic data, funding, keywords
  - Use this when detailed author information is needed (e.g., identifying PIs, corresponding authors)

#### Parameter Translation
Tool parameters (e.g., `from_publication_year`) are mapped to OpenAlex API filter format (e.g., `publication_year:>2019`) in the `buildFilter()` helper.

**CRITICAL**: OpenAlex uses `publication_year` filter, NOT `from_publication_date`
- Year ranges: `publication_year:2020-2023`
- From year: `publication_year:>2019` (note: use year-1 to be inclusive)
- To year: `publication_year:<2025`

#### Other Patterns
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

## Publishing to npm

**ALWAYS follow this workflow:**

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

# 6. Check npm for existing versions to avoid conflicts
npm view openalex-research-mcp versions --json

# 7. Version bump (triggers tests again via prepublishOnly)
npm version patch  # or minor/major

# 8. Push with tags (tag push triggers GitHub Actions npm publish via OIDC trusted publishing)
git push && git push --tags

# 9. Create GitHub release
gh release create v0.X.X --title "v0.X.X" --notes "Release notes"
```

Publishing uses npm trusted publishing (OIDC) — no `NPM_TOKEN` secret needed. The CI workflow triggers on `v*` tag pushes.

## Adding New Tools

When adding a new tool:

1. **Add tool definition** to `tools` array in `src/index.ts`:
   - `name`: Tool name (snake_case)
   - `description`: What it does and when to use it
   - `inputSchema`: JSON Schema for parameters

2. **Add case handler** in the `switch(name)` statement:
   - Extract parameters from `params` (NOT `args`)
   - Use `buildFilter(params)` for year/filter handling
   - Build appropriate filters or search options
   - Call OpenAlexClient methods
   - Return JSON response in MCP format

3. **Choose response format**:
   - For list operations: Use `summarizeWorksList(results)`
   - For single work: Use `getFullWorkDetails(work)` if full details needed
   - For other data: Return relevant fields directly

4. **Add tests** in `tests/quick-test.js`:
   - Test with at least 2-3 parameter combinations
   - Verify error handling
   - Ensure OpenAlex API returns expected data

5. **Test manually** in MCP client:
   - Build: `npm run build`
   - Test with realistic queries
   - Check debug logs for issues

6. **Update documentation**:
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

5. **Not filtering by citations for "influential papers"** queries
   - ✅ Use `get_top_cited_works` (has default min_citations: 50)
   - ✅ Or add `cited_by_count: ">100"` to `search_works`
   - ❌ Using `search_works` with only sorting returns many low-quality papers

### Search Quality Best Practices

When users ask for "most influential," "seminal," or "highly-cited" papers:

1. **Prefer `get_top_cited_works` tool**: Automatically filters for papers with >= 50 citations by default
2. **Use citation thresholds**: For "very influential" papers, use `min_citations: 200` or higher
3. **Combine with year filters**: Recent papers need lower thresholds (e.g., 50+ for 2020+, 200+ for pre-2020)
4. **Query specificity matters**: Generic queries return many irrelevant results; use specific terms

Example queries:
- ❌ Bad: `search_works(query="AI safety", sort="cited_by_count")` → Returns 97K papers including unrelated results
- ✅ Good: `get_top_cited_works(query="AI safety alignment ethics", from_year=2020)` → Returns 261 papers, all with 50+ citations
- ✅ Better: `get_top_cited_works(query="AI safety alignment ethics", from_year=2020, min_citations=200)` → Returns 47 highly influential papers

## Environment Variables

- `OPENALEX_EMAIL`: Email for polite pool (better rate limits)
- `OPENALEX_API_KEY`: Premium API key (optional)
- `MCP_DEFAULT_PAGE_SIZE`: Default number of results per page (default: 10). Set to a lower value (e.g., 5) if experiencing context overflow errors in MCP clients.

All are automatically picked up by the server on startup.

## Known Issues

### TypingMind "tool_use_id" Errors

When using with TypingMind, users may encounter:
```
Request failed. Error details: messages.0.content.0: unexpected `tool_use_id` found in `tool_result` blocks
```

This is caused by conversation history becoming too large or TypingMind's MCP adapter having protocol translation issues. See [TYPINGMIND.md](TYPINGMIND.md) for detailed troubleshooting.

**Quick fixes:**
1. Start a new chat (clears conversation history)
2. Request fewer results (5-10 instead of 10-25)
3. Use specific queries with filters
4. Set `MCP_DEFAULT_PAGE_SIZE=5` in environment
