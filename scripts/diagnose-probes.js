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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function classifyError(code) {
  if (!code) return 'ok';
  const lower = String(code).toLowerCase();
  if (lower === 'semantic_mismatch') return 'semantic_mismatch';
  if (lower.startsWith('http-')) {
    const status = parseInt(lower.replace('http-', ''), 10);
    if (Number.isFinite(status)) {
      if (status === 401 || status === 403) return 'auth';
      if (status === 404) return 'not_found';
      if (status === 429) return 'rate_limit';
      if (status >= 500) return 'server_error';
      return `http_${status}`;
    }
    return 'http_error';
  }
  if (lower.startsWith('probe_')) return lower;
  return 'other';
}

async function initAdmin() {
  const preferredEnv = (process.env.PROBE_DIAG_ENV || process.env.FIREBASE_ENV || 'production').toLowerCase();
  const envFiles =
    preferredEnv === 'production'
      ? ['.env.production.local', '.env.local']
      : ['.env.local', '.env.production.local'];
  loadEnvFromFiles(envFiles);

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!serviceAccountKey && (!privateKey || !clientEmail || !projectId)) {
    console.error('Firebase credentials missing in env.');
    process.exit(1);
  }

  const parseServiceAccount = (value) => {
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
  };

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
        projectId: projectId,
      });
    }
  }

  return admin.firestore();
}

async function fetchSyntheticEvents(db, minutes) {
  const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - minutes * 60 * 1000));
  try {
    const snapshot = await db
      .collection('synthetic_probes')
      .where('timestamp', '>=', cutoff)
      .limit(1000)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  } catch (error) {
    const snapshot = await db.collection('synthetic_probes').limit(500).get();
    return snapshot.docs.map((doc) => doc.data());
  }
}

async function main() {
  const args = process.argv.slice(2);
  const minutes = parseInt(readArg(args, '--minutes', '180'), 10);
  const outPath = readArg(args, '--out');
  const db = await initAdmin();
  const events = await fetchSyntheticEvents(db, Number.isFinite(minutes) ? minutes : 180);

  const providerStats = {};
  const errorCounts = {};
  let total = 0;
  let ok = 0;
  let minTimestamp = null;
  let maxTimestamp = null;

  for (const event of events) {
    total += 1;
    const providerId = event.providerId || 'unknown';
    const errorCode = event.errorCode || '';
    const category = classifyError(errorCode);
    const tsValue = event.timestamp?.toDate ? event.timestamp.toDate() : new Date(event.timestamp || 0);
    if (Number.isFinite(tsValue.getTime())) {
      if (!minTimestamp || tsValue < minTimestamp) minTimestamp = tsValue;
      if (!maxTimestamp || tsValue > maxTimestamp) maxTimestamp = tsValue;
    }

    if (!providerStats[providerId]) {
      providerStats[providerId] = {
        total: 0,
        ok: 0,
        categories: {},
        errorCodes: {},
      };
    }

    providerStats[providerId].total += 1;
    if (category === 'ok') {
      ok += 1;
      providerStats[providerId].ok += 1;
    } else {
      providerStats[providerId].categories[category] =
        (providerStats[providerId].categories[category] || 0) + 1;
      const key = String(errorCode).toLowerCase().slice(0, 80);
      providerStats[providerId].errorCodes[key] = (providerStats[providerId].errorCodes[key] || 0) + 1;
      errorCounts[category] = (errorCounts[category] || 0) + 1;
    }
  }

  const summary = {
    windowMinutes: minutes,
    totalEvents: total,
    okEvents: ok,
    errorEvents: total - ok,
    earliestTimestamp: minTimestamp ? minTimestamp.toISOString() : null,
    latestTimestamp: maxTimestamp ? maxTimestamp.toISOString() : null,
    errorCategories: errorCounts,
    providers: Object.entries(providerStats)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([providerId, stats]) => ({
        providerId,
        total: stats.total,
        ok: stats.ok,
        categories: stats.categories,
        topErrorCodes: Object.entries(stats.errorCodes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5),
      })),
  };

  if (outPath) {
    const resolved = path.resolve(process.cwd(), outPath);
    ensureDir(path.dirname(resolved));
    fs.writeFileSync(resolved, JSON.stringify(summary, null, 2));
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
