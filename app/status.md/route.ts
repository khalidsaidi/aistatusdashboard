export const dynamic = 'force-dynamic';

export async function GET() {
  const body = `# AIStatusDashboard Status

Live status dashboard:
https://aistatusdashboard.com/status

JSON API:
https://aistatusdashboard.com/api/public/v1/status/summary
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
