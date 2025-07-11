/**
 * Standard provider status values
 */
export type ProviderStatus = 'operational' | 'degraded' | 'down' | 'unknown';

/**
 * Provider configuration interface
 */
export interface Provider {
  /** Unique identifier for the provider */
  id: string;

  /** Display name of the provider */
  name: string;

  /** API endpoint URL for fetching status */
  statusUrl: string;

  /** Public status page URL for users */
  statusPageUrl: string;
}

/**
 * Status check result for a provider
 */
export interface StatusResult {
  /** Provider ID */
  id: string;

  /** Provider display name */
  name: string;

  /** Current operational status */
  status: ProviderStatus;

  /** Response time in milliseconds */
  responseTime: number;

  /** ISO timestamp of last check */
  lastChecked: string;

  /** Optional error message if fetch failed */
  error?: string;

  /** Link to provider's status page */
  statusPageUrl: string;

  /** Optional additional details about status detection */
  details?: string;
}

/**
 * Atlassian StatusPage API response format
 */
export interface StatusPageResponse {
  page: {
    id: string;
    name: string;
    url: string;
  };
  status: {
    indicator: 'none' | 'minor' | 'major' | 'critical';
    description: string;
  };
}

/**
 * Google Cloud status API response format
 * The API returns an array of incidents directly
 */
export type GoogleCloudStatusResponse = Array<{
  id: string;
  name?: string;
  external_desc?: string;
  begin: string;
  end?: string;
  severity?: string;
  status_impact?: string;
  currently_affected_locations?: Array<{
    title: string;
    id: string;
  }>;
}>;

/**
 * Cache item structure
 */
export interface CacheItem<T> {
  data: T;
  timestamp: number;
}

/**
 * Logger function type
 */
export type LogLevel = 'info' | 'warn' | 'error';

export interface LogData {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: any;
}

export interface UserComment {
  id: string;
  author: string;
  email?: string;
  message?: string; // Frontend format
  content?: string; // Cloud Function format
  providerId?: string; // Optional - for provider-specific comments
  provider?: string; // Cloud Function format
  type?: 'general' | 'provider' | 'feedback' | 'issue';
  createdAt: string | { _seconds: number; _nanoseconds: number }; // Support Firestore timestamp
  updatedAt?: string;
  status?: 'pending' | 'approved' | 'hidden';
  approved?: boolean; // Cloud Function format
  replies?: UserComment[];
  likes?: number;
  reported?: boolean;
}

export interface CommentCreate {
  author: string;
  email?: string;
  message: string;
  providerId?: string;
  type: 'general' | 'provider' | 'feedback' | 'issue';
}

export interface CommentFilter {
  providerId?: string;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface StatusHistoryRecord {
  providerId: string;
  providerName: string;
  status: ProviderStatus;
  responseTime: number;
  checkedAt: string;
  error?: string;
}

// =============================================================================
// PROVIDER CONFIGURATION TYPES
// =============================================================================

/**
 * Extended provider configuration from JSON config
 *
 * AI CONSTRAINTS:
 * - id MUST be non-empty string
 * - name MUST be non-empty string
 * - category MUST be one of defined categories
 * - statusApi.timeout MUST be > 0
 * - priority MUST be >= 1
 */
export interface ProviderConfig {
  /** Unique identifier - MUST be non-empty */
  id: string;

  /** Display name - MUST be non-empty */
  name: string;

  /** Provider category for grouping */
  category: 'LLM' | 'ML_Platform' | 'Cloud_AI' | 'Hardware_AI' | 'Search_AI';

  /** Status API configuration */
  statusApi: {
    /** API endpoint URL - MUST be valid URL */
    url: string;

    /** Response format type */
    format:
      | 'statuspage_v2'
      | 'statuspage_v2_or_html'
      | 'google_cloud'
      | 'connectivity_check'
      | 'html_parsing'
      | 'rss_feed';

    /** Request timeout in milliseconds - MUST be > 0 */
    timeout: number;

    /** Optional fallback URLs for connectivity checks */
    fallbackUrls?: string[];
  };

