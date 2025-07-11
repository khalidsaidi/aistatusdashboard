/**
 * HTTP Client Utility
 *
 * AI CONSTRAINTS:
 * - MUST handle timeouts properly
 * - MUST return consistent error types
 * - MUST validate response objects
 * - MUST never throw - return error in result
 */

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText: string;
  data: any;
  responseTime: number;
}

export interface HttpError {
  message: string;
  code: 'TIMEOUT' | 'NETWORK' | 'HTTP_ERROR' | 'PARSE_ERROR';
  status?: number;
  responseTime: number;
}

export interface HttpResult {
  success: boolean;
  response?: HttpResponse;
  error?: HttpError;
}

/**
 * Fetch with timeout and error handling
 *
 * AI CONSTRAINTS:
 * - MUST return HttpResult (never throw)
 * - MUST measure actual response time
 * - MUST handle all error cases
 * - timeoutMs MUST be > 0
 */
export async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 10000
): Promise<HttpResult> {
  if (timeoutMs <= 0) {
    return {
      success: false,
      error: {
        message: 'Timeout must be greater than 0',
        code: 'NETWORK',
        responseTime: 0,
      },
    };
  }

  const startTime = Date.now();
  let controller: AbortController | undefined;
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    // Create abort controller for timeout
    controller = new AbortController();
    timeoutId = setTimeout(() => controller!.abort(), timeoutMs);

    // Make the request
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AI-Status-Dashboard/1.0',
        Accept: 'application/json,text/html,application/rss+xml,*/*',
        'Cache-Control': 'no-cache',
      },
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    // Validate response object
    if (!response || typeof response.ok === 'undefined') {
      return {
        success: false,
        error: {
          message: 'Invalid response object received',
          code: 'NETWORK',
          responseTime,
        },
      };
    }

    // Parse response data
    let data: any;
    try {
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (parseError) {
      return {
        success: false,
        error: {
          message: `Failed to parse response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          code: 'PARSE_ERROR',
          status: response.status,
          responseTime,
        },
      };
    }

    return {
      success: true,
      response: {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
        responseTime,
      },
    };
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    // Handle specific error types
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: {
            message: `Request timeout after ${timeoutMs}ms`,
            code: 'TIMEOUT',
            responseTime,
          },
        };
      }

      return {
        success: false,
        error: {
          message: error.message,
          code: 'NETWORK',
          responseTime,
        },
      };
    }

    return {
      success: false,
      error: {
        message: 'Unknown network error',
        code: 'NETWORK',
        responseTime,
      },
    };
  }
}

/**
 * Check if URL is reachable (HEAD request)
 *
 * AI CONSTRAINTS:
 * - MUST use HEAD method to minimize data transfer
 * - MUST return boolean result
 * - MUST handle all error cases gracefully
 */
export async function isUrlReachable(
  url: string,
  timeoutMs: number = 5000
): Promise<{ reachable: boolean; responseTime: number; status?: number }> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'AI-Status-Dashboard/1.0',
      },
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    return {
      reachable: response.ok,
      responseTime,
      status: response.status,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      reachable: false,
      responseTime,
    };
  }
}
