import { NextResponse } from 'next/server';

const BODY = `# AI Status Dashboard - Full LLM Discovery Guide

## Overview
AI Status Dashboard is an AI reliability control plane: status, incidents, metrics, and fallback policy generation across major AI providers.

## Core Endpoints
- Landing: https://aistatusdashboard.com/ai
- MCP server: https://aistatusdashboard.com/mcp
- OpenAPI (JSON): https://aistatusdashboard.com/openapi.json
- OpenAPI (YAML): https://aistatusdashboard.com/openapi.yaml
- Plugin manifest: https://aistatusdashboard.com/.well-known/ai-plugin.json
- Well-known OpenAPI: https://aistatusdashboard.com/.well-known/openapi.json
- RSS/Atom: https://aistatusdashboard.com/rss.xml
- Sitemap: https://aistatusdashboard.com/sitemap.xml
- Discovery audit JSON: https://aistatusdashboard.com/discovery/audit/latest.json
- Discovery audit HTML: https://aistatusdashboard.com/discovery/audit

## Datasets
- Index: https://aistatusdashboard.com/datasets
- Incidents NDJSON: https://aistatusdashboard.com/datasets/incidents.ndjson
- Metrics CSV: https://aistatusdashboard.com/datasets/metrics.csv

## Docs (Markdown mirrors)
- Main docs: https://aistatusdashboard.com/docs.md
- API: https://aistatusdashboard.com/docs/api.md
- MCP Quickstart: https://aistatusdashboard.com/docs/agent/mcp-quickstart.md
- Status: https://aistatusdashboard.com/status.md
- Providers: https://aistatusdashboard.com/providers.md
- Citations: https://aistatusdashboard.com/docs/citations.md

## MCP Quickstart
\`\`\`
Endpoint: https://aistatusdashboard.com/mcp
Tools: status_summary, search_incidents, list_providers
\`\`\`

## REST Quickstart (curl)
\`\`\`
curl https://aistatusdashboard.com/api/public/v1/status/summary
curl \"https://aistatusdashboard.com/api/public/v1/incidents?provider=openai&limit=5\"
curl https://aistatusdashboard.com/api/public/v1/providers
\`\`\`

## Evidence endpoints
- https://aistatusdashboard.com/api/public/v1/status/summary
- https://aistatusdashboard.com/api/public/v1/incidents

## Citing
See https://aistatusdashboard.com/docs/citations.md and /incidents/{id}/cite for evidence bundles.

## Notes
- Plain text / markdown only
- Updated regularly
`;

export async function GET() {
  return new NextResponse(BODY, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