  /** Public status page URL - MUST be valid URL */
  statusPageUrl: string;

  /** Whether provider is enabled */
  enabled: boolean;

  /** Display priority - MUST be >= 1 */
  priority: number;
}

// =============================================================================
// DATABASE INTERFACE TYPES
// =============================================================================

/**
 * Database abstraction interface
 *
 * AI CONSTRAINTS:
 * - All methods MUST handle errors gracefully
 * - saveStatusResult MUST never throw
 * - getLastStatus MUST return null if not found
 * - isHealthy MUST return boolean (never throw)
 */
export interface DatabaseInterface {
  // Status operations
  saveStatusResult(result: StatusResult): Promise<void>;
  saveStatusResults(results: StatusResult[]): Promise<void>;
  getLastStatus(providerId: string): Promise<StatusResult | null>;
  getProviderHistory(providerId: string, hours?: number): Promise<StatusHistoryRecord[]>;

  // Analytics
  calculateUptime(providerId: string, hours?: number): Promise<number>;
  getAverageResponseTime(providerId: string, hours?: number): Promise<number>;

  // Maintenance
  cleanupOldRecords(): Promise<void>;
  closeDatabase(): Promise<void>;

  // Health check
  isHealthy(): Promise<boolean>;
}

export interface DatabaseConfig {
  type: 'firestore' | 'sqlite' | 'memory';
  connectionString?: string;
  options?: Record<string, any>;
}

// =============================================================================
// RATE LIMITING TYPES
// =============================================================================

/**
 * Rate limiting configuration
 *
 * AI CONSTRAINTS:
 * - maxRequests MUST be > 0
 * - windowMs MUST be > 0
 */
export interface RateLimitConfig {
  /** Maximum requests allowed - MUST be > 0 */
  maxRequests: number;

  /** Time window in milliseconds - MUST be > 0 */
  windowMs: number;
}

/**
 * Rate limit check result
 *
 * AI CONSTRAINTS:
 * - remaining MUST be >= 0
 * - resetTime MUST be valid timestamp
 */
export interface RateLimitResult {
  /** Whether request is allowed */
  allowed: boolean;

  /** Remaining requests in window - MUST be >= 0 */
  remaining: number;

  /** When the limit resets (timestamp) */
  resetTime: number;
}

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

/**
 * Notification channel interface
 *
 * AI CONSTRAINTS:
 * - name MUST be non-empty string
 * - send MUST handle all errors gracefully
 */
export interface NotificationChannel {
  /** Channel name - MUST be non-empty */
  name: string;

  /** Whether channel is enabled */
  enabled: boolean;

  /** Send notification - MUST handle errors */
  send(notification: NotificationData): Promise<void>;
}

/**
 * Notification data structure
 *
 * AI CONSTRAINTS:
 * - type MUST be one of defined types
 * - message MUST be non-empty
 * - timestamp MUST be valid ISO string
 */
export interface NotificationData {
  /** Notification type */
  type: 'status_change' | 'incident' | 'recovery';

  /** Current provider status */
  provider: StatusResult;

  /** Previous status for comparison */
  previousStatus?: StatusResult;

  /** Human-readable message - MUST be non-empty */
  message: string;

  /** ISO timestamp - MUST be valid */
  timestamp: string;
}

// =============================================================================
// CIRCUIT BREAKER TYPES
// =============================================================================

/**
 * Circuit breaker state
 *
 * AI CONSTRAINTS:
 * - failures MUST be >= 0
 * - lastFailure MUST be valid timestamp or 0
 */
export interface CircuitBreakerState {
  /** Number of consecutive failures - MUST be >= 0 */
  failures: number;

  /** Timestamp of last failure - MUST be >= 0 */
  lastFailure: number;

  /** Current state */
  state: 'closed' | 'open';
}

/**
 * Circuit breaker configuration
 *
 * AI CONSTRAINTS:
 * - failureThreshold MUST be > 0
 * - resetTimeout MUST be > 0
 */
export interface CircuitBreakerConfig {
  /** Failures before opening - MUST be > 0 */
  failureThreshold: number;

