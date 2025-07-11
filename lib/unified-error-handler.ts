/**
 * UNIFIED ERROR HANDLER
 * 
 * Provides consistent error handling patterns across all components
 * with proper classification, logging, and recovery strategies.
 */

import { log } from './logger';

// =============================================================================
// ERROR TYPES AND CLASSIFICATIONS
// =============================================================================

export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  EXTERNAL_SERVICE = 'external_service',
  CONFIGURATION = 'configuration',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  CIRCUIT_BREAKER = 'circuit_breaker'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  component: string;
  operation: string;
  providerId?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface ClassifiedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  originalError: Error;
  context: ErrorContext;
  timestamp: number;
  retryable: boolean;
  userFriendlyMessage: string;
}

// =============================================================================
// ERROR CLASSIFICATION RULES
// =============================================================================

class ErrorClassifier {
  private static networkErrorPatterns = [
    /network/i,
    /connection/i,
    /timeout/i,
    /fetch/i,
    /ECONNREFUSED/i,
    /ENOTFOUND/i,
    /ETIMEDOUT/i
  ];

  private static authErrorPatterns = [
    /unauthorized/i,
    /authentication/i,
    /invalid.*token/i,
    /expired.*token/i,
    /permission.*denied/i
  ];

  private static validationErrorPatterns = [
    /validation/i,
    /invalid.*input/i,
    /required.*field/i,
    /bad.*request/i
  ];

  private static rateLimitPatterns = [
    /rate.*limit/i,
    /too.*many.*requests/i,
    /quota.*exceeded/i
  ];

  static classify(error: Error, context: ErrorContext): ClassifiedError {
    const message = error.message.toLowerCase();
    
    // Determine category
    let category = ErrorCategory.SYSTEM;
    let severity = ErrorSeverity.MEDIUM;
    let retryable = false;
    let userFriendlyMessage = 'An unexpected error occurred. Please try again.';

    // Network errors
    if (this.networkErrorPatterns.some(pattern => pattern.test(message))) {
      category = ErrorCategory.NETWORK;
      severity = ErrorSeverity.MEDIUM;
      retryable = true;
      userFriendlyMessage = 'Network connection issue. Please check your internet connection and try again.';
    }
    // Authentication errors
    else if (this.authErrorPatterns.some(pattern => pattern.test(message))) {
      category = ErrorCategory.AUTHENTICATION;
      severity = ErrorSeverity.HIGH;
      retryable = false;
      userFriendlyMessage = 'Authentication failed. Please check your credentials.';
    }
    // Validation errors
    else if (this.validationErrorPatterns.some(pattern => pattern.test(message))) {
      category = ErrorCategory.VALIDATION;
      severity = ErrorSeverity.LOW;
      retryable = false;
      userFriendlyMessage = 'Invalid input provided. Please check your data and try again.';
    }
    // Rate limit errors
    else if (this.rateLimitPatterns.some(pattern => pattern.test(message))) {
      category = ErrorCategory.RATE_LIMIT;
      severity = ErrorSeverity.MEDIUM;
      retryable = true;
      userFriendlyMessage = 'Rate limit exceeded. Please wait a moment and try again.';
    }
    // Circuit breaker errors
    else if (message.includes('circuit breaker')) {
      category = ErrorCategory.CIRCUIT_BREAKER;
      severity = ErrorSeverity.HIGH;
      retryable = true;
      userFriendlyMessage = 'Service temporarily unavailable. Please try again in a few minutes.';
    }
    // Firebase specific errors
    else if (message.includes('firebase') || message.includes('firestore')) {
      category = ErrorCategory.EXTERNAL_SERVICE;
      severity = ErrorSeverity.HIGH;
      retryable = true;
      userFriendlyMessage = 'Database service temporarily unavailable. Please try again.';
    }
    // Configuration errors
    else if (message.includes('config') || message.includes('environment')) {
      category = ErrorCategory.CONFIGURATION;
      severity = ErrorSeverity.CRITICAL;
      retryable = false;
      userFriendlyMessage = 'System configuration error. Please contact support.';
    }

    return {
      category,
      severity,
      message: error.message,
      originalError: error,
      context,
      timestamp: Date.now(),
      retryable,
      userFriendlyMessage
    };
  }
}

// =============================================================================
// RECOVERY STRATEGIES
// =============================================================================

export interface RecoveryStrategy {
  canRecover(error: ClassifiedError): boolean;
  recover(error: ClassifiedError): Promise<any>;
}

class NetworkRecoveryStrategy implements RecoveryStrategy {
  canRecover(error: ClassifiedError): boolean {
    return error.category === ErrorCategory.NETWORK && error.retryable;
  }

