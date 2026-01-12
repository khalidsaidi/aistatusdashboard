import { NextRequest, NextResponse } from 'next/server';
import { providerService } from '@/lib/services/providers';

export const dynamic = 'force-dynamic';

function getRequestOrigin(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost?.split(',')[0]?.trim() || request.headers.get('host');
  const proto = forwardedProto?.split(',')[0]?.trim();

  if (proto && host) return `${proto}://${host}`;
  if (host) return `${request.nextUrl.protocol}//${host}`;
  return request.nextUrl.origin;
}

function buildUrl(loc: string, lastmod: string, changefreq: string, priority: string) {
  return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const now = new Date().toISOString();

  const providers = providerService.getProviders();
  const urls: string[] = [
    buildUrl(`${origin}/`, now, 'always', '1.0'),
    buildUrl(`${origin}/ai`, now, 'always', '0.9'),
    buildUrl(`${origin}/status`, now, 'always', '0.9'),
    buildUrl(`${origin}/status.md`, now, 'daily', '0.8'),
    buildUrl(`${origin}/docs`, now, 'weekly', '0.7'),
    buildUrl(`${origin}/docs.md`, now, 'weekly', '0.7'),
    buildUrl(`${origin}/docs/api`, now, 'weekly', '0.6'),
    buildUrl(`${origin}/docs/api.md`, now, 'weekly', '0.6'),
    buildUrl(`${origin}/docs/agent/mcp-quickstart`, now, 'weekly', '0.6'),
    buildUrl(`${origin}/docs/agent/mcp-quickstart.md`, now, 'weekly', '0.6'),
    buildUrl(`${origin}/providers`, now, 'daily', '0.8'),
    buildUrl(`${origin}/providers.md`, now, 'daily', '0.7'),
    buildUrl(`${origin}/incidents`, now, 'hourly', '0.7'),
    buildUrl(`${origin}/datasets`, now, 'weekly', '0.6'),
    buildUrl(`${origin}/datasets/incidents`, now, 'weekly', '0.6'),
    buildUrl(`${origin}/datasets/metrics`, now, 'weekly', '0.6'),
    buildUrl(`${origin}/how-it-works`, now, 'monthly', '0.6'),
    buildUrl(`${origin}/llms.txt`, now, 'daily', '0.7'),
    buildUrl(`${origin}/llms-full.txt`, now, 'daily', '0.6'),
    buildUrl(`${origin}/rss.xml`, now, 'hourly', '0.8'),
  ];

  providers.forEach((provider) => {
    urls.push(buildUrl(`${origin}/provider/${provider.id}`, now, 'hourly', '0.7'));
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
