import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date().toUTCString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AI Status Dashboard Incidents</title>
    <link>https://aistatusdashboard.com/</link>
    <description>Incidents and maintenances</description>
    <lastBuildDate>${now}</lastBuildDate>
    <item>
      <title>Placeholder incident feed</title>
      <link>https://aistatusdashboard.com/incidents</link>
      <guid>placeholder</guid>
      <pubDate>${now}</pubDate>
      <description>Incidents feed placeholder.</description>
    </item>
  </channel>
</rss>`;
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
