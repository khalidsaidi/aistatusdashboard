#!/usr/bin/env node

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!filePath) return;
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key === 'FIREBASE_SERVICE_ACCOUNT_KEY') {
      process.env[key] = value;
    } else {
      process.env[key] = value.replace(/\\n/g, '\n');
    }
  });
}

function readArgValue(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const confirm = args.includes('--confirm') || args.includes('--yes');
  const envFile = readArgValue(args, '--env') || process.env.ENV_FILE || path.resolve(process.cwd(), '.env.production.local');

  if (apply && !confirm) {
    console.error('Refusing to delete without --confirm (dry-run by default).');
    process.exit(1);
  }

  loadEnvFile(envFile);

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  let serviceAccount = null;
  if (serviceAccountKey) {
    try {
      serviceAccount = JSON.parse(serviceAccountKey);
      if (serviceAccount?.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
    } catch {
      serviceAccount = null;
    }
  }

  if (!serviceAccount && (!privateKey || !clientEmail || !projectId)) {
    console.error('Firebase credentials missing in env. Provide FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL + FIREBASE_PROJECT_ID.');
    process.exit(1);
  }

  if (!admin.apps.length) {
    if (serviceAccount) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } else {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        projectId,
      });
    }
  }

  const db = admin.firestore();
  const snapshot = await db
    .collection('incidents')
    .where('providerId', '==', 'google-ai')
    .where('sourceId', '==', 'gcp-health')
    .get();

  const candidates = [];
  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const id = String(data.id || doc.id || '');
    const title = String(data.title || '');
    if (id.startsWith('gcp-health-test') || title.toLowerCase().includes('test') || title.toLowerCase().includes('synthetic')) {
      candidates.push({ docId: doc.id, id, title });
    }
  });

  console.log(`GCP health incidents scanned: ${snapshot.size}`);
  console.log(`Matched test incidents: ${candidates.length}`);
  if (candidates.length === 0) {
    console.log('No test incidents to clean.');
    return;
  }

  candidates.slice(0, 10).forEach((item) => {
    console.log(`- ${item.docId} | ${item.title || item.id}`);
  });

  if (!apply) {
    console.log('Dry run complete. Re-run with --apply --confirm to delete.');
    return;
  }

  const batch = db.batch();
  candidates.forEach((item) => {
    batch.delete(db.collection('incidents').doc(item.docId));
  });
  await batch.commit();

  console.log(`Deleted ${candidates.length} test incidents.`);
}

main().catch((err) => {
  console.error(`Cleanup failed: ${err.message}`);
  process.exit(1);
});
