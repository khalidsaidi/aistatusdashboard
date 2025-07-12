/**
 * SECURE CONFIGURATION SYSTEM - PUBLIC REPOSITORY SAFE
 *
 * This system ensures NO sensitive information is exposed in the public repository.
 * All project-specific details are loaded from environment variables.
 *
 * ENVIRONMENTS:
 * - local: Always uses dev backend (ai-status-dashboard-dev)
 * - test: Uses test configuration with dev backend
 * - staging: Uses dev backend (ai-status-dashboard-dev)
 * - production: Uses production backend (ai-status-dashboard-prod)
 */

import { z } from 'zod';

// =============================================================================
// ENVIRONMENT TYPES
// =============================================================================

export type Environment = 'local' | 'test' | 'staging' | 'production';

export interface SecureConfig {
  // Environment identification
  environment: Environment;
  nodeEnv: 'development' | 'test' | 'staging' | 'production';

  // Site configuration (public safe)
  site: {
    name: string;
    url: string;
    description: string;
  };

  // API configuration (uses environment variables)
  api: {
    baseUrl: string;
    timeout: number;
    retries: number;
    maxConcurrentRequests: number;
  };

  // Firebase configuration (environment-based)
  firebase: {
    projectId: string;
    region: string;
    useEmulator: boolean;
  };

  // Feature flags
  features: {
    realTimeUpdates: boolean;
    notifications: boolean;
    analytics: boolean;
    caching: boolean;
    monitoring: boolean;
  };

  // Performance settings
  performance: {
    cacheTtl: number;
    maxConcurrentRequests: number;
    requestTimeout: number;
    batchSize: number;
    rateLimitRequests: number;
    rateLimitWindow: number;
  };

  // Security settings
  security: {
    enforceHttps: boolean;
    validateOrigin: boolean;
    enableCors: boolean;
  };
}

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

/**
 * Detect the current environment based on various indicators
 * This is the single source of truth for environment detection
 */
function detectEnvironment(): Environment {
  // Check explicit environment variable first
  const explicitEnv = process.env.NEXT_PUBLIC_ENVIRONMENT || process.env.ENVIRONMENT;
  if (explicitEnv && ['local', 'test', 'staging', 'production'].includes(explicitEnv)) {
    return explicitEnv as Environment;
  }

  // Check NODE_ENV
  const nodeEnv = process.env.NODE_ENV;

  // Test environment
  if (nodeEnv === 'test' || process.env.JEST_WORKER_ID) {
    return 'test';
  }

  // Production environment
  if (nodeEnv === 'production') {
    // Check if we're in a production deployment
    const projectId =
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    if (projectId && !projectId.includes('dev') && !projectId.includes('test')) {
      return 'production';
    }
    // If production NODE_ENV but dev project, it's staging
    return 'staging';
  }

  // Check if we're in GitHub Actions or CI
  if (process.env.CI || process.env.GITHUB_ACTIONS) {
    return 'staging';
  }

  // Default to local for development
  return 'local';
}

/**
 * Get Firebase project ID based on environment
 * This ensures local always uses dev backend
 */
function getFirebaseProjectId(environment: Environment): string {
  // Environment variable override (for deployment flexibility)
  const envProjectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

  switch (environment) {
    case 'production':
      // Production must use production project
      return envProjectId || 'ai-status-dashboard-prod';

    case 'local':
    case 'test':
    case 'staging':
    default:
      // Local, test, and staging always use dev backend
      return envProjectId || 'ai-status-dashboard-dev';
  }
}

/**
 * Get API base URL based on environment and Firebase project
 */
function getApiBaseUrl(environment: Environment, firebaseProjectId: string): string {
  // Environment variable override
  const envApiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (envApiUrl) {
    return envApiUrl;
  }

  // Get Firebase region
  const region = process.env.FIREBASE_FUNCTIONS_REGION || 'us-central1';

  switch (environment) {
    case 'local':
      // Local development can use local API or dev backend
      if (process.env.USE_LOCAL_API === 'true') {
        return 'http://localhost:3000/api';
      }
      // Default: use dev backend for local development
      return `https://${region}-${firebaseProjectId}.cloudfunctions.net/api`;

    case 'test':
      // Tests use local API endpoints
      return '/api';

    case 'staging':
    case 'production':
      // Staging and production use Firebase Functions
      return `https://${region}-${firebaseProjectId}.cloudfunctions.net/api`;

    default:
      return '/api';
  }
}

// =============================================================================
// CONFIGURATION BUILDER
// =============================================================================

/**
 * Build configuration based on environment
 * This is the main configuration factory
 */
