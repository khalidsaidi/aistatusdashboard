export const dynamic = 'force-dynamic';

export async function GET() {
  const body = `# AIStatusDashboard Docs

## Quick links
- https://aistatusdashboard.com/docs/api
- https://aistatusdashboard.com/docs/agent/mcp-quickstart
- https://aistatusdashboard.com/docs/agent/mcp-tools
- https://aistatusdashboard.com/datasets

## OpenAPI
- https://aistatusdashboard.com/openapi.json
- https://aistatusdashboard.com/openapi.yaml

## MCP
- https://aistatusdashboard.com/mcp
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
