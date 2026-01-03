export const config = {
    firebase: {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
        serviceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
    },
    monitoring: {
        defaultTimeout: 10000,
        defaultRetries: 2,
        cacheTTL: 60 * 1000, // 60 seconds
    },
    rateLimit: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100,
    },
    email: {
        enabled: (process.env.APP_ENABLE_EMAIL ?? process.env.APP_ENABLE_REAL_MONITORING) === 'true',
        from: process.env.SMTP_FROM || 'AI Status Dashboard <hello@aistatusdashboard.com>',
        smtp: {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            user: process.env.SMTP_USER,
            password: process.env.SMTP_PASSWORD
        }
    }
};
