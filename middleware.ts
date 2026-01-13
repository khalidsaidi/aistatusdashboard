import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DEFAULT_CANONICAL_HOST = 'aistatusdashboard.com';
const DISCOVERY_EXTENSIONS = ['.xml', '.yaml', '.md', '.ndjson', '.csv'];
const DISCOVERY_BUILD_ID =
  process.env.APP_BUILD_ID || process.env.GITHUB_SHA || process.env.COMMIT_SHA || 'unknown';

function shouldBypassCache(request: NextRequest): boolean {
  const accept = request.headers.get('accept') || '';
  const fetchDest = request.headers.get('sec-fetch-dest') || '';
  return accept.includes('text/html') || fetchDest === 'document';
}

function getCanonicalHost(): string | null {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return null;

  try {
    return new URL(siteUrl).host;
  } catch {
    return DEFAULT_CANONICAL_HOST;
  }
}

function isDiscoveryAsset(pathname: string): boolean {
  if (pathname === '/rss.xml' || pathname === '/sitemap.xml') return true;
  if (pathname.startsWith('/datasets/')) return true;
  if (pathname.startsWith('/docs/') && pathname.endsWith('.md')) return true;
  if (pathname === '/docs.md' || pathname === '/status.md' || pathname === '/providers.md') return true;
  if (pathname === '/openapi.yaml' || pathname === '/openapi-3.0.yaml') return true;
  return DISCOVERY_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

function applyDiscoveryHeaders(response: NextResponse, pathname: string) {
  response.headers.set('X-Discovery-Handler', 'static');
  response.headers.set('X-Discovery-Build', DISCOVERY_BUILD_ID);
  response.headers.set('X-Discovery-Runtime', 'static');

  if (pathname === '/rss.xml') {
    response.headers.set('Content-Type', 'application/rss+xml; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
    return;
  }

  if (pathname === '/sitemap.xml') {
    response.headers.set('Content-Type', 'application/xml; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    return;
  }

  if (pathname.endsWith('.yaml')) {
    response.headers.set('Content-Type', 'text/yaml; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    return;
  }

  if (pathname.endsWith('.md')) {
    response.headers.set('Content-Type', 'text/markdown; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    return;
  }

  if (pathname.endsWith('.ndjson')) {
    response.headers.set('Content-Type', 'application/x-ndjson; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
    return;
  }

  if (pathname.endsWith('.csv')) {
    response.headers.set('Content-Type', 'text/csv; charset=utf-8');
    response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const canonicalHost = getCanonicalHost();
  const currentHost = request.headers.get('host');
  const currentHostname = currentHost ? currentHost.split(':')[0] : null;

  if (process.env.NODE_ENV === 'production' && canonicalHost && currentHostname) {
    const wwwHost = `www.${canonicalHost}`;
    if (currentHostname === wwwHost) {
      const url = request.nextUrl.clone();
      url.hostname = canonicalHost;
      url.port = '';
      url.protocol = 'https:';
      return NextResponse.redirect(url, 308);
    }
  }

  if (isDiscoveryAsset(pathname)) {
    const response = NextResponse.next();
    applyDiscoveryHeaders(response, pathname);
    return response;
  }

  // PERFORMANCE: only short-circuit HEAD requests that are clearly HTML page fetches.
  if (request.method === 'HEAD') {
    const accept = request.headers.get('accept') || '';
    const fetchDest = request.headers.get('sec-fetch-dest') || '';
    const isHtmlIntent = accept.includes('text/html') || fetchDest === 'document';
    if (isHtmlIntent) {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
          'X-Response-Time': '1ms',
          'X-Optimized': 'head-request',
        },
      });
    }
  }

  const response = NextResponse.next();

  const privatePrefixes = ['/app', '/account', '/org', '/billing', '/api/private'];
  if (privatePrefixes.some((prefix) => pathname.startsWith(prefix))) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  if (request.method === 'GET' && shouldBypassCache(request)) {
    // Keep HTML uncached so deploys never serve stale shells with missing JS chunks.
    response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
    const existingVary = response.headers.get('Vary');
    response.headers.set('Vary', existingVary ? `${existingVary}, Accept` : 'Accept');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/api/private/:path*',
  ],
};
