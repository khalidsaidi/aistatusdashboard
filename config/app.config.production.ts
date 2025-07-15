import { AppConfig, SHARED_PROVIDERS, SHARED_API_ENDPOINTS, SHARED_RATE_LIMIT } from './app.config.base';

export const PROD_CONFIG: AppConfig = {
  environment: {
    name: 'production',
    nodeEnv: process.env.NODE_ENV || 'production', // Always production in Next.js builds
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://aistatusdashboard.com',
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://us-central1-ai-status-dashboard-prod.cloudfunctions.net',
  },

  api: {
    basePath: '/api',
    endpoints: SHARED_API_ENDPOINTS,
  },

  firebase: {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ai-status-dashboard-prod',
    functions: {
      region: process.env.FIREBASE_FUNCTIONS_REGION || 'us-central1',
    },
    messaging: {
      vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY || '',
      serverKey: process.env.FCM_SERVER_KEY,
    },
    config: {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    },
  },

  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      user: process.env.SMTP_USER || '',
      password: process.env.SMTP_PASSWORD || '',
    },
    defaults: {
      from: process.env.DEFAULT_FROM || '',
      replyTo: process.env.DEFAULT_REPLY_TO || '',
    },
  },

  providers: SHARED_PROVIDERS,

  rateLimit: {
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  },

  monitoring: {
    enableRealTime: process.env.ENABLE_REAL_MONITORING === 'true',
    enableNotifications: process.env.ENABLE_REAL_NOTIFICATIONS === 'true',
    enableEmailSending: process.env.ENABLE_REAL_EMAIL_SENDING === 'true',
  },
}; 