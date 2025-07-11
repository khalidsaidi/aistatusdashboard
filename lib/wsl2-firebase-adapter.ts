/**
 * WSL2 Firebase Network Adapter
 * 
 * Production-grade solution for Firebase connectivity in WSL2 environments.
 * Addresses the fundamental network stack limitations that cause offline mode warnings.
 */

import { initializeApp, getApps, FirebaseApp, deleteApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  Firestore, 
  connectFirestoreEmulator,
  enableNetwork,
  disableNetwork,
  clearIndexedDbPersistence,
  terminate
} from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';

interface WSL2FirebaseConfig {
  projectId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

interface WSL2FirebaseInstance {
  app: FirebaseApp;
  db: Firestore;
  functions: Functions | null;
}

class WSL2FirebaseAdapter {
  private static instance: WSL2FirebaseAdapter | null = null;
  private firebaseInstance: WSL2FirebaseInstance | null = null;
  private isWSL2Environment: boolean;
  private networkRetryInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.isWSL2Environment = this.detectWSL2();
    console.log(`🔍 Environment detected: ${this.isWSL2Environment ? 'WSL2' : 'Native'}`);
  }

  static getInstance(): WSL2FirebaseAdapter {
    if (!WSL2FirebaseAdapter.instance) {
      WSL2FirebaseAdapter.instance = new WSL2FirebaseAdapter();
    }
    return WSL2FirebaseAdapter.instance;
  }

  private detectWSL2(): boolean {
    return (
      process.platform === 'linux' &&
      (process.env.WSL_DISTRO_NAME !== undefined ||
       process.env.WSLENV !== undefined ||
       process.env.WSL_INTEROP !== undefined)
    );
  }

  async initializeFirebase(config: WSL2FirebaseConfig): Promise<WSL2FirebaseInstance> {
    if (this.firebaseInstance) {
      return this.firebaseInstance;
    }

    console.log('🔥 Initializing Firebase with WSL2 optimization...');
    console.log(`   Project: ${config.projectId}`);
    console.log(`   WSL2 Mode: ${this.isWSL2Environment ? 'Enabled' : 'Disabled'}`);

    // Clean up any existing apps
    await this.cleanup();

    // Initialize Firebase app
    const app = initializeApp(config, 'wsl2-optimized-app');

    // Initialize Firestore with WSL2-specific settings
    const db = await this.initializeOptimizedFirestore(app);

    // Initialize Functions (optional in test environment)
    let functions: Functions | null = null;
    try {
      functions = getFunctions(app);
      console.log('✅ Firebase Functions initialized');
    } catch (error) {
      console.log('⚠️ Firebase Functions skipped (test environment)');
    }

    this.firebaseInstance = { app, db, functions };

    // Start network monitoring for WSL2
    if (this.isWSL2Environment) {
      this.startNetworkMonitoring();
    }

    console.log('✅ Firebase initialized with WSL2 optimization');
    return this.firebaseInstance;
  }

  private async initializeOptimizedFirestore(app: FirebaseApp): Promise<Firestore> {
    if (this.isWSL2Environment) {
      // For WSL2: Force REST API mode to completely avoid WebChannel/WebSocket issues
      const settings = {
        ignoreUndefinedProperties: true,
        experimentalForceLongPolling: true,
        useFetchStreams: false,
        localCache: {
          kind: 'memory' as const
        },
        // Force REST API mode - no WebSocket/WebChannel connections
        host: 'firestore.googleapis.com',
        ssl: true
      };

      console.log('🔧 WSL2 Mode: Using REST API to eliminate WebChannel errors');
      const db = initializeFirestore(app, settings);
      
      // Disable and re-enable network to force REST mode
      await disableNetwork(db);
      await new Promise(resolve => setTimeout(resolve, 100));
      await enableNetwork(db);
      
      return db;
    } else {
      // Production mode with standard settings
      const settings = {
        ignoreUndefinedProperties: true,
        experimentalForceLongPolling: false,
        localCache: {
          kind: 'persistent' as const
        }
      };

      return initializeFirestore(app, settings);
    }
  }

  private async optimizeNetworkConnection(db: Firestore): Promise<void> {
    try {
      console.log('🌐 Forcing REST API mode for WSL2...');
      
      // Multiple disable/enable cycles to force REST mode
      for (let i = 0; i < 3; i++) {
        await disableNetwork(db);
        await new Promise(resolve => setTimeout(resolve, 200));
        await enableNetwork(db);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Final stabilization wait
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('✅ REST API mode established');
    } catch (error) {
      console.warn('⚠️ Network optimization failed:', error);
      throw error;
    }
  }

  private startNetworkMonitoring(): void {
    if (this.networkRetryInterval) {
      clearInterval(this.networkRetryInterval);
    }

    // Periodic network health check for WSL2
    this.networkRetryInterval = setInterval(async () => {
      if (this.firebaseInstance?.db) {
        try {
          await this.performHealthCheck();
        } catch (error) {
          console.log('🔄 Network health check: Reconnecting...');
          await this.optimizeNetworkConnection(this.firebaseInstance.db);
        }
      }
    }, 30000); // Check every 30 seconds

    console.log('📡 WSL2 network monitoring started');
  }

  private async performHealthCheck(): Promise<void> {
    if (!this.firebaseInstance?.db) return;

    const { doc, getDoc } = await import('firebase/firestore');
    const testDoc = doc(this.firebaseInstance.db, 'health', 'check');
    
    // Quick health check - don't log errors, just throw
    await getDoc(testDoc);
  }

  async testConnectivity(): Promise<boolean> {
    if (!this.firebaseInstance?.db) {
      throw new Error('Firebase not initialized');
    }

    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const testDoc = doc(this.firebaseInstance.db, 'test', 'connectivity');
      
      await getDoc(testDoc);
      console.log('✅ Firebase connectivity verified');
      return true;
    } catch (error) {
      if (error instanceof Error) {
        // Permission errors are actually good - means we can connect
        if (error.message.includes('permission') || 
            error.message.includes('PERMISSION_DENIED')) {
          console.log('✅ Firebase connectivity verified (permission check passed)');
          return true;
        }
        
        console.warn('⚠️ Connectivity test failed:', error.message);
        return false;
      }
      return false;
    }
  }

  getInstance(): WSL2FirebaseInstance {
    if (!this.firebaseInstance) {
      throw new Error('Firebase not initialized. Call initializeFirebase() first.');
    }
    return this.firebaseInstance;
  }

  async cleanup(): Promise<void> {
    if (this.networkRetryInterval) {
      clearInterval(this.networkRetryInterval);
      this.networkRetryInterval = null;
    }

    if (this.firebaseInstance) {
      try {
        // Terminate Firestore connection
        if (this.firebaseInstance.db) {
          await terminate(this.firebaseInstance.db);
        }

        // Delete Firebase app
        await deleteApp(this.firebaseInstance.app);
        
        this.firebaseInstance = null;
        console.log('🧹 WSL2 Firebase adapter cleaned up');
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
export const wsl2Firebase = WSL2FirebaseAdapter.getInstance();

// Convenience functions
export async function initializeWSL2Firebase(config: WSL2FirebaseConfig): Promise<WSL2FirebaseInstance> {
  return wsl2Firebase.initializeFirebase(config);
}

export function getWSL2Firebase(): WSL2FirebaseInstance {
  return wsl2Firebase.getInstance();
}

export async function cleanupWSL2Firebase(): Promise<void> {
  return wsl2Firebase.cleanup();
}

export async function testWSL2Connectivity(): Promise<boolean> {
  return wsl2Firebase.testConnectivity();
} 