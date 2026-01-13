export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const body = `# AIStatusDashboard Docs

AI Status Dashboard is a reliability control plane for AI providers. Use these docs to integrate the REST API, MCP tools, datasets, and citation endpoints.

## Quick links
- https://aistatusdashboard.com/ai
- https://aistatusdashboard.com/docs/api
- https://aistatusdashboard.com/docs/agent/mcp-quickstart
- https://aistatusdashboard.com/docs/agent/mcp-tools
- https://aistatusdashboard.com/datasets
- https://aistatusdashboard.com/status
- https://aistatusdashboard.com/providers

## OpenAPI
- https://aistatusdashboard.com/openapi.json
- https://aistatusdashboard.com/openapi.yaml

## MCP
- https://aistatusdashboard.com/mcp
- Registry: https://registry.modelcontextprotocol.io/v0.1/servers/io.github.aistatusdashboard%2Faistatusdashboard/versions/latest

## Citing
- https://aistatusdashboard.com/docs/citations.md
- https://aistatusdashboard.com/incidents/{id}/cite
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
