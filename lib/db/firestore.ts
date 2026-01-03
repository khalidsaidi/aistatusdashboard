import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { config } from '@/lib/config';
import { log } from '@/lib/utils/logger';

let app: App | undefined;
let db: Firestore | undefined;

export function getFirebaseApp(): App {
    if (!app) {
        const apps = getApps();
        if (apps.length > 0) {
            app = apps[0];
        } else {
            try {
                if (config.firebase.serviceAccountKey) {
                    const serviceAccount = JSON.parse(config.firebase.serviceAccountKey);
                    app = initializeApp({
                        credential: cert(serviceAccount),
                    });
                } else if (config.firebase.privateKey && config.firebase.clientEmail && config.firebase.projectId) {
                    app = initializeApp({
                        credential: cert({
                            projectId: config.firebase.projectId,
                            clientEmail: config.firebase.clientEmail,
                            privateKey: config.firebase.privateKey.replace(/\\n/g, '\n'),
                        }),
                    });
                } else {
                    // Fallback for Cloud Functions or default environment
                    app = initializeApp();
                }
            } catch (error) {
                log('error', 'Failed to initialize Firebase Admin', { error });
                throw error;
            }
        }
    }
    return app;
}

export function getDb(): Firestore {
    if (!db) {
        const app = getFirebaseApp();
        db = getFirestore(app);

        const projId = app.options.projectId || (app as any).options?.credential?.projectId;
        log('info', `Firestore initialized for project: ${projId}`);

        try {
            db.settings({ ignoreUndefinedProperties: true });
        } catch (e) {
            // Settings might have been already applied by another call
            log('warn', 'Firestore settings already applied');
        }
    }
    return db;
}
