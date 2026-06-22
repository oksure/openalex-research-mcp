---
name: openalex
description: "Search academic papers, authors, institutions, and topics via the OpenAlex API (477M+ works). Direct CLI/curl calls, zero token cost when not in use. 논문 검색, 저자 찾기, 인용 확인, 학술 검색, 피인용 수, 학회지 검색, 연구자 찾기, 논문 피인용, 주제별 논문, 학술 트렌드, 저널 프리셋, UTD24 논문"
version: "1.1"
allowed-tools: Bash(openalex *), Bash(curl *), Bash(jq *)
---

## Status: active

# /openalex -- Academic Paper & Research Search

OpenAlex is a free, open catalog of the global research system (477M+ works, 90M+ authors).

> This skill is the lightweight, **token-frugal counterpart** to the
> [`openalex-research-mcp`](../README.md) MCP server in this repo: instead of a
> persistent server with 31 structured tools, it shells out to a small CLI on
> demand, so it costs nothing while idle. Use the MCP server inside MCP clients
> (Claude Desktop, TypingMind); use this skill inside coding agents with shell
> access.

## When NOT to use

- arXiv/SSRN full-text search -> OpenAlex has metadata only, not full text
- Reading a specific paper's full text -> fetch the DOI URL directly
- Getting BibTeX citations -> use CrossRef (`https://api.crossref.org/works/<DOI>`)

## Setup

The skill drives the `openalex` CLI bundled at `skill/bin/openalex` (zero
dependencies, Python 3). Put it on your `PATH`:

```bash
chmod +x skill/bin/openalex
export PATH="$PWD/skill/bin:$PATH"
# Optional but recommended (faster "polite pool"):
export OPENALEX_EMAIL="you@example.com"
# Optional (premium): export OPENALEX_API_KEY="..."
```

Both env vars are optional — OpenAlex serves anonymous requests for free.

## Core Patterns — `openalex` CLI

The CLI handles key/email injection, mandatory `select=` field trimming (full
responses are 3x larger), abstract reconstruction from the inverted index, and
DOI→W-id resolution. Add `--json` for shaped JSON output.

### Search works (papers)
```bash
openalex works "supply chain network" -n 10
openalex works "structural estimation" --filter "from_publication_date:2024-01-01,cited_by_count:>10"
openalex works "<query>" --abstract        # include reconstructed abstracts
```

### Get a specific work
```bash
openalex work 10.3982/ecta7743             # by DOI
openalex work W2070854196 --abstract --refs
```

### Authors (two-step: search name → use the A-id; names are ambiguous, IDs are not)
```bash
openalex authors "daron acemoglu" -n 3
openalex author-works A5012301204 -n 10    # top works by citation
openalex experts "CRISPR gene editing" -n 5  # leading authors ON a topic, by h-index
```
`experts` resolves the topic to a `topics.id` and ranks authors who work on it by
h-index (unlike `authors`, which name-matches) — use it to find field leaders.

### Institutions / topics / sources
```bash
openalex institutions "seoul national university"
openalex topics "supply chain"             # topics replaced "concepts" — never use concept.id
openalex sources "management science"
```

### Citation network & trends
```bash
openalex cites 10.3982/ecta7743 -n 10      # papers citing this work (DOI auto-resolved)
openalex work W1234 --refs                 # references of a paper
openalex trend T10539                      # works per year for a topic
```

### Abstract reconstruction
```bash
openalex abstract 10.3982/ecta7743         # inverted index → readable text
```

### Raw API (only when the CLI lacks a filter/field)

Base `https://api.openalex.org`, append `&api_key=$OPENALEX_API_KEY` (if set, else
`&mailto=$OPENALEX_EMAIL`) and ALWAYS `&select=` only the fields you need. Filter
syntax, sorting, pagination: see `references/api-reference.md`.

### File Index

| File | Purpose |
|------|---------|
| `bin/openalex` | the zero-dependency CLI this skill drives |
| `references/journal-presets.md` | ISSN lists for UTD24, FT50, ABS4* venue filtering |
| `references/api-reference.md` | Filter syntax, sorting, pagination, autocomplete, error handling |

## Tips

- **Two-step for names**: `openalex authors` first to get the A-id, then `openalex author-works` — names are ambiguous; IDs are not.
- **Empty results?** Try: broader date range, fewer filters, alternate spelling, or check the topic/author ID via autocomplete.
- The CLI already enforces `select=` and reconstructs abstracts — only fall back to raw curl for exotic filters.

## Output Contract

All queries produce JSON piped through `jq` for compact display:
- **Work search** — array of `{title, year, cited, doi, venue, authors}` objects
- **Author search** — array of `{id, name, works, cited, inst}` objects
- **Institution/topic/source search** — array of `{id, name, works, cited}` objects
- **Citation network** — list of OpenAlex IDs or `{title, year, cited}` objects
- **Abstract** — reconstructed plain text string

Present results as a markdown table when >=3 items, inline JSON for 1-2 items. Always include the total count from `meta.count` when available.
