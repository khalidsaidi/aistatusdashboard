import { Provider, StatusResult, StatusPageResponse, GoogleCloudStatusResponse, ProviderStatus } from './types';
import { log } from './logger';
import { getCached, setCache } from './cache';

// Circuit breaker state for each provider
const circuitBreakers = new Map<string, {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}>();

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  halfOpenMaxCalls: 3
};

function getCircuitBreakerState(providerId: string) {
  if (!circuitBreakers.has(providerId)) {
    circuitBreakers.set(providerId, {
      failures: 0,
      lastFailure: 0,
      state: 'closed'
    });
  }
  return circuitBreakers.get(providerId)!;
}

function updateCircuitBreaker(providerId: string, success: boolean) {
  const breaker = getCircuitBreakerState(providerId);
  
  if (success) {
    breaker.failures = 0;
    breaker.state = 'closed';
  } else {
    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    if (breaker.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      breaker.state = 'open';
      log('warn', 'Circuit breaker opened for provider', {
        provider: providerId,
        failures: breaker.failures
      });
    }
  }
}

function canMakeRequest(providerId: string): boolean {
  const breaker = getCircuitBreakerState(providerId);
  
  if (breaker.state === 'closed') return true;
  if (breaker.state === 'open') {
    const timeSinceLastFailure = Date.now() - breaker.lastFailure;
    if (timeSinceLastFailure > CIRCUIT_BREAKER_CONFIG.resetTimeout) {
      breaker.state = 'half-open';
      return true;
    }
    return false;
  }
  return true; // half-open
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) break;
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      log('warn', 'Retrying request after failure', {
        attempt: attempt + 1,
        maxRetries,
        delay,
        error: lastError.message
      });
    }
  }
  
  throw lastError!;
}

