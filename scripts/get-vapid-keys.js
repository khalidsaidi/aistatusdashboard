#!/usr/bin/env node

/**
 * VAPID Key Setup Helper
 *
 * This script helps you set up VAPID keys for both dev and production environments.
 * VAPID keys must be obtained from Firebase Console.
 */

const vapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;

if (!vapidKey) {
} else if (vapidKey.includes('your-') || vapidKey === 'placeholder') {
} else {
}

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (projectId) {
  if (projectId === 'ai-status-dashboard-dev') {
  } else if (projectId === 'ai-status-dashboard') {
  } else {
  }
} else {
}
