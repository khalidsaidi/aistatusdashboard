import { NextRequest, NextResponse } from 'next/server';
import { getAllProvidersList } from '@/lib/providers';
import { checkRateLimit } from '@/lib/thread-safe-rate-limiter';

/**
 * PROVIDERS ENDPOINT
 *
 * Returns list of all available providers with their configuration.
 * Used by frontend and tests to get provider information.
 */

function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || realIp || 'unknown';
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Rate limiting
    const clientId = getClientId(request);
    const rateLimitResult = await checkRateLimit(`providers:${clientId}`, 60, 60000); // 60 requests per minute

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60',
            'X-RateLimit-Limit': '60',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
          },
        }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const enabled = searchParams.get('enabled');
    const category = searchParams.get('category');
    const format = searchParams.get('format');

    // Filter providers based on query parameters
    let filteredProviders = getAllProvidersList();

    if (enabled === 'true') {
      filteredProviders = filteredProviders.filter((p) => p.enabled);
    } else if (enabled === 'false') {
      filteredProviders = filteredProviders.filter((p) => !p.enabled);
    }

    if (category) {
      filteredProviders = filteredProviders.filter(
        (p) => p.category?.toLowerCase() === category.toLowerCase()
      );
    }

    if (format) {
      filteredProviders = filteredProviders.filter((p) => p.format === format);
    }

    // Prepare response data
    const responseData = {
      providers: filteredProviders.map((provider) => ({
        id: provider.id,
        name: provider.name,
        enabled: provider.enabled,
        category: provider.category || 'AI Services',
        format: provider.format,
        statusPageUrl: provider.statusPageUrl,
        priority: provider.priority || 1,
        description: `${provider.name} AI service status`,
        // Don't expose internal URLs for security
        hasStatusUrl: !!provider.statusUrl,
        hasApiUrl: false,
      })),
      metadata: {
        total: filteredProviders.length,
        enabled: filteredProviders.filter((p) => p.enabled).length,
        disabled: filteredProviders.filter((p) => !p.enabled).length,
        categories: Array.from(new Set(filteredProviders.map((p) => p.category || 'AI Services'))),
        formats: Array.from(new Set(filteredProviders.map((p) => p.format))),
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      },
      filters: {
        enabled: enabled || 'all',
        category: category || 'all',
        format: format || 'all',
      },
    };

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'X-Total-Providers': filteredProviders.length.toString(),
        'X-Response-Time': `${Date.now() - startTime}ms`,
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      },
    });
  } catch (error) {
    // Error handled by response

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch providers',
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          'X-Response-Time': `${Date.now() - startTime}ms`,
        },
      }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // POST method for future provider management (admin only)
  return NextResponse.json(
    {
      error: 'Method not implemented',
      message: 'Provider management not yet available',
    },
    { status: 501 }
  );
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  // PUT method for future provider updates (admin only)
  return NextResponse.json(
    {
      error: 'Method not implemented',
      message: 'Provider updates not yet available',
    },
    { status: 501 }
  );
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // DELETE method for future provider removal (admin only)
  return NextResponse.json(
    {
      error: 'Method not implemented',
      message: 'Provider deletion not yet available',
    },
    { status: 501 }
  );
}
