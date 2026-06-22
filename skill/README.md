# openalex — Claude Skill

The same OpenAlex access as the [`openalex-research-mcp`](../README.md) server in
this repo, packaged as a **Claude Skill** (the lighter-weight, token-frugal
alternative). A skill is loaded into the agent's context only when invoked and
shells out to a small CLI, so it costs nothing while idle — handy in coding
agents (Claude Code, etc.) that already have shell access, where a persistent
MCP server is overkill.

## What's here

| Path | Purpose |
|------|---------|
| `SKILL.md` | the skill definition (frontmatter + usage patterns) |
| `bin/openalex` | zero-dependency Python 3 CLI the skill drives |
| `references/api-reference.md` | filter syntax, sorting, pagination, errors |
| `references/journal-presets.md` | ISSN lists for UTD24 / FT50 / ABS4* venue filtering |

## Install

1. Put the CLI on your `PATH` and make it executable:
   ```bash
   chmod +x skill/bin/openalex
   export PATH="$PWD/skill/bin:$PATH"     # or copy it to ~/.local/bin
   ```
2. (Optional, recommended) set your email for the faster "polite pool":
   ```bash
   export OPENALEX_EMAIL="you@example.com"
   # export OPENALEX_API_KEY="..."        # only if you have a premium key
   ```
3. Make the skill discoverable by your agent — e.g. for Claude Code:
   ```bash
   cp -r skill ~/.claude/skills/openalex
   ```

Both env vars are optional: OpenAlex serves anonymous requests for free.

## Quick check

```bash
openalex works "supply chain network" -n 5
openalex authors "daron acemoglu" -n 3
```

## MCP vs. Skill — which to use?

- **MCP server** (`npm i -g openalex-research-mcp`): structured tools inside MCP
  clients (Claude Desktop, TypingMind) — 31 typed tools, validation, presets.
- **Skill** (this folder): a shell-driven CLI for coding agents — no running
  server, zero idle cost. The industry is steadily shifting routine API access
  from always-on MCP servers toward on-demand skills; this repo ships both so
  you can pick per context.