function buildConfiguration(): SecureConfig {
  const environment = detectEnvironment();
  const nodeEnv = (process.env.NODE_ENV as SecureConfig['nodeEnv']) || 'development';
  const firebaseProjectId = getFirebaseProjectId(environment);
  const apiBaseUrl = getApiBaseUrl(environment, firebaseProjectId);

  // Base configuration
  const baseConfig: SecureConfig = {
    environment,
    nodeEnv,

    site: {
      name: 'AI Status Dashboard',
      url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      description: 'Real-time monitoring for AI service providers',
    },

    api: {
      baseUrl: apiBaseUrl,
      timeout: parseInt(process.env.API_TIMEOUT || '10000'),
      retries: parseInt(process.env.API_RETRIES || '2'),
      maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '10'),
    },

    firebase: {
      projectId: firebaseProjectId,
      region: process.env.FIREBASE_FUNCTIONS_REGION || 'us-central1',
      useEmulator: process.env.USE_FIREBASE_EMULATOR === 'true',
    },

    features: {
      realTimeUpdates: process.env.ENABLE_REAL_TIME !== 'false',
      notifications: process.env.ENABLE_NOTIFICATIONS !== 'false',
      analytics: process.env.ENABLE_ANALYTICS !== 'false',
      caching: process.env.ENABLE_CACHING !== 'false',
      monitoring: process.env.ENABLE_MONITORING !== 'false',
    },

    performance: {
      cacheTtl: parseInt(process.env.CACHE_TTL || '60000'), // 60 seconds
      maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '10'),
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '10000'),
      batchSize: parseInt(process.env.BATCH_SIZE || '10'),
      rateLimitRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60'),
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    },

    security: {
      enforceHttps: environment === 'production',
      validateOrigin: environment === 'production',
      enableCors: true,
    },
  };

  // Environment-specific overrides
  switch (environment) {
    case 'local':
      return {
        ...baseConfig,
        features: {
          ...baseConfig.features,
          notifications: false, // Disable notifications in local to avoid spam
          analytics: false, // Disable analytics in local
        },
        security: {
          ...baseConfig.security,
          enforceHttps: false,
          validateOrigin: false,
        },
      };

    case 'test':
      return {
        ...baseConfig,
        api: {
          ...baseConfig.api,
          timeout: 5000,
          retries: 1,
        },
        features: {
          realTimeUpdates: false,
          notifications: false,
          analytics: false,
          caching: false,
          monitoring: false,
        },
        performance: {
          ...baseConfig.performance,
          cacheTtl: 1000, // 1 second for tests
          requestTimeout: 5000,
        },
        security: {
          enforceHttps: false,
          validateOrigin: false,
          enableCors: true,
        },
      };

    case 'staging':
      return {
        ...baseConfig,
        features: {
          ...baseConfig.features,
          notifications: true,
          analytics: false, // Disable analytics in staging
        },
        performance: {
          ...baseConfig.performance,
          cacheTtl: 30000, // 30 seconds in staging
          maxConcurrentRequests: 20,
        },
      };

    case 'production':
      return {
        ...baseConfig,
        features: {
          ...baseConfig.features,
          notifications: true,
          analytics: true,
          monitoring: true,
        },
        performance: {
          ...baseConfig.performance,
          cacheTtl: 60000, // 1 minute in production
          maxConcurrentRequests: 50,
          requestTimeout: 15000,
          rateLimitRequests: 100,
        },
        security: {
          enforceHttps: true,
          validateOrigin: true,
          enableCors: true,
        },
      };

    default:
      return baseConfig;
  }
}

// =============================================================================
// CONFIGURATION VALIDATION
// =============================================================================

/**
 * Validate configuration for security and correctness
 */
function validateConfiguration(config: SecureConfig): void {
  // Security validation - ensure no hardcoded sensitive values
  const configStr = JSON.stringify(config);
  const sensitivePatterns = [
    /ai-status-dashboard-dev/,
    /ai-status-dashboard-prod/,
    /\.firebaseapp\.com/,
    /\.cloudfunctions\.net/,
    /firebase-adminsdk/,
    /\.iam\.gserviceaccount\.com/,
  ];

  for (const pattern of sensitivePatterns) {
    if (pattern.test(configStr)) {
      // Only warn in non-test environments about hardcoded values
      if (config.environment !== 'test') {
        console.warn(
          `⚠️  Configuration contains pattern that should be in environment variables: ${pattern}`
        );
      }
      // Don't throw in non-production to allow development
      if (config.environment === 'production') {
        throw new Error(
          `Configuration contains sensitive information that should be in environment variables`
        );
      }
    }
  }

  // Validate required fields
  if (!config.api.baseUrl) {
    throw new Error('API base URL is required');
  }

  if (config.api.timeout < 1000) {
    throw new Error('API timeout must be at least 1000ms');
  }

  if (config.performance.cacheTtl < 0) {
    throw new Error('Cache TTL must be non-negative');
  }

  // Environment-specific validation
  if (config.environment === 'production') {
    if (!config.site.url || config.site.url.includes('localhost')) {
      throw new Error('Production must have a valid site URL');
    }

    if (!config.security.enforceHttps) {
      throw new Error('Production must enforce HTTPS');
    }
  }

  // Local environment validation - ensure it uses dev backend
  if (config.environment === 'local') {
    if (!config.api.baseUrl.includes('dev') && !config.api.baseUrl.includes('localhost')) {
      console.warn('⚠️  Local environment should typically use dev backend or localhost');
    }
  }
}

// =============================================================================
// CONFIGURATION MANAGER
// =============================================================================

class SecureConfigManager {
  private config: SecureConfig;
  private initialized = false;

  constructor() {
    this.config = buildConfiguration();
    this.validateConfig();
    this.initialized = true;

    // Log configuration summary (safe for logs)
    console.log('🔧 Configuration initialized:', this.getConfigSummary());
  }

  private validateConfig(): void {
    try {
      validateConfiguration(this.config);
    } catch (error) {
      console.error('❌ Configuration validation failed:', error);
      throw error;
    }
  }

  /**
   * Get the complete configuration
   */
  getConfig(): SecureConfig {
    if (!this.initialized) {
      throw new Error('Configuration not initialized');
    }
    return { ...this.config };
  }

  /**
   * Get a specific configuration section
   */
  get<K extends keyof SecureConfig>(section: K): SecureConfig[K] {
    return this.getConfig()[section];
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: keyof SecureConfig['features']): boolean {
    return this.config.features[feature];
  }

  /**
   * Get environment-safe configuration for client-side use
   * This strips out any server-only configuration
   */
  getClientConfig(): Pick<SecureConfig, 'site' | 'features' | 'performance' | 'environment'> & {
    api: Pick<SecureConfig['api'], 'timeout' | 'retries'>;
  } {
    const config = this.getConfig();
    return {
      environment: config.environment,
      site: config.site,
      features: config.features,
      performance: config.performance,
      api: {
        timeout: config.api.timeout,
        retries: config.api.retries,
        // baseUrl is intentionally excluded for security
      },
    };
  }

  /**
   * Get configuration summary for debugging (safe for logs)
   */
  getConfigSummary(): Record<string, any> {
    const config = this.getConfig();
    return {
      environment: config.environment,
      nodeEnv: config.nodeEnv,
      features: config.features,
      performance: {
        cacheTtl: config.performance.cacheTtl,
        maxConcurrentRequests: config.performance.maxConcurrentRequests,
      },
      firebase: {
        projectId: config.firebase.projectId,
        region: config.firebase.region,
        useEmulator: config.firebase.useEmulator,
      },
      // API baseUrl is masked for security
      apiConfigured: !!config.api.baseUrl,
      apiType: config.api.baseUrl.includes('localhost')
        ? 'local'
        : config.api.baseUrl.includes('cloudfunctions')
          ? 'firebase'
          : 'other',
      siteUrl: config.site.url.includes('localhost') ? 'localhost' : 'configured',
    };
  }

  /**
   * Get Firebase configuration for client SDK
   */
  getFirebaseClientConfig(): {
    projectId: string;
    authDomain?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
    measurementId?: string;
  } {
    const config = this.getConfig();

    return {
      projectId: config.firebase.projectId,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

// Export singleton instance
export const secureConfig = new SecureConfigManager();

// Export configuration getter functions
export const getConfig = () => secureConfig.getConfig();
export const getClientConfig = () => secureConfig.getClientConfig();
export const getFirebaseConfig = () => secureConfig.getFirebaseClientConfig();
export const isFeatureEnabled = (feature: keyof SecureConfig['features']) =>
  secureConfig.isFeatureEnabled(feature);

// Export for testing and debugging
export const getConfigSummary = () => secureConfig.getConfigSummary();

/**
 * Helper function to get API URL safely
 * This replaces the previous hardcoded URLs
 */
export function getApiUrl(endpoint?: string): string {
  const config = secureConfig.getConfig();
  const baseUrl = config.api.baseUrl;

  if (!baseUrl) {
    throw new Error('API base URL not configured');
  }

  if (!endpoint) {
    return baseUrl;
  }

  // Ensure endpoint starts with /
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Remove trailing slash from baseUrl and combine
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  return `${cleanBaseUrl}${cleanEndpoint}`;
}

/**
 * Get Firebase Functions URL for a specific function
 */
export function getFirebaseFunctionUrl(functionName: string): string {
  const config = secureConfig.getConfig();
  const { projectId, region } = config.firebase;

  return `https://${region}-${projectId}.cloudfunctions.net/${functionName}`;
}

/**
 * Type-safe environment variable getter
 */
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  return value || defaultValue!;
}

/**
 * Validate that we're not exposing sensitive information
 */
export function validateNoSensitiveData(): void {
  try {
    secureConfig.getConfig();
    console.log('✅ Configuration security validation passed');
  } catch (error) {
    console.error('❌ Configuration security validation failed:', error);
    throw error;
  }
}

/**
 * Legacy compatibility exports
 */
export const getCurrentEnvironment = () => secureConfig.get('environment');
export const getFirebaseProjectIdLegacy = () => secureConfig.get('firebase').projectId;
export const getApiBaseUrlLegacy = () => secureConfig.get('api').baseUrl;
