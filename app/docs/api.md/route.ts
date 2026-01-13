export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const body = `# API Docs

Base URL: https://aistatusdashboard.com

## Key endpoints
- GET /api/public/v1/status/summary
- GET /api/public/v1/incidents
- GET /api/public/v1/providers
- GET /metrics/{series_id}.json

OpenAPI:
- https://aistatusdashboard.com/openapi.json
- https://aistatusdashboard.com/openapi.yaml

## Example
\`\`\`bash
curl https://aistatusdashboard.com/api/public/v1/status/summary
\`\`\`
`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
