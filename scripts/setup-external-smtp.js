const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const SES_REGION = process.env.SES_REGION || 'us-east-1';
const MAILTM_API = process.env.MAILTM_API_URL || 'https://api.mail.tm';
const OUTPUT_ENV = process.env.EXTERNAL_SMTP_ENV || '.env.external.smtp.local';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function runAws(cmd) {
  return execSync(`aws ${cmd} --region ${SES_REGION} --output json`, { encoding: 'utf8' });
}

function readAwsCredentials() {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN || null,
      source: 'env',
    };
  }
  const credPath =
    process.env.AWS_SHARED_CREDENTIALS_FILE ||
    path.join(os.homedir(), '.aws', 'credentials');
  if (!fs.existsSync(credPath)) {
    throw new Error('AWS credentials file not found');
  }
  const profile = process.env.AWS_PROFILE || 'default';
  const content = fs.readFileSync(credPath, 'utf8');
  let current = null;
  const data = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const section = line.match(/^\[(.+)]$/);
    if (section) {
      current = section[1].trim();
      data[current] = data[current] || {};
      continue;
    }
    const idx = line.indexOf('=');
    if (idx === -1 || !current) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    data[current][key] = value;
  }
  const creds = data[profile];
  if (!creds || !creds.aws_access_key_id || !creds.aws_secret_access_key) {
    throw new Error(`AWS credentials missing for profile "${profile}"`);
  }
  return {
    accessKeyId: creds.aws_access_key_id,
    secretAccessKey: creds.aws_secret_access_key,
    sessionToken: creds.aws_session_token || null,
    source: `profile:${profile}`,
  };
}

function hmac(key, msg) {
  return crypto.createHmac('sha256', key).update(msg, 'utf8').digest();
}

