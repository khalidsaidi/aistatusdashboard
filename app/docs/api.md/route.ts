export const dynamic = 'force-dynamic';

export async function GET() {
  const body = `# AIStatusDashboard Public API

Base URL: https://aistatusdashboard.com/api/public/v1

## Endpoints
- GET /providers
- GET /providers/{provider}/surfaces
- GET /providers/{provider}/regions
- GET /providers/{provider}/models
- GET /status/summary
- GET /status/health-matrix
- GET /incidents
- GET /incidents/{incident_id}
- GET /metrics
- POST /recommendations/fallback_plan
- POST /policy/generate

## OpenAPI
- https://aistatusdashboard.com/openapi.json
- https://aistatusdashboard.com/openapi.yaml
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
