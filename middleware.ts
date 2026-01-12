import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const DEFAULT_CANONICAL_HOST = 'aistatusdashboard.com';

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

  // PERFORMANCE FIX: Handle HEAD requests efficiently
  if (request.method === 'HEAD') {
    // For HEAD requests, return minimal response without executing heavy server components
    const response = new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
        'X-Response-Time': '1ms',
        'X-Optimized': 'head-request',
      },
    });

    return response;
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
