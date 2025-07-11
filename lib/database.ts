import { StatusResult } from './types';
import { log } from './logger';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, Timestamp } from 'firebase-admin/firestore';
import { processStatusChange } from './email-notifications';
import { processWebhookStatusChange } from './webhook-notifications';
import { createIncidentFromStatusChange, checkIncidentResolution } from './incident-tracking';

let db: Firestore | null = null;

/**
 * Initialize Firestore
 */
function initFirestore(): Firestore {
  if (!db) {
    try {
      // Check if Firebase Admin is already initialized
      if (getApps().length === 0) {
        // Initialize with environment credentials or default
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          initializeApp({
            credential: cert(serviceAccount),
          });
        } else {
          // Use default credentials (works in Cloud Functions)
          initializeApp();
        }
      }

      db = getFirestore();
      db.settings({ ignoreUndefinedProperties: true });
    } catch (error) {
      log('error', 'Failed to initialize Firestore', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
  return db;
}

/**
 * Get database instance
 */
export function getDatabase(): Firestore {
  if (!db) {
    db = initFirestore();
  }
  return db;
}

/**
 * Get database instance (alias for external use)
 */
export function getDatabaseInstance(): Firestore {
  return getDatabase();
}

/**
 * Initialize the database (for compatibility)
 */
export async function initDatabase(): Promise<void> {
  if (!db) {
    db = initFirestore();
  }
  log('info', 'Firestore database initialized');
}

/**
 * Get the last status for a provider
 */
export async function getLastStatus(providerId: string): Promise<StatusResult | null> {
  const db = getDatabase();

  try {
    const snapshot = await db
      .collection('status_history')
      .where('providerId', '==', providerId)
      .orderBy('checkedAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
      id: data.providerId,
      name: data.providerName,
      status: data.status,
      responseTime: data.responseTime,
      error: data.error,
      lastChecked: data.checkedAt.toDate().toISOString(),
      statusPageUrl: data.statusPageUrl || '',
    };
  } catch (error) {
    log('error', 'Failed to get last status', {
      provider: providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Save status result to database with notifications
 */
export async function saveStatusResult(result: StatusResult): Promise<void> {
  const db = getDatabase();

  try {
    // Get previous status for comparison
    const previousStatus = await getLastStatus(result.id);

    // Save to Firestore
    await db.collection('status_history').add({
      providerId: result.id,
      providerName: result.name,
      status: result.status,
      responseTime: result.responseTime,
      error: result.error || null,
      checkedAt: Timestamp.fromDate(new Date(result.lastChecked)),
      createdAt: Timestamp.now(),
      statusPageUrl: result.statusPageUrl || '',
    });

    // Trigger notifications if status changed
    if (previousStatus && previousStatus.status !== result.status) {
      log('info', 'Status change detected, triggering notifications', {
        provider: result.id,
        change: `${previousStatus.status} → ${result.status}`,
      });

      // Process email notifications
      await processStatusChange(result, previousStatus);

      // Process webhook notifications
      await processWebhookStatusChange(result, previousStatus);

      // Process incident tracking
      await createIncidentFromStatusChange(result, previousStatus);
      await checkIncidentResolution(result, previousStatus);
    }
  } catch (error) {
    log('error', 'Failed to save status result', {
      provider: result.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Save multiple status results
 */
export async function saveStatusResults(results: StatusResult[]): Promise<void> {
  const db = getDatabase();
  const batch = db.batch();

  try {
    for (const result of results) {
      const docRef = db.collection('status_history').doc();
      batch.set(docRef, {
        providerId: result.id,
        providerName: result.name,
        status: result.status,
        responseTime: result.responseTime,
        error: result.error || null,
        checkedAt: Timestamp.fromDate(new Date(result.lastChecked)),
        createdAt: Timestamp.now(),
        statusPageUrl: result.statusPageUrl || '',
      });
    }

    await batch.commit();
    log('info', 'Saved status results to database', { count: results.length });
  } catch (error) {
    log('error', 'Failed to save status results', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get status history for a provider
 */
export async function getProviderHistory(providerId: string, hours: number = 24): Promise<any[]> {
  const db = getDatabase();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  try {
    const snapshot = await db
      .collection('status_history')
      .where('providerId', '==', providerId)
      .where('checkedAt', '>=', Timestamp.fromDate(since))
      .orderBy('checkedAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      checked_at: doc.data().checkedAt.toDate().toISOString(),
    }));
  } catch (error) {
    log('error', 'Failed to get provider history', {
      provider: providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Calculate uptime percentage for a provider
 */
export async function calculateUptime(providerId: string, hours: number = 24): Promise<number> {
  const db = getDatabase();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  try {
    const snapshot = await db
      .collection('status_history')
      .where('providerId', '==', providerId)
      .where('checkedAt', '>=', Timestamp.fromDate(since))
      .get();

    if (snapshot.empty) {
      return 100; // No data means assume 100%
    }

    const total = snapshot.size;
    const operational = snapshot.docs.filter((doc) => doc.data().status === 'operational').length;

    return Math.round((operational / total) * 100 * 100) / 100;
  } catch (error) {
    log('error', 'Failed to calculate uptime', {
      provider: providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 100;
  }
}

/**
 * Get average response time for a provider
 */
export async function getAverageResponseTime(
  providerId: string,
  hours: number = 24
): Promise<number> {
  const db = getDatabase();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  try {
    // Use only the composite index we have: providerId + checkedAt
    const snapshot = await db
      .collection('status_history')
      .where('providerId', '==', providerId)
      .where('checkedAt', '>=', Timestamp.fromDate(since))
      .get();

    if (snapshot.empty) {
      return 0;
    }

    // Filter out 'unknown' status in application code to avoid multiple inequality filters
    const validResponseTimes = snapshot.docs
      .map((doc) => doc.data())
      .filter((data) => data.status !== 'unknown')
      .map((data) => data.responseTime);

    if (validResponseTimes.length === 0) {
      return 0;
    }

    const sum = validResponseTimes.reduce((acc, time) => acc + time, 0);

    return Math.round(sum / validResponseTimes.length);
  } catch (error) {
    log('error', 'Failed to get average response time', {
      provider: providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}

/**
 * Clean up old records (keep 30 days)
 */
export async function cleanupOldRecords(): Promise<void> {
  const db = getDatabase();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    // Firestore requires batched deletes
    const snapshot = await db
      .collection('status_history')
      .where('checkedAt', '<', Timestamp.fromDate(thirtyDaysAgo))
      .limit(500) // Process in batches
      .get();

    if (snapshot.empty) {
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    log('info', 'Cleaned up old records', {
      deleted: snapshot.size,
    });

    // Recursively delete more if needed
    if (snapshot.size === 500) {
      await cleanupOldRecords();
    }
  } catch (error) {
    log('error', 'Failed to cleanup old records', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Close database connection (no-op for Firestore)
 */
export async function closeDatabase(): Promise<void> {
  // Firestore doesn't need explicit closing
  log('info', 'Database close requested (no-op for Firestore)');
}
