const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

function loadEnv(paths) {
  const env = {};
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    const data = fs.readFileSync(p, 'utf8');
    for (const raw of data.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const idx = line.indexOf('=');
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in env)) env[key] = val;
    }
  }
  return env;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getGuerrillaInbox() {
  const info = await fetchJson('https://api.guerrillamail.com/ajax.php?f=get_email_address');
  if (!info?.email_addr || !info?.sid_token) {
    throw new Error('Failed to create Guerrilla Mail inbox');
  }
  return { address: info.email_addr, sidToken: info.sid_token };
}

async function pollGuerrillaMessage({ sidToken, subjectToken, timeoutMs = 180000 }) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const list = await fetchJson(
      `https://api.guerrillamail.com/ajax.php?f=get_email_list&offset=0&sid_token=${sidToken}`
    );
    const messages = Array.isArray(list.list) ? list.list : [];
    const match = messages.find((msg) => typeof msg.mail_subject === 'string' && msg.mail_subject.includes(subjectToken));
    if (match?.mail_id) {
      const detail = await fetchJson(
        `https://api.guerrillamail.com/ajax.php?f=fetch_email&sid_token=${sidToken}&email_id=${match.mail_id}`
      );
      return { match, detail };
    }
    await sleep(3000);
  }
  throw new Error('Timed out waiting for Guerrilla Mail message');
}

async function main() {
  const env = loadEnv(['.env.production.local', '.env.external.smtp.local', '.env.local']);
  const smtpHost = env.SMTP_HOST;
  const smtpPort = Number.parseInt(env.SMTP_PORT || '587', 10);
  const smtpSecure = env.SMTP_SECURE === 'true';
  const smtpUser = env.SMTP_USER || '';
  const smtpPass = env.SMTP_PASSWORD || '';
  const smtpFrom = env.SMTP_FROM || '';

  if (!smtpHost || !smtpFrom) {
    throw new Error('SMTP config missing (SMTP_HOST/SMTP_FROM).');
  }

  const { address, sidToken } = await getGuerrillaInbox();
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join('.ai', 'human', runId, 'smtp');
  fs.mkdirSync(outDir, { recursive: true });

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  const subject = `AI Status Dashboard SMTP probe ${runId}`;
  const html = `<p>SMTP verification for AI Status Dashboard.</p><p>Run: ${runId}</p>`;

  await transporter.sendMail({
    from: smtpFrom,
    to: address,
    subject,
    html,
  });

  const { match, detail } = await pollGuerrillaMessage({
    sidToken,
    subjectToken: runId,
  });

  fs.writeFileSync(path.join(outDir, 'smtp-guerrillamail.json'), JSON.stringify({ match, detail }, null, 2));

  const fromHeader = detail?.mail_from || match?.mail_from || '';
  const fromAddress = String(fromHeader).match(/<([^>]+)>/)?.[1] || fromHeader;
  const fromMatches = typeof fromAddress === 'string' && smtpFrom.includes(fromAddress);

  const summary = {
    runId,
    inbox: address,
    receivedAt: match?.mail_date || null,
    subject: match?.mail_subject || subject,
    from: fromHeader || null,
    smtpFrom,
    fromHeaderMatches: fromMatches,
    provider: 'guerrillamail',
  };
  fs.writeFileSync(path.join(outDir, 'smtp-live-check.json'), JSON.stringify(summary, null, 2));

  console.log(`SMTP live check (guerrillamail) received. From header matches: ${fromMatches}`);
  console.log(`Artifacts: ${outDir}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
