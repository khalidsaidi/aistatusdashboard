import { ProviderStatus } from '../types';
import { validateStatusResult } from '../validation';

/**
 * Status Parsing Utilities
 * 
 * AI CONSTRAINTS:
 * - Each function does ONE thing only
 * - MUST return ProviderStatus type
 * - MUST handle all edge cases
 * - MUST validate input data
 */

/**
 * Parse StatusPage.io v2 API response
 * 
 * AI CONSTRAINTS:
 * - MUST return one of: 'operational' | 'degraded' | 'down' | 'unknown'
 * - MUST handle missing indicator gracefully
 * - MUST validate response structure
 */
export function parseStatusPageResponse(data: any): ProviderStatus {
  try {
    // Validate basic structure
    if (!data || typeof data !== 'object') {
      return 'unknown';
    }

    const indicator = data.status?.indicator;
    
    // Map StatusPage indicators to our status types
    switch (indicator) {
      case 'none':
        return 'operational';
      case 'minor':
        return 'degraded';
      case 'major':
      case 'critical':
        return 'down';
      default:
        return 'unknown';
    }
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Parse Google Cloud status API response
 * 
 * AI CONSTRAINTS:
 * - MUST handle array of incidents
 * - MUST check for active incidents only
 * - MUST validate incident structure
 */
export function parseGoogleCloudResponse(data: any): ProviderStatus {
  try {
    // Must be an array
    if (!Array.isArray(data)) {
      return 'unknown';
    }

    // Check for active incidents with significant impact
    const hasActiveIncidents = data.some(incident => 
      incident &&
      !incident.end && // Incident is ongoing
      incident.status_impact && 
      ['SERVICE_OUTAGE', 'SERVICE_DISRUPTION'].includes(incident.status_impact)
    );

    return hasActiveIncidents ? 'degraded' : 'operational';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Parse RSS/XML feed (basic availability check)
 * 
 * AI CONSTRAINTS:
 * - MUST check for non-empty content
 * - MUST handle text responses
 * - MUST return operational if accessible
 */
export function parseRssFeedResponse(data: any): ProviderStatus {
  try {
    if (typeof data === 'string' && data.length > 0) {
      return 'operational';
    }
    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Parse HTML response for status indicators
 * 
 * AI CONSTRAINTS:
 * - MUST look for common status keywords
 * - MUST handle HTML content safely
 * - MUST default to operational if no issues found
 */
export function parseHtmlResponse(data: any): ProviderStatus {
  try {
    if (typeof data !== 'string') {
      return 'unknown';
    }

    const html = data.toLowerCase();
    
    // Look for status indicators in HTML
    const hasIncidents = html.includes('incident') || 
                        html.includes('outage') || 
                        html.includes('down') ||
                        html.includes('degraded') ||
                        html.includes('issues');

    const isOperational = html.includes('operational') ||
                         html.includes('all systems') ||
                         html.includes('no issues');

    if (hasIncidents && !isOperational) {
      return 'degraded';
    }

    return isOperational || !hasIncidents ? 'operational' : 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Determine status from connectivity check results
 * 
 * AI CONSTRAINTS:
 * - MUST calculate percentage of successful endpoints
 * - MUST handle empty results array
 * - MUST return appropriate status based on success rate
 */
export function parseConnectivityResults(
  results: Array<{ success: boolean; endpoint: string }>
): ProviderStatus {
  try {
    if (!Array.isArray(results) || results.length === 0) {
      return 'unknown';
    }

    const successfulCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    const successRate = successfulCount / totalCount;

    // Determine status based on success rate
    if (successRate === 1.0) {
      return 'operational';
    } else if (successRate >= 0.5) {
      return 'degraded';
    } else if (successRate > 0) {
      return 'degraded';
    } else {
      return 'down';
    }
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Calculate response time with validation
 * 
 * AI CONSTRAINTS:
 * - MUST return non-negative number
 * - MUST handle invalid start times
 * - startTime MUST be valid timestamp
 */
export function calculateResponseTime(startTime: number): number {
  try {
    if (typeof startTime !== 'number' || startTime <= 0) {
      return 0;
    }

    const responseTime = Date.now() - startTime;
    return Math.max(0, responseTime);
  } catch (error) {
    return 0;
  }
}

/**
 * Create ISO timestamp string
 * 
 * AI CONSTRAINTS:
 * - MUST return valid ISO 8601 string
 * - MUST handle Date creation errors
 * - MUST use current time if no date provided
 */
export function createTimestamp(date?: Date): string {
  try {
    const targetDate = date || new Date();
    return targetDate.toISOString();
  } catch (error) {
    // Fallback to current time
    return new Date().toISOString();
  }
}

/**
 * Validate and sanitize provider ID
 * 
 * AI CONSTRAINTS:
 * - MUST return non-empty string
 * - MUST handle null/undefined input
 * - MUST remove invalid characters
 */
export function sanitizeProviderId(id: any): string {
  try {
    if (typeof id !== 'string' || id.length === 0) {
      return 'unknown';
    }

    // Remove invalid characters and convert to lowercase
    return id.toLowerCase().replace(/[^a-z0-9-_]/g, '');
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Format provider name safely
 * 
 * AI CONSTRAINTS:
 * - MUST return non-empty string
 * - MUST handle null/undefined input
 * - MUST trim whitespace
 */
export function formatProviderName(name: any): string {
  try {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return 'Unknown Provider';
    }

    return name.trim();
  } catch (error) {
    return 'Unknown Provider';
  }
} 