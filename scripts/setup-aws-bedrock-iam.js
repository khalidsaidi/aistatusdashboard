const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENV_PATH = path.resolve(__dirname, '..', '.env.production.local');
const USER_NAME = 'aistatusdashboard-bedrock-probe';
const POLICY_NAME = 'aistatusdashboard-bedrock-probe';
const DEFAULT_REGION = 'us-east-1';

function readEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  return lines.reduce((acc, line) => {
    if (!line || line.trim().startsWith('#')) return acc;
    const idx = line.indexOf('=');
    if (idx === -1) return acc;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
    acc[key] = value;
    return acc;
  }, {});
}

function writeEnv(update) {
  const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/) : [];
  const map = existing.reduce((acc, line) => {
    if (!line || line.trim().startsWith('#')) return acc;
    const idx = line.indexOf('=');
    if (idx === -1) return acc;
    acc[line.slice(0, idx).trim()] = line;
    return acc;
  }, {});

  Object.entries(update).forEach(([key, value]) => {
    map[key] = `${key}=${value}`;
  });

  const preserved = existing.filter((line) => {
    if (!line || line.trim().startsWith('#')) return true;
    const idx = line.indexOf('=');
    if (idx === -1) return true;
    return !Object.prototype.hasOwnProperty.call(update, line.slice(0, idx).trim());
  });

  const merged = [...preserved, ...Object.values(map)];
  fs.writeFileSync(ENV_PATH, merged.join('\n'));
}

function execJson(cmd) {
  return JSON.parse(execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString());
}

function ensureUser() {
  try {
    execSync(`aws iam get-user --user-name ${USER_NAME}`, { stdio: 'ignore' });
  } catch {
    execSync(`aws iam create-user --user-name ${USER_NAME}`, { stdio: 'ignore' });
  }
}

function ensurePolicy() {
  const policyDoc = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
          'bedrock:ListFoundationModels',
        ],
        Resource: '*',
      },
    ],
  };
  execSync(
    `aws iam put-user-policy --user-name ${USER_NAME} --policy-name ${POLICY_NAME} --policy-document '${JSON.stringify(
      policyDoc
    )}'`,
    { stdio: 'ignore' }
  );
}

function ensureAccessKey(env) {
  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    return { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY };
  }

  const existing = execJson(`aws iam list-access-keys --user-name ${USER_NAME}`);
  const activeKeys = (existing.AccessKeyMetadata || []).filter((key) => key.Status === 'Active');
  if (activeKeys.length >= 2) {
    throw new Error(`User ${USER_NAME} already has two active access keys.`);
  }

  const created = execJson(`aws iam create-access-key --user-name ${USER_NAME}`);
  return {
    accessKeyId: created.AccessKey.AccessKeyId,
    secretAccessKey: created.AccessKey.SecretAccessKey,
  };
}

function main() {
  const env = readEnv();
  ensureUser();
  ensurePolicy();
  const creds = ensureAccessKey(env);

  writeEnv({
    AWS_ACCESS_KEY_ID: creds.accessKeyId,
    AWS_SECRET_ACCESS_KEY: creds.secretAccessKey,
    AWS_BEDROCK_REGION: env.AWS_BEDROCK_REGION || DEFAULT_REGION,
    AWS_REGION: env.AWS_REGION || env.AWS_BEDROCK_REGION || DEFAULT_REGION,
  });

  const report = {
    user: USER_NAME,
    region: env.AWS_BEDROCK_REGION || DEFAULT_REGION,
    updatedEnv: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_BEDROCK_REGION', 'AWS_REGION'],
  };
  fs.writeFileSync(
    path.resolve(__dirname, '..', '.ai', 'creds', 'aws-bedrock-iam.json'),
    JSON.stringify(report, null, 2)
  );
}

main();
