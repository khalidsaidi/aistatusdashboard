/**
 * COMPREHENSIVE API ERROR HANDLER
 * 
 * Provides centralized error handling for API routes with proper fallbacks,
 * retry mechanisms, and graceful degradation.
 */

import { NextRequest, NextResponse } from 'next/server';

export class ApiError extends Error {
  statusCode?: number;
  code?: string;
  context?: any;
  retryable?: boolean;

  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  requestId: string;
  retryable?: boolean;
  retryAfter?: number;
}

export interface ApiHandlerOptions {
  timeout?: number;
  retries?: number;
  fallbackResponse?: any;
  requireAuth?: boolean;
  rateLimit?: {
    max: number;
    windowMs: number;
  };
}

/**
 * Wrap API handler with comprehensive error handling
 */
export function withErrorHandler(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: ApiHandlerOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    try {
      // Set timeout if specified
      if (options.timeout) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new ApiError('Request timeout'));
          }, options.timeout);
        });
        
        const handlerPromise = handler(request);
        
        return await Promise.race([handlerPromise, timeoutPromise]);
      }
      
      return await handler(request);
      
    } catch (error) {
      return handleApiError(error, request, requestId, startTime, options);
    }
  };
}

/**
 * Handle API errors with proper HTTP responses and logging
 */
export function handleApiError(
  error: any,
  request: NextRequest,
  requestId: string,
  startTime: number,
  options: ApiHandlerOptions = {}
): NextResponse {
  const responseTime = Date.now() - startTime;
  
  // Determine error details
  const apiError = normalizeError(error);
  const statusCode = apiError.statusCode || 500;
  
  // Log error
  logApiError(apiError, request, requestId, responseTime);
  
  // Create error response
  const errorResponse: ErrorResponse = {
    error: getErrorType(statusCode),
    message: getErrorMessage(apiError, statusCode),
    statusCode,
    timestamp: new Date().toISOString(),
    requestId,
    retryable: isRetryableError(apiError),
    retryAfter: getRetryAfter(apiError, statusCode)
  };
  
  // Add fallback response if available
  if (options.fallbackResponse && statusCode >= 500) {
    return NextResponse.json({
      ...errorResponse,
      fallback: options.fallbackResponse,
      message: 'Service temporarily unavailable, using cached data'
    }, {
      status: 200, // Return success with fallback
      headers: {
        'X-Error-Fallback': 'true',
        'X-Request-Id': requestId,
        'X-Response-Time': `${responseTime}ms`
      }
    });
  }
  
  return NextResponse.json(errorResponse, {
    status: statusCode,
    headers: {
      'X-Request-Id': requestId,
      'X-Response-Time': `${responseTime}ms`,
      'X-Error-Type': getErrorType(statusCode),
      ...(errorResponse.retryAfter && {
        'Retry-After': errorResponse.retryAfter.toString()
      })
    }
  });
}

/**
 * Normalize different error types to ApiError
 */
function normalizeError(error: any): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  
  if (error instanceof Error) {
    const apiError = new ApiError(error.message) as ApiError;
    apiError.stack = error.stack;
    
    // Detect common error types
    if (error.message.includes('timeout')) {
      apiError.statusCode = 408;
      apiError.code = 'TIMEOUT';
      apiError.retryable = true;
    } else if (error.message.includes('not found')) {
      apiError.statusCode = 404;
      apiError.code = 'NOT_FOUND';
      apiError.retryable = false;
    } else if (error.message.includes('unauthorized')) {
      apiError.statusCode = 401;
      apiError.code = 'UNAUTHORIZED';
      apiError.retryable = false;
    } else if (error.message.includes('forbidden')) {
      apiError.statusCode = 403;
      apiError.code = 'FORBIDDEN';
      apiError.retryable = false;
    } else if (error.message.includes('rate limit')) {
      apiError.statusCode = 429;
      apiError.code = 'RATE_LIMITED';
      apiError.retryable = true;
    } else {
      apiError.statusCode = 500;
      apiError.code = 'INTERNAL_ERROR';
      apiError.retryable = true;
    }
    
    return apiError;
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    const apiError = new ApiError(error) as ApiError;
    apiError.statusCode = 500;
    apiError.code = 'UNKNOWN_ERROR';
    apiError.retryable = true;
    return apiError;
  }
  
  // Handle unknown error types
  const apiError = new ApiError('Unknown error occurred') as ApiError;
  apiError.statusCode = 500;
  apiError.code = 'UNKNOWN_ERROR';
  apiError.retryable = true;
  apiError.context = error;
  return apiError;
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error: ApiError, statusCode: number): string {
  // In production, don't expose internal error details
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    return 'Internal server error. Please try again later.';
  }
  
  // Return specific error message for client errors
  if (statusCode >= 400 && statusCode < 500) {
    return error.message || 'Bad request';
  }
  
  return error.message || 'An unexpected error occurred';
}

