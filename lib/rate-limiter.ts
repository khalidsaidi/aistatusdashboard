import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { log } from './logger';

interface RateLimitRecord {
  count: number;
  resetTime: Timestamp;
  firstRequest: Timestamp;
}

// Initialize Firestore only in non-test environments
let db: any = null;

if (process.env.NODE_ENV !== 'test') {
  try {
    db = getFirestore();
  } catch (error) {
    // Firebase not initialized - will handle gracefully in methods
    db = null;
  }
}

export class PersistentRateLimiter {
  private collectionName = 'rate_limits';
  
  async checkRateLimit(
    clientId: string, 
    maxRequests: number = 60, 
    windowMs: number = 60000
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    
    try {
      if (!db) {
        // Fail open when database not available
        return { allowed: true, remaining: maxRequests, resetTime: now + windowMs };
      }
      
      const docRef = db.collection(this.collectionName).doc(clientId);
      
      const result = await db.runTransaction(async (transaction: any) => {
        const doc = await transaction.get(docRef);
        
        if (!doc.exists) {
          // First request
          const resetTime = Timestamp.fromMillis(now + windowMs);
          transaction.set(docRef, {
            count: 1,
            resetTime,
            firstRequest: Timestamp.fromMillis(now)
          });
          return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
        }
        
        const data = doc.data() as RateLimitRecord;
        
        // Check if window has expired
        if (now > data.resetTime.toMillis()) {
          // Reset window
          const resetTime = Timestamp.fromMillis(now + windowMs);
          transaction.update(docRef, {
            count: 1,
            resetTime,
            firstRequest: Timestamp.fromMillis(now)
          });
          return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
        }
        
        // Check if limit exceeded
        if (data.count >= maxRequests) {
          return { 
            allowed: false, 
            remaining: 0, 
            resetTime: data.resetTime.toMillis() 
          };
        }
        
        // Increment count
        transaction.update(docRef, {
          count: data.count + 1
        });
        
        return { 
          allowed: true, 
          remaining: maxRequests - (data.count + 1), 
          resetTime: data.resetTime.toMillis() 
        };
      });
      
      return result;
    } catch (error) {
      log('error', 'Rate limiting failed, allowing request', {
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Fail open for availability
      return { allowed: true, remaining: maxRequests, resetTime: now + windowMs };
    }
  }
  
  async cleanupExpiredRecords(): Promise<void> {
    try {
      if (!db) {
        return; // Skip cleanup when database not available
      }
      
      const now = Timestamp.now();
      const expiredQuery = db.collection(this.collectionName)
        .where('resetTime', '<', now)
        .limit(100);
      
      const snapshot = await expiredQuery.get();
      
      if (snapshot.empty) {
        return;
      }
      
      const batch = db.batch();
      snapshot.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      log('info', 'Cleaned up expired rate limit records', {
        cleaned: snapshot.size
      });
    } catch (error) {
      log('error', 'Failed to cleanup rate limit records', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const rateLimiter = new PersistentRateLimiter();

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
}

// Default rate limits for different endpoints
export const RATE_LIMITS = {
  status: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 60       // 60 requests per minute
  },
  health: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 30       // 30 requests per minute
  },
  provider: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 120      // 120 requests per minute
  }
} as const;

/**
 * Get client identifier from request
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  
  // For API endpoints, we could also use API keys in the future
  return `ip:${ip}`;
}

/**
 * Create rate limit headers
 */
export function createRateLimitHeaders(
  limit: number,
  remaining: number,
  resetTime: number
): Headers {
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', limit.toString());
  headers.set('X-RateLimit-Remaining', remaining.toString());
  headers.set('X-RateLimit-Reset', Math.floor(resetTime / 1000).toString());
  return headers;
} 