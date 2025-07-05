/**
 * Standard provider status values
 */
export type ProviderStatus = 'operational' | 'degraded' | 'down' | 'unknown';

/**
 * Provider configuration interface
 */
export interface Provider {
  /** Unique identifier for the provider */
  id: string;
  
  /** Display name of the provider */
  name: string;
  
  /** API endpoint URL for fetching status */
  statusUrl: string;
  
  /** Public status page URL for users */
  statusPageUrl: string;
}

/**
 * Status check result for a provider
 */
export interface StatusResult {
  /** Provider ID */
  id: string;
  
  /** Provider display name */
  name: string;
  
  /** Current operational status */
  status: ProviderStatus;
  
  /** Response time in milliseconds */
  responseTime: number;
  
  /** ISO timestamp of last check */
  lastChecked: string;
  
  /** Optional error message if fetch failed */
  error?: string;
  
  /** Link to provider's status page */
  statusPageUrl: string;
  
  /** Optional additional details about status detection */
  details?: string;
}

/**
 * Atlassian StatusPage API response format
 */
export interface StatusPageResponse {
  page: {
    id: string;
    name: string;
    url: string;
  };
  status: {
    indicator: 'none' | 'minor' | 'major' | 'critical';
    description: string;
  };
}

/**
 * Google Cloud status API response format
 * The API returns an array of incidents directly
 */
export type GoogleCloudStatusResponse = Array<{
  id: string;
  name?: string;
  external_desc?: string;
  begin: string;
  end?: string;
  severity?: string;
  status_impact?: string;
  currently_affected_locations?: Array<{
    title: string;
    id: string;
  }>;
}>;

/**
 * Cache item structure
 */
export interface CacheItem<T> {
  data: T;
  timestamp: number;
}

/**
 * Logger function type
 */
export type LogLevel = 'info' | 'warn' | 'error';

export interface LogData {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: any;
}

export interface UserComment {
  id: string;
  author: string;
  email?: string;
  message?: string; // Frontend format
  content?: string; // Cloud Function format
  providerId?: string; // Optional - for provider-specific comments
  provider?: string; // Cloud Function format
  type?: 'general' | 'provider' | 'feedback' | 'issue';
  createdAt: string | { _seconds: number; _nanoseconds: number }; // Support Firestore timestamp
  updatedAt?: string;
  status?: 'pending' | 'approved' | 'hidden';
  approved?: boolean; // Cloud Function format
  replies?: UserComment[];
  likes?: number;
  reported?: boolean;
}

export interface CommentCreate {
  author: string;
  email?: string;
  message: string;
  providerId?: string;
  type: 'general' | 'provider' | 'feedback' | 'issue';
}

export interface CommentFilter {
  providerId?: string;
  type?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface StatusHistoryRecord {
  providerId: string;
  providerName: string;
  status: ProviderStatus;
  responseTime: number;
  checkedAt: string;
  error?: string;
} 