  /** Time before retry in ms - MUST be > 0 */
  resetTimeout: number;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Standard API response wrapper
 *
 * AI CONSTRAINTS:
 * - success MUST be boolean
 * - timestamp MUST be valid ISO string
 * - error MUST be present when success is false
 */
export interface ApiResponse<T = any> {
  /** Whether request succeeded */
  success: boolean;

  /** Response data (only when success = true) */
  data?: T;

  /** Error message (only when success = false) */
  error?: string;

  /** Response timestamp - MUST be valid ISO */
  timestamp: string;

  /** Request metadata */
  meta?: {
    /** Total items (for paginated responses) */
    total?: number;

    /** Current page */
    page?: number;

    /** Items per page */
    limit?: number;

    /** Response time in milliseconds */
    responseTime?: number;

    /** API version */
    version?: string;
  };
}

/**
 * Health check response
 *
 * AI CONSTRAINTS:
 * - status MUST be 'healthy' | 'unhealthy'
 * - checks array MUST not be empty
 */
export interface HealthCheckResponse {
  /** Overall system status */
  status: 'healthy' | 'unhealthy';

  /** Individual component checks */
  checks: Array<{
    /** Component name */
    name: string;

    /** Component status */
    status: 'healthy' | 'unhealthy';

    /** Optional error message */
    error?: string;

    /** Response time in ms */
    responseTime?: number;
  }>;

  /** Check timestamp */
  timestamp: string;
}

// =============================================================================
// VALIDATION ERROR TYPES
// =============================================================================

/**
 * Validation error details
 *
 * AI CONSTRAINTS:
 * - field MUST be non-empty when provided
 * - message MUST be descriptive
 */
export interface ValidationError {
  /** Field that failed validation */
  field?: string;

  /** Descriptive error message - MUST explain what was expected */
  message: string;

  /** Received value that failed validation */
  received?: any;

  /** Expected value or format */
  expected?: string;
}

// =============================================================================
// HTTP CLIENT AND PERFORMANCE TYPES
// =============================================================================

/**
 * HTTP client configuration
 *
 * AI CONSTRAINTS:
 * - timeout MUST be > 0
 * - retries MUST be >= 0
 * - poolSize MUST be > 0
 */
export interface HttpClientConfig {
  /** Request timeout in milliseconds - MUST be > 0 */
  timeout: number;

  /** Number of retries - MUST be >= 0 */
  retries: number;

  /** Connection pool size - MUST be > 0 */
  poolSize: number;

  /** Keep-alive timeout in milliseconds */
  keepAliveTimeout: number;

  /** User agent string for requests */
  userAgent: string;
}

/**
 * Batch request configuration
 *
 * AI CONSTRAINTS:
 * - batchSize MUST be > 0
 * - maxConcurrency MUST be > 0
 * - batchTimeout MUST be > 0
 */
export interface BatchConfig {
  /** Maximum requests per batch - MUST be > 0 */
  batchSize: number;

  /** Maximum concurrent requests - MUST be > 0 */
  maxConcurrency: number;

  /** Batch timeout in milliseconds - MUST be > 0 */
  batchTimeout: number;
}

/**
 * Performance metrics for monitoring
 *
 * AI CONSTRAINTS:
 * - All timing values MUST be >= 0
 * - successRate MUST be between 0 and 1
 */
export interface PerformanceMetrics {
  /** Average response time in milliseconds - MUST be >= 0 */
  avgResponseTime: number;

  /** Minimum response time in milliseconds - MUST be >= 0 */
  minResponseTime: number;

  /** Maximum response time in milliseconds - MUST be >= 0 */
  maxResponseTime: number;

  /** Success rate between 0 and 1 - MUST be between 0 and 1 */
  successRate: number;

  /** Total requests processed - MUST be >= 0 */
  totalRequests: number;

  /** Failed requests count - MUST be >= 0 */
  failedRequests: number;

