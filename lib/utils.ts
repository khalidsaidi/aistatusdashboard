import { trackApiCall } from './firebase';
import { APP_CONFIG } from '../config/app.config';

export function getApiUrl(endpoint: string): string {
  // Always use Firebase Functions directly since we removed proxy routes
  const baseUrl =
    APP_CONFIG.environment.apiBaseUrl ||
    `https://${APP_CONFIG.firebase.functions.region}-${process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ai-status-dashboard-dev'}.cloudfunctions.net`;

  // Handle different endpoint types
  if (['status', 'health', 'comments', 'notifications', 'incidents'].includes(endpoint.replace('api/', ''))) {
    // These endpoints are part of the main api function
    return `${baseUrl}/api/${endpoint.replace('api/', '')}`;
  } else {
    // For notification endpoints, use direct function URLs
    return `${baseUrl}/${endpoint}`;
  }
}

// Enhanced fetch with performance tracking
export async function fetchWithPerformance(url: string, options?: RequestInit): Promise<Response> {
  const apiName = url.split('/').pop() || 'unknown';

  return trackApiCall(apiName, async () => {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response;
  });
}

// Status check utility with performance tracking
export async function checkProviderStatus(providerId: string) {
  return trackApiCall(`status_${providerId}`, async () => {
    const response = await fetch(getApiUrl(`api/status?provider=${providerId}`));
    if (!response.ok) {
      throw new Error(`Failed to fetch status for ${providerId}`);
    }
    return response.json();
  });
}

// Health check utility with performance tracking
export async function checkSystemHealth() {
  return trackApiCall('health_check', async () => {
    const response = await fetch(getApiUrl('api/health'));
    if (!response.ok) {
      throw new Error('Failed to fetch system health');
    }
    return response.json();
  });
}
