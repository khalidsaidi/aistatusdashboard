# Discoverability Audit

Self-service checklist for AIStatusDashboard discovery surfaces. This page lists the required public endpoints, their expected status codes, and content types.

Last verified: 2026-01-13T07:25:16+00:00

## Required endpoints

| URL | Expected status | Content-Type |
| --- | --- | --- |
| https://aistatusdashboard.com/ai | 200 | text/html |
| https://aistatusdashboard.com/robots.txt | 200 | text/plain |
| https://aistatusdashboard.com/sitemap.xml | 200 | application/xml |
| https://aistatusdashboard.com/rss.xml | 200 | application/rss+xml |
| https://aistatusdashboard.com/llms.txt | 200 | text/plain |
| https://aistatusdashboard.com/llms-full.txt | 200 | text/plain |
| https://aistatusdashboard.com/openapi.json | 200 | application/json |
| https://aistatusdashboard.com/openapi.yaml | 200 | application/yaml |
| https://aistatusdashboard.com/.well-known/openapi.json | 200 | application/json |
| https://aistatusdashboard.com/.well-known/ai-plugin.json | 200 | application/json |
| https://aistatusdashboard.com/mcp | 200 | text/plain |
| https://aistatusdashboard.com/providers | 200 | text/html |
| https://aistatusdashboard.com/datasets/incidents.ndjson | 200 | application/x-ndjson |
| https://aistatusdashboard.com/datasets/metrics.csv | 200 | text/csv |
| https://aistatusdashboard.com/docs.md | 200 | text/markdown |
| https://aistatusdashboard.com/docs/api.md | 200 | text/markdown |
| https://aistatusdashboard.com/docs/citations.md | 200 | text/markdown |
| https://aistatusdashboard.com/docs/agent/mcp-quickstart.md | 200 | text/markdown |

## Verify with curl

```bash
curl -i https://aistatusdashboard.com/sitemap.xml
curl -i https://aistatusdashboard.com/rss.xml
curl -i https://aistatusdashboard.com/datasets/incidents.ndjson
curl -i https://aistatusdashboard.com/datasets/metrics.csv
curl -i https://aistatusdashboard.com/llms.txt
curl -i https://aistatusdashboard.com/openapi.yaml
```

## Notes

- All URLs must return HTTP 200 for a plain GET with a generic User-Agent.
- RSS and sitemap should be valid XML and cacheable.
- Dataset downloads must be cacheable and return correct content types.
