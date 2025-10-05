# Testing & Release Procedures

This document outlines how to test the OpenAlex MCP server before releasing new versions.

## Testing Philosophy

**Never release without testing.** Every change must pass automated tests and manual validation to prevent user-facing bugs.

## Quick Pre-Release Checklist

Before any release (`npm publish` or git tag), run:

```bash
# 1. Build the code
npm run build

# 2. Run quick smoke tests (~15 seconds)
node tests/quick-test.js

# 3. Test locally with MCP client
# See "Manual Testing" section below
```

If all three pass, the release is ready.

## Automated Testing

###  Quick Smoke Tests (Required before release)

**File:** `tests/quick-test.js`

**What it tests:**
- Basic search functionality
- Year filtering
- Search + filter + sort combinations
- Single entity retrieval

**How to run:**
```bash
node tests/quick-test.js
```

**Expected result:**
```
🎉 All critical tests passed!
```

**Time:** ~15 seconds (includes rate limiting delays)

### Integration Tests (Optional, for major changes)

**File:** `tests/integration.test.js`

**What it tests:**
- All 10 major API patterns
- Author/institution search
- Advanced filtering
- Grouping/aggregation

**How to run:**
```bash
# Wait for rate limits to reset first
sleep 30
node tests/integration.test.js
```

**Time:** ~15-20 seconds

**Note:** Only run when making major changes to API interaction logic. Not needed for documentation or minor fixes.

## Manual Testing

### Test with Claude Desktop or TypingMind

1. **Build the latest code:**
   ```bash
   npm run build
   ```

2. **Configure your MCP client** (Claude Desktop or TypingMind):
   ```json
   {
     "mcpServers": {
       "openalex-dev": {
         "command": "node",
         "args": ["/absolute/path/to/openalex-mcp/build/index.js"],
         "env": {
           "OPENALEX_EMAIL": "your.email@example.com"
         }
       }
     }
   }
   ```

3. **Restart the MCP client**

4. **Run test queries:**

   ✅ **Must pass:**
   - "Find the most influential papers on AI safety published since 2020"
   - "Get the citation network for DOI 10.48550/arXiv.1706.03762"
   - "Who are the top collaborators of Geoffrey Hinton?"
   - "Show me research trends in quantum computing from 2020-2024"

5. **Check debug logs** (stderr output) for errors

### Common Issues During Testing

**❌ Rate Limit Errors (429)**
- **Cause:** Too many requests too quickly
- **Solution:** Wait 10-30 seconds between test runs
- **Prevention:** Use `sleep` commands in test scripts

**❌ 400 Invalid Errors**
- **Cause:** Incorrect filter format or parameter
- **Solution:** Check `buildFilter` function and parameter mapping
- **Debug:** Enable debug logging to see exact API requests

**❌ Tools not showing up**
- **Cause:** Build not up to date or MCP client cache
- **Solution:** Run `npm run build` and restart MCP client

## Testing New Tools

When adding a new tool:

1. **Add test case to `quick-test.js`** for the new tool
2. **Test manually** with at least 3 different parameter combinations
3. **Document** the test cases in this file
4. **Verify** the tool works in both Claude Desktop and TypingMind

## Release Testing Workflow

```bash
# 1. Make code changes
# ... edit files ...

# 2. Rebuild
npm run build

# 3. Run automated tests
node tests/quick-test.js

# 4. Manual test with MCP client
# Test at least 2-3 queries

# 5. Update CHANGELOG.md with changes

# 6. Commit changes
git add .
git commit -m "Fix: description of fix"

# 7. Version bump
npm version patch  # or minor/major

# 8. Push and create release
git push && git push --tags
gh release create vX.X.X --title "vX.X.X" --notes "Release notes"

# 9. GitHub Actions will auto-publish to npm
```

## CI/CD Setup (Future)

**TODO:** Add GitHub Actions workflow to run tests automatically on:
- Every pull request
- Before publishing to npm
- On push to main branch

## Debugging Failed Tests

### Check API Response

```bash
# Test direct API call
curl "https://api.openalex.org/works?search=AI&filter=publication_year:>2020&per_page=1"
```

### Enable Debug Logging

The server already has debug logging enabled. When running locally, stderr will show:
- Server startup messages
- Tool calls received
- API requests being made
- Errors with stack traces

### Rate Limiting

OpenAlex limits:
- 10 requests/second
- 100,000 requests/day

Our tests respect these by adding delays between requests.

## Test Data

**Known good DOI for testing:** `10.48550/arXiv.1706.03762` (Attention Is All You Need paper)

**Known good OpenAlex ID:** `W2741809807`

**Known good author:** Geoffrey Hinton, Yann LeCun

## Version History Testing

When fixing bugs, always:
1. Add a test case that reproduces the bug
2. Verify the test fails before the fix
3. Verify the test passes after the fix
4. Keep the test for regression prevention

## Summary

**Before every release:**
1. ✅ Build: `npm run build`
2. ✅ Test: `node tests/quick-test.js`
3. ✅ Manual: Test 2-3 queries in MCP client
4. ✅ Document: Update CHANGELOG.md
5. ✅ Release: Version bump and push

**Never skip testing!** A broken release affects all users and damages trust.
