# Firebase VAPID Keys Setup Guide

## Overview

VAPID keys are required for web push notifications. You need separate keys for dev and production environments.

## Steps to Get VAPID Keys

### 1. Development Environment (ai-status-dashboard-dev)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **ai-status-dashboard-dev**
3. Go to **Project Settings** (gear icon)
4. Click on **Cloud Messaging** tab
5. Scroll down to **Web configuration**
6. If no key exists, click **Generate key pair**
7. Copy the **Key pair** value

### 2. Production Environment (ai-status-dashboard)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **ai-status-dashboard**
3. Go to **Project Settings** (gear icon)
4. Click on **Cloud Messaging** tab
5. Scroll down to **Web configuration**
6. If no key exists, click **Generate key pair**
7. Copy the **Key pair** value

## Environment Variables to Update

### Development (.env.local)

```bash
NEXT_PUBLIC_FCM_VAPID_KEY=<DEV_VAPID_KEY_HERE>
```

### Production (.env.production)

```bash
NEXT_PUBLIC_FCM_VAPID_KEY=<PROD_VAPID_KEY_HERE>
```

## Alternative: Generate via Firebase CLI

If you have Firebase CLI with admin permissions:

```bash
# For dev environment
firebase use ai-status-dashboard-dev
# Then go to Firebase Console to get the key

# For production environment
firebase use ai-status-dashboard
# Then go to Firebase Console to get the key
```

## Test After Setup

1. Update the environment files with real VAPID keys
2. Restart the development server
3. Test push notifications in the browser
4. Should see "Push notifications enabled successfully" instead of error

## Security Note

- VAPID keys are public keys and safe to include in client-side code
- They are environment-specific and should be different for dev/prod
- Store them in environment variables, not hardcoded in source code
