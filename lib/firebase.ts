import { initializeApp, getApps } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getPerformance } from 'firebase/performance';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Analytics (only in browser)
let analytics: any = null;
let performance: any = null;

if (typeof window !== 'undefined') {
  // Initialize Google Analytics
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });

  // Initialize Performance Monitoring
  performance = getPerformance(app);
}

export { app, analytics, performance };

// Performance monitoring utilities
export const trackCustomMetric = (name: string, value: number) => {
  if (performance && typeof window !== 'undefined') {
    const trace = performance.trace(name);
    trace.start();
    trace.putMetric(name, value);
    trace.stop();
  }
};

export const trackPageLoad = (pageName: string) => {
  if (performance && typeof window !== 'undefined') {
    const trace = performance.trace(`page_load_${pageName}`);
    trace.start();
    
    // Stop trace when page is fully loaded
    if (document.readyState === 'complete') {
      trace.stop();
    } else {
      window.addEventListener('load', () => {
        trace.stop();
      });
    }
  }
};

export const trackApiCall = async (apiName: string, apiCall: () => Promise<any>) => {
  if (performance && typeof window !== 'undefined') {
    const trace = performance.trace(`api_${apiName}`);
    trace.start();
    
    try {
      const result = await apiCall();
      trace.putAttribute('success', 'true');
      return result;
    } catch (error) {
      trace.putAttribute('success', 'false');
      trace.putAttribute('error', error instanceof Error ? error.message : 'unknown');
      throw error;
    } finally {
      trace.stop();
    }
  } else {
    return await apiCall();
  }
}; 