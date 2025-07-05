// API Configuration
export const API_CONFIG = {
  // Use environment variable if available, otherwise use appropriate Cloud Functions URL
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 
    (process.env.NODE_ENV === 'production' 
      ? 'https://us-central1-ai-status-dashboard.cloudfunctions.net/api'  // Production project
      : 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/api'), // Dev project
  
  endpoints: {
    status: '/status',
    health: '/health',
    comments: '/comments',
    incidents: '/incidents',
    notifications: '/notifications',
    webhooks: '/webhooks',
    history: '/history',
    badge: '/badge'
  }
};

// Helper function to get full API URL
export function getApiUrl(endpoint: keyof typeof API_CONFIG.endpoints): string {
  // For local development (npm run dev), use local API routes
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port === '3000') {
    return `/api${API_CONFIG.endpoints[endpoint]}`;
  }
  
  // Otherwise use Cloud Functions (dev or prod based on NODE_ENV)
  return `${API_CONFIG.baseUrl}${API_CONFIG.endpoints[endpoint]}`;
} 