const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENV_PATH = path.resolve(__dirname, '..', '.env.production.local');
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'ai-status-dashboard';
const SECRET_NAME = 'FIREBASE_SERVICE_ACCOUNT_KEY';

function parseEnv(contents) {
  const result = {};
  contents.split(/\r?\n/).forEach((line) => {
    if (!line || line.trim().startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  });
  return result;
}

function formatEnvValue(value) {
  if (value.includes(' ') || value.includes('"')) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

function writeEnv(env, originalContents, rawKeys = new Set()) {
  const lines = originalContents.split(/\r?\n/);
  const updated = [];
  const seen = new Set();

  for (const line of lines) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) {
      updated.push(line);
      continue;
    }
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    if (Object.prototype.hasOwnProperty.call(env, key)) {
      if (rawKeys.has(key)) {
        updated.push(`${key}='${env[key]}'`);
      } else {
        updated.push(`${key}=${formatEnvValue(env[key])}`);
      }
      seen.add(key);
    } else {
      updated.push(line);
    }
  }

  Object.keys(env).forEach((key) => {
    if (!seen.has(key)) {
      if (rawKeys.has(key)) {
        updated.push(`${key}='${env[key]}'`);
      } else {
        updated.push(`${key}=${formatEnvValue(env[key])}`);
      }
    }
  });

  fs.writeFileSync(ENV_PATH, `${updated.join('\n')}\n`);
}

function main() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`Missing ${ENV_PATH}`);
  }

  const originalContents = fs.readFileSync(ENV_PATH, 'utf8');
  const env = parseEnv(originalContents);

  const rawSecret = execSync(
    `gcloud secrets versions access latest --secret ${SECRET_NAME} --project ${PROJECT_ID}`,
    { encoding: 'utf8' }
  );
  const parsed = JSON.parse(rawSecret);
  env[SECRET_NAME] = JSON.stringify(parsed);
  writeEnv(env, originalContents, new Set([SECRET_NAME]));
}

main();
