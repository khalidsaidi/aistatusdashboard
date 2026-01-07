#!/usr/bin/env node

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

    lines.forEach((rawLine) => {
      let line = rawLine.trim();
      if (!line || line.startsWith('#')) return;

      const firstEq = line.indexOf('=');
      if (firstEq === -1) return;

      const key = line.substring(0, firstEq).trim();
      let value = line.substring(firstEq + 1).trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }

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

function readArg(args, name, fallback = null) {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  return args[idx + 1] || fallback;
}

function parseServiceAccount(value) {
  let candidate = value;
  for (let i = 0; i < 6; i += 1) {
    const trimmed = candidate.replace(/^[\"']+|[\"']+$/g, '');
    const unescaped = trimmed
      .replace(/\\\\\"/g, '"')
      .replace(/\\\"/g, '"')
      .replace(/\\\\\\\\/g, '\\');
    const start = unescaped.indexOf('{');
    const end = unescaped.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const parsed = JSON.parse(unescaped.slice(start, end + 1));
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {}
    }
    candidate = unescaped;
  }
  return null;
}

async function initAdmin() {
  loadEnvFromFiles(['.env.production.local', '.env.local']);

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!serviceAccountKey && (!privateKey || !clientEmail || !projectId)) {
    throw new Error('Firebase credentials missing in env.');
  }

  if (!admin.apps.length) {
    if (serviceAccountKey) {
      const serviceAccount = parseServiceAccount(serviceAccountKey);
      if (!serviceAccount) {
        throw new Error('Unable to parse FIREBASE_SERVICE_ACCOUNT_KEY.');
      }
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
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

  return admin.firestore();
}

function parseMinutes(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function main() {
  const args = process.argv.slice(2);
  const providerId = readArg(args, '--provider');
  const errorCode = readArg(args, '--error-code');
  const minutes = parseMinutes(readArg(args, '--minutes'), 60);
  const limit = parseMinutes(readArg(args, '--limit'), 200);
  const requireHttp5xx = args.includes('--http5xx');
  const apply = args.includes('--apply');
  const confirm = args.includes('--confirm');

  if (!providerId) {
    throw new Error('Missing --provider <id>');
  }

  const db = await initAdmin();
  const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - minutes * 60 * 1000));
  const snapshot = await db
    .collection('synthetic_probes')
    .where('providerId', '==', providerId)
    .where('timestamp', '>=', cutoff)
    .orderBy('timestamp', 'asc')
    .limit(limit)
    .get();

  const matches = [];
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (errorCode && data.errorCode !== errorCode) return;
    if (requireHttp5xx && !(data.http5xxRate && data.http5xxRate > 0)) return;
    matches.push({ id: doc.id, data });
  });

  const outputDir = path.resolve('.ai', 'probe-diagnostics', 'cleanup');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, `cleanup-${providerId}-${Date.now()}.json`),
    JSON.stringify(
      {
        providerId,
        minutes,
        limit,
        errorCode: errorCode || null,
        requireHttp5xx,
        matches: matches.map((match) => ({
          id: match.id,
          errorCode: match.data.errorCode || null,
          http5xxRate: match.data.http5xxRate || null,
          timestamp: match.data.timestamp?.toDate?.()?.toISOString() || null,
        })),
      },
      null,
      2
    )
  );

  if (!apply || !confirm) {
    console.log(`Dry-run: ${matches.length} matches. Re-run with --apply --confirm to delete.`);
    return;
  }

  const batch = db.batch();
  matches.forEach((match) => {
    batch.delete(db.collection('synthetic_probes').doc(match.id));
  });
  await batch.commit();
  console.log(`Deleted ${matches.length} synthetic probe events for ${providerId}.`);
}

main().catch((error) => {
  console.error(`Cleanup failed: ${error.message}`);
  process.exit(1);
});
