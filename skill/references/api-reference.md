# OpenAlex API Reference

## Filter Syntax

Filters use `key:value` format, comma-separated:
- `from_publication_date:2024-01-01` -- date range
- `cited_by_count:>10` -- citation threshold
- `author.id:A1234567890` -- by author OpenAlex ID
- `institutions.id:I1234567890` -- by institution ID
- `topics.id:T10539` -- by topic (NOT concept -- concepts are deprecated)
- `open_access.is_oa:true` -- only open access
- `type:journal-article` -- work types (journal-article, proceedings-article, book-chapter, etc.)
- `primary_location.source.issn:ISSN1|ISSN2` -- by journal ISSN (pipe = OR)
- `cites:W1234567890` -- papers that cite this work
- `cited_by:W1234567890` -- papers cited by this work

Negate any filter with `!`: `type:!paratext`

## Sorting

`sort=cited_by_count:desc` or `sort=publication_date:desc` or `sort=relevance_score:desc`

## Pagination

- `per_page=25&page=2` (max 200 per page, max 10,000 results via page-based)
- For deep pagination: `cursor=*` on first request, then use returned `meta.next_cursor`

## Autocomplete

Fast prefix search for finding IDs:
```bash
curl -s "https://api.openalex.org/autocomplete/authors?q=acemoglu&mailto=$OPENALEX_EMAIL" \
  | jq '.results[:3] | .[] | {id, display_name, cited_by_count}'
```
Works for: `autocomplete/works`, `autocomplete/authors`, `autocomplete/sources`, `autocomplete/institutions`, `autocomplete/topics`

## OpenAlex IDs

`W` = works, `A` = authors, `S` = sources, `I` = institutions, `T` = topics.

## Per-request cost

singleton=1 credit, list=10, group_by=10. Budget accordingly for batch operations.

## Error Handling

- `403` or `401` -> `OPENALEX_API_KEY` is set but invalid. Unset it to fall back to the (free) anonymous/polite pool, or supply a valid key. Check: `echo ${OPENALEX_API_KEY:0:8}...`
- Empty `results` array -> query too narrow. Try: broader date range, fewer filters, alternate spelling, or check the topic/author ID via autocomplete.
- `429 Too Many Requests` -> rate limit hit. Set `OPENALEX_EMAIL` for the polite pool (10 req/s). Wait 2s and retry.
- Malformed JSON in response -> likely a network truncation. Retry the request.
