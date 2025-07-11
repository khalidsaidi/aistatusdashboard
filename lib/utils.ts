import { trackApiCall } from './firebase';

export function getApiUrl(endpoint: string): string {
  // For client-side requests, detect if we're running locally
  if (typeof window !== 'undefined') {
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    
    if (isLocalhost) {
      // Use local API routes that will proxy to Firebase Functions
      return `/api/${endpoint}`;
    }
  }
  
  // For server-side or production, use Firebase Functions directly
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || `https://us-central1-${process.env.FIREBASE_PROJECT_ID || 'demo-project'}.cloudfunctions.net`;
  
  // Handle different endpoint types
  if (['status', 'health', 'comments', 'notifications', 'incidents'].includes(endpoint)) {
    // These endpoints are part of the main api function
    return `${baseUrl}/api/${endpoint}`;
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