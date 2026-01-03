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
    if (process.env[key] === undefined) {
      process.env[key] = value.replace(/\\n/g, '\n');
    }
  });
}

function readArgValue(args, name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1] || null;
}

function readArgValues(args, name) {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name && args[i + 1]) values.push(args[i + 1]);
  }
  return values;
}

function parseIsoDate(input) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.toLowerCase();
}

function getCreatedAtIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const confirm = args.includes('--confirm') || args.includes('--yes');
  const envFile = readArgValue(args, '--env') || process.env.ENV_FILE || path.resolve(process.cwd(), '.env.local');
  const limitArg = readArgValue(args, '--limit');
  const limit = limitArg ? Math.max(parseInt(limitArg, 10) || 0, 0) : 0;
  const beforeArg = readArgValue(args, '--before');
  const beforeDate = parseIsoDate(beforeArg);

  if (apply && !confirm) {
    console.error('Refusing to delete without --confirm (dry-run by default).');
    process.exit(1);
  }

  loadEnvFile(envFile);

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!serviceAccountKey && (!privateKey || !clientEmail || !projectId)) {
    console.error('Firebase credentials missing in env. Provide FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PRIVATE_KEY + FIREBASE_CLIENT_EMAIL + FIREBASE_PROJECT_ID.');
    process.exit(1);
  }

  if (!admin.apps.length) {
    if (serviceAccountKey) {
      const serviceAccount = JSON.parse(serviceAccountKey);
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

  const extraPatterns = readArgValues(args, '--pattern').map((p) => p.toLowerCase());
  const basePatterns = [
    'human verify comment',
    'human tester',
    'system tester',
    'human-mimic',
    'ui looks responsive',
  ];
  const patterns = [...new Set([...basePatterns, ...extraPatterns])].map((value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));

  const db = admin.firestore();
  const snapshot = await db.collection('comments').where('approved', '==', false).get();
  const candidates = [];

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const author = normalizeText(data.author);
    const content = normalizeText(data.content);
    const createdAtIso = getCreatedAtIso(data.createdAt);

    if (beforeDate && createdAtIso) {
      if (new Date(createdAtIso) >= beforeDate) return;
    }

    const matches = patterns.filter((re) => re.test(author) || re.test(content));
    if (matches.length === 0) return;

    candidates.push({
      id: doc.id,
      author: data.author || null,
      createdAt: createdAtIso,
      content: data.content || '',
      matchCount: matches.length,
    });
  });

  const limited = limit > 0 ? candidates.slice(0, limit) : candidates;

  console.log(`Pending comments scanned: ${snapshot.size}`);
  console.log(`Matched test comments: ${candidates.length}${limit > 0 ? ` (limited to ${limited.length})` : ''}`);
  if (beforeDate) console.log(`Before cutoff: ${beforeDate.toISOString()}`);

  if (limited.length === 0) {
    console.log('No pending test comments to clean.');
    return;
  }

  limited.slice(0, 10).forEach((item) => {
    const preview = item.content.length > 120 ? `${item.content.slice(0, 117)}...` : item.content;
    console.log(`- ${item.id} | ${item.author || 'unknown'} | ${item.createdAt || 'unknown'} | ${preview}`);
  });

  if (!apply) {
    console.log('Dry run complete. Re-run with --apply --confirm to delete.');
    return;
  }

  const batchLimit = 400;
  let batch = db.batch();
  let batchCount = 0;
  let deleted = 0;

  for (const item of limited) {
    const ref = db.collection('comments').doc(item.id);
    batch.delete(ref);
    batchCount += 1;
    deleted += 1;
    if (batchCount >= batchLimit) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`Deleted ${deleted} pending test comments.`);
}

main().catch((err) => {
  console.error(`Cleanup failed: ${err.message}`);
  process.exit(1);
});
