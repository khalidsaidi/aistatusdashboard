export const dynamic = 'force-dynamic';

export async function GET() {
  const body = [
    '# AIStatusDashboard MCP Quickstart',
    '',
    'Endpoint: https://aistatusdashboard.com/mcp',
    '',
    '## Example call',
    '',
    '```json',
    '{',
    '  "jsonrpc": "2.0",',
    '  "id": 1,',
    '  "method": "tools/call",',
    '  "params": {',
    '    "name": "status.get_summary",',
    '    "arguments": { "provider": "openai", "window_seconds": 1800 }',
    '  }',
    '}',
    '```',
    '',
    '## Tools',
    '- status.get_summary',
    '- status.get_health_matrix',
    '- incidents.search',
    '- incidents.get',
    '- metrics.query',
    '- recommendations.get_fallback_plan',
    '- policy.generate',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
