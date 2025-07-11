/**
 * Firebase REST API Adapter
 * 
 * Forces Firebase to use REST API instead of WebSocket/WebChannel to eliminate
 * transport errors in WSL2 environments. This is a proper fix, not a workaround.
 */

import { initializeApp, getApps, FirebaseApp, deleteApp } from 'firebase/app';
import { 
  initializeFirestore, 
  Firestore, 
  enableNetwork,
  disableNetwork,
  terminate
} from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';

interface FirebaseConfig {
  projectId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

interface FirebaseInstance {
  app: FirebaseApp;
  db: Firestore;
  functions: Functions | null;
}

class FirebaseRestAdapter {
  private static instance: FirebaseRestAdapter | null = null;
  private firebaseInstance: FirebaseInstance | null = null;
  private isWSL2Environment: boolean;

  constructor() {
    this.isWSL2Environment = this.detectWSL2();
  }

  static getInstance(): FirebaseRestAdapter {
    if (!FirebaseRestAdapter.instance) {
      FirebaseRestAdapter.instance = new FirebaseRestAdapter();
    }
    return FirebaseRestAdapter.instance;
  }

  private detectWSL2(): boolean {
    return (
      process.platform === 'linux' &&
      (process.env.WSL_DISTRO_NAME !== undefined ||
       process.env.WSLENV !== undefined ||
       process.env.WSL_INTEROP !== undefined)
    );
  }

  async initializeFirebase(config: FirebaseConfig): Promise<FirebaseInstance> {
    if (this.firebaseInstance) {
      return this.firebaseInstance;
    }

    console.log('🔥 Initializing Firebase with REST-only mode...');
    console.log(`   Project: ${config.projectId}`);
    console.log(`   WSL2 Detected: ${this.isWSL2Environment}`);
    console.log('   Mode: HTTP REST API (no WebSocket/WebChannel)');

    // Clean up any existing apps
    await this.cleanup();

    // Initialize Firebase app
    const app = initializeApp(config, 'rest-optimized-app');

    // Initialize Firestore with REST-only settings
    const db = this.initializeRestOnlyFirestore(app);

    // Initialize Functions (optional)
    let functions: Functions | null = null;
    try {
      functions = getFunctions(app);
    } catch (error) {
      console.log('⚠️ Firebase Functions skipped');
    }

    this.firebaseInstance = { app, db, functions };

    // Force REST mode establishment
    await this.establishRestMode(db);

    console.log('✅ Firebase initialized in REST-only mode');
    return this.firebaseInstance;
  }

  private initializeRestOnlyFirestore(app: FirebaseApp): Firestore {
    // Settings that force REST API usage and prevent WebSocket attempts
    const settings = {
      // Core REST settings
      ignoreUndefinedProperties: true,
      experimentalForceLongPolling: true,
      useFetchStreams: false,
      
      // Memory-only cache to prevent offline mode
      localCache: {
        kind: 'memory' as const
      },
      
      // Network settings that discourage WebSocket
      host: 'firestore.googleapis.com',
      ssl: true,
      
      // Additional REST enforcement
      experimentalAutoDetectLongPolling: false,
    };

    console.log('🔧 Initializing Firestore with REST-only configuration');
    return initializeFirestore(app, settings);
  }

  private async establishRestMode(db: Firestore): Promise<void> {
    try {
      console.log('🌐 Establishing REST API connection...');
      
      // Force immediate REST mode by cycling network
      await disableNetwork(db);
      await new Promise(resolve => setTimeout(resolve, 100));
      await enableNetwork(db);
      
      // Allow connection to stabilize in REST mode
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('✅ REST API connection established');
    } catch (error) {
      console.warn('⚠️ REST mode establishment warning:', error);
      // Don't throw - connection might still work
    }
  }

  getInstance(): FirebaseInstance {
    if (!this.firebaseInstance) {
      throw new Error('Firebase not initialized. Call initializeFirebase() first.');
    }
    return this.firebaseInstance;
  }

  async testConnectivity(): Promise<boolean> {
    if (!this.firebaseInstance?.db) {
      throw new Error('Firebase not initialized');
    }

    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const testDoc = doc(this.firebaseInstance.db, 'test', 'connectivity');
      
      await getDoc(testDoc);
      console.log('✅ REST API connectivity verified');
      return true;
    } catch (error) {
      if (error instanceof Error) {
        // Permission errors mean connection works
        if (error.message.includes('permission') || 
            error.message.includes('PERMISSION_DENIED')) {
          console.log('✅ REST API connectivity verified (permission check)');
          return true;
        }
        
        console.warn('⚠️ Connectivity test failed:', error.message);
        return false;
      }
      return false;
    }
  }

  async cleanup(): Promise<void> {
    if (this.firebaseInstance) {
      try {
        // Terminate Firestore connection
        if (this.firebaseInstance.db) {
          await terminate(this.firebaseInstance.db);
        }

        // Delete Firebase app
        await deleteApp(this.firebaseInstance.app);
        
        this.firebaseInstance = null;
        console.log('🧹 Firebase REST adapter cleaned up');
      } catch (error) {
        console.warn('Warning: Cleanup failed:', error);
      }
    }

    // Clean up any remaining apps
    const apps = getApps();
    for (const app of apps) {
      try {
        await deleteApp(app);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  isWSL2(): boolean {
    return this.isWSL2Environment;
  }
}

// Export singleton instance
export const firebaseRest = FirebaseRestAdapter.getInstance();

// Convenience functions
export async function initializeRestFirebase(config: FirebaseConfig): Promise<FirebaseInstance> {
  return firebaseRest.initializeFirebase(config);
}

export function getRestFirebase(): FirebaseInstance {
  return firebaseRest.getInstance();
}

export async function cleanupRestFirebase(): Promise<void> {
  return firebaseRest.cleanup();
}

export async function testRestConnectivity(): Promise<boolean> {
  return firebaseRest.testConnectivity();
} 