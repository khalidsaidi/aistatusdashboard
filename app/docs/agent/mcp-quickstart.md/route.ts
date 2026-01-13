export const dynamic = 'force-dynamic';

export async function GET() {
  const body = `# MCP Quickstart

Endpoint: https://aistatusdashboard.com/mcp
Registry: https://registry.modelcontextprotocol.io/v0.1/servers/io.github.aistatusdashboard%2Faistatusdashboard/versions/latest
OpenAPI: https://aistatusdashboard.com/openapi.json

## Example call
\`\`\`json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "status.get_summary",
    "arguments": { "provider": "openai", "window_seconds": 1800 }
  }
}
\`\`\`
`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
