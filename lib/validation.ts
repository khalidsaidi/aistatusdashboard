// Input validation and sanitization utilities

import { z } from 'zod';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: any;
}

// Email validation
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  let sanitized = email.trim().toLowerCase();

  if (!sanitized) {
    errors.push('Email is required');
    return { isValid: false, errors };
  }

  if (sanitized.length > 254) {
    errors.push('Email is too long (maximum 254 characters)');
  }

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(sanitized)) {
    errors.push('Please enter a valid email address');
  }

  // Check for common typos
  const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  const domain = sanitized.split('@')[1];
  if (domain) {
    const suggestions = commonDomains.filter(d => 
      Math.abs(d.length - domain.length) <= 2 && 
      d !== domain &&
      levenshteinDistance(d, domain) <= 2
    );
    if (suggestions.length > 0) {
      errors.push(`Did you mean: ${sanitized.split('@')[0]}@${suggestions[0]}?`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

// URL validation
export function validateUrl(url: string): ValidationResult {
  const errors: string[] = [];
  let sanitized = url.trim();

  if (!sanitized) {
    errors.push('URL is required');
    return { isValid: false, errors };
  }

  // Add protocol if missing
  if (!sanitized.match(/^https?:\/\//)) {
    sanitized = 'https://' + sanitized;
  }

  try {
    const urlObj = new URL(sanitized);
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      errors.push('Only HTTP and HTTPS URLs are allowed');
    }

    // Check for suspicious patterns
    if (urlObj.hostname.includes('..') || urlObj.hostname.startsWith('.') || urlObj.hostname.endsWith('.')) {
      errors.push('Invalid hostname format');
    }

    // Length check
    if (sanitized.length > 2048) {
      errors.push('URL is too long (maximum 2048 characters)');
    }

  } catch (e) {
    errors.push('Please enter a valid URL');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

// Text content validation and sanitization
export function validateText(text: string, options: {
  minLength?: number;
  maxLength?: number;
  allowHtml?: boolean;
  required?: boolean;
} = {}): ValidationResult {
  const { minLength = 0, maxLength = 1000, allowHtml = false, required = false } = options;
  const errors: string[] = [];
  
  let sanitized = text.trim();

  if (required && !sanitized) {
    errors.push('This field is required');
    return { isValid: false, errors };
  }

  if (sanitized.length < minLength) {
    errors.push(`Minimum length is ${minLength} characters`);
  }

  if (sanitized.length > maxLength) {
    errors.push(`Maximum length is ${maxLength} characters`);
  }

  // HTML sanitization
  if (!allowHtml) {
    sanitized = sanitized
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/');
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /on\w+\s*=/i, // event handlers
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(sanitized)) {
      errors.push('Content contains potentially unsafe elements');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

// Provider ID validation
export function validateProviderId(id: string): ValidationResult {
  const errors: string[] = [];
  const sanitized = id.trim().toLowerCase();

  if (!sanitized) {
    errors.push('Provider ID is required');
    return { isValid: false, errors };
  }

  // Valid provider IDs (from your system)
  const validProviders = [
    'openai', 'anthropic', 'huggingface', 'google-ai', 'cohere', 
    'replicate', 'groq', 'deepseek', 'meta', 'xai', 'perplexity', 
    'claude', 'mistral', 'aws', 'azure'
  ];

  if (!validProviders.includes(sanitized)) {
    errors.push('Invalid provider ID');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

// Comment type validation
export function validateCommentType(type: string): ValidationResult {
  const errors: string[] = [];
  const sanitized = type.trim().toLowerCase();

  const validTypes = ['general', 'provider', 'feedback', 'issue'];

  if (!validTypes.includes(sanitized)) {
    errors.push('Invalid comment type');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

// Rate limiting validation
export function validateRateLimit(identifier: string, action: string): ValidationResult {
  const errors: string[] = [];
  
  // Simple in-memory rate limiting (in production, use Redis or similar)
  const rateLimits: { [key: string]: { count: number; resetTime: number } } = {};
  const key = `${identifier}:${action}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = action === 'comment' ? 5 : action === 'email' ? 3 : 10;

  if (!rateLimits[key] || now > rateLimits[key].resetTime) {
    rateLimits[key] = { count: 1, resetTime: now + windowMs };
  } else {
    rateLimits[key].count++;
  }

  if (rateLimits[key].count > maxRequests) {
    const resetIn = Math.ceil((rateLimits[key].resetTime - now) / 1000);
    errors.push(`Rate limit exceeded. Try again in ${resetIn} seconds.`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Comprehensive form validation
export function validateCommentForm(data: {
  author: string;
  content: string;
  email?: string;
  provider?: string;
}): ValidationResult {
  const errors: string[] = [];
  const sanitized: any = {};

  // Validate author
  const authorResult = validateText(data.author, { 
    minLength: 2, 
    maxLength: 50, 
    required: true 
  });
  if (!authorResult.isValid) {
    errors.push(...authorResult.errors.map(e => `Author: ${e}`));
  } else {
    sanitized.author = authorResult.sanitized;
  }

  // Validate content
  const contentResult = validateText(data.content, { 
    minLength: 10, 
    maxLength: 1000, 
    required: true 
  });
  if (!contentResult.isValid) {
    errors.push(...contentResult.errors.map(e => `Comment: ${e}`));
  } else {
    sanitized.content = contentResult.sanitized;
  }

  // Validate email (optional)
  if (data.email) {
    const emailResult = validateEmail(data.email);
    if (!emailResult.isValid) {
      errors.push(...emailResult.errors.map(e => `Email: ${e}`));
    } else {
      sanitized.email = emailResult.sanitized;
    }
  }

  // Validate provider (optional)
  if (data.provider) {
    const providerResult = validateProviderId(data.provider);
    if (!providerResult.isValid) {
      errors.push(...providerResult.errors.map(e => `Provider: ${e}`));
    } else {
      sanitized.provider = providerResult.sanitized;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: errors.length === 0 ? sanitized : undefined
  };
}

// Utility function for string similarity
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// XSS prevention
export function sanitizeForDisplay(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// SQL injection prevention (for any future SQL queries)
export function sanitizeForQuery(input: string): string {
  return input
    .replace(/'/g, "''")
    .replace(/;/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '');
}

// =============================================================================
// CORE VALIDATION SCHEMAS
// =============================================================================

/**
 * Provider status validation schema
 * 
 * AI CONSTRAINTS:
 * - MUST be one of the four defined values
 * - Used for runtime validation of API responses
 */
export const ProviderStatusSchema = z.enum(['operational', 'degraded', 'down', 'unknown'], {
  message: 'Status must be one of: operational, degraded, down, unknown'
});

/**
 * Provider configuration validation schema
 * 
 * AI CONSTRAINTS:
 * - id MUST be non-empty string
 * - name MUST be non-empty string
 * - statusUrl MUST be valid URL
 * - statusPageUrl MUST be valid URL
 */
export const ProviderSchema = z.object({
  id: z.string().min(1, 'Provider ID must not be empty'),
  name: z.string().min(1, 'Provider name must not be empty'),
  statusUrl: z.string().url('Status URL must be a valid URL'),
  statusPageUrl: z.string().url('Status page URL must be a valid URL')
});

/**
 * Status result validation schema
 * 
 * AI CONSTRAINTS:
 * - responseTime MUST be >= 0
 * - lastChecked MUST be valid ISO 8601 date
 * - error is optional but if present must be non-empty
 */
export const StatusResultSchema = z.object({
  id: z.string().min(1, 'Provider ID must not be empty'),
  name: z.string().min(1, 'Provider name must not be empty'),
  status: ProviderStatusSchema,
  responseTime: z.number().min(0, 'Response time must be non-negative'),
  lastChecked: z.string().datetime('Must be valid ISO 8601 date'),
  error: z.string().min(1).optional(),
  statusPageUrl: z.string().url('Status page URL must be valid'),
  details: z.string().optional()
});

// =============================================================================
// PROVIDER CONFIGURATION SCHEMAS
// =============================================================================

/**
 * Provider category validation
 * 
 * AI CONSTRAINTS:
 * - MUST be one of the defined categories
 */
export const ProviderCategorySchema = z.enum([
  'LLM', 
  'ML_Platform', 
  'Cloud_AI', 
  'Hardware_AI', 
  'Search_AI'
], {
  message: 'Category must be one of: LLM, ML_Platform, Cloud_AI, Hardware_AI, Search_AI'
});

/**
 * Status API format validation
 * 
 * AI CONSTRAINTS:
 * - MUST be one of the supported formats
 */
export const StatusApiFormatSchema = z.enum([
  'statuspage_v2',
  'statuspage_v2_or_html',
  'google_cloud',
  'connectivity_check',
  'html_parsing',
  'rss_feed'
], {
  message: 'Format must be one of the supported API formats'
});

/**
 * Extended provider configuration validation
 * 
 * AI CONSTRAINTS:
 * - timeout MUST be > 0
 * - priority MUST be >= 1
 * - fallbackUrls must be valid URLs if provided
 */
export const ProviderConfigSchema = z.object({
  id: z.string().min(1, 'Provider ID must not be empty'),
  name: z.string().min(1, 'Provider name must not be empty'),
  category: ProviderCategorySchema,
  statusApi: z.object({
    url: z.string().url('Status API URL must be valid'),
    format: StatusApiFormatSchema,
    timeout: z.number().min(1, 'Timeout must be greater than 0'),
    fallbackUrls: z.array(z.string().url('Fallback URLs must be valid')).optional()
  }),
  statusPageUrl: z.string().url('Status page URL must be valid'),
  enabled: z.boolean(),
  priority: z.number().min(1, 'Priority must be >= 1')
});

// =============================================================================
// API RESPONSE SCHEMAS
// =============================================================================

/**
 * StatusPage.io API response validation
 * 
 * AI CONSTRAINTS:
 * - indicator MUST be one of the defined values
 * - description MUST be non-empty
 */
export const StatusPageResponseSchema = z.object({
  page: z.object({
    id: z.string(),
    name: z.string(),
    url: z.string().url()
  }),
  status: z.object({
    indicator: z.enum(['none', 'minor', 'major', 'critical']),
    description: z.string().min(1, 'Description must not be empty')
  })
});

/**
 * Google Cloud status response validation
 * 
 * AI CONSTRAINTS:
 * - Must be array of incident objects
 * - begin MUST be valid date string
 */
export const GoogleCloudStatusResponseSchema = z.array(z.object({
  id: z.string(),
  name: z.string().optional(),
  external_desc: z.string().optional(),
  begin: z.string(),
  end: z.string().optional(),
  severity: z.string().optional(),
  status_impact: z.string().optional(),
  currently_affected_locations: z.array(z.object({
    title: z.string(),
    id: z.string()
  })).optional()
}));

// =============================================================================
// RATE LIMITING SCHEMAS
// =============================================================================

/**
 * Rate limit configuration validation
 * 
 * AI CONSTRAINTS:
 * - maxRequests MUST be > 0
 * - windowMs MUST be > 0
 */
export const RateLimitConfigSchema = z.object({
  maxRequests: z.number().min(1, 'Max requests must be greater than 0'),
  windowMs: z.number().min(1, 'Window duration must be greater than 0')
});

/**
 * Rate limit result validation
 * 
 * AI CONSTRAINTS:
 * - remaining MUST be >= 0
 * - resetTime MUST be valid timestamp
 */
export const RateLimitResultSchema = z.object({
  allowed: z.boolean(),
  remaining: z.number().min(0, 'Remaining must be non-negative'),
  resetTime: z.number().min(0, 'Reset time must be valid timestamp')
});

// =============================================================================
// NOTIFICATION SCHEMAS
// =============================================================================

/**
 * Notification data validation
 * 
 * AI CONSTRAINTS:
 * - type MUST be one of defined types
 * - message MUST be non-empty
 * - timestamp MUST be valid ISO date
 */
export const NotificationDataSchema = z.object({
  type: z.enum(['status_change', 'incident', 'recovery']),
  provider: StatusResultSchema,
  previousStatus: StatusResultSchema.optional(),
  message: z.string().min(1, 'Message must not be empty'),
  timestamp: z.string().datetime('Timestamp must be valid ISO 8601 date')
});

// =============================================================================
// VALIDATION HELPER FUNCTIONS
// =============================================================================

/**
 * Validate provider status with descriptive errors
 * 
 * AI CONSTRAINTS:
 * - MUST return ProviderStatus type
 * - MUST throw with descriptive error on failure
 * - MUST handle all edge cases
 */
export function validateProviderStatus(data: unknown): z.infer<typeof ProviderStatusSchema> {
  try {
    return ProviderStatusSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => issue.message).join(', ');
      throw new Error(`Invalid provider status: ${issues}. Received: ${JSON.stringify(data)}`);
    }
    throw new Error(`Unexpected validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate status result with descriptive errors
 * 
 * AI CONSTRAINTS:
 * - MUST return StatusResult type
 * - MUST provide field-specific error messages
 * - MUST handle partial objects gracefully
 */
export function validateStatusResult(data: unknown): z.infer<typeof StatusResultSchema> {
  try {
    return StatusResultSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map(issue => {
        const field = issue.path.join('.');
        return `${field}: ${issue.message}`;
      }).join(', ');
      throw new Error(`Invalid status result: ${fieldErrors}. Received: ${JSON.stringify(data)}`);
    }
    throw new Error(`Unexpected validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate provider configuration with descriptive errors
 * 
 * AI CONSTRAINTS:
 * - MUST return ProviderConfig type
 * - MUST validate URL formats
 * - MUST check numeric constraints
 */
export function validateProviderConfig(data: unknown): z.infer<typeof ProviderConfigSchema> {
  try {
    return ProviderConfigSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map(issue => {
        const field = issue.path.join('.');
        return `${field}: ${issue.message}`;
      }).join(', ');
      throw new Error(`Invalid provider config: ${fieldErrors}. Received: ${JSON.stringify(data)}`);
    }
    throw new Error(`Unexpected validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate array of provider configurations
 * 
 * AI CONSTRAINTS:
 * - MUST validate each item individually
 * - MUST provide index information in errors
 * - MUST check for duplicate IDs
 */
export function validateProviderConfigs(data: unknown): z.infer<typeof ProviderConfigSchema>[] {
  if (!Array.isArray(data)) {
    throw new Error(`Provider configs must be an array. Received: ${typeof data}`);
  }
  
  const validated: z.infer<typeof ProviderConfigSchema>[] = [];
  const seenIds = new Set<string>();
  
  for (let i = 0; i < data.length; i++) {
    try {
      const config = validateProviderConfig(data[i]);
      
      // Check for duplicate IDs
      if (seenIds.has(config.id)) {
        throw new Error(`Duplicate provider ID: ${config.id}`);
      }
      seenIds.add(config.id);
      
      validated.push(config);
    } catch (error) {
      throw new Error(`Provider config at index ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return validated;
}

// =============================================================================
// TYPE EXPORTS (inferred from schemas)
// =============================================================================

export type ValidatedProviderStatus = z.infer<typeof ProviderStatusSchema>;
export type ValidatedProvider = z.infer<typeof ProviderSchema>;
export type ValidatedStatusResult = z.infer<typeof StatusResultSchema>;
export type ValidatedProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type ValidatedStatusPageResponse = z.infer<typeof StatusPageResponseSchema>;
export type ValidatedGoogleCloudStatusResponse = z.infer<typeof GoogleCloudStatusResponseSchema>;
export type ValidatedRateLimitConfig = z.infer<typeof RateLimitConfigSchema>;
export type ValidatedRateLimitResult = z.infer<typeof RateLimitResultSchema>;
export type ValidatedNotificationData = z.infer<typeof NotificationDataSchema>;

// =============================================================================
// HTTP CLIENT AND PERFORMANCE VALIDATION SCHEMAS
// =============================================================================

/**
 * HTTP client configuration validation schema
 * 
 * AI CONSTRAINTS:
 * - timeout MUST be positive number
 * - retries MUST be non-negative integer
 * - poolSize MUST be positive integer
 */
export const HttpClientConfigSchema = z.object({
  timeout: z.number().min(1, 'Timeout must be greater than 0'),
  retries: z.number().int().min(0, 'Retries must be non-negative integer'),
  poolSize: z.number().int().min(1, 'Pool size must be positive integer'),
  keepAliveTimeout: z.number().min(0, 'Keep-alive timeout must be non-negative'),
  userAgent: z.string().min(1, 'User agent must be non-empty string')
});

/**
 * Batch configuration validation schema
 * 
 * AI CONSTRAINTS:
 * - All values MUST be positive integers
 */
export const BatchConfigSchema = z.object({
  batchSize: z.number().int().min(1, 'Batch size must be positive integer'),
  maxConcurrency: z.number().int().min(1, 'Max concurrency must be positive integer'),
  batchTimeout: z.number().int().min(1, 'Batch timeout must be positive integer')
});

/**
 * Performance metrics validation schema
 * 
 * AI CONSTRAINTS:
 * - All timing values MUST be non-negative
 * - Success rate MUST be between 0 and 1
 */
export const PerformanceMetricsSchema = z.object({
  avgResponseTime: z.number().min(0, 'Average response time must be non-negative'),
  minResponseTime: z.number().min(0, 'Minimum response time must be non-negative'),
  maxResponseTime: z.number().min(0, 'Maximum response time must be non-negative'),
  successRate: z.number().min(0).max(1, 'Success rate must be between 0 and 1'),
  totalRequests: z.number().int().min(0, 'Total requests must be non-negative integer'),
  failedRequests: z.number().int().min(0, 'Failed requests must be non-negative integer'),
  lastUpdated: z.string().datetime('Last updated must be valid ISO 8601 datetime')
});

/**
 * Status fetcher configuration validation schema
 * 
 * AI CONSTRAINTS:
 * - All nested schemas MUST be valid
 */
export const StatusFetcherConfigSchema = z.object({
  http: HttpClientConfigSchema,
  batch: BatchConfigSchema,
  circuitBreaker: z.object({
    failureThreshold: z.number().int().min(1, 'Failure threshold must be positive integer'),
    resetTimeout: z.number().int().min(1, 'Reset timeout must be positive integer')
  }),
  cache: z.object({
    ttl: z.number().int().min(1, 'Cache TTL must be positive integer'),
    maxSize: z.number().int().min(1, 'Cache max size must be positive integer')
  })
});

// =============================================================================
// UNIFIED PROVIDER VALIDATION SCHEMA
// =============================================================================

/**
 * Unified provider validation schema
 * 
 * AI CONSTRAINTS:
 * - id MUST be non-empty string
 * - URLs MUST be valid HTTP/HTTPS URLs
 * - timeout MUST be positive number
 * - priority MUST be positive integer
 */
export const UnifiedProviderSchema = z.object({
  id: z.string().min(1, 'Provider ID must be non-empty string'),
  name: z.string().min(1, 'Provider name must be non-empty string'),
  category: z.enum(['LLM', 'ML_Platform', 'Cloud_AI', 'Hardware_AI', 'Search_AI'], {
    message: 'Category must be one of: LLM, ML_Platform, Cloud_AI, Hardware_AI, Search_AI'
  }),
  statusUrl: z.string().url('Status URL must be valid URL'),
  statusPageUrl: z.string().url('Status page URL must be valid URL'),
  format: z.enum(['statuspage_v2', 'statuspage_v2_or_html', 'google_cloud', 'connectivity_check', 'html_parsing', 'rss_feed']),
  timeout: z.number().int().min(1, 'Timeout must be positive integer'),
  fallbackUrls: z.array(z.string().url('Fallback URL must be valid URL')).optional(),
  enabled: z.boolean(),
  priority: z.number().int().min(1, 'Priority must be positive integer')
});

// =============================================================================
// BATCH PROCESSING VALIDATION SCHEMAS
// =============================================================================

/**
 * Batch request item validation schema
 * 
 * AI CONSTRAINTS:
 * - requestId MUST be non-empty string
 * - provider MUST be valid UnifiedProvider
 * - timestamp MUST be valid ISO 8601
 */
export const BatchRequestItemSchema = z.object({
  requestId: z.string().min(1, 'Request ID must be non-empty string'),
  provider: UnifiedProviderSchema,
  timestamp: z.string().datetime('Timestamp must be valid ISO 8601 datetime')
});

/**
 * Standard error validation schema
 * 
 * AI CONSTRAINTS:
 * - code MUST be non-empty string
 * - message MUST be descriptive
 * - timestamp MUST be ISO 8601
 */
export const StandardErrorSchema = z.object({
  code: z.string().min(1, 'Error code must be non-empty string'),
  message: z.string().min(1, 'Error message must be descriptive'),
  details: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().datetime('Timestamp must be valid ISO 8601 datetime'),
  requestId: z.string().optional()
});

/**
 * Batch response item validation schema
 * 
 * AI CONSTRAINTS:
 * - requestId MUST match request
 * - result XOR error MUST be present (not both)
 */
export const BatchResponseItemSchema = z.object({
  requestId: z.string().min(1, 'Request ID must be non-empty string'),
  result: StatusResultSchema.optional(),
  error: StandardErrorSchema.optional(),
  processingTime: z.number().min(0, 'Processing time must be non-negative')
}).refine(
  (data) => (data.result && !data.error) || (!data.result && data.error),
  {
    message: 'Either result or error must be present, but not both',
    path: ['result', 'error']
  }
);

// =============================================================================
// CONSOLIDATED VALIDATION HELPER FUNCTIONS
// =============================================================================

/**
 * Validate HTTP client configuration with descriptive errors
 * 
 * AI CONSTRAINTS:
 * - MUST return HttpClientConfig type
 * - MUST provide field-specific error messages
 */
export function validateHttpClientConfig(data: unknown): z.infer<typeof HttpClientConfigSchema> {
  try {
    return HttpClientConfigSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map(issue => {
        const field = issue.path.join('.');
        return `${field}: ${issue.message}`;
      }).join(', ');
      throw new Error(`Invalid HTTP client config: ${fieldErrors}. Received: ${JSON.stringify(data)}`);
    }
    throw new Error(`Unexpected validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate unified provider with descriptive errors
 * 
 * AI CONSTRAINTS:
 * - MUST return UnifiedProvider type
 * - MUST validate URL formats
 * - MUST check all constraints
 */
export function validateUnifiedProvider(data: unknown): z.infer<typeof UnifiedProviderSchema> {
  try {
    return UnifiedProviderSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map(issue => {
        const field = issue.path.join('.');
        return `${field}: ${issue.message}`;
      }).join(', ');
      throw new Error(`Invalid unified provider: ${fieldErrors}. Received: ${JSON.stringify(data)}`);
    }
    throw new Error(`Unexpected validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate status fetcher configuration
 * 
 * AI CONSTRAINTS:
 * - MUST validate all nested configurations
 * - MUST provide specific error messages
 */
export function validateStatusFetcherConfig(data: unknown): z.infer<typeof StatusFetcherConfigSchema> {
  try {
    return StatusFetcherConfigSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues.map(issue => {
        const field = issue.path.join('.');
        return `${field}: ${issue.message}`;
      }).join(', ');
      throw new Error(`Invalid status fetcher config: ${fieldErrors}. Received: ${JSON.stringify(data)}`);
    }
    throw new Error(`Unexpected validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate array of unified providers
 * 
 * AI CONSTRAINTS:
 * - MUST validate each provider individually
 * - MUST check for duplicate IDs
 * - MUST provide index information in errors
 */
export function validateUnifiedProviders(data: unknown): z.infer<typeof UnifiedProviderSchema>[] {
  if (!Array.isArray(data)) {
    throw new Error(`Unified providers must be an array. Received: ${typeof data}`);
  }
  
  const validated: z.infer<typeof UnifiedProviderSchema>[] = [];
  const seenIds = new Set<string>();
  
  for (let i = 0; i < data.length; i++) {
    try {
      const provider = validateUnifiedProvider(data[i]);
      
      // Check for duplicate IDs
      if (seenIds.has(provider.id)) {
        throw new Error(`Duplicate provider ID: ${provider.id}`);
      }
      seenIds.add(provider.id);
      
      validated.push(provider);
    } catch (error) {
      throw new Error(`Unified provider at index ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return validated;
} 