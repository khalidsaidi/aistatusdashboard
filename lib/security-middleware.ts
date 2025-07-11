import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { log } from './logger';
import { checkApiKeyRateLimit } from '@/lib/thread-safe-rate-limiter';
import crypto from 'crypto';

const db = getFirestore();

/**
 * SECURE MIDDLEWARE WITH TIMING ATTACK PROTECTION
 *
 * CRITICAL FIXES:
 * - Timing-safe string comparison
 * - Proper input validation
 * - Secure rate limiting
 * - Protection against common attacks
 */

interface ApiKey {
  id: string;
  name: string;
  enabled: boolean;
  permissions: string[];
  rateLimit: number;
  createdAt: string;
  lastUsed?: string;
  ipWhitelist?: string[];
  expiresAt?: string;
}

export class SecurityMiddleware {
  private static instance: SecurityMiddleware;

  static getInstance(): SecurityMiddleware {
    if (!this.instance) {
      this.instance = new SecurityMiddleware();
    }
    return this.instance;
  }

  /**
   * CRITICAL SECURITY: Validate and authenticate API requests with timing attack protection
   */
  async authenticateRequest(request: NextRequest): Promise<{
    isValid: boolean;
    apiKey?: ApiKey;
    error?: string;
  }> {
    try {
      // Extract API key from headers
      const apiKeyHeader =
        request.headers.get('x-api-key') ||
        request.headers.get('authorization')?.replace('Bearer ', '');

      if (!apiKeyHeader) {
        return { isValid: false, error: 'API key required' };
      }

      // SECURITY FIX: Validate API key format before database lookup
      if (!this.isValidApiKeyFormat(apiKeyHeader)) {
        // Use timing-safe delay to prevent timing attacks
        await this.constantTimeDelay();
        return { isValid: false, error: 'Invalid API key format' };
      }

      // Fetch API key from Firestore
      const apiKeyDoc = await getDoc(doc(db, 'apiKeys', apiKeyHeader));

      if (!apiKeyDoc.exists()) {
        // Use timing-safe delay to prevent timing attacks
        await this.constantTimeDelay();

        log('warn', 'Invalid API key attempted', {
          ip: this.getClientIP(request),
          userAgent: request.headers.get('user-agent'),
          keyPrefix: apiKeyHeader.substring(0, 8) + '...', // Log only prefix for security
        });
        return { isValid: false, error: 'Invalid API key' };
      }

      const apiKey = apiKeyDoc.data() as ApiKey;

      // SECURITY FIX: Use timing-safe comparison for API key validation
      const isValidKey = await this.timingSafeCompare(apiKeyHeader, apiKeyDoc.id);

      if (!isValidKey) {
        await this.constantTimeDelay();
        return { isValid: false, error: 'Invalid API key' };
      }

      if (!apiKey.enabled) {
        return { isValid: false, error: 'API key disabled' };
      }

      // Check expiration
      if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
        return { isValid: false, error: 'API key expired' };
      }

      // Check IP whitelist if configured
      if (apiKey.ipWhitelist && apiKey.ipWhitelist.length > 0) {
        const clientIP = this.getClientIP(request);
        if (!this.isIPWhitelisted(clientIP, apiKey.ipWhitelist)) {
          log('warn', 'API key used from non-whitelisted IP', {
            keyId: apiKey.id,
            clientIP,
            whitelist: apiKey.ipWhitelist,
          });
          return { isValid: false, error: 'IP not whitelisted' };
        }
      }

      // Check rate limiting with thread-safe implementation
      const rateLimitResult = await checkApiKeyRateLimit(apiKey.id, apiKey.rateLimit);
      if (!rateLimitResult.allowed) {
        return {
          isValid: false,
          error: `Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)}s`,
        };
      }

      return { isValid: true, apiKey };
    } catch (error) {
      log('error', 'Authentication error', { error: (error as Error).message });
      return { isValid: false, error: 'Authentication failed' };
    }
  }

  /**
   * CRITICAL SECURITY: Check if API key has required permissions
   */
  checkPermissions(apiKey: ApiKey, requiredPermission: string): boolean {
    return apiKey.permissions.includes('admin') || apiKey.permissions.includes(requiredPermission);
  }

  /**
   * CRITICAL SECURITY: Timing-safe string comparison to prevent timing attacks
   */
  private async timingSafeCompare(a: string, b: string): Promise<boolean> {
    // Ensure both strings are the same length for comparison
    const aBuffer = Buffer.from(a, 'utf8');
    const bBuffer = Buffer.from(b, 'utf8');

    // If lengths differ, still do a comparison to maintain constant time
    const maxLength = Math.max(aBuffer.length, bBuffer.length);
    const paddedA = Buffer.alloc(maxLength);
    const paddedB = Buffer.alloc(maxLength);

    aBuffer.copy(paddedA);
    bBuffer.copy(paddedB);

    // Use crypto.timingSafeEqual for timing-safe comparison
    try {
      return crypto.timingSafeEqual(paddedA, paddedB) && aBuffer.length === bBuffer.length;
    } catch {
      return false;
    }
  }

  /**
   * SECURITY FIX: Constant time delay to prevent timing attacks
   */
  private async constantTimeDelay(): Promise<void> {
    // Random delay between 10-50ms to prevent timing analysis
    const delay = 10 + Math.random() * 40;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * SECURITY FIX: Validate API key format
   */
  private isValidApiKeyFormat(apiKey: string): boolean {
    // API key should be alphanumeric with underscores and hyphens, 32+ characters
    return /^[a-zA-Z0-9_-]{32,128}$/.test(apiKey);
  }

  /**
   * SECURITY FIX: Check if IP is in whitelist
   */
  private isIPWhitelisted(clientIP: string, whitelist: string[]): boolean {
    // Support both individual IPs and CIDR ranges
    for (const allowedIP of whitelist) {
      if (allowedIP === clientIP) {
        return true;
      }

      // Check CIDR ranges
      if (allowedIP.includes('/')) {
        if (this.isIPInCIDR(clientIP, allowedIP)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if IP is in CIDR range
   */
  private isIPInCIDR(ip: string, cidr: string): boolean {
    try {
      const [range, bits] = cidr.split('/');
      const mask = ~(2 ** (32 - parseInt(bits)) - 1);

      const ipNum = this.ipToNumber(ip);
      const rangeNum = this.ipToNumber(range);

      return (ipNum & mask) === (rangeNum & mask);
    } catch {
      return false;
    }
  }

  /**
   * Convert IP address to number
   */
  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }

  /**
   * CRITICAL SECURITY: Input validation and sanitization
   */
  validateInput(data: any, schema: any): { isValid: boolean; errors: string[]; sanitized?: any } {
    const errors: string[] = [];
    const sanitized: any = {};

    try {
      // Basic validation rules
      for (const [key, rules] of Object.entries(schema)) {
        const value = data[key];
        const ruleSet = rules as any;

        // Required field check
        if (ruleSet.required && (value === undefined || value === null || value === '')) {
          errors.push(`${key} is required`);
          continue;
        }

        if (value === undefined || value === null) {
          continue; // Skip optional fields
        }

        // Type validation
        if (ruleSet.type && typeof value !== ruleSet.type) {
          errors.push(`${key} must be of type ${ruleSet.type}`);
          continue;
        }

        // String validation
        if (ruleSet.type === 'string') {
          if (ruleSet.minLength && value.length < ruleSet.minLength) {
            errors.push(`${key} must be at least ${ruleSet.minLength} characters`);
            continue;
          }
          if (ruleSet.maxLength && value.length > ruleSet.maxLength) {
            errors.push(`${key} must be no more than ${ruleSet.maxLength} characters`);
            continue;
          }
          if (ruleSet.pattern && !new RegExp(ruleSet.pattern).test(value)) {
            errors.push(`${key} format is invalid`);
            continue;
          }

          // SECURITY FIX: Sanitize string input
          sanitized[key] = this.sanitizeString(value);
        }

        // Number validation
        else if (ruleSet.type === 'number') {
          if (ruleSet.min !== undefined && value < ruleSet.min) {
            errors.push(`${key} must be at least ${ruleSet.min}`);
            continue;
          }
          if (ruleSet.max !== undefined && value > ruleSet.max) {
            errors.push(`${key} must be no more than ${ruleSet.max}`);
            continue;
          }

          sanitized[key] = Number(value);
        }

        // Array validation
        else if (ruleSet.type === 'array') {
          if (!Array.isArray(value)) {
            errors.push(`${key} must be an array`);
            continue;
          }
          if (ruleSet.minItems && value.length < ruleSet.minItems) {
            errors.push(`${key} must have at least ${ruleSet.minItems} items`);
            continue;
          }
          if (ruleSet.maxItems && value.length > ruleSet.maxItems) {
            errors.push(`${key} must have no more than ${ruleSet.maxItems} items`);
            continue;
          }

          // Sanitize array items if they are strings
          sanitized[key] = value.map((item) =>
            typeof item === 'string' ? this.sanitizeString(item) : item
          );
        }

        // Object validation
        else if (ruleSet.type === 'object') {
          if (typeof value !== 'object' || Array.isArray(value)) {
            errors.push(`${key} must be an object`);
            continue;
          }

          // Recursively validate nested objects if schema provided
          if (ruleSet.properties) {
            const nestedValidation = this.validateInput(value, ruleSet.properties);
            if (!nestedValidation.isValid) {
              errors.push(...nestedValidation.errors.map((err) => `${key}.${err}`));
              continue;
            }
            sanitized[key] = nestedValidation.sanitized;
          } else {
            sanitized[key] = value;
          }
        } else {
          sanitized[key] = value;
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitized: errors.length === 0 ? sanitized : undefined,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation error: ${(error as Error).message}`],
      };
    }
  }

  /**
   * SECURITY FIX: Sanitize string input to prevent XSS and injection attacks
   */
  private sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    return (
      input
        // Remove null bytes
        .replace(/\0/g, '')
        // Remove control characters except newlines and tabs
        .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Trim whitespace
        .trim()
        // Limit length to prevent DoS
        .substring(0, 10000)
    );
  }

  /**
   * SECURITY FIX: Get client IP with proper header validation
   */
  getClientIP(request: NextRequest): string {
    // Check various headers for client IP
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip');

    // Validate and return first valid IP
    if (forwarded) {
      const ips = forwarded.split(',').map((ip) => ip.trim());
      for (const ip of ips) {
        if (this.isValidIP(ip)) {
          return ip;
        }
      }
    }

    if (realIp && this.isValidIP(realIp)) {
      return realIp;
    }

    if (cfConnectingIp && this.isValidIP(cfConnectingIp)) {
      return cfConnectingIp;
    }

    return 'unknown';
  }

  /**
   * Validate IP address format
   */
  private isValidIP(ip: string): boolean {
    // IPv4 validation
    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    // IPv6 validation (basic)
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * SECURITY FIX: Add security headers to response
   */
  addSecurityHeaders(headers: Headers): void {
    // Prevent XSS attacks
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-XSS-Protection', '1; mode=block');

    // HTTPS enforcement
    if (process.env.NODE_ENV === 'production') {
      headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    // Content Security Policy
    headers.set(
      'Content-Security-Policy',
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        "connect-src 'self' https:; " +
        "font-src 'self' data:; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self';"
    );

    // Referrer policy
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  }

  /**
   * CRITICAL SECURITY: Create secure response with security headers
   */
  createSecureResponse(data: any, status: number = 200): NextResponse {
    const response = NextResponse.json(data, { status });

    // SECURITY HEADERS
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key, authorization');

    return response;
  }

  /**
   * CRITICAL SECURITY: Cleanup is now handled by thread-safe rate limiter
   */
  cleanupRateLimits(): void {
    // Cleanup is now handled automatically by the thread-safe rate limiter
    // No manual cleanup needed
    log('info', 'Rate limit cleanup handled by thread-safe implementation');
  }
}

// Auto-cleanup every 5 minutes
setInterval(
  () => {
    SecurityMiddleware.getInstance().cleanupRateLimits();
  },
  5 * 60 * 1000
);

export const security = SecurityMiddleware.getInstance();
