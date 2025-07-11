// =============================================================================
// SIMPLE ERROR HANDLING
// =============================================================================

/**
 * Standard error codes for classification
 *
 * AI CONSTRAINTS:
 * - MUST be specific enough for debugging
 * - MUST be simple enough for consistent usage
 * - MUST cover all common error scenarios
 */
export const ERROR_CODES = {
  // Configuration errors
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_MISSING: 'CONFIG_MISSING',

  // Provider errors
  PROVIDER_NOT_FOUND: 'PROVIDER_NOT_FOUND',
  PROVIDER_DISABLED: 'PROVIDER_DISABLED',
  PROVIDER_INVALID_URL: 'PROVIDER_INVALID_URL',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  PROVIDER_HTTP_ERROR: 'PROVIDER_HTTP_ERROR',
  PROVIDER_PARSE_ERROR: 'PROVIDER_PARSE_ERROR',

  // Rate limiting errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Cache errors
  CACHE_ERROR: 'CACHE_ERROR',

  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Generic errors
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Standard error interface
 *
 * AI CONSTRAINTS:
 * - MUST include enough context for debugging
 * - MUST be serializable for API responses
 * - MUST not expose sensitive information
 */
export interface StandardError {
  /** Error code for classification */
  code: ErrorCode;

  /** Human-readable error message */
  message: string;

  /** Additional context for debugging */
  context?: Record<string, any>;

  /** Original error if wrapped */
  cause?: Error;

  /** Timestamp when error occurred */
  timestamp: string;

  /** Whether error is retryable */
  retryable: boolean;
}

/**
 * Create a standardized error
 *
 * AI CONSTRAINTS:
 * - MUST always return StandardError
 * - MUST sanitize sensitive information
 * - MUST preserve useful debugging context
 */
export function createError(
  code: ErrorCode,
  message: string,
  options: {
    context?: Record<string, any>;
    cause?: Error;
    retryable?: boolean;
  } = {}
): StandardError {
  const { context = {}, cause, retryable = false } = options;

  // Sanitize context to remove sensitive information
  const sanitizedContext = sanitizeContext(context);

  return {
    code,
    message,
    context: sanitizedContext,
    cause,
    timestamp: new Date().toISOString(),
    retryable,
  };
}

/**
 * Wrap an unknown error into StandardError
 *
 * AI CONSTRAINTS:
 * - MUST handle all error types safely
 * - MUST extract useful information
 * - MUST not throw exceptions
 */
export function wrapError(error: unknown, context: Record<string, any> = {}): StandardError {
  if (error instanceof Error) {
    // Classify error based on message/type
    const code = classifyError(error);
    const retryable = isRetryableError(error);

    return createError(code, error.message, {
      context: {
        ...context,
        originalName: error.name,
        stack: error.stack,
      },
      cause: error,
      retryable,
    });
  }

  // Handle non-Error objects
  const message = typeof error === 'string' ? error : 'Unknown error occurred';

  return createError(ERROR_CODES.UNKNOWN_ERROR, message, {
    context: {
      ...context,
      originalError: typeof error === 'object' ? JSON.stringify(error) : String(error),
    },
    retryable: false,
  });
}

/**
 * Classify error based on type and message
 *
 * AI CONSTRAINTS:
 * - MUST handle common error patterns
 * - MUST return appropriate error code
 * - MUST not throw exceptions
 */
function classifyError(error: Error): ErrorCode {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Network-related errors
  if (name.includes('timeout') || message.includes('timeout')) {
    return ERROR_CODES.NETWORK_TIMEOUT;
  }

  if (name.includes('abort') || message.includes('abort')) {
    return ERROR_CODES.NETWORK_TIMEOUT;
  }

  if (message.includes('fetch') || message.includes('network') || message.includes('connection')) {
    return ERROR_CODES.NETWORK_ERROR;
  }

  // HTTP errors
  if (message.includes('http') && (message.includes('404') || message.includes('not found'))) {
    return ERROR_CODES.PROVIDER_NOT_FOUND;
  }

  if (message.includes('http') && message.includes('50')) {
    return ERROR_CODES.PROVIDER_HTTP_ERROR;
  }

  // Parse errors
  if (name.includes('syntax') || message.includes('json') || message.includes('parse')) {
    return ERROR_CODES.PROVIDER_PARSE_ERROR;
  }

  // Validation errors
  if (name.includes('validation') || message.includes('invalid')) {
    return ERROR_CODES.VALIDATION_ERROR;
  }

  // URL errors
  if (message.includes('url') || message.includes('uri')) {
    return ERROR_CODES.PROVIDER_INVALID_URL;
  }

  // Rate limiting
  if (message.includes('rate') && message.includes('limit')) {
    return ERROR_CODES.RATE_LIMIT_EXCEEDED;
  }

  // Default to internal error
  return ERROR_CODES.INTERNAL_ERROR;
}

/**
 * Determine if error is retryable
 *
 * AI CONSTRAINTS:
 * - MUST be conservative (prefer not retrying)
 * - MUST handle common retry scenarios
 * - MUST not cause infinite loops
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Network timeouts are retryable
  if (name.includes('timeout') || message.includes('timeout')) {
    return true;
  }

  // Temporary network issues are retryable
  if (message.includes('econnreset') || message.includes('enotfound')) {
    return true;
  }

  // 5xx HTTP errors are retryable
  if (message.includes('http 5')) {
    return true;
  }

  // 429 (rate limit) is retryable after delay
  if (message.includes('429') || message.includes('rate limit')) {
    return true;
  }

  // Everything else is not retryable by default
  return false;
}

/**
 * Sanitize context to remove sensitive information
 *
 * AI CONSTRAINTS:
 * - MUST remove passwords, tokens, keys
 * - MUST preserve useful debugging information
 * - MUST handle nested objects safely
 */
function sanitizeContext(context: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();

    // Skip sensitive fields
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('key') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('auth')
    ) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Handle nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeContext(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Convert StandardError to API response format
 *
 * AI CONSTRAINTS:
 * - MUST not expose internal details in production
 * - MUST include enough information for debugging
 * - MUST be consistent across all APIs
 */
export function errorToApiResponse(error: StandardError, includeStack: boolean = false) {
  const response: any = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      timestamp: error.timestamp,
      retryable: error.retryable,
    },
  };

  // Include context in development or when explicitly requested
  if (includeStack && error.context) {
    response.error.context = error.context;
  }

  // Include stack trace only in development
  if (includeStack && error.cause?.stack) {
    response.error.stack = error.cause.stack;
  }

  return response;
}

/**
 * Log error with appropriate level and context
 *
 * AI CONSTRAINTS:
 * - MUST use appropriate log level
 * - MUST include relevant context
 * - MUST not log sensitive information
 */
export function logError(error: StandardError, logger: any = console) {
  const logLevel = error.retryable ? 'warn' : 'error';
  const logMessage = `${error.code}: ${error.message}`;

  const logContext = {
    code: error.code,
    retryable: error.retryable,
    timestamp: error.timestamp,
    ...error.context,
  };

  if (typeof logger.log === 'function') {
    logger.log(logLevel, logMessage, logContext);
  } else if (typeof logger[logLevel] === 'function') {
    logger[logLevel](logMessage, logContext);
  } else {
    // Error logged to monitoring system
  }
}