function deriveSesSmtpPassword(secretAccessKey, region) {
  const date = '11111111';
  const service = 'ses';
  const terminal = 'aws4_request';
  const message = 'SendRawEmail';
  const kDate = hmac(`AWS4${secretAccessKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, terminal);
  const signature = hmac(kSigning, message);
  const smtpPassword = Buffer.concat([Buffer.from([0x04]), signature]).toString('base64');
  return smtpPassword;
}

async function mailTmRequest(pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${MAILTM_API}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

async function createMailTmAccount() {
  if (process.env.MAILTM_ADDRESS && process.env.MAILTM_PASSWORD) {
    const address = process.env.MAILTM_ADDRESS;
    const password = process.env.MAILTM_PASSWORD;
    const tokenRes = await mailTmRequest('/token', {
      method: 'POST',
      body: { address, password },
    });
    if (!tokenRes.ok) throw new Error('Failed to obtain mail.tm token for existing account');
    const tokenJson = await tokenRes.json();
    return { address, password, token: tokenJson.token, id: tokenJson.id || null };
  }

  const domainsRes = await mailTmRequest('/domains');
  if (!domainsRes.ok) throw new Error('Failed to fetch mail.tm domains');
  const domainsJson = await domainsRes.json();
  const domain = domainsJson?.['hydra:member']?.[0]?.domain;
  if (!domain) throw new Error('mail.tm domain not found');

  let account = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const address = `human-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${domain}`;
    const password = `Test-${crypto.randomBytes(6).toString('hex')}!`;
    const createRes = await mailTmRequest('/accounts', {
      method: 'POST',
      body: { address, password },
    });
    if (!createRes.ok) {
      continue;
    }
    const createJson = await createRes.json();
    account = { address, password, id: createJson.id };
    break;
  }
  if (!account) throw new Error('Unable to create mail.tm account');

  const tokenRes = await mailTmRequest('/token', {
    method: 'POST',
    body: { address: account.address, password: account.password },
  });
  if (!tokenRes.ok) throw new Error('Failed to obtain mail.tm token');
  const tokenJson = await tokenRes.json();
  return {
    ...account,
    token: tokenJson.token,
  };
}

async function waitForSesVerificationLink(token, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const listRes = await mailTmRequest('/messages?page=1', { token });
    if (listRes.ok) {
      const listJson = await listRes.json();
      const messages = Array.isArray(listJson['hydra:member']) ? listJson['hydra:member'] : [];
      for (const msg of messages) {
        if (!msg || !msg.id) continue;
        const detailRes = await mailTmRequest(`/messages/${msg.id}`, { token });
        if (!detailRes.ok) continue;
        const detail = await detailRes.json();
        const html = Array.isArray(detail.html) ? detail.html.join('\n') : detail.html || '';
        const text = typeof detail.text === 'string' ? detail.text : '';
        const content = (html || text || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        const match = content.match(/https?:\/\/[^\s"'<>]*amazonaws\.com[^\s"'<>]*/i);
        if (match) return match[0];
      }
    }
    await sleep(2000);
  }
  throw new Error('SES verification email not received in time');
}

async function waitForSesIdentityVerified(email, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const raw = runAws(`sesv2 get-email-identity --email-identity ${email}`);
      const data = JSON.parse(raw);
      if (data?.VerifiedForSendingStatus === true) return true;
    } catch {
      // ignore and retry
    }
    await sleep(2000);
  }
  throw new Error('SES identity did not verify in time');
}

async function main() {
  log('🔧 Creating mail.tm inbox...');
  const mailtm = await createMailTmAccount();
  log(`✅ mail.tm address created: ${mailtm.address}`);

  const earlyEnv = [
    `MAILTM_API_URL=${MAILTM_API}`,
    `MAILTM_ADDRESS=${mailtm.address}`,
    `MAILTM_PASSWORD=${mailtm.password}`,
    `MAILTM_TOKEN=${mailtm.token}`,
  ];
  fs.writeFileSync(OUTPUT_ENV, earlyEnv.join('\n'));
  log(`📝 Saved mail.tm credentials to ${OUTPUT_ENV}`);

  log('📨 Requesting SES email identity verification...');
  try {
    runAws(`sesv2 create-email-identity --email-identity ${mailtm.address}`);
  } catch (err) {
    // ignore if identity already exists
  }

  log('📥 Waiting for SES verification email...');
  const verifyLink = await waitForSesVerificationLink(mailtm.token, 180_000);
  log('🔗 Verification link received; confirming...');
  await fetch(verifyLink);
  await waitForSesIdentityVerified(mailtm.address, 90_000);
  log('✅ SES identity verified.');

  const awsCreds = readAwsCredentials();
  const smtpPassword = deriveSesSmtpPassword(awsCreds.secretAccessKey, SES_REGION);

  const envLines = [
    `# External SMTP (SES) + mail.tm inbox`,
    `SES_REGION=${SES_REGION}`,
    `SMTP_HOST=email-smtp.${SES_REGION}.amazonaws.com`,
    `SMTP_PORT=587`,
    `SMTP_SECURE=false`,
    `SMTP_USER=${awsCreds.accessKeyId}`,
    `SMTP_PASSWORD=${smtpPassword}`,
    `SMTP_FROM=${mailtm.address}`,
    `MAILTM_API_URL=${MAILTM_API}`,
    `MAILTM_ADDRESS=${mailtm.address}`,
    `MAILTM_PASSWORD=${mailtm.password}`,
    `MAILTM_TOKEN=${mailtm.token}`,
  ];
  fs.writeFileSync(OUTPUT_ENV, envLines.join('\n'));

  log(`✅ Wrote ${OUTPUT_ENV} (secrets stored locally).`);
  log('Next: run the launch-blocker suite with:');
  log(`  set -a; source ${OUTPUT_ENV}; set +a; TEST_WEBHOOK_URL=https://ptsv3.com/t/e4bdd571-1b4e-4054-8b16-0eed8e82a840/post HUMAN_VERIFY_BROWSERS=chromium HUMAN_VERIFY_VARIANTS=desktop node scripts/launch-blockers-verify.js`);
}

main().catch((err) => {
  console.error(`❌ Setup failed: ${err.message}`);
  process.exit(1);
});
