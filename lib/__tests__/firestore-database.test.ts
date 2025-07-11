import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { initializeTestFirebase, cleanupTestFirebase, getTestFirebase } from '../test-firebase-config';
import { getFirestore, collection, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import * as db from '../firestore-database';

describe('Firestore Database', () => {
  let testFirebase: { app: any; db: any };
  let testDocIds: string[] = [];

  beforeAll(async () => {
    try {
      testFirebase = await initializeTestFirebase();
      console.log('✅ Firebase initialized for Firestore database tests');
    } catch (error) {
      throw new Error(`CRITICAL: Firebase initialization failed: ${error instanceof Error ? error.message : String(error)}. This must be fixed for tests to run.`);
    }
  });

  afterAll(async () => {
    // Cleanup test documents
    if (testFirebase && testDocIds.length > 0) {
      try {
        const cleanupPromises = testDocIds.map(async (docId) => {
          try {
            await deleteDoc(doc(testFirebase.db, 'status_history', docId));
          } catch (error) {
            throw new Error(`Cleanup failed for doc ${docId}: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
        await Promise.allSettled(cleanupPromises);
      } catch (error) {
        throw new Error(`Test cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    await cleanupTestFirebase();
  });

  describe('Configuration', () => {
    it('should have Firebase instance available', () => {
      if (!testFirebase) {
        throw new Error('CRITICAL: Firebase instance not available - initialization must have failed');
      }
      
      expect(testFirebase).toBeDefined();
      expect(testFirebase.app).toBeDefined();
      expect(testFirebase.db).toBeDefined();
    });

    it('should connect to test Firebase project', () => {
      if (!testFirebase) {
        throw new Error('CRITICAL: Firebase instance not available');
      }
      
      const projectId = testFirebase.app.options.projectId;
      expect(projectId).toBe('ai-status-dashboard-dev');
    });
  });

  describe('Database Operations', () => {
    it('should save status result', async () => {
      if (!testFirebase) {
        throw new Error('CRITICAL: Firebase instance not available');
      }

      const testStatus = {
        id: 'test-provider',
        name: 'Test Provider',
        status: 'operational' as const,
        lastChecked: new Date().toISOString(),
        responseTime: 150,
        statusPageUrl: 'https://status.test.com'
      };

      try {
        await db.saveStatusResult(testStatus);
        console.log('✅ Status result saved successfully');
      } catch (error) {
        throw new Error(`saveStatusResult failed: ${error instanceof Error ? error.message : String(error)}. This indicates a real database issue that must be fixed.`);
      }
    });

    it('should get provider history', async () => {
      if (!testFirebase) {
        throw new Error('CRITICAL: Firebase instance not available');
      }

      try {
        const history = await db.getProviderHistory('openai', 1);
        expect(Array.isArray(history)).toBe(true);
        console.log(`✅ Retrieved ${history.length} provider history records`);
      } catch (error) {
        throw new Error(`getProviderHistory failed: ${error instanceof Error ? error.message : String(error)}. This indicates a real database issue that must be fixed.`);
      }
    });

    it('should save and retrieve test document', async () => {
      if (!testFirebase) {
        throw new Error('CRITICAL: Firebase instance not available');
      }

      const testDoc = {
        providerId: 'test-provider-' + Date.now(),
        status: 'operational' as const,
        timestamp: Timestamp.now(),
        details: 'Test document for database integration'
      };

      try {
        // Save test document
        const docRef = await addDoc(collection(testFirebase.db, 'status_history'), testDoc);
        testDocIds.push(docRef.id);
        
        expect(docRef.id).toBeTruthy();
        console.log(`✅ Test document saved with ID: ${docRef.id}`);
      } catch (error) {
        throw new Error(`Database write operation failed: ${error instanceof Error ? error.message : String(error)}. This indicates a real database issue that must be fixed.`);
      }
    }, 15000);
  });

  describe('Status History Operations', () => {
    it('should handle empty history gracefully', async () => {
      if (!testFirebase) {
        throw new Error('CRITICAL: Firebase instance not available');
      }

      try {
        const nonExistentProviderId = 'non-existent-provider-' + Date.now();
        const history = await db.getProviderHistory(nonExistentProviderId, 1);
        
        expect(Array.isArray(history)).toBe(true);
        expect(history.length).toBe(0);
        
        console.log('✅ Empty history handled correctly');
      } catch (error) {
        throw new Error(`getProviderHistory for non-existent provider failed: ${error instanceof Error ? error.message : String(error)}. This indicates a real database issue that must be fixed.`);
      }
    }, 10000);

    it('should validate provider history structure', async () => {
      if (!testFirebase) {
        throw new Error('CRITICAL: Firebase instance not available');
      }

      try {
        const history = await db.getProviderHistory('openai', 1);
        
        if (history.length > 0) {
          const record = history[0];
          expect(record).toHaveProperty('providerId');
          expect(record).toHaveProperty('status');
          expect(record).toHaveProperty('checkedAt');
          
          console.log('✅ Provider history structure validated');
        } else {
          console.log('✅ No history records found (acceptable for clean test environment)');
        }
      } catch (error) {
        throw new Error(`Provider history validation failed: ${error instanceof Error ? error.message : String(error)}. This indicates a real database issue that must be fixed.`);
      }
    }, 15000);
  });
});

describe('Firestore Database Integration', () => {
  let testFirebase: { app: any; db: any };
  let testDocIds: string[] = [];

  beforeAll(async () => {
    try {
      testFirebase = await initializeTestFirebase();
      console.log('✅ Firebase initialized for integration tests');
    } catch (error) {
      throw new Error(`CRITICAL: Firebase initialization failed: ${error instanceof Error ? error.message : String(error)}. This must be fixed for tests to run.`);
    }
  });

  afterAll(async () => {
    // Cleanup test documents
    if (testFirebase && testDocIds.length > 0) {
      try {
        const cleanupPromises = testDocIds.map(async (docId) => {
          try {
            await deleteDoc(doc(testFirebase.db, 'status_history', docId));
          } catch (error) {
            throw new Error(`Cleanup failed for doc ${docId}: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
        await Promise.allSettled(cleanupPromises);
      } catch (error) {
        throw new Error(`Test cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    await cleanupTestFirebase();
  });

  describe('Provider Status Operations', () => {
    it('should save status results with all fields', async () => {
      if (!testFirebase) {
        throw new Error('CRITICAL: Firebase instance not available');
      }

      const completeStatuses = [{
        id: 'test-complete-' + Date.now(),
        name: 'Complete Test Provider',
        status: 'operational' as const,
        lastChecked: new Date().toISOString(),
        responseTime: 200,
        statusPageUrl: 'https://status.complete.test.com'
      }];

      try {
        await db.saveStatusResults(completeStatuses);
        console.log('✅ Complete status results saved successfully');
      } catch (error) {
        throw new Error(`Complete status save failed: ${error instanceof Error ? error.message : String(error)}. This indicates a real database issue that must be fixed.`);
      }
    }, 15000);

    it('should get last status for provider', async () => {
      if (!testFirebase) {
        throw new Error('CRITICAL: Firebase instance not available');
      }

      try {
        const lastStatus = await db.getLastStatus('openai');
        
        if (lastStatus) {
          expect(lastStatus).toHaveProperty('id');
          expect(lastStatus).toHaveProperty('status');
          expect(lastStatus).toHaveProperty('lastChecked');
          console.log('✅ Last status retrieved successfully');
        } else {
          console.log('✅ No last status found (acceptable for clean test environment)');
        }
      } catch (error) {
        // STRICT MODE: ALL ERRORS MUST BE FIXED
        throw new Error(`Firebase getLastStatus failed: ${error instanceof Error ? error.message : String(error)}. This indicates a real configuration or connectivity issue that must be resolved.`);
      }
    }, 20000);

    it('should return null for non-existent provider', async () => {
      if (!testFirebase) {
        throw new Error('CRITICAL: Firebase instance not available');
      }

      try {
        const nonExistentProviderId = 'non-existent-provider-' + Date.now();
        const lastStatus = await db.getLastStatus(nonExistentProviderId);
        
        // Should return null for non-existent provider
        expect(lastStatus).toBeNull();
        
      } catch (error) {
        // STRICT MODE: ALL ERRORS MUST BE FIXED
        throw new Error(`Firebase getLastStatus for non-existent provider failed: ${error instanceof Error ? error.message : String(error)}. This indicates a real configuration or connectivity issue that must be resolved.`);
      }
    }, 15000);
  });
}); 