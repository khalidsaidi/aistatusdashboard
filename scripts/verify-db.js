const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function loadEnvFromFiles(files) {
    files.forEach((file) => {
        if (!file) return;
        const envPath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(envPath)) return;

        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split(/\r?\n/);

        lines.forEach(rawLine => {
            let line = rawLine.trim();
            if (!line || line.startsWith('#')) return;

            const firstEq = line.indexOf('=');
            if (firstEq === -1) return;

            const key = line.substring(0, firstEq).trim();
            let value = line.substring(firstEq + 1).trim();

            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }

            // Only fill missing env vars; never override existing process.env values.
            if (process.env[key] === undefined) {
                if (key === 'FIREBASE_SERVICE_ACCOUNT_KEY') {
                    process.env[key] = value;
                } else {
                    process.env[key] = value.replace(/\\n/g, '\n');
                }
            }
        });
    });
}

loadEnvFromFiles(['.env.production.local', '.env.local']);

// Load env for Firebase
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!serviceAccountKey && (!privateKey || !clientEmail || !projectId)) {
    console.error('Firebase credentials missing in env:', {
        hasServiceAccountKey: !!serviceAccountKey,
        hasPrivateKey: !!privateKey,
        hasClientEmail: !!clientEmail,
        projectId: projectId
    });
    process.exit(1);
}
// Diagnostic logs moved to stderr to keep stdout clean for the test runner
console.error(`Using Project ID: ${projectId}`);

try {
    if (serviceAccountKey) {
        const serviceAccount = JSON.parse(serviceAccountKey);
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
    } else {
        if (!admin.apps.length) {
            console.error(`Initializing Admin SDK for Project: ${projectId}`);
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey: privateKey.replace(/\\n/g, '\n')
                }),
                projectId: projectId
            });
        }
    }
} catch (e) {
    console.error(`INIT_ERROR: ${e.message}`);
    process.exit(1);
}

console.error(`DB_VERIFY_START: Project=${projectId}`);
const db = admin.firestore();

async function verifySubscription(email) {
    const doc = await db.collection('emailSubscriptions').doc(email).get();

    if (!doc.exists) {
        console.error(`SUBSCRIPTION_NOT_FOUND: ${email}`);
        console.log('NOT_FOUND');
    } else {
        console.log('FOUND');
    }
}

async function getSubscriptionToken(email) {
    const doc = await db.collection('emailSubscriptions').doc(email).get();

    if (!doc.exists) {
        console.log('NOT_FOUND');
        return;
    }

    const data = doc.data() || {};
    const token = data.confirmationToken;

    if (typeof token === 'string' && token.length > 0) {
        console.log(token);
    } else {
        console.log('NO_TOKEN');
    }
}

async function verifyWebhook(url) {
    const snapshot = await db.collection('webhooks')
        .where('url', '==', url)
        .get();

    if (snapshot.empty) {
        console.log('NOT_FOUND');
    } else {
        console.log('FOUND');
    }
}

async function verifyComment(needle) {
    const snapshot = await db.collection('comments').get();
    const found = snapshot.docs.find(doc => doc.data().content.includes(needle));

    if (!found) {
        console.log('NOT_FOUND');
    } else {
        console.log('FOUND');
    }
}

async function injectStatus(providerId, status) {
    await db.collection('status_history').add({
        id: providerId,
        name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
        status: status,
        responseTime: 500,
        lastChecked: new Date().toISOString(),
        checkedAt: admin.firestore.Timestamp.now(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        statusPageUrl: `https://status.${providerId}.com`
    });
    console.log('INJECTED');
}

async function seedAnalytics(providerId, count) {
    const batch = db.batch();
    for (let i = 0; i < count; i++) {
        const ref = db.collection('analytics_events').doc();
        batch.set(ref, {
            type: 'interaction',
            providerId,
            timestamp: new Date().toISOString(),
            metadata: { test: true }
        });
    }
    await batch.commit();
    console.log('SEEDED');
}

async function checkQueue(email) {
    let query = db.collection('emailQueue');
    if (email) {
        query = query.where('to', '==', email);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
        console.log('EMPTY');
    } else {
        console.log(`FOUND_${snapshot.size}`);
    }
}

async function clearCollection(name) {
    const snapshot = await db.collection(name).get();
    const docs = snapshot.docs;
    const BATCH_LIMIT = 500;

    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
        const batch = db.batch();
        docs.slice(i, i + BATCH_LIMIT).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    console.log('CLEARED');
}

const [, , command, arg1, arg2] = process.argv;

(async () => {
    switch (command) {
        case 'subscription': await verifySubscription(arg1); break;
        case 'subscription-token': await getSubscriptionToken(arg1); break;
        case 'webhook': await verifyWebhook(arg1); break;
        case 'comment': await verifyComment(arg1); break;
        case 'inject': await injectStatus(arg1, arg2); break;
        case 'analytics-seed': await seedAnalytics(arg1, parseInt(arg2)); break;
        case 'queue-check': await checkQueue(arg1); break;
        case 'clear': await clearCollection(arg1); break;
        case 'webhook-register':
            await db.collection('webhooks').add({
                url: arg1,
                active: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log('REGISTERED');
            break;
        default: console.error('UNKNOWN_COMMAND'); process.exit(1);
    }
    process.exit(0);
})();
