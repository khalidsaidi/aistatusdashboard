/**
 * Production-Grade Firebase Configuration for Test Environments
 *
 * Uses WSL2 Firebase Adapter to eliminate network limitations and offline mode warnings
 * for comprehensive testing without workarounds.
 */

import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  initializeUnifiedFirebase,
  getUnifiedFirebase,
  shutdownUnifiedFirebase,
  isFirebaseReady,
} from './unified-firebase-adapter';

interface FirebaseTestConfig {
  projectId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

let testFirebaseInstance: { app: FirebaseApp; db: Firestore } | null = null;

/**
 * Load Firebase configuration from secure config file
 */
function loadFirebaseConfig(): FirebaseTestConfig {
  try {
    const configPath = join(process.cwd(), 'config', 'test.env');
    const configContent = readFileSync(configPath, 'utf-8');

    const envVars: Record<string, string> = {};
    configContent.split('\n').forEach((line) => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });

    return {
      projectId: process.env.FIREBASE_PROJECT_ID!,
      apiKey: process.env.FIREBASE_API_KEY!,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN!,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.FIREBASE_APP_ID!,
    };
  } catch (error) {
    throw new Error(`Failed to load Firebase test configuration: ${error}`);
  }
}

/**
 * Initialize Firebase with WSL2 optimization for production-grade testing
 *
 * Uses the WSL2 Firebase Adapter to eliminate offline mode warnings and
 * network connectivity issues while maintaining full Firebase functionality.
 */
export async function initializeTestFirebase(): Promise<{ app: FirebaseApp; db: Firestore }> {
  if (testFirebaseInstance) {
    return testFirebaseInstance;
  }

  const config = loadFirebaseConfig();

  console.log('🚀 Initializing WSL2-optimized Firebase for testing...');
  console.log(`   Project: ${config.projectId}`);
  console.log('   Mode: Production-grade with WSL2 optimization');

  // Initialize Firebase using unified adapter
  const unifiedInstance = await initializeUnifiedFirebase(config, {
    environment: 'test',
    enableEmulators: false,
    optimizeForWSL2: true,
    useRestOnlyMode: true,
    connectionTimeout: 10000,
    maxRetries: 3,
  });

  testFirebaseInstance = {
    app: unifiedInstance.app,
    db: unifiedInstance.db,
  };

  // Test connectivity using unified adapter
  const connected = isFirebaseReady();
  if (connected) {
    console.log('✅ WSL2-optimized Firebase connectivity verified');
  } else {
    console.warn('⚠️ Firebase connectivity test had issues, but continuing with WSL2 optimization');
  }

  return testFirebaseInstance;
}

/**
 * Cleanup Firebase resources after tests
 */
export async function cleanupTestFirebase(): Promise<void> {
  if (testFirebaseInstance) {
    try {
      await shutdownUnifiedFirebase();
      testFirebaseInstance = null;
      console.log('🧹 WSL2-optimized Firebase resources cleaned up');
    } catch (error) {
      console.warn('Warning: Firebase cleanup failed:', error);
    }
  }
}

/**
 * Get the test Firebase instances (must call initializeTestFirebase first)
 */
export function getTestFirebase(): { app: FirebaseApp; db: Firestore } {
  if (!testFirebaseInstance) {
    throw new Error('Firebase not initialized. Call initializeTestFirebase() first.');
  }
  return testFirebaseInstance;
}
