import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!process.env.FIREBASE_PROJECT_ID || !privateKey || !process.env.FIREBASE_CLIENT_EMAIL) {
    throw new Error('Missing Firebase Admin SDK configuration');
  }

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

// Get Firestore instance
export const adminDb = getFirestore();

// Helper function to convert Firestore timestamp to ISO string
export function timestampToISOString(timestamp: any): string {
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  return new Date().toISOString();
}

// Helper function to create server timestamp
export function serverTimestamp() {
  return new Date();
} 