export async function fetchProviderStatus(provider: Provider): Promise<StatusResult> {
  const cacheKey = `provider:${provider.id}`;
  
  // Check cache first
  const cached = getCached<StatusResult>(cacheKey);
  if (cached) {
    log('info', 'Cache hit for provider', {
      provider: provider.id,
      cacheKey
    });
    return cached;
  }
  
  // Check circuit breaker
  if (!canMakeRequest(provider.id)) {
    log('warn', 'Circuit breaker is open, using fallback', {
      provider: provider.id
    });
    
    // Try to get last known good status
    const lastKnownStatus = getCached<StatusResult>(`provider:${provider.id}:last_known`);
    if (lastKnownStatus) {
      return {
        ...lastKnownStatus,
        status: 'unknown',
        error: 'Circuit breaker open - using last known status',
        lastChecked: new Date().toISOString()
      };
    }
    
    return {
      id: provider.id,
      name: provider.name,
      status: 'unknown',
      statusPageUrl: provider.statusPageUrl,
      responseTime: 0,
      lastChecked: new Date().toISOString(),
      error: 'Circuit breaker open - service temporarily unavailable'
    };
  }
  
  log('info', 'Cache miss for provider', {
    provider: provider.id,
    cacheKey
  });
  
  const startTime = Date.now();
  
  try {
    // Try alternative status detection for providers without public APIs
    const providersWithoutPublicAPI = ['meta', 'xai', 'mistral'];
    if (providersWithoutPublicAPI.includes(provider.id)) {
      return await detectStatusAlternatively(provider, startTime);
    }
    
    // Special handling for Perplexity which returns HTML instead of JSON
    if (provider.id === 'perplexity') {
      return await detectPerplexityStatus(provider, startTime);
    }
    
    const response = await retryWithBackoff(async () => {
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const fetchResponse = await fetch(provider.statusUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'AI-Status-Dashboard/1.0',
            'Accept': 'application/json,text/html,application/rss+xml,*/*',
            'Cache-Control': 'no-cache'
          }
        });
        
        clearTimeout(timeoutId);
        
        // Check if response exists and has ok property
        if (!fetchResponse || typeof fetchResponse.ok === 'undefined') {
          throw new Error('Invalid response object received');
        }
        
        if (!fetchResponse.ok) {
          throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`);
        }
        
        return fetchResponse;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    }, 3, 1000);
    
    let status: ProviderStatus;
    const responseTime = Date.now() - startTime;
    
    // Handle different response formats based on provider
    if (provider.id === 'aws' || provider.id === 'azure') {
      // RSS/XML feeds - treat as operational if we can fetch them
      const textResponse = await response.text();
      status = textResponse.length > 0 ? 'operational' : 'unknown';
    } else if (provider.id === 'huggingface') {
      // HTML response
      const textResponse = await response.text();
      status = textResponse.includes('<!DOCTYPE') ? 'operational' : 'unknown';
    } else {
      // JSON responses
      try {
        const data = await response.json();
        
        if (provider.id === 'google-ai') {
          // Google Cloud status format - API returns array of incidents directly
          const incidents = data as GoogleCloudStatusResponse;
          const hasActiveIncidents = Array.isArray(incidents) && 
            incidents.length > 0 && 
            incidents.some(incident => 
              !incident.end && // Incident is ongoing
              incident.status_impact && 
              ['SERVICE_OUTAGE', 'SERVICE_DISRUPTION'].includes(incident.status_impact)
            );
          status = hasActiveIncidents ? 'degraded' : 'operational';
        } else {
          // Standard status page format
          const statusData = data as StatusPageResponse;
          const indicator = statusData.status?.indicator || 'unknown';
          
          // Map status page indicators to our status types
          status = indicator === 'none' ? 'operational' : 
                   indicator === 'minor' ? 'degraded' :
                   (indicator === 'major' || indicator === 'critical') ? 'down' :
                   'unknown';
        }
      } catch (jsonError) {
        // If JSON parsing fails, treat as unknown
        status = 'unknown';
        log('warn', 'Failed to parse JSON response', {
          provider: provider.id,
          error: jsonError instanceof Error ? jsonError.message : 'Unknown JSON error'
        });
      }
    }
    
    log('info', 'Provider status fetched successfully', {
      provider: provider.id,
      responseTime,
      httpStatus: response.status,
      parsedStatus: status
    });
    
    const statusResult: StatusResult = {
      id: provider.id,
      name: provider.name,
      status,
      statusPageUrl: provider.statusPageUrl,
      responseTime,
      lastChecked: new Date().toISOString()
    };
    
    // Update circuit breaker with success
    updateCircuitBreaker(provider.id, true);
    
    // Cache successful result
    setCache(cacheKey, statusResult);
    
    // Cache as last known good status
    setCache(`provider:${provider.id}:last_known`, statusResult);
    
    return statusResult;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // Update circuit breaker with failure
    updateCircuitBreaker(provider.id, false);
    
    log('error', 'Provider fetch failed after retries', {
      provider: provider.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime,
      circuitBreakerState: getCircuitBreakerState(provider.id).state
    });
    
    // Try to get last known good status as fallback
    const lastKnownStatus = getCached<StatusResult>(`provider:${provider.id}:last_known`);
    if (lastKnownStatus) {
      return {
        ...lastKnownStatus,
        status: 'unknown',
        error: `Failed to fetch current status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date().toISOString()
      };
    }
    
    return {
      id: provider.id,
      name: provider.name,
      status: 'unknown',
      statusPageUrl: provider.statusPageUrl,
      responseTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Alternative status detection for providers without public APIs
async function detectStatusAlternatively(provider: Provider, startTime: number): Promise<StatusResult> {
  log('info', 'Using alternative status detection', {
    provider: provider.id
  });
  
  try {
    // Define service endpoints to test connectivity
    const serviceEndpoints = {
      'meta': [
        'https://ai.meta.com',
        'https://llama.meta.com',
        'https://www.meta.ai'
      ],
      'xai': [
        'https://x.ai',
        'https://api.x.ai',
        'https://grok.x.ai'
      ],
      'mistral': [
        'https://mistral.ai',
        'https://api.mistral.ai',
        'https://console.mistral.ai'
      ]
    };
    
    const endpoints = serviceEndpoints[provider.id as keyof typeof serviceEndpoints] || [];
    
    // Test multiple endpoints in parallel
    const connectivityTests = endpoints.map(async (endpoint) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // Shorter timeout for connectivity
        
        const response = await fetch(endpoint, {
          method: 'HEAD', // Use HEAD to minimize data transfer
          signal: controller.signal,
          headers: {
            'User-Agent': 'AI-Status-Dashboard/1.0'
          }
        });
        
        clearTimeout(timeoutId);
        return { endpoint, success: response.ok, status: response.status };
      } catch (error) {
        return { endpoint, success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });
    
    const results = await Promise.all(connectivityTests);
    const responseTime = Date.now() - startTime;
    
    // Analyze results
    const successfulTests = results.filter(r => r.success);
    const totalTests = results.length;
    
    let status: ProviderStatus;
    let details = '';
    
    if (successfulTests.length === totalTests) {
      status = 'operational';
      details = `All ${totalTests} endpoints responding`;
    } else if (successfulTests.length > 0) {
      status = 'degraded';
      details = `${successfulTests.length}/${totalTests} endpoints responding`;
    } else {
      status = 'down';
      details = 'No endpoints responding';
    }
    
    log('info', 'Alternative status detection completed', {
      provider: provider.id,
      responseTime,
      status,
      successfulTests: successfulTests.length,
      totalTests,
      details
    });
    
    const statusResult: StatusResult = {
      id: provider.id,
      name: provider.name,
      status,
      statusPageUrl: provider.statusPageUrl,
      responseTime,
      lastChecked: new Date().toISOString(),
      details
    };
    
    // Update circuit breaker with success (we got a result)
    updateCircuitBreaker(provider.id, true);
    
    // Cache result
    setCache(`provider:${provider.id}`, statusResult);
    setCache(`provider:${provider.id}:last_known`, statusResult);
    
    return statusResult;
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    log('error', 'Alternative status detection failed', {
      provider: provider.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    });
    
    return {
      id: provider.id,
      name: provider.name,
      status: 'unknown',
      statusPageUrl: provider.statusPageUrl,
      responseTime,
      lastChecked: new Date().toISOString(),
      error: `Alternative detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Special handling for Perplexity which returns HTML
async function detectPerplexityStatus(provider: Provider, startTime: number): Promise<StatusResult> {
  try {
    // Try the status API first
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(provider.statusUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AI-Status-Dashboard/1.0',
        'Accept': 'text/html,application/json,*/*'
      }
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      const textResponse = await response.text();
      
      // If it's HTML, check for common status indicators
      if (textResponse.includes('<!DOCTYPE') || textResponse.includes('<html')) {
        // Look for status indicators in HTML
        const isOperational = 
          textResponse.includes('operational') ||
          textResponse.includes('all systems') ||
          textResponse.includes('no issues') ||
          !textResponse.includes('incident') &&
          !textResponse.includes('outage') &&
          !textResponse.includes('down');
        
        const status: ProviderStatus = isOperational ? 'operational' : 'degraded';
        
        log('info', 'Perplexity status detected from HTML', {
          provider: provider.id,
          responseTime,
          status,
          method: 'HTML_parsing'
        });
        
        const statusResult: StatusResult = {
          id: provider.id,
          name: provider.name,
          status,
          statusPageUrl: provider.statusPageUrl,
          responseTime,
          lastChecked: new Date().toISOString(),
          details: 'Status detected from HTML content'
        };
        
        updateCircuitBreaker(provider.id, true);
        setCache(`provider:${provider.id}`, statusResult);
        setCache(`provider:${provider.id}:last_known`, statusResult);
        
        return statusResult;
      }
    }
    
    // Fallback to connectivity test
    return await detectStatusAlternatively(provider, startTime);
    
  } catch (error) {
    log('warn', 'Perplexity status API failed, trying alternative detection', {
      provider: provider.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Fallback to alternative detection
    return await detectStatusAlternatively(provider, startTime);
  }
}

// Export circuit breaker state for monitoring
export function getCircuitBreakerStats() {
  const stats = Array.from(circuitBreakers.entries()).map(([providerId, breaker]) => ({
    providerId,
    state: breaker.state,
    failures: breaker.failures,
    lastFailure: breaker.lastFailure ? new Date(breaker.lastFailure).toISOString() : null
  }));
  
  return stats;
}

// Export function to reset circuit breakers (for testing)
export function resetCircuitBreakers() {
  circuitBreakers.clear();
} 