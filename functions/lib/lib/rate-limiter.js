"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimitHeaders = exports.getClientIdentifier = exports.checkRateLimit = exports.RATE_LIMITS = void 0;
const logger_1 = require("./logger");
// In-memory storage for rate limiting
const rateLimitStore = new Map();
// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    const entries = Array.from(rateLimitStore.entries());
    for (const [key, entry] of entries) {
        if (entry.resetTime < now) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);
// Default rate limits for different endpoints
exports.RATE_LIMITS = {
    status: {
        windowMs: 60 * 1000,
        maxRequests: 60 // 60 requests per minute
    },
    health: {
        windowMs: 60 * 1000,
        maxRequests: 30 // 30 requests per minute
    },
    provider: {
        windowMs: 60 * 1000,
        maxRequests: 120 // 120 requests per minute
    }
};
/**
 * Check if a request should be rate limited
 */
function checkRateLimit(identifier, config) {
    const now = Date.now();
    const key = identifier;
    let entry = rateLimitStore.get(key);
    // If no entry or window expired, create new entry
    if (!entry || entry.resetTime < now) {
        entry = {
            count: 0,
            resetTime: now + config.windowMs
        };
        rateLimitStore.set(key, entry);
    }
    // Increment count
    entry.count++;
    const allowed = entry.count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - entry.count);
    if (!allowed) {
        (0, logger_1.log)('warn', 'Rate limit exceeded', {
            identifier,
            count: entry.count,
            maxRequests: config.maxRequests,
            resetTime: entry.resetTime
        });
    }
    return {
        allowed,
        remaining,
        resetTime: entry.resetTime
    };
}
exports.checkRateLimit = checkRateLimit;
/**
 * Get client identifier from request
 */
function getClientIdentifier(request) {
    // Try to get IP from various headers
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = (forwarded === null || forwarded === void 0 ? void 0 : forwarded.split(',')[0]) || realIp || 'unknown';
    // For API endpoints, we could also use API keys in the future
    return `ip:${ip}`;
}
exports.getClientIdentifier = getClientIdentifier;
/**
 * Create rate limit headers
 */
function createRateLimitHeaders(limit, remaining, resetTime) {
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', limit.toString());
    headers.set('X-RateLimit-Remaining', remaining.toString());
    headers.set('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());
    return headers;
}
exports.createRateLimitHeaders = createRateLimitHeaders;
//# sourceMappingURL=rate-limiter.js.map