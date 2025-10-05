# TypingMind Compatibility Guide

## Known Issue: Tool Use ID Errors

When using the OpenAlex MCP server with TypingMind, you may encounter this error:

```
Request failed. Error details: messages.0.content.0: unexpected `tool_use_id` found in `tool_result` blocks: toolu_XXXXXXXXXX.
Each `tool_result` block must have a corresponding `tool_use` block in the previous message.
```

### What This Means

This is an **Anthropic API validation error** that occurs when the conversation history becomes too large or corrupted. It happens when TypingMind tries to send the conversation to Claude's API, and the tool call/result pairs don't match up correctly.

This error is **not caused by our MCP server** - it's caused by TypingMind's MCP adapter losing track of tool calls when conversation history gets long.

### Why It Happens

1. **Large Conversation History**: Multiple tool calls create a long conversation history that exceeds context limits
2. **Response Size**: Even with our optimized responses (~1.7 KB per work), multiple queries accumulate in conversation history
3. **TypingMind's MCP Adapter**: The way TypingMind converts between MCP protocol and Anthropic's API format can cause mismatches

### Solutions

#### 1. Start a New Chat (Recommended)

The simplest fix is to start a fresh conversation:
- Click "New Chat" in TypingMind
- This clears the conversation history and resets the MCP connection

#### 2. Reduce Results Per Query

Ask for fewer results at a time:
- Instead of: "Find the most influential papers on AI safety since 2020"
- Try: "Find the top 5 most influential papers on AI safety since 2020"

The server now defaults to 10 results per query (down from 25), but you can request even fewer.

#### 3. Use Pagination

For large result sets, use pagination instead of requesting all results at once:
```
Show me the top 10 AI safety papers, then I'll ask for the next 10 if needed
```

#### 4. Adjust Default Page Size

Set the `MCP_DEFAULT_PAGE_SIZE` environment variable to an even smaller default (e.g., 5):

```json
{
  "mcpServers": {
    "openalex": {
      "command": "npx",
      "args": ["-y", "openalex-research-mcp"],
      "env": {
        "OPENALEX_EMAIL": "your.email@example.com",
        "MCP_DEFAULT_PAGE_SIZE": "5"
      }
    }
  }
}
```

#### 5. Be Specific in Queries

More specific queries return better targeted results:
- ❌ Bad: "AI safety" (returns 97K papers)
- ✅ Good: "AI alignment value learning" (returns targeted papers)
- ✅ Better: "AI alignment value learning after 2020 with over 100 citations"

#### 6. Use Summary Tools

For overview queries, use aggregation tools that don't return full paper lists:
- `analyze_topic_trends` - Shows publication trends over time (grouped data)
- `compare_research_areas` - Compares topic volumes (just counts)
- `analyze_geographic_distribution` - Shows country-level stats

### Response Size Optimizations

The server already implements aggressive response filtering:

**Per Work (~1.7 KB each):**
- Core identifiers (ID, DOI, title)
- Publication metadata (year, citations)
- First 5 authors only
- Primary topic only
- Abstract preview (500 chars max)

**With 10 results:** ~17 KB per response
**With 5 results:** ~8.5 KB per response

### When It Still Fails

If you continue to experience errors even with a fresh chat:

1. **Check MCP Server Logs**: Look for errors in the server stderr output
2. **Verify Connection**: Make sure the MCP server is running (`npx openalex-research-mcp`)
3. **Update Package**: Ensure you have the latest version (`npm install -g openalex-research-mcp`)
4. **Contact Support**: Report the issue with:
   - Your exact query
   - TypingMind version
   - Server logs (stderr output)

### Technical Details

This error originates from Anthropic's Messages API validation, not from the MCP server itself. The API enforces strict ordering:

```
User Message
  → Assistant Message with tool_use blocks
    → User Message with tool_result blocks (must match tool_use IDs)
      → Assistant Message with response
```

When this pattern breaks (due to context overflow, connection resets, or protocol translation issues), the error occurs.

### What We've Fixed (v0.2.0)

The following optimizations have been implemented to improve TypingMind compatibility:

1. ✅ **Updated MCP SDK** from 1.0.4 to 1.19.1 (major version update with bug fixes)
2. ✅ **Reduced response sizes by 80-90%** (from ~10 KB to ~1.7 KB per work)
3. ✅ **Reduced default results from 25 to 10** (further reducing response size)
4. ✅ **Made page size configurable** via `MCP_DEFAULT_PAGE_SIZE` environment variable
5. ✅ **Improved error handling** and logging for debugging

These changes should significantly reduce or eliminate the tool_use_id errors. **Please upgrade to the latest version:**

```bash
npm install -g openalex-research-mcp@latest
```

### Alternative MCP Clients

If you continue to have issues with TypingMind, consider these MCP-compatible alternatives:

- **Claude Desktop** (official Anthropic client)
- **Claude Code** (VS Code extension)
- **Zed Editor** (built-in MCP support)
- **Continue.dev** (VS Code/JetBrains extension)

These clients may have more mature MCP implementations.

## Best Practices for TypingMind

1. ✅ Start new chats frequently when doing research
2. ✅ Request small batches (5-10 papers at a time)
3. ✅ Use specific search queries with filters
4. ✅ Leverage aggregation tools for overviews
5. ❌ Avoid requesting 25+ papers in a single query
6. ❌ Avoid long conversation chains with many tool calls
7. ❌ Don't request multiple complex queries in one chat

## Questions?

If you have questions or encounter issues not covered here:
- Open an issue: https://github.com/oksure/openalex-research-mcp/issues
- Check MCP docs: https://docs.typingmind.com/model-context-protocol-(mcp)-in-typingmind
