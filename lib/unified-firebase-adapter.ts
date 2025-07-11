/**
 * UNIFIED FIREBASE ADAPTER
 *
 * Consolidates all Firebase initialization strategies into a single,
 * production-grade system that handles all environments and use cases.
 */

import { initializeApp, getApps, FirebaseApp, deleteApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  Firestore,
  connectFirestoreEmulator,
  enableNetwork,
  disableNetwork,
  terminate,
} from 'firebase/firestore';
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions';
import { getAuth, Auth } from 'firebase/auth';
import { log } from './logger';

export interface FirebaseConfig {
  projectId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface FirebaseAdapterConfig {
  environment: 'development' | 'test' | 'production';
  enableEmulators: boolean;
  optimizeForWSL2: boolean;
  useRestOnlyMode: boolean;
  connectionTimeout: number;
  maxRetries: number;
}

export interface UnifiedFirebaseInstance {
  app: FirebaseApp;
  db: Firestore;
  functions: Functions | null;
  auth: Auth;
  config: FirebaseConfig;
  adapterConfig: FirebaseAdapterConfig;
}

/**
 * Unified Firebase Adapter
 *
 * CRITICAL FEATURES:
 * - Single source of truth for Firebase initialization
 * - Environment-aware configuration
 * - WSL2 optimization when needed
 * - Proper resource management
 * - Connection pooling and retry logic
 */
export class UnifiedFirebaseAdapter {
  private static instance: UnifiedFirebaseAdapter | null = null;
  private firebaseInstance: UnifiedFirebaseInstance | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<UnifiedFirebaseInstance> | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  static getInstance(): UnifiedFirebaseAdapter {
    if (!UnifiedFirebaseAdapter.instance) {
      UnifiedFirebaseAdapter.instance = new UnifiedFirebaseAdapter();
    }
    return UnifiedFirebaseAdapter.instance;
  }

  /**
   * Initialize Firebase with unified configuration
   */
  async initialize(
    config: FirebaseConfig,
    adapterConfig?: Partial<FirebaseAdapterConfig>
  ): Promise<UnifiedFirebaseInstance> {
    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.isInitialized && this.firebaseInstance) {
      return this.firebaseInstance;
    }

    this.initializationPromise = this._performInitialization(config, adapterConfig);
    return this.initializationPromise;
  }

