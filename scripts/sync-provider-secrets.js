const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENV_PATH = path.resolve(__dirname, '..', '.env.production.local');
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'ai-status-dashboard';
const SECRET_KEYS = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'COHERE_API_KEY',
  'GROQ_API_KEY',
  'MISTRAL_API_KEY',
  'DEEPSEEK_API_KEY',
  'XAI_API_KEY',
  'AZURE_OPENAI_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'TELEMETRY_PUBLIC_KEY',
];

const KEY_PATTERNS = {
  OPENAI_API_KEY: /^sk-/,
  ANTHROPIC_API_KEY: /^sk-ant-/i,
  GROQ_API_KEY: /^gsk_/i,
};

function isValidSecretValue(key, value) {
  if (!value) return false;
  if (/\s/.test(value)) return false;
  if (/[^\x20-\x7E]/.test(value)) return false;
  const pattern = KEY_PATTERNS[key];
  if (pattern && !pattern.test(value)) return false;
  return true;
}

function parseEnv(contents) {
  const result = {};
  contents.split(/\r?\n/).forEach((line) => {
    if (!line || line.trim().startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
    result[key] = value;
  });
  return result;
}

function ensureSecret(name) {
  try {
    execSync(`gcloud secrets describe ${name} --project ${PROJECT_ID}`, { stdio: 'ignore' });
  } catch {
    execSync(`gcloud secrets create ${name} --replication-policy=automatic --project ${PROJECT_ID}`, {
      stdio: 'ignore',
    });
  }
}

function addSecretVersion(name, value) {
  execSync(`gcloud secrets versions add ${name} --project ${PROJECT_ID} --data-file=-`, {
    input: value,
    stdio: ['pipe', 'ignore', 'ignore'],
  });
}

function main() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error(`Missing ${ENV_PATH}`);
  }
  const env = parseEnv(fs.readFileSync(ENV_PATH, 'utf8'));
  const missing = [];
  const invalid = [];
  const updated = [];

  SECRET_KEYS.forEach((key) => {
    const value = env[key];
    if (!value) {
      missing.push(key);
      return;
    }
    if (!isValidSecretValue(key, value)) {
      invalid.push(key);
      return;
    }
    ensureSecret(key);
    addSecretVersion(key, value);
    updated.push(key);
  });

  const report = { updated, missing, invalid };
  fs.writeFileSync(
    path.resolve(__dirname, '..', '.ai', 'creds', 'secret-sync.json'),
    JSON.stringify(report, null, 2)
  );
}

main();