/**
 * Get error type string
 */
function getErrorType(statusCode: number): string {
  if (statusCode >= 500) return 'internal_error';
  if (statusCode === 429) return 'rate_limited';
  if (statusCode === 408) return 'timeout';
  if (statusCode === 404) return 'not_found';
  if (statusCode === 403) return 'forbidden';
  if (statusCode === 401) return 'unauthorized';
  if (statusCode >= 400) return 'client_error';
  return 'unknown_error';
}

/**
 * Determine if error is retryable
 */
function isRetryableError(error: ApiError): boolean {
  if (error.retryable !== undefined) {
    return error.retryable;
  }
  
  const statusCode = error.statusCode || 500;
  
  // Retryable status codes
  if ([408, 429, 500, 502, 503, 504].includes(statusCode)) {
    return true;
  }
  
  // Non-retryable client errors
  if (statusCode >= 400 && statusCode < 500) {
    return false;
  }
  
  return true; // Default to retryable for server errors
}

/**
 * Get retry after seconds
 */
function getRetryAfter(error: ApiError, statusCode: number): number | undefined {
  if (!isRetryableError(error)) {
    return undefined;
  }
  
  switch (statusCode) {
    case 429: // Rate limited
      return 60; // 1 minute
    case 503: // Service unavailable
      return 30; // 30 seconds
    case 502: // Bad gateway
    case 504: // Gateway timeout
      return 5; // 5 seconds
    default:
      return 10; // 10 seconds default
  }
}

/**
 * Log API errors with appropriate level
 */
function logApiError(
  error: ApiError,
  request: NextRequest,
  requestId: string,
  responseTime: number
): void {
  const logData = {
    requestId,
    method: request.method,
    url: request.url,
    statusCode: error.statusCode,
    code: error.code,
    message: error.message,
    responseTime,
    timestamp: new Date().toISOString(),
    userAgent: request.headers.get('user-agent'),
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
  };
  
  const statusCode = error.statusCode || 500;
  
  if (statusCode >= 500) {
    console.error('🚨 API ERROR (5xx):', logData);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } else if (statusCode === 429) {
    console.warn('⚠️ API RATE LIMITED (429):', logData);
  } else if (statusCode >= 400) {
    console.warn('⚠️ API CLIENT ERROR (4xx):', logData);
  } else {
    console.info('ℹ️ API INFO:', logData);
  }
}

/**
 * Create API error with specific status code
 */
export function createApiError(
  message: string,
  statusCode: number,
  code?: string,
  retryable?: boolean,
  context?: any
): ApiError {
  const error = new ApiError(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  error.retryable = retryable;
  error.context = context;
  return error;
}

/**
 * Common error creators
 */
export const ApiErrors = {
  badRequest: (message: string = 'Bad request') => 
    createApiError(message, 400, 'BAD_REQUEST', false),
  
  unauthorized: (message: string = 'Unauthorized') => 
    createApiError(message, 401, 'UNAUTHORIZED', false),
  
  forbidden: (message: string = 'Forbidden') => 
    createApiError(message, 403, 'FORBIDDEN', false),
  
  notFound: (message: string = 'Not found') => 
    createApiError(message, 404, 'NOT_FOUND', false),
  
  methodNotAllowed: (message: string = 'Method not allowed') => 
    createApiError(message, 405, 'METHOD_NOT_ALLOWED', false),
  
  timeout: (message: string = 'Request timeout') => 
    createApiError(message, 408, 'TIMEOUT', true),
  
  rateLimited: (message: string = 'Rate limit exceeded') => 
    createApiError(message, 429, 'RATE_LIMITED', true),
  
  internalError: (message: string = 'Internal server error') => 
    createApiError(message, 500, 'INTERNAL_ERROR', true),
  
  badGateway: (message: string = 'Bad gateway') => 
    createApiError(message, 502, 'BAD_GATEWAY', true),
  
  serviceUnavailable: (message: string = 'Service unavailable') => 
    createApiError(message, 503, 'SERVICE_UNAVAILABLE', true),
  
  gatewayTimeout: (message: string = 'Gateway timeout') => 
    createApiError(message, 504, 'GATEWAY_TIMEOUT', true)
};

/**
 * Async error handler wrapper for API routes
 */
export function asyncHandler(
  fn: (request: NextRequest) => Promise<NextResponse>
) {
  return (request: NextRequest): Promise<NextResponse> => {
    return Promise.resolve(fn(request)).catch((error) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return handleApiError(error, request, requestId, Date.now());
    });
  };
} 