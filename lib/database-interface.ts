import { StatusResult, StatusHistoryRecord } from './types';

export interface DatabaseInterface {
  // Status operations
  saveStatusResult(result: StatusResult): Promise<void>;
  saveStatusResults(results: StatusResult[]): Promise<void>;
  getLastStatus(providerId: string): Promise<StatusResult | null>;
  getProviderHistory(providerId: string, hours?: number): Promise<StatusHistoryRecord[]>;
  
  // Analytics
  calculateUptime(providerId: string, hours?: number): Promise<number>;
  getAverageResponseTime(providerId: string, hours?: number): Promise<number>;
  
  // Maintenance
  cleanupOldRecords(): Promise<void>;
  closeDatabase(): Promise<void>;
  
  // Health check
  isHealthy(): Promise<boolean>;
}

export interface DatabaseConfig {
  type: 'firestore';
  connectionString?: string;
  options?: Record<string, any>;
}

// Factory function to create database instance
export async function createDatabase(config: DatabaseConfig): Promise<DatabaseInterface> {
  switch (config.type) {
    case 'firestore':
      const firestoreDb = await import('./firestore-database');
      return firestoreDb;
    
    default:
      throw new Error(`Unsupported database type: ${config.type}. Only 'firestore' is supported.`);
  }
}

// Global database instance
let databaseInstance: DatabaseInterface | null = null;

export async function getDatabase(): Promise<DatabaseInterface> {
  if (!databaseInstance) {
    const config: DatabaseConfig = {
      type: 'firestore', // Only Firestore is supported
      connectionString: process.env.DATABASE_URL,
      options: {
        retentionDays: parseInt(process.env.DATA_RETENTION_DAYS || '30'),
        batchSize: parseInt(process.env.DATABASE_BATCH_SIZE || '100')
      }
    };
    
    databaseInstance = await createDatabase(config);
  }
  
  return databaseInstance;
} 