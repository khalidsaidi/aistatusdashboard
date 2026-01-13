import { NextRequest, NextResponse } from 'next/server';
import { intelligenceService } from '@/lib/services/intelligence';
import { normalizeIncidentDates, normalizeMaintenanceDates } from '@/lib/utils/normalize-dates';
import { log } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SITE_URL = 'https://aistatusdashboard.com';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(request: NextRequest) {
  try {
    const providerId = request.nextUrl.searchParams.get('provider') || undefined;
    const now = new Date().toUTCString();
    const incidents = (await intelligenceService.getIncidents({ limit: 25, providerId })).map(normalizeIncidentDates);
    const maintenances = (await intelligenceService.getMaintenances({ limit: 10, providerId })).map(
      normalizeMaintenanceDates
    );
    const titleSuffix = providerId ? ` (${providerId})` : '';

    const items = [
      ...incidents.map((incident) => ({
        title: `${incident.providerId}: ${incident.title}`,
        link: `${SITE_URL}/incidents/${incident.providerId}:${incident.id}`,
        guid: `incident-${incident.providerId}:${incident.id}`,
        pubDate: new Date(incident.updatedAt).toUTCString(),
        description: incident.title,
        category: incident.providerId,
      })),
      ...maintenances.map((maintenance) => ({
        title: `${maintenance.providerId}: ${maintenance.title}`,
        link: `${SITE_URL}/incidents/${maintenance.providerId}:${maintenance.id}`,
        guid: `maintenance-${maintenance.providerId}:${maintenance.id}`,
        pubDate: new Date(maintenance.updatedAt).toUTCString(),
        description: maintenance.title,
        category: maintenance.providerId,
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
      <category>${escapeXml(i.category)}</category>
    </item>`
      )
      .join('\n');

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AI Status Dashboard Incidents${titleSuffix}</title>
    <link>${SITE_URL}/</link>
    <description>Incidents and maintenances</description>
    <lastBuildDate>${now}</lastBuildDate>
    <ttl>60</ttl>
    ${itemsXml}
  </channel>
</rss>`;
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=120',
      },
    });
  } catch (error) {
    log('error', 'RSS feed generation failed', { error });
    const now = new Date().toUTCString();
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AI Status Dashboard Incidents</title>
    <link>${SITE_URL}/</link>
    <description>Incidents and maintenances</description>
    <lastBuildDate>${now}</lastBuildDate>
    <ttl>60</ttl>
  </channel>
</rss>`;
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=120',
        'X-Feed-Status': 'fallback',
      },
    });
  }
}