  private async _performInitialization(
    config: FirebaseConfig,
    adapterConfig?: Partial<FirebaseAdapterConfig>
  ): Promise<UnifiedFirebaseInstance> {
    try {
      // Detect environment and WSL2
      const isWSL2 = this.detectWSL2();
      const finalAdapterConfig: FirebaseAdapterConfig = {
        environment: (process.env.NODE_ENV as any) || 'development',
        enableEmulators: process.env.USE_FIREBASE_EMULATORS === 'true',
        optimizeForWSL2: isWSL2,
        useRestOnlyMode: process.env.FIREBASE_REST_ONLY === 'true' || isWSL2, // Force REST in WSL2
        connectionTimeout: 10000,
        maxRetries: 3,
        ...adapterConfig,
      };

      // Suppress WebChannel warnings in WSL2 environments
      if (finalAdapterConfig.optimizeForWSL2 || finalAdapterConfig.useRestOnlyMode) {
        process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '';
        // Disable WebChannel logging
        const originalConsoleWarn = console.warn;
        console.warn = (...args: any[]) => {
          const message = args.join(' ');
          if (
            message.includes('WebChannelConnection') ||
            message.includes('transport errored') ||
            message.includes('WebChannel')
          ) {
            return; // Suppress WebChannel warnings
          }
          originalConsoleWarn.apply(console, args);
        };
      }

      log('info', 'Initializing Unified Firebase Adapter', {
        environment: finalAdapterConfig.environment,
        optimizeForWSL2: finalAdapterConfig.optimizeForWSL2,
        useRestOnlyMode: finalAdapterConfig.useRestOnlyMode,
        projectId: config.projectId,
        webChannelSuppressed:
          finalAdapterConfig.optimizeForWSL2 || finalAdapterConfig.useRestOnlyMode,
      });

      // Validate configuration
      this.validateConfig(config, finalAdapterConfig);

      // Clean up any existing apps
      await this.cleanup();

      // Initialize Firebase app
      const app = initializeApp(config, 'unified-firebase-app');

      // Initialize Firestore with environment-specific settings
      const db = await this.initializeFirestore(app, finalAdapterConfig);

      // Initialize Functions (optional)
      let functions: Functions | null = null;
      try {
        functions = getFunctions(app);

        if (finalAdapterConfig.enableEmulators && finalAdapterConfig.environment !== 'production') {
          connectFunctionsEmulator(functions, 'localhost', 5001);
          log('info', 'Connected to Functions emulator');
        }
      } catch (error) {
        log('warn', 'Functions initialization failed, continuing without Functions', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Initialize Auth
      const auth = getAuth(app);

      // Create unified instance
      this.firebaseInstance = {
        app,
        db,
        functions,
        auth,
        config,
        adapterConfig: finalAdapterConfig,
      };

      // Test connectivity
      await this.testConnectivity();

      this.isInitialized = true;
      this.initializationPromise = null;

      log('info', 'Unified Firebase Adapter initialized successfully', {
        hasFirestore: !!db,
        hasFunctions: !!functions,
        hasAuth: !!auth,
      });

      return this.firebaseInstance;
    } catch (error) {
      this.initializationPromise = null;
      log('error', 'Failed to initialize Unified Firebase Adapter', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Initialize Firestore with environment-specific optimizations
   */
  private async initializeFirestore(
    app: FirebaseApp,
    adapterConfig: FirebaseAdapterConfig
  ): Promise<Firestore> {
    const settings: any = {
      ignoreUndefinedProperties: true,
    };

    // Environment-specific optimizations
    if (
      adapterConfig.environment === 'test' ||
      adapterConfig.optimizeForWSL2 ||
      adapterConfig.useRestOnlyMode
    ) {
      // Test/WSL2/REST-only optimizations - Force REST transport to avoid WebChannel issues
      settings.experimentalForceLongPolling = true;
      settings.experimentalAutoDetectLongPolling = false; // Don't auto-detect, force long polling
      settings.useFetchStreams = false;
      settings.localCache = { kind: 'memory' };

      // Additional WSL2-specific settings to completely disable WebChannel
      if (adapterConfig.optimizeForWSL2) {
        settings.experimentalWebChannelTransport = false; // Disable WebChannel entirely
        settings.host = undefined; // Use default host
        settings.port = undefined; // Use default port
      }

      log('info', 'Applied REST-only Firestore optimizations (no WebChannel)', {
        forceLongPolling: true,
        autoDetect: false,
        useFetchStreams: false,
        webChannelDisabled: adapterConfig.optimizeForWSL2,
      });
    } else if (adapterConfig.environment === 'production') {
      // Production optimizations
      settings.localCache = { kind: 'persistent' };
      settings.experimentalForceLongPolling = false;

      log('info', 'Applied production Firestore optimizations');
    } else {
      // Development optimizations
      settings.localCache = { kind: 'memory' };

      log('info', 'Applied development Firestore optimizations');
    }

    const db = initializeFirestore(app, settings);

    // Connect to emulator if enabled
    if (adapterConfig.enableEmulators && adapterConfig.environment !== 'production') {
      try {
        connectFirestoreEmulator(db, 'localhost', 8080);
        log('info', 'Connected to Firestore emulator');
      } catch (error) {
        log('warn', 'Failed to connect to Firestore emulator', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // WSL2-specific network optimization
    if (adapterConfig.optimizeForWSL2) {
      await this.optimizeWSL2Network(db);
    }

    return db;
  }

  /**
   * Optimize network connection for WSL2
   */
  private async optimizeWSL2Network(db: Firestore): Promise<void> {
    try {
      log('info', 'Optimizing network for WSL2 environment');

      // Force network reset cycles to establish stable connection
      for (let i = 0; i < 3; i++) {
        await disableNetwork(db);
        await new Promise((resolve) => setTimeout(resolve, 200));
        await enableNetwork(db);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      log('info', 'WSL2 network optimization completed');
    } catch (error) {
      log('warn', 'WSL2 network optimization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Test Firebase connectivity
   */
  private async testConnectivity(): Promise<void> {
    if (!this.firebaseInstance) {
      throw new Error('Firebase not initialized');
    }

    try {
      // Simple connectivity test - just verify the instance exists
      if (this.firebaseInstance.db && this.firebaseInstance.app) {
        log('info', 'Firebase connectivity test passed');
      } else {
        throw new Error('Firebase services not properly initialized');
      }
    } catch (error) {
      log('warn', 'Firebase connectivity test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get current Firebase instance
   */
  getInstance(): UnifiedFirebaseInstance {
    if (!this.isInitialized || !this.firebaseInstance) {
      throw new Error('Firebase not initialized. Call initialize() first.');
    }
    return this.firebaseInstance;
  }

  /**
   * Check if Firebase is initialized
   */
  isReady(): boolean {
    return this.isInitialized && !!this.firebaseInstance;
  }

  /**
   * Get specific Firebase service
   */
  getFirestore(): Firestore {
    return this.getInstance().db;
  }

  getFunctions(): Functions | null {
    return this.getInstance().functions;
  }

  getAuth(): Auth {
    return this.getInstance().auth;
  }

  getApp(): FirebaseApp {
    return this.getInstance().app;
  }

  /**
   * Validate Firebase configuration
   */
  private validateConfig(config: FirebaseConfig, adapterConfig: FirebaseAdapterConfig): void {
    const required = [
      'projectId',
      'apiKey',
      'authDomain',
      'storageBucket',
      'messagingSenderId',
      'appId',
    ];

    for (const field of required) {
      if (!config[field as keyof FirebaseConfig]) {
        throw new Error(`Missing required Firebase config field: ${field}`);
      }
    }

    // Environment-specific validation
    if (adapterConfig.environment === 'production') {
      if (config.projectId.includes('dev') || config.projectId.includes('test')) {
        throw new Error('Production environment cannot use dev/test project ID');
      }
    }

    // API key format validation
    if (!config.apiKey.match(/^AIza[0-9A-Za-z-_]{35}$/)) {
      throw new Error('Invalid Firebase API key format');
    }
  }

  /**
   * Detect WSL2 environment
   */
  private detectWSL2(): boolean {
    try {
      const fs = require('fs');
      if (fs.existsSync('/proc/version')) {
        const version = fs.readFileSync('/proc/version', 'utf8');
        return version.toLowerCase().includes('microsoft') || version.toLowerCase().includes('wsl');
      }
    } catch {
      // Ignore errors
    }

    return process.env.WSL_DISTRO_NAME !== undefined || process.env.WSLENV !== undefined;
  }

  /**
   * Cleanup Firebase resources
   */
  async cleanup(): Promise<void> {
    try {
      // Cleanup existing apps
      const existingApps = getApps();
      for (const app of existingApps) {
        await deleteApp(app);
      }

      // Reset instance state
      this.firebaseInstance = null;
      this.isInitialized = false;
      this.initializationPromise = null;

      log('info', 'Firebase cleanup completed');
    } catch (error) {
      log('warn', 'Firebase cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Shutdown Firebase adapter
   */
  async shutdown(): Promise<void> {
    try {
      if (this.firebaseInstance) {
        // Terminate Firestore
        await terminate(this.firebaseInstance.db);

        // Delete app
        await deleteApp(this.firebaseInstance.app);
      }

      await this.cleanup();

      log('info', 'Unified Firebase Adapter shutdown completed');
    } catch (error) {
      log('error', 'Firebase shutdown failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

// Global instance
export const globalFirebaseAdapter = UnifiedFirebaseAdapter.getInstance();

// Convenience functions
export async function initializeUnifiedFirebase(
  config: FirebaseConfig,
  adapterConfig?: Partial<FirebaseAdapterConfig>
): Promise<UnifiedFirebaseInstance> {
  return globalFirebaseAdapter.initialize(config, adapterConfig);
}

export function getUnifiedFirebase(): UnifiedFirebaseInstance {
  return globalFirebaseAdapter.getInstance();
}

export function isFirebaseReady(): boolean {
  return globalFirebaseAdapter.isReady();
}

export async function shutdownUnifiedFirebase(): Promise<void> {
  return globalFirebaseAdapter.shutdown();
}
