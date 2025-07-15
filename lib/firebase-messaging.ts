import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// VAPID key for web push
const vapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;

// Initialize Firebase (only in browser environment)
let app: any = null;
let messaging: Messaging | null = null;

// Validate Firebase configuration
const validateFirebaseConfig = () => {
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
  const missing = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);
  
  if (missing.length > 0) {
    throw new Error(`Missing Firebase configuration: ${missing.join(', ')}`);
  }
};

// Skip Firebase initialization in test/Node.js environments
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'test') {
  try {
    validateFirebaseConfig();
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

    // Initialize messaging only on client side with proper browser detection
    if ('navigator' in window && 'serviceWorker' in navigator) {
      messaging = getMessaging(app);
    }
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    throw error;
  }
}

export interface PushSubscription {
  token: string;
  endpoint: string;
  userAgent: string;
  createdAt: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

/**
 * Request notification permission and get FCM token
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (!messaging) {
    console.warn('Firebase messaging not initialized');
    return null;
  }

  if (!vapidKey) {
    throw new Error('VAPID key not configured. Push notifications require a valid VAPID key.');
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      console.log('Notification permission granted');

      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: vapidKey,
      });

      if (token) {
        console.log('FCM token received:', token);
        return token;
      } else {
        console.log('No registration token available');
        return null;
      }
    } else {
      console.log('Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
}

/**
 * Check if notifications are supported
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(providers: string[]): Promise<boolean> {
  try {
    const token = await requestNotificationPermission();

    if (!token) {
      return false;
    }

    // Send subscription to backend
    const response = await fetch('/api/subscribePush', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        providers,
        endpoint: token, // FCM uses token as endpoint
        userAgent: navigator.userAgent,
      }),
    });

    if (response.ok) {
      console.log('Push subscription successful');
      return true;
    } else {
      console.error('Failed to subscribe to push notifications');
      return false;
    }
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return false;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    const token = await requestNotificationPermission();

    if (!token) {
      return false;
    }

    const response = await fetch('/api/unsubscribePush', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return false;
  }
}

/**
 * Listen for foreground messages
 */
export function onForegroundMessage(callback: (payload: any) => void): (() => void) | null {
  if (!messaging) {
    return null;
  }

  const unsubscribe = onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload);
  });

  return unsubscribe;
}

/**
 * Register service worker for background messages
 */
export async function registerServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers not supported');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });

    console.log('Service worker registered:', registration);

    // Send Firebase config to service worker (environment-aware)
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    // Send config to service worker
    registration.active?.postMessage({
      type: 'FIREBASE_CONFIG',
      config: config,
    });

    return true;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return false;
  }
}

/**
 * Show a local notification (fallback)
 */
export function showLocalNotification(payload: NotificationPayload): void {
  if (!isNotificationSupported() || getNotificationPermission() !== 'granted') {
    return;
  }

  const options: NotificationOptions = {
    body: payload.body,
    icon: payload.icon || '/icon-192x192.png',
    badge: payload.badge || '/badge-72x72.png',
    data: payload.data,
    tag: 'ai-status-notification',
    requireInteraction: true,
    ...(payload.actions && { actions: payload.actions }),
  };

  new Notification(payload.title, options);
}

/**
 * Initialize push notifications
 */
export async function initializePushNotifications(): Promise<boolean> {
  try {
    // Register service worker
    const swRegistered = await registerServiceWorker();

    if (!swRegistered) {
      return false;
    }

    // Check if already have permission
    if (getNotificationPermission() === 'granted') {
      console.log('Push notifications already enabled');
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return false;
  }
}
