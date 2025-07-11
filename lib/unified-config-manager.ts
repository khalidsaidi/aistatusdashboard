/**
 * UNIFIED CONFIGURATION MANAGER
 *
 * Consolidates all configuration systems into a single, type-safe,
 * environment-aware configuration manager.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { log } from './logger';

// =============================================================================
// CONFIGURATION INTERFACES
// =============================================================================

export interface FirebaseConfig {
  projectId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface DatabaseConfig {
  maxConnections: number;
  connectionTimeout: number;
  queryTimeout: number;
  batchSize: number;
  indexOptimization: boolean;
}

export interface ScalingConfig {
  maxConcurrency: number;
  batchSize: number;
  scalingThreshold: number;
  autoScaleEnabled: boolean;
  resourceLimits: {
    memory: number;
    cpu: number;
  };
}

export interface SecurityConfig {
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
  circuitBreaker: {
    threshold: number;
    timeout: number;
    resetTimeout: number;
  };
  authentication: {
    required: boolean;
    tokenExpiry: number;
  };
}

export interface MonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    memoryUsage: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    structured: boolean;
  };
}

export interface UnifiedConfig {
  environment: 'development' | 'test' | 'production';
  firebase: FirebaseConfig;
  database: DatabaseConfig;
  scaling: ScalingConfig;
  security: SecurityConfig;
  monitoring: MonitoringConfig;
  features: {
    enableEmulators: boolean;
    optimizeForWSL2: boolean;
    useRestOnlyMode: boolean;
    enableCaching: boolean;
    enableMetrics: boolean;
  };
}

// =============================================================================
// CONFIGURATION SOURCES
// =============================================================================

interface ConfigSource {
  name: string;
  priority: number;
  load(): Partial<UnifiedConfig> | null;
}

/**
 * Environment Variables Configuration Source
 */
class EnvironmentConfigSource implements ConfigSource {
  name = 'environment';
  priority = 1; // Highest priority

  load(): Partial<UnifiedConfig> | null {
    try {
      const config: Partial<UnifiedConfig> = {
        environment: (process.env.NODE_ENV as any) || 'development',
        firebase: {
          projectId: process.env.FIREBASE_PROJECT_ID || '',
          apiKey: process.env.FIREBASE_API_KEY || '',
          authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
          messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
          appId: process.env.FIREBASE_APP_ID || '',
          measurementId: process.env.FIREBASE_MEASUREMENT_ID,
        },
        ...(process.env.DB_MAX_CONNECTIONS && {
          database: {
            maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS),
            connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
            queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
            batchSize: parseInt(process.env.DB_BATCH_SIZE || '25'),
            indexOptimization: process.env.DB_INDEX_OPTIMIZATION === 'true',
          },
        }),
        ...(process.env.SCALING_MAX_CONCURRENCY && {
          scaling: {
            maxConcurrency: parseInt(process.env.SCALING_MAX_CONCURRENCY),
            batchSize: parseInt(process.env.SCALING_BATCH_SIZE || '50'),
            scalingThreshold: parseInt(process.env.SCALING_THRESHOLD || '100'),
            autoScaleEnabled: process.env.AUTO_SCALE_ENABLED === 'true',
            resourceLimits: {
              memory: parseInt(process.env.SCALING_MEMORY_LIMIT || '512'),
              cpu: parseInt(process.env.SCALING_CPU_LIMIT || '2'),
            },
          },
        }),
        features: {
          enableEmulators: process.env.USE_FIREBASE_EMULATORS === 'true',
          optimizeForWSL2: process.env.OPTIMIZE_FOR_WSL2 === 'true',
          useRestOnlyMode: process.env.FIREBASE_REST_ONLY === 'true',
          enableCaching: process.env.ENABLE_CACHING !== 'false',
          enableMetrics: process.env.ENABLE_METRICS !== 'false',
        },
      };

      return this.removeUndefinedValues(config);
    } catch (error) {
      log('warn', 'Failed to load environment configuration', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  private removeUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    const cleaned: any = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = this.removeUndefinedValues(value);
      }
    }

    return cleaned;
  }
}

/**
 * Configuration File Source
 */
class FileConfigSource implements ConfigSource {
  name = 'file';
  priority = 2;

  load(): Partial<UnifiedConfig> | null {
    const configPaths = ['config/config.json', 'config/config.js', 'config.json', '.env.json'];

    for (const configPath of configPaths) {
      try {
        if (existsSync(configPath)) {
          const content = readFileSync(configPath, 'utf-8');

          if (configPath.endsWith('.json')) {
            return JSON.parse(content);
          } else if (configPath.endsWith('.js')) {
            // Dynamic import for JS config files
            delete require.cache[require.resolve(join(process.cwd(), configPath))];
            return require(join(process.cwd(), configPath));
          }
        }
      } catch (error) {
        log('warn', `Failed to load config from ${configPath}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return null;
  }
}

/**
 * Test Environment Configuration Source
 */
class TestConfigSource implements ConfigSource {
  name = 'test';
  priority = 3;

  load(): Partial<UnifiedConfig> | null {
    if (process.env.NODE_ENV !== 'test') {
      return null;
    }

    const testConfigPaths = ['config/test.env', 'config/test.json', 'test.env'];

    for (const configPath of testConfigPaths) {
      try {
        if (existsSync(configPath)) {
          const content = readFileSync(configPath, 'utf-8');

          if (configPath.endsWith('.env')) {
            // Parse .env format
            const config: any = {};
            const lines = content.split('\n');

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                  const value = valueParts.join('=').replace(/^["']|["']$/g, '');

                  // Map to config structure
                  if (key.startsWith('FIREBASE_')) {
                    config.firebase = config.firebase || {};
                    const fbKey = key.replace('FIREBASE_', '').toLowerCase();
                    if (fbKey === 'project_id') config.firebase.projectId = value;
                    else if (fbKey === 'api_key') config.firebase.apiKey = value;
                    else if (fbKey === 'auth_domain') config.firebase.authDomain = value;
                    else if (fbKey === 'storage_bucket') config.firebase.storageBucket = value;
                    else if (fbKey === 'messaging_sender_id')
                      config.firebase.messagingSenderId = value;
                    else if (fbKey === 'app_id') config.firebase.appId = value;
                    else if (fbKey === 'measurement_id') config.firebase.measurementId = value;
                  }
                }
              }
            }

            return config;
          } else if (configPath.endsWith('.json')) {
            return JSON.parse(content);
          }
        }
      } catch (error) {
        log('warn', `Failed to load test config from ${configPath}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return null;
  }
}

/**
 * Default Configuration Source
 */
class DefaultConfigSource implements ConfigSource {
  name = 'default';
  priority = 4; // Lowest priority

  load(): Partial<UnifiedConfig> {
    return {
      environment: 'development',
      database: {
        maxConnections: 100,
        connectionTimeout: 10000,
        queryTimeout: 30000,
        batchSize: 25,
        indexOptimization: true,
      },
      scaling: {
        maxConcurrency: 20,
        batchSize: 50,
        scalingThreshold: 100,
        autoScaleEnabled: true,
        resourceLimits: {
          memory: 512,
          cpu: 2,
        },
      },
      security: {
        rateLimiting: {
          windowMs: 60000,
          maxRequests: 1000,
        },
        circuitBreaker: {
          threshold: 20,
          timeout: 30000,
          resetTimeout: 60000,
        },
        authentication: {
          required: false,
          tokenExpiry: 3600,
        },
      },
      monitoring: {
        enabled: true,
        metricsInterval: 30000,
        alertThresholds: {
          errorRate: 5,
          responseTime: 5000,
          memoryUsage: 80,
        },
        logging: {
          level: 'info',
          structured: true,
        },
      },
      features: {
        enableEmulators: false,
        optimizeForWSL2: false,
        useRestOnlyMode: false,
        enableCaching: true,
        enableMetrics: true,
      },
    };
  }
}

// =============================================================================
// UNIFIED CONFIGURATION MANAGER
// =============================================================================

export class UnifiedConfigManager {
  private static instance: UnifiedConfigManager | null = null;
  private config: UnifiedConfig | null = null;
  private sources: ConfigSource[] = [];
  private isLoaded = false;

  private constructor() {
    this.sources = [
      new EnvironmentConfigSource(),
      new FileConfigSource(),
      new TestConfigSource(),
      new DefaultConfigSource(),
    ].sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): UnifiedConfigManager {
    if (!UnifiedConfigManager.instance) {
      UnifiedConfigManager.instance = new UnifiedConfigManager();
    }
    return UnifiedConfigManager.instance;
  }

  /**
   * Load configuration from all sources
   */
  async load(): Promise<UnifiedConfig> {
    if (this.isLoaded && this.config) {
      return this.config;
    }

    try {
      log('info', 'Loading unified configuration from all sources');

      let mergedConfig: Partial<UnifiedConfig> = {};

      // Load from all sources in priority order (reverse since lower priority = higher precedence)
      for (const source of this.sources.reverse()) {
        const sourceConfig = source.load();
        if (sourceConfig) {
          mergedConfig = this.deepMerge(mergedConfig, sourceConfig);
          log('info', `Loaded configuration from source: ${source.name}`);
        }
      }

      // Validate the merged configuration
      this.config = this.validateAndTransform(mergedConfig);
      this.isLoaded = true;

      log('info', 'Unified configuration loaded successfully', {
        environment: this.config.environment,
        sources: this.sources.map((s) => s.name),
        features: this.config.features,
      });

      return this.config;
    } catch (error) {
      log('error', 'Failed to load unified configuration', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): UnifiedConfig {
    if (!this.isLoaded || !this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * Get specific configuration section
   */
  getFirebaseConfig(): FirebaseConfig {
    return this.getConfig().firebase;
  }

  getDatabaseConfig(): DatabaseConfig {
    return this.getConfig().database;
  }

  getScalingConfig(): ScalingConfig {
    return this.getConfig().scaling;
  }

  getSecurityConfig(): SecurityConfig {
    return this.getConfig().security;
  }

  getMonitoringConfig(): MonitoringConfig {
    return this.getConfig().monitoring;
  }

  /**
   * Check if configuration is loaded
   */
  isConfigLoaded(): boolean {
    return this.isLoaded && !!this.config;
  }

  /**
   * Reload configuration
   */
  async reload(): Promise<UnifiedConfig> {
    this.isLoaded = false;
    this.config = null;
    return this.load();
  }

  /**
   * Deep merge configuration objects
   */
  private deepMerge(target: any, source: any): any {
    if (!source) return target;
    if (!target) return source;

    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key]) &&
          typeof target[key] === 'object' &&
          target[key] !== null &&
          !Array.isArray(target[key])
        ) {
          result[key] = this.deepMerge(target[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Validate and transform configuration
   */
  private validateAndTransform(config: Partial<UnifiedConfig>): UnifiedConfig {
    // Validate required Firebase configuration
    if (!config.firebase?.projectId) {
      throw new Error('Firebase project ID is required');
    }

    if (!config.firebase?.apiKey) {
      throw new Error('Firebase API key is required');
    }

    // Ensure features object exists
    config.features = config.features || {
      enableEmulators: false,
      optimizeForWSL2: false,
      useRestOnlyMode: false,
      enableCaching: true,
      enableMetrics: true,
    };

    // Auto-detect WSL2 if not explicitly set
    if (config.features.optimizeForWSL2 === undefined) {
      config.features.optimizeForWSL2 = this.detectWSL2();
    }

    // Auto-enable REST mode for WSL2
    if (config.features.optimizeForWSL2 && config.features.useRestOnlyMode === undefined) {
      config.features.useRestOnlyMode = true;
    }

    // Environment-specific adjustments
    if (config.environment === 'test') {
      config.features.enableEmulators = config.features.enableEmulators ?? false;
      config.monitoring = config.monitoring || {
        enabled: false,
        metricsInterval: 30000,
        alertThresholds: { errorRate: 5, responseTime: 5000, memoryUsage: 80 },
        logging: { level: 'info', structured: true },
      };
      config.monitoring.enabled = false; // Disable monitoring in tests
    }

    return config as UnifiedConfig;
  }

  /**
   * Detect WSL2 environment
   */
  private detectWSL2(): boolean {
    try {
      if (existsSync('/proc/version')) {
        const version = readFileSync('/proc/version', 'utf8');
        return version.toLowerCase().includes('microsoft') || version.toLowerCase().includes('wsl');
      }
    } catch {
      // Ignore errors
    }

    return process.env.WSL_DISTRO_NAME !== undefined || process.env.WSLENV !== undefined;
  }
}

// Global instance
export const globalConfigManager = UnifiedConfigManager.getInstance();

// Convenience functions
export async function loadUnifiedConfig(): Promise<UnifiedConfig> {
  return globalConfigManager.load();
}

export function getUnifiedConfig(): UnifiedConfig {
  return globalConfigManager.getConfig();
}

export function isConfigLoaded(): boolean {
  return globalConfigManager.isConfigLoaded();
}
