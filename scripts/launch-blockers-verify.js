const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

function getRunId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function isLoopbackHost(host = '') {
  const h = host.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1';
}

function getFreePort(host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, host, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : null;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHttpOk(url, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) return;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function killProcess(child, name) {
  if (!child || child.killed) return;
  try {
    child.kill('SIGTERM');
  } catch {
    // ignore
  }
  const timeout = setTimeout(() => {
    try {
      child.kill('SIGKILL');
    } catch {
      // ignore
    }
  }, 5000);
  child.on('exit', () => clearTimeout(timeout));
  if (name) console.log(`🛑 Stopping ${name} (pid=${child.pid})`);
}

async function main() {
  const runId = getRunId();
  const humanDir = path.join(process.cwd(), '.ai', 'human', runId);
  const smtpDir = path.join(humanDir, 'smtp');
  const webhookDir = path.join(humanDir, 'webhooks');

  fs.mkdirSync(smtpDir, { recursive: true });
  fs.mkdirSync(webhookDir, { recursive: true });

  const appPort = await getFreePort();
  const smtpPort = await getFreePort();
  const webhookPort = await getFreePort();
  const externalSmtpHost = process.env.SMTP_HOST && !isLoopbackHost(process.env.SMTP_HOST);

  const baseUrl = `http://localhost:${appPort}`;
  const debugSecret = `debug-${Math.random().toString(36).slice(2)}-${Date.now()}`;

  console.log(`🧪 Launch-blockers verification run: ${runId}`);
  console.log(`🌐 App: ${baseUrl}`);
  if (externalSmtpHost) {
    console.log(`📮 SMTP: external (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 'unknown'})`);
  } else {
    console.log(`📮 SMTP sink: 127.0.0.1:${smtpPort}`);
  }
  console.log(`📡 Webhook receiver: 127.0.0.1:${webhookPort}`);

  let smtpProc = null;
  let webhookProc = null;
  let appProc = null;

  const cleanup = () => {
    killProcess(appProc, 'Next dev server');
    killProcess(webhookProc, 'webhook receiver');
    killProcess(smtpProc, 'SMTP sink');
  };
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });
  process.on('exit', cleanup);

  if (!externalSmtpHost) {
    smtpProc = spawn('node', ['scripts/smtp-sink.js'], {
      env: {
        ...process.env,
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: String(smtpPort),
        SMTP_SINK_DIR: smtpDir,
      },
      stdio: 'inherit',
    });
  }

  webhookProc = spawn('node', ['scripts/webhook-receiver.js'], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(webhookPort),
      WEBHOOK_SINK_DIR: webhookDir,
    },
    stdio: 'inherit',
  });

  const appEnv = {
    ...process.env,
    PORT: String(appPort),
    NEXT_PUBLIC_SITE_URL: baseUrl,
    NEXT_PUBLIC_ENABLE_SW_ON_LOCALHOST: 'true',
    APP_ENABLE_EMAIL: 'true',
    ALLOW_LOCAL_WEBHOOKS: 'true',
    APP_ENABLE_DEBUG_ENDPOINTS: 'true',
    APP_DEBUG_SECRET: debugSecret,
  };

  if (externalSmtpHost) {
    appEnv.SMTP_HOST = process.env.SMTP_HOST;
    appEnv.SMTP_PORT = process.env.SMTP_PORT || '587';
    appEnv.SMTP_SECURE = process.env.SMTP_SECURE || 'true';
    if (process.env.SMTP_USER) appEnv.SMTP_USER = process.env.SMTP_USER;
    if (process.env.SMTP_PASSWORD) appEnv.SMTP_PASSWORD = process.env.SMTP_PASSWORD;
    if (process.env.SMTP_FROM) appEnv.SMTP_FROM = process.env.SMTP_FROM;
  } else {
    appEnv.SMTP_HOST = '127.0.0.1';
    appEnv.SMTP_PORT = String(smtpPort);
    appEnv.SMTP_SECURE = 'false';
    appEnv.SMTP_USER = 'test';
    appEnv.SMTP_PASSWORD = 'test';
    appEnv.SMTP_FROM = 'AI Status Dashboard <no-reply@localhost>';
  }

  appProc = spawn('node', ['scripts/start-dev.js'], { env: appEnv, stdio: 'inherit' });

  await waitForHttpOk(`${baseUrl}/api/health`);

  const human = spawn('node', ['scripts/human-verify.js'], {
    env: {
      ...process.env,
      HUMAN_VERIFY_RUN_ID: runId,
      TEST_FRONTEND_URL: baseUrl,
      HUMAN_VERIFY_LAUNCH_BLOCKERS: 'true',
      HUMAN_VERIFY_EXTENDED: 'true',
      HUMAN_VERIFY_BROWSERS: process.env.HUMAN_VERIFY_BROWSERS || 'chromium,firefox,webkit',
      NEXT_PUBLIC_ENABLE_SW_ON_LOCALHOST: 'true',
      SMTP_SINK_DIR: smtpDir,
      WEBHOOK_SINK_DIR: webhookDir,
      TEST_WEBHOOK_URL: process.env.TEST_WEBHOOK_URL || `http://127.0.0.1:${webhookPort}/webhook`,
      APP_DEBUG_SECRET: debugSecret,
    },
    stdio: 'inherit',
  });

  const exitCode = await new Promise((resolve) => human.on('close', resolve));
  if (exitCode !== 0) {
    throw new Error(`Human verify failed with exit code ${exitCode}`);
  }

  const summaryPath = path.join(humanDir, 'LAUNCH_BLOCKERS_SUMMARY.md');
  const summary = [
    `# Launch Blockers Verification`,
    ``,
    `Run ID: \`${runId}\``,
    ``,
    `- App: \`${baseUrl}\``,
    externalSmtpHost
      ? `- SMTP: external (\`${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 'unknown'}\`) (artifacts: \`${smtpDir}\`)`
      : `- SMTP sink: \`127.0.0.1:${smtpPort}\` (artifacts: \`${smtpDir}\`)`,
    `- Webhook receiver: \`127.0.0.1:${webhookPort}\` (artifacts: \`${webhookDir}\`)`,
    process.env.TEST_WEBHOOK_URL ? `- Webhook target: \`${process.env.TEST_WEBHOOK_URL}\`` : null,
    ``,
    `Evidence: see \`.ai/human/${runId}/\` screenshots + JSON artifacts.`,
    ``,
  ]
    .filter(Boolean)
    .join('\n');
  fs.writeFileSync(summaryPath, summary);

  console.log(`✅ Launch-blockers verification complete: ${summaryPath}`);
  cleanup();
  process.exit(0);
}

main().catch((err) => {
  console.error(`❌ Launch-blockers verification failed: ${err.message}`);
  process.exit(1);
});
