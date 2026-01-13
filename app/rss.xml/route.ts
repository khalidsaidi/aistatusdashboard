import { NextResponse } from 'next/server';
import { intelligenceService } from '@/lib/services/intelligence';
import { normalizeIncidentDates, normalizeMaintenanceDates } from '@/lib/utils/normalize-dates';

export const dynamic = 'force-dynamic';

const SITE_URL = 'https://aistatusdashboard.com';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const now = new Date().toUTCString();
  const incidents = (await intelligenceService.getIncidents({ limit: 25 })).map(normalizeIncidentDates);
  const maintenances = (await intelligenceService.getMaintenances({ limit: 10 })).map(normalizeMaintenanceDates);

  const items = [
    ...incidents.map((incident) => ({
      title: `${incident.providerId}: ${incident.title}`,
      link: `${SITE_URL}/incidents/${incident.providerId}:${incident.id}`,
      guid: `incident-${incident.providerId}:${incident.id}`,
      pubDate: new Date(incident.updatedAt).toUTCString(),
      description: incident.title,
    })),
    ...maintenances.map((maintenance) => ({
      title: `${maintenance.providerId}: ${maintenance.title}`,
      link: `${SITE_URL}/incidents/${maintenance.providerId}:${maintenance.id}`,
      guid: `maintenance-${maintenance.providerId}:${maintenance.id}`,
      pubDate: new Date(maintenance.updatedAt).toUTCString(),
      description: maintenance.title,
    })),
  ];

  const itemsXml = items
    .map(
      (i) => `<item>
      <title>${escapeXml(i.title)}</title>
      <link>${escapeXml(i.link)}</link>
      <guid>${escapeXml(i.guid)}</guid>
      <pubDate>${escapeXml(i.pubDate)}</pubDate>
      <description>${escapeXml(i.description)}</description>
    </item>`
    )
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AI Status Dashboard Incidents</title>
    <link>${SITE_URL}/</link>
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
