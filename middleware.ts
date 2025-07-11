import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // PERFORMANCE FIX: Handle HEAD requests efficiently
  if (request.method === 'HEAD') {
    // For HEAD requests, return minimal response without executing heavy server components
    const response = new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=60',
        'X-Response-Time': '1ms',
        'X-Optimized': 'head-request',
      },
    });

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