  async recover(error: ClassifiedError): Promise<any> {
    // Exponential backoff retry
    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.delay(baseDelay * Math.pow(2, attempt - 1));
        // The actual retry would be handled by the calling code
        return { shouldRetry: true, delay: baseDelay * Math.pow(2, attempt) };
      } catch (retryError) {
        if (attempt === maxRetries) {
          throw retryError;
        }
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class CircuitBreakerRecoveryStrategy implements RecoveryStrategy {
  canRecover(error: ClassifiedError): boolean {
    return error.category === ErrorCategory.CIRCUIT_BREAKER;
  }

  async recover(error: ClassifiedError): Promise<any> {
    // Wait for circuit breaker timeout and suggest retry
    return { 
      shouldRetry: true, 
      delay: 30000, // 30 seconds
      message: 'Circuit breaker is open. Waiting for recovery...'
    };
  }
}

// =============================================================================
// UNIFIED ERROR HANDLER
// =============================================================================

export class UnifiedErrorHandler {
  private recoveryStrategies: RecoveryStrategy[] = [];
  private errorHistory: ClassifiedError[] = [];
  private maxHistorySize = 1000;

  constructor() {
    // Register default recovery strategies
    this.recoveryStrategies.push(
      new NetworkRecoveryStrategy(),
      new CircuitBreakerRecoveryStrategy()
    );
  }

  /**
   * Handle an error with classification and recovery
   */
  async handleError(
    error: Error,
    context: ErrorContext
  ): Promise<{ 
    classifiedError: ClassifiedError; 
    recoveryAction?: any; 
    shouldThrow: boolean 
  }> {
    // Classify the error
    const classifiedError = ErrorClassifier.classify(error, context);

    // Log the error
    this.logError(classifiedError);

    // Store in history
    this.addToHistory(classifiedError);

    // Attempt recovery
    let recoveryAction;
    let shouldThrow = true;

    for (const strategy of this.recoveryStrategies) {
      if (strategy.canRecover(classifiedError)) {
        try {
          recoveryAction = await strategy.recover(classifiedError);
          shouldThrow = false;
          break;
        } catch (recoveryError) {
          log('warn', 'Recovery strategy failed', {
            strategy: strategy.constructor.name,
            error: recoveryError instanceof Error ? recoveryError.message : 'Unknown error'
          });
        }
      }
    }

    return {
      classifiedError,
      recoveryAction,
      shouldThrow
    };
  }

  /**
   * Create a standardized error response
   */
  createErrorResponse(classifiedError: ClassifiedError): {
    error: {
      code: string;
      message: string;
      category: ErrorCategory;
      severity: ErrorSeverity;
      retryable: boolean;
      timestamp: number;
      requestId?: string;
    };
  } {
    return {
      error: {
        code: `${classifiedError.category.toUpperCase()}_ERROR`,
        message: classifiedError.userFriendlyMessage,
        category: classifiedError.category,
        severity: classifiedError.severity,
        retryable: classifiedError.retryable,
        timestamp: classifiedError.timestamp,
        requestId: classifiedError.context.requestId
      }
    };
  }

  /**
   * Wrap async operations with error handling
   */
  async wrapOperation<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const result = await this.handleError(
        error instanceof Error ? error : new Error(String(error)),
        context
      );

      if (result.shouldThrow) {
        throw result.classifiedError;
      }

      // If recovery is possible, throw a recoverable error
      throw new RecoverableError(result.classifiedError, result.recoveryAction);
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByCategory: Record<ErrorCategory, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recentErrors: ClassifiedError[];
  } {
    const errorsByCategory = {} as Record<ErrorCategory, number>;
    const errorsBySeverity = {} as Record<ErrorSeverity, number>;

    // Initialize counters
    Object.values(ErrorCategory).forEach(cat => errorsByCategory[cat] = 0);
    Object.values(ErrorSeverity).forEach(sev => errorsBySeverity[sev] = 0);

    // Count errors
    for (const error of this.errorHistory) {
      errorsByCategory[error.category]++;
      errorsBySeverity[error.severity]++;
    }

    return {
      totalErrors: this.errorHistory.length,
      errorsByCategory,
      errorsBySeverity,
      recentErrors: this.errorHistory.slice(-10) // Last 10 errors
    };
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Add recovery strategy
   */
  addRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private logError(error: ClassifiedError): void {
    const logLevel = this.getLogLevel(error.severity);
    
    log(logLevel, `Error in ${error.context.component}.${error.context.operation}`, {
      category: error.category,
      severity: error.severity,
      message: error.message,
      retryable: error.retryable,
      context: error.context,
      stack: error.originalError.stack
    });
  }

  private getLogLevel(severity: ErrorSeverity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'info';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return 'error';
      default:
        return 'error';
    }
  }

  private addToHistory(error: ClassifiedError): void {
    this.errorHistory.push(error);
    
    // Maintain history size limit
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }
}

// =============================================================================
// RECOVERABLE ERROR CLASS
// =============================================================================

export class RecoverableError extends Error {
  public readonly classifiedError: ClassifiedError;
  public readonly recoveryAction: any;

  constructor(classifiedError: ClassifiedError, recoveryAction: any) {
    super(classifiedError.userFriendlyMessage);
    this.name = 'RecoverableError';
    this.classifiedError = classifiedError;
    this.recoveryAction = recoveryAction;
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

// Global error handler instance
const globalErrorHandler = new UnifiedErrorHandler();

/**
 * Handle an error globally
 */
export async function handleError(
  error: Error,
  context: ErrorContext
): Promise<{ 
  classifiedError: ClassifiedError; 
  recoveryAction?: any; 
  shouldThrow: boolean 
}> {
  return globalErrorHandler.handleError(error, context);
}

/**
 * Wrap an operation with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext
): Promise<T> {
  return globalErrorHandler.wrapOperation(operation, context);
}

/**
 * Create standardized error response
 */
export function createErrorResponse(classifiedError: ClassifiedError) {
  return globalErrorHandler.createErrorResponse(classifiedError);
}

/**
 * Get global error statistics
 */
export function getGlobalErrorStats() {
  return globalErrorHandler.getErrorStats();
}

/**
 * Clear global error history
 */
export function clearGlobalErrorHistory(): void {
  globalErrorHandler.clearHistory();
}

/**
 * Get the global error handler instance
 */
export function getGlobalErrorHandler(): UnifiedErrorHandler {
  return globalErrorHandler;
} 