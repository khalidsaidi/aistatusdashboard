# Discoverability Audit

Self-service checklist for AIStatusDashboard discovery surfaces. This page lists the required public endpoints, their expected status codes, and content types.

Last verified: 2026-01-13T21:05:00+00:00

## Required endpoints

| URL | Expected status | Content-Type |
| --- | --- | --- |
| https://aistatusdashboard.com/ai | 200 | text/html |
| https://aistatusdashboard.com/robots.txt | 200 | text/plain |
| https://aistatusdashboard.com/sitemap.xml | 200 | application/xml |
| https://aistatusdashboard.com/rss.xml | 200 | application/rss+xml |
| https://aistatusdashboard.com/llms.txt | 200 | text/plain |
| https://aistatusdashboard.com/llms-full.txt | 200 | text/plain |
| https://aistatusdashboard.com/discovery/audit | 200 | text/html |
| https://aistatusdashboard.com/discovery/audit/latest.json | 200 | application/json |
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

## robots.txt policy

```
User-agent: *
Allow: /
Disallow: /app/
Disallow: /account/
Disallow: /org/
Disallow: /billing/
Disallow: /api/private/

# Public discovery surfaces (explicitly allowed)
Allow: /ai
Allow: /docs
Allow: /docs/
Allow: /status
Allow: /providers
Allow: /provider/
Allow: /incidents
Allow: /incidents/
Allow: /datasets
Allow: /datasets/
Allow: /api/public/
Allow: /llms.txt
Allow: /llms-full.txt
Allow: /openapi.json
Allow: /openapi.yaml
Allow: /openapi-3.0.json
Allow: /openapi-3.0.yaml
Allow: /.well-known/
Allow: /rss.xml
Allow: /sitemap.xml
Allow: /discovery/audit
Allow: /discovery/audit/

Sitemap: https://aistatusdashboard.com/sitemap.xml
```

## Header snapshots

```
HTTP/2 200
cache-control: max-age=300, private
x-robots-tag: index,follow
```

- https://aistatusdashboard.com/sitemap.xml

```
HTTP/2 200
cache-control: max-age=60, private
x-robots-tag: index,follow
```

- https://aistatusdashboard.com/rss.xml

```
HTTP/2 200
cache-control: max-age=60, private
x-robots-tag: index,follow
```

- https://aistatusdashboard.com/discovery/audit/latest.json

```
HTTP/2 200
cache-control: max-age=300, private
```

- https://aistatusdashboard.com/robots.txt

## Verify with curl

```bash
curl -i https://aistatusdashboard.com/sitemap.xml
curl -i https://aistatusdashboard.com/rss.xml
curl -i https://aistatusdashboard.com/datasets/incidents.ndjson
curl -i https://aistatusdashboard.com/datasets/metrics.csv
curl -i https://aistatusdashboard.com/llms.txt
curl -i https://aistatusdashboard.com/openapi.yaml
curl -i https://aistatusdashboard.com/discovery/audit/latest.json
```

## Notes

- All URLs must return HTTP 200 for a plain GET with a generic User-Agent.
- RSS and sitemap should be valid XML and cacheable.
- Dataset downloads must be cacheable and return correct content types.
- Firebase App Hosting currently appends `private` to Cache-Control responses even when public caching is requested; the policy checks and CI still enforce the intended public directives.
