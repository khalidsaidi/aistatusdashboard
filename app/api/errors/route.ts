import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/thread-safe-rate-limiter';

/**
 * ERROR REPORTING ENDPOINT
 * 
 * Receives error reports from error boundaries and client-side error handlers.
 * Provides centralized error logging and monitoring.
 */

function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || realIp || 'unknown';
}

// Error storage (in production, this would be sent to a monitoring service)
const errorLog: Array<{
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'critical';
  message: string;
  stack?: string;
  context: any;
  clientInfo: {
    ip: string;
    userAgent: string;
    url: string;
  };
}> = [];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // Rate limiting for error reports
    const clientId = getClientId(request);
    const rateLimitResult = await checkRateLimit(`errors:${clientId}`, 20, 60000); // 20 errors per minute
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Too many error reports'
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
          }
        }
      );
    }
    
    const body = await request.json();
    
    // Validate error report structure
    if (!body.message && !body.error) {
      return NextResponse.json(
        {
          error: 'Validation error',
          message: 'Error message is required'
        },
        { status: 400 }
      );
    }
    
    // Sanitize and process error data
    const errorReport = {
      id: body.errorId || `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: body.timestamp || new Date().toISOString(),
      level: determineErrorLevel(body),
      message: sanitizeErrorMessage(body.message || body.error),
      stack: body.stack ? sanitizeStack(body.stack) : undefined,
      context: {
        componentStack: body.componentStack,
        level: body.level,
        context: body.context,
        url: body.url,
        userAgent: body.userAgent
      },
      clientInfo: {
        ip: clientId,
        userAgent: request.headers.get('user-agent') || 'unknown',
        url: body.url || 'unknown'
      }
    };
    
    // Store error (in production, send to monitoring service)
    errorLog.unshift(errorReport);
    
    // Keep only last 1000 errors to prevent memory issues
    if (errorLog.length > 1000) {
      errorLog.splice(1000);
    }
    
    // Log error based on level
    if (errorReport.level === 'critical') {
      // Critical error reported
    } else if (errorReport.level === 'error') {
      // Error reported
    } else {
      // Warning reported
    }
    
    // In production, you would send this to services like:
    // - Sentry
    // - LogRocket
    // - Datadog
    // - Custom monitoring service
    
    return NextResponse.json(
      {
        success: true,
        errorId: errorReport.id,
        message: 'Error report received',
        timestamp: new Date().toISOString()
      },
      { 
        status: 200,
        headers: {
          'X-Response-Time': `${Date.now() - startTime}ms`
        }
      }
    );
    
  } catch (error) {
    // Error reporting endpoint failed
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to process error report',
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${Date.now() - startTime}ms`
        }
      }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    // Rate limiting for error log access
    const clientId = getClientId(request);
    const rateLimitResult = await checkRateLimit(`error-logs:${clientId}`, 10, 60000); // 10 requests per minute
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded'
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
          }
        }
      );
    }
    
    // Only allow in development or with proper authentication
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Error logs not accessible in production'
        },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Filter errors
    let filteredErrors = [...errorLog];
    
    if (level) {
      filteredErrors = filteredErrors.filter(error => error.level === level);
    }
    
    // Apply pagination
    const paginatedErrors = filteredErrors.slice(offset, offset + limit);
    
    const responseData = {
      errors: paginatedErrors,
      metadata: {
        total: filteredErrors.length,
        limit,
        offset,
        hasMore: offset + limit < filteredErrors.length,
        levelCounts: {
          critical: errorLog.filter(e => e.level === 'critical').length,
          error: errorLog.filter(e => e.level === 'error').length,
          warning: errorLog.filter(e => e.level === 'warning').length
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      }
    };
    
    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        'X-Response-Time': `${Date.now() - startTime}ms`
      }
    });
    
  } catch (error) {
    // Error log retrieval failed
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to retrieve error logs'
      },
      { status: 500 }
    );
  }
}

function determineErrorLevel(errorData: any): 'error' | 'warning' | 'critical' {
  // Determine error level based on context
  if (errorData.level === 'critical' || 
      errorData.message?.toLowerCase().includes('critical') ||
      errorData.context?.level === 'critical') {
    return 'critical';
  }
  
  if (errorData.message?.toLowerCase().includes('warning') ||
      errorData.context?.level === 'warning') {
    return 'warning';
  }
  
  return 'error';
}

function sanitizeErrorMessage(message: string): string {
  if (typeof message !== 'string') {
    return 'Invalid error message';
  }
  
  // Remove potentially sensitive information
  return message
    .replace(/password[=:]\s*\S+/gi, 'password=***')
    .replace(/token[=:]\s*\S+/gi, 'token=***')
    .replace(/key[=:]\s*\S+/gi, 'key=***')
    .replace(/secret[=:]\s*\S+/gi, 'secret=***')
    .substring(0, 1000); // Limit length
}

function sanitizeStack(stack: string): string {
  if (typeof stack !== 'string') {
    return 'Invalid stack trace';
  }
  
  // Remove potentially sensitive paths and limit length
  return stack
    .replace(/\/Users\/[^\/]+/g, '/Users/***')
    .replace(/\/home\/[^\/]+/g, '/home/***')
    .replace(/C:\\Users\\[^\\]+/g, 'C:\\Users\\***')
    .substring(0, 5000); // Limit length
} 