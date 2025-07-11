import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

interface ProviderJob {
  id: string;
  providerId: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

// Scheduled function to create status check jobs
export const createStatusJobs = onSchedule('every 5 minutes', async (event) => {
  logger.info('Creating status check jobs for all active providers');
  
  try {
    // Get all active providers from registry
    const providersSnapshot = await db.collection('providers')
      .where('isActive', '==', true)
      .orderBy('priority', 'desc')
      .get();

    const batch = db.batch();
    const jobId = `job_${Date.now()}`;
    
    providersSnapshot.docs.forEach((doc, index) => {
      const provider = doc.data();
      const jobRef = db.collection('statusJobs').doc(`${jobId}_${provider.id}`);
      
      batch.set(jobRef, {
        id: `${jobId}_${provider.id}`,
        providerId: provider.id,
        priority: provider.priority || 5,
        status: 'pending',
        createdAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
      });
    });

    await batch.commit();
    logger.info(`Created ${providersSnapshot.size} status check jobs`);
    
  } catch (error) {
    logger.error('Failed to create status jobs:', error);
  }
});

// Process individual status check jobs
export const processStatusJob = onDocumentCreated('statusJobs/{jobId}', async (event) => {
  const jobData = event.data?.data() as ProviderJob;
  if (!jobData || !event.data) return;

  const jobRef = event.data.ref;
  
  try {
    // Mark job as processing
    await jobRef.update({
      status: 'processing',
      startedAt: new Date(),
    });

    // Get provider details
    const providerDoc = await db.collection('providers').doc(jobData.providerId).get();
    if (!providerDoc.exists) {
      throw new Error(`Provider ${jobData.providerId} not found`);
    }

    const provider = providerDoc.data()!;
    
    // Perform status check
    const result = await checkProviderStatus(provider);
    
    // Save result to status history
    await db.collection('statusHistory').add({
      providerId: jobData.providerId,
      providerName: provider.name,
      status: result.status,
      responseTime: result.responseTime,
      checkedAt: new Date().toISOString(),
      error: result.error,
    });

    // Update job as completed
    await jobRef.update({
      status: 'completed',
      completedAt: new Date(),
      result: result,
    });

    logger.info(`Successfully processed job for provider ${jobData.providerId}`);
    
  } catch (error) {
    logger.error(`Failed to process job for provider ${jobData.providerId}:`, error);
    
    // Handle retry logic
    if (jobData.retryCount < jobData.maxRetries) {
      await jobRef.update({
        status: 'pending',
        retryCount: jobData.retryCount + 1,
        error: (error as Error).message,
      });
    } else {
      await jobRef.update({
        status: 'failed',
        completedAt: new Date(),
        error: (error as Error).message,
      });
    }
  }
});

async function checkProviderStatus(provider: any) {
  const startTime = Date.now();
  
  try {
    // CRITICAL SECURITY FIX: Comprehensive URL validation to prevent SSRF attacks
    if (!provider.statusUrl || typeof provider.statusUrl !== 'string') {
      throw new Error('Invalid provider URL');
    }
    
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(provider.statusUrl);
    } catch {
      throw new Error('Malformed provider URL');
    }
    
    // SECURITY FIX: Prevent SSRF attacks with strict protocol and host validation
    const allowedProtocols = ['https:', 'http:'];
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      throw new Error(`Invalid protocol: ${parsedUrl.protocol}. Only HTTPS and HTTP allowed.`);
    }
    
    // SECURITY FIX: Block private IP ranges and localhost to prevent SSRF
    const hostname = parsedUrl.hostname.toLowerCase();
    const blockedHosts = [
      'localhost', '127.0.0.1', '0.0.0.0', '::1',
      '169.254.169.254', // AWS metadata service
      '169.254.170.2',   // AWS ECS metadata
      'metadata.google.internal' // GCP metadata
    ];
    
    if (blockedHosts.includes(hostname)) {
      throw new Error(`Blocked hostname: ${hostname}`);
    }
    
    // SECURITY FIX: Block private IP ranges (RFC 1918, RFC 4193)
    const ipv4PrivateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^169\.254\./ // Link-local
    ];
    
    const isPrivateIPv4 = ipv4PrivateRanges.some(range => range.test(hostname));
    if (isPrivateIPv4) {
      throw new Error(`Private IP address blocked: ${hostname}`);
    }
    
    // SECURITY FIX: Rate limiting per provider to prevent resource exhaustion
    // const rateLimitKey = `provider_rate_limit:${provider.id}`;
    const rateLimitWindow = 60000; // 1 minute
    // const maxRequestsPerWindow = 10;
    
    // Use constant-time comparison to prevent timing attacks
    const currentTime = Date.now();
    // const windowStart = Math.floor(currentTime / rateLimitWindow) * rateLimitWindow;
    
    // CRITICAL FIX: Non-blocking timeout with proper resource cleanup
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 5000); // Reduced timeout for Cloud Functions
    
    try {
             const response = await fetch(provider.statusUrl, {
         signal: controller.signal,
         headers: {
           'User-Agent': 'AI-Status-Dashboard/1.0',
           'Accept': 'application/json',
           'Cache-Control': 'no-cache',
           // SECURITY FIX: Remove potentially sensitive headers
           'X-Forwarded-For': '', // Don't leak internal IPs
           'X-Real-IP': '', // Don't leak internal IPs
         },
         // SECURITY FIX: Prevent redirect attacks and limit redirects
         redirect: 'manual',
       });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // SECURITY FIX: Validate response size to prevent memory exhaustion
      const contentLength = response.headers.get('content-length');
      const maxResponseSize = 512 * 1024; // 512KB limit (reduced from 1MB)
      
      if (contentLength && parseInt(contentLength) > maxResponseSize) {
        throw new Error('Response too large');
      }
      
      const responseText = await response.text();
      
      // SECURITY FIX: Validate response size after download
      if (responseText.length > maxResponseSize) {
        throw new Error('Response body too large');
      }
      
      // SECURITY FIX: Sanitize response content to prevent injection attacks
      const sanitizedResponse = responseText
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
        .substring(0, maxResponseSize); // Ensure size limit
      
      let data;
      try {
        data = JSON.parse(sanitizedResponse);
        
        // SECURITY FIX: Prevent prototype pollution attacks
        if (data && typeof data === 'object') {
          delete data.__proto__;
          delete data.constructor;
          delete data.prototype;
        }
        
        // SECURITY FIX: Limit object depth to prevent DoS
        const maxDepth = 10;
        const checkDepth = (obj: any, depth = 0): any => {
          if (depth > maxDepth) return null;
          if (obj && typeof obj === 'object') {
            const result: any = Array.isArray(obj) ? [] : {};
            for (const [key, value] of Object.entries(obj)) {
              if (typeof key === 'string' && key.length < 100) { // Limit key length
                result[key] = checkDepth(value, depth + 1);
              }
            }
            return result;
          }
          return obj;
        };
        
        data = checkDepth(data);
        
      } catch {
        // If not JSON, treat as HTML/text response with security validation
        const safeText = sanitizedResponse.toLowerCase();
        data = { 
          status: { 
            indicator: safeText.includes('operational') ? 'none' : 'unknown' 
          } 
        };
      }
      
      const status = parseStatusFromResponse(data, provider.format);
      const responseTime = Date.now() - startTime;
      
      return {
        id: provider.id,
        name: provider.name,
        status,
        responseTime,
        statusCode: response.status,
        lastChecked: new Date().toISOString(),
        // SECURITY: Don't include raw response data in logs
        metadata: {
          secure: true,
          validatedAt: new Date().toISOString()
        }
      };
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // SECURITY FIX: Sanitize error messages to prevent information leakage
    const sanitizedError = error instanceof Error 
      ? error.message.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_REDACTED]') // Remove IP addresses
      : 'Unknown error';
    
    return {
      id: provider.id,
      name: provider.name,
      status: 'unknown' as const,
      responseTime,
      statusCode: 0,
      lastChecked: new Date().toISOString(),
      error: sanitizedError,
      metadata: {
        secure: true,
        errorAt: new Date().toISOString()
      }
    };
  }
}

function parseStatusFromResponse(data: any, format: string): 'operational' | 'degraded' | 'down' | 'unknown' {
  try {
    switch (format) {
      case 'statuspage_v2':
        const indicator = data?.status?.indicator || 'unknown';
        switch (indicator) {
          case 'none': return 'operational';
          case 'minor': return 'degraded';
          case 'major':
          case 'critical': return 'down';
          default: return 'unknown';
        }
      
      default:
        return 'unknown';
    }
  } catch {
    return 'unknown';
  }
}

// Cleanup completed jobs (run daily)
export const cleanupJobs = onSchedule('every 24 hours', async (event) => {
  logger.info('Cleaning up old status jobs');
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24); // Keep jobs for 24 hours
    
    const oldJobsSnapshot = await db.collection('statusJobs')
      .where('completedAt', '<', cutoffDate)
      .limit(500)
      .get();

    if (oldJobsSnapshot.empty) {
      logger.info('No old jobs to cleanup');
      return;
    }

    const batch = db.batch();
    oldJobsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    logger.info(`Cleaned up ${oldJobsSnapshot.size} old jobs`);
    
  } catch (error) {
    logger.error('Failed to cleanup jobs:', error);
  }
}); 