import { persistenceService } from '@/lib/services/persistence';

export async function generateRSSFeed(options: {
    provider?: string;
    limit?: number;
    siteUrl?: string;
} = {}): Promise<string> {
    const history = await persistenceService.getHistory({
        providerId: options.provider,
        limit: options.limit || 50
    });

    const siteUrl = options.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const title = options.provider
        ? `AI Status Dashboard - ${options.provider} Status`
        : 'AI Status Dashboard - All Providers';

    const items = history.map(item => `
    <item>
      <title>${item.name}: ${item.status.toUpperCase()}</title>
      <link>${item.statusPageUrl || siteUrl}</link>
      <guid>${item.id}-${item.checkedAt}</guid>
      <pubDate>${new Date(item.checkedAt).toUTCString()}</pubDate>
      <description><![CDATA[
        <p>Status: ${item.status}</p>
        <p>Response Time: ${item.responseTime}ms</p>
        ${item.error ? `<p>Error: ${item.error}</p>` : ''}
      ]]></description>
    </item>
  `).join('');

    return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${title}</title>
    <link>${siteUrl}</link>
    <description>Real-time status updates for AI providers.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;
}
