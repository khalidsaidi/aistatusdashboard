import { NextRequest, NextResponse } from 'next/server';

/**
 * INCIDENTS API PROXY
 * 
 * This route proxies requests to Firebase Functions with basic security
 */

const FIREBASE_FUNCTIONS_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 
  'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net';

// Simple rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

function checkRateLimit(clientId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const limit = rateLimitMap.get(clientId);
  
  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  
  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((limit.resetTime - now) / 1000) };
  }
  
  limit.count++;
  return { allowed: true };
}

function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || realIp || 'unknown';
}

async function proxyToFirebase(request: NextRequest, method: string): Promise<NextResponse> {
  const clientId = getClientId(request);
  
  // Check rate limit
  const rateLimitResult = checkRateLimit(clientId);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', message: 'Too many requests' },
      { 
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
        }
      }
    );
  }

  try {
    const url = new URL(request.url);
    const firebaseUrl = `${FIREBASE_FUNCTIONS_BASE}/api/incidents${url.search}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Copy relevant headers from the original request
    const userAgent = request.headers.get('user-agent');
    if (userAgent) {
      headers['User-Agent'] = userAgent;
    }
    
    const fetchOptions: RequestInit = {
      method,
      headers,
    };
    
    // For POST requests, include the body with validation
    if (method === 'POST' && request.body) {
      const body = await request.text();
      
      // Basic input validation
      if (body.length > 10000) { // 10KB limit
        return NextResponse.json(
          { error: 'Request body too large' },
          { status: 413 }
        );
      }
      
      fetchOptions.body = body;
    }
    
    const response = await fetch(firebaseUrl, fetchOptions);
    const data = await response.text();
    
    // Return the response with CORS headers
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'X-RateLimit-Remaining': (RATE_LIMIT_MAX_REQUESTS - (rateLimitMap.get(clientId)?.count || 0)).toString()
      },
    });
    
  } catch (error) {
    return NextResponse.json({
      error: 'Proxy error',
      message: 'Failed to connect to Firebase Functions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 502,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxyToFirebase(request, 'GET');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxyToFirebase(request, 'POST');
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 