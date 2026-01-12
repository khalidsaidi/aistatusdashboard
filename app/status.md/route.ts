export const dynamic = 'force-dynamic';

export async function GET() {
  const body = `# Status

This page mirrors public status data and links to the JSON endpoints.

- Summary: https://aistatusdashboard.com/api/public/v1/status/summary
- Incidents: https://aistatusdashboard.com/api/public/v1/incidents
- RSS: https://aistatusdashboard.com/rss.xml
`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
