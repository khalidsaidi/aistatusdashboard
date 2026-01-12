import { intelligenceService } from '@/lib/services/intelligence';
import { normalizeIncidentDates, normalizeMaintenanceDates } from '@/lib/utils/normalize-dates';

export async function generateRSSFeed(options: {
  provider?: string;
  limit?: number;
  siteUrl?: string;
} = {}): Promise<string> {
  const limit = options.limit || 50;
  const [incidents, maintenances] = await Promise.all([
    intelligenceService.getIncidents({ providerId: options.provider, limit }),
    intelligenceService.getMaintenances({ providerId: options.provider, limit }),
  ]);

  const normalizedIncidents = incidents.map(normalizeIncidentDates);
  const normalizedMaintenances = maintenances.map(normalizeMaintenanceDates);

  const siteUrl = options.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const title = options.provider
    ? `AI Status Dashboard - ${options.provider} Incidents`
    : 'AI Status Dashboard - Incident Updates';

  const items = [...normalizedIncidents, ...normalizedMaintenances]
    .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit)
    .map((item: any) => {
      const isMaintenance = 'scheduledFor' in item;
      const link = item.rawUrl || `${siteUrl}/incidents/${item.providerId}:${item.id}`;
      const pubDate = new Date(item.updatedAt || item.scheduledFor).toUTCString();
      const statusLabel = isMaintenance ? 'maintenance' : item.status;
      return `
    <item>
      <title>${item.title} (${statusLabel})</title>
      <link>${link}</link>
      <guid>${item.providerId}-${item.id}-${item.updatedAt}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[
        <p>Provider: ${item.providerId}</p>
        <p>Status: ${statusLabel}</p>
        <p>Severity: ${item.severity || 'n/a'}</p>
      ]]></description>
    </item>
  `;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${title}</title>
    <link>${siteUrl}</link>
    <description>Incident and maintenance updates for AI providers.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;
}
