import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date().toUTCString();
  const items = [
    {
      title: 'Incidents feed (placeholder)',
      link: 'https://aistatusdashboard.com/incidents',
      guid: 'placeholder',
      pubDate: now,
      description: 'Incidents and maintenances feed will list latest items here.',
    },
  ];
  const itemsXml = items
    .map(
      (i) => `<item>
      <title>${i.title}</title>
      <link>${i.link}</link>
      <guid>${i.guid}</guid>
      <pubDate>${i.pubDate}</pubDate>
      <description>${i.description}</description>
    </item>`
    )
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AI Status Dashboard Incidents</title>
    <link>https://aistatusdashboard.com/</link>
    <description>Incidents and maintenances</description>
    <lastBuildDate>${now}</lastBuildDate>
    ${itemsXml}
  </channel>
</rss>`;
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
