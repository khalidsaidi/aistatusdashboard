import { NextResponse } from 'next/server';

const BODY = `# AI Status Dashboard

> AI reliability control plane: status, incidents, datasets, and MCP tools. Start here: https://aistatusdashboard.com/ai

## Core endpoints
- MCP server: https://aistatusdashboard.com/mcp
- OpenAPI: https://aistatusdashboard.com/openapi.json
- Plugin manifest: https://aistatusdashboard.com/.well-known/ai-plugin.json
- OpenAPI (well-known): https://aistatusdashboard.com/.well-known/openapi.json

## Datasets
- https://aistatusdashboard.com/datasets
- https://aistatusdashboard.com/datasets/incidents.ndjson
- https://aistatusdashboard.com/datasets/metrics.csv

## Docs (Markdown mirrors)
- https://aistatusdashboard.com/docs.md
- https://aistatusdashboard.com/docs/api.md
- https://aistatusdashboard.com/docs/agent/mcp-quickstart.md
- https://aistatusdashboard.com/status.md
- https://aistatusdashboard.com/providers.md
- https://aistatusdashboard.com/docs/citations.md

## Citing
- https://aistatusdashboard.com/docs/citations.md

## Feeds
- RSS: https://aistatusdashboard.com/rss.xml
- Sitemap: https://aistatusdashboard.com/sitemap.xml
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
