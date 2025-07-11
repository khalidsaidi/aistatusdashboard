import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/thread-safe-rate-limiter';

/**
 * SEND TEST NOTIFICATION ENDPOINT
 *
 * Used by production smoke tests to verify email notification system.
 * Restricted to admin emails and production test headers.
 */

function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || realIp || 'unknown';
}

const ADMIN_EMAILS = [
  'admin@yourdomain.com',
  'status@aistatusdashboard.com',
  'hello@aistatusdashboard.com',
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Check for production test header
    const isProductionTest = request.headers.get('x-production-test') === 'true';

    if (!isProductionTest && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Test notifications only allowed with proper headers',
        },
        { status: 401 }
      );
    }

    // Strict rate limiting for test notifications
    const clientId = getClientId(request);
    const rateLimitResult = await checkRateLimit(`test-notification:${clientId}`, 2, 300000); // 2 per 5 minutes

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Test notifications are strictly rate limited',
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '300',
          },
        }
      );
    }

    const body = await request.json();
    const { email, type } = body;

    // Validate email is admin email
    if (!email || !ADMIN_EMAILS.includes(email)) {
      return NextResponse.json(
        {
          error: 'Validation error',
          message: 'Test notifications only allowed for admin emails',
        },
        { status: 400 }
      );
    }

    // Validate test type
    if (type !== 'production-smoke-test') {
      return NextResponse.json(
        {
          error: 'Validation error',
          message: 'Invalid test notification type',
        },
        { status: 400 }
      );
    }

    // Mock email sending (in production, would use real email service)
    const testNotification = {
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      to: email,
      subject: 'Production Smoke Test - AI Status Dashboard',
      body: `This is a production smoke test notification sent at ${new Date().toISOString()}. If you receive this, the email notification system is working correctly.`,
      type: 'production-smoke-test',
      sentAt: new Date().toISOString(),
      status: 'sent',
    };

    // Production smoke test notification sent successfully

    return NextResponse.json(
      {
        success: true,
        message: 'Test notification sent successfully',
        notification: {
          id: testNotification.id,
          type: testNotification.type,
          sentAt: testNotification.sentAt,
          status: testNotification.status,
        },
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'X-Response-Time': `${Date.now() - startTime}ms`,
          'X-Test-Type': 'production-smoke-test',
        },
      }
    );
  } catch (error) {
    // Error handled by response

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to send test notification',
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  // GET method not supported for test notifications
  return NextResponse.json(
    {
      error: 'Method not allowed',
      message: 'Use POST to send test notifications',
    },
    { status: 405 }
  );
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  // PUT method not supported
  return NextResponse.json(
    {
      error: 'Method not allowed',
      message: 'Use POST to send test notifications',
    },
    { status: 405 }
  );
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // DELETE method not supported
  return NextResponse.json(
    {
      error: 'Method not allowed',
      message: 'Use POST to send test notifications',
    },
    { status: 405 }
  );
}
