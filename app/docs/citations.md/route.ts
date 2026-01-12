export const dynamic = 'force-dynamic';

export async function GET() {
  const body = `# Citing AI Status Dashboard

Use these references when citing incidents, metrics, or datasets.

- Homepage: https://aistatusdashboard.com/
- AI landing: https://aistatusdashboard.com/ai
- OpenAPI: https://aistatusdashboard.com/openapi.json
- MCP: https://aistatusdashboard.com/mcp
- Datasets: https://aistatusdashboard.com/datasets
- Incident citation endpoint: https://aistatusdashboard.com/incidents/{id}/cite

## How to cite incidents
1. Use the /incidents/{id}/cite endpoint for a JSON evidence bundle.
2. Include the permalink and generated_at timestamp.
3. Include source_urls (official status pages) from the cite payload.

## How to cite datasets
- Incidents NDJSON: https://aistatusdashboard.com/datasets/incidents.ndjson
- Metrics Parquet: https://aistatusdashboard.com/datasets/metrics.parquet

Include temporal coverage and the retrieval date in your citation.
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