  /** Last updated timestamp */
  lastUpdated: string;
}

/**
 * Consolidated status fetcher configuration
 *
 * AI CONSTRAINTS:
 * - All nested configs MUST be valid
 * - MUST include all required settings
 */
export interface StatusFetcherConfig {
  /** HTTP client configuration */
  http: HttpClientConfig;

  /** Batch processing configuration */
  batch: BatchConfig;

  /** Circuit breaker configuration */
  circuitBreaker: CircuitBreakerConfig;

  /** Cache configuration */
  cache: {
    /** Cache TTL in milliseconds - MUST be > 0 */
    ttl: number;

    /** Maximum cache size - MUST be > 0 */
    maxSize: number;
  };
}

// =============================================================================
// ERROR HANDLING TYPES
// =============================================================================

/**
 * Standardized error response
 *
 * AI CONSTRAINTS:
 * - code MUST be non-empty string
 * - message MUST be descriptive
 * - timestamp MUST be ISO 8601 format
 */
export interface StandardError {
  /** Error code - MUST be non-empty */
  code: string;

  /** Human-readable error message - MUST be descriptive */
  message: string;

  /** Optional error details */
  details?: Record<string, unknown>;

  /** Error timestamp - MUST be ISO 8601 */
  timestamp: string;

  /** Request ID for tracing */
  requestId?: string;
}

/**
 * Enhanced API response wrapper
 *
 * AI CONSTRAINTS:
 * - success MUST be boolean
 * - data XOR error MUST be present (not both)
 */
export interface EnhancedApiResponse<T = unknown> {
  /** Success indicator - MUST be boolean */
  success: boolean;

  /** Response data - present when success=true */
  data?: T;

  /** Error information - present when success=false */
  error?: StandardError;

  /** Response metadata */
  meta?: {
    /** Request timestamp */
    timestamp: string;

    /** Response time in milliseconds */
    responseTime: number;

    /** API version */
    version: string;
  };
}

// =============================================================================
// CONSOLIDATED PROVIDER TYPES
// =============================================================================

/**
 * Unified provider interface (replaces multiple definitions)
 *
 * AI CONSTRAINTS:
 * - id MUST be unique across all providers
 * - statusUrl MUST be valid URL
 * - MUST include all fields from config
 */
export interface UnifiedProvider {
  /** Unique provider identifier - MUST be unique */
  id: string;

  /** Display name - MUST be non-empty */
  name: string;

  /** Provider category */
  category: 'LLM' | 'ML_Platform' | 'Cloud_AI' | 'Hardware_AI' | 'Search_AI';

  /** Status API URL - MUST be valid URL */
  statusUrl: string;

  /** Public status page URL - MUST be valid URL */
  statusPageUrl: string;

  /** API format type */
  format:
    | 'statuspage_v2'
    | 'statuspage_v2_or_html'
    | 'google_cloud'
    | 'connectivity_check'
    | 'html_parsing'
    | 'rss_feed';

  /** Request timeout in milliseconds - MUST be > 0 */
  timeout: number;

  /** Optional fallback URLs */
  fallbackUrls?: string[];

  /** Whether provider is enabled */
  enabled: boolean;

  /** Display priority - MUST be >= 1 */
  priority: number;
}

// =============================================================================
// BATCH PROCESSING TYPES
// =============================================================================

/**
 * Batch request item
 *
 * AI CONSTRAINTS:
 * - provider MUST be valid UnifiedProvider
 * - requestId MUST be unique within batch
 */
export interface BatchRequestItem {
  /** Unique request identifier - MUST be unique within batch */
  requestId: string;

  /** Provider to check - MUST be valid */
  provider: UnifiedProvider;

  /** Request timestamp */
  timestamp: string;
}

/**
 * Batch response item
 *
 * AI CONSTRAINTS:
 * - requestId MUST match request
 * - result XOR error MUST be present
 */
export interface BatchResponseItem {
  /** Request identifier - MUST match request */
  requestId: string;

  /** Status result - present on success */
  result?: StatusResult;

  /** Error information - present on failure */
  error?: StandardError;

  /** Processing time in milliseconds */
  processingTime: number;
}
