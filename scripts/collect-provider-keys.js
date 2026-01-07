const fs = require('fs');
const path = require('path');
const net = require('net');
const { execSync, spawn } = require('child_process');
const { chromium } = require('playwright');

const USER_DATA_DIR = path.resolve(__dirname, '..', '.ai', 'tmp-browser-profile', 'wsl-login');
const ENV_PATH = path.resolve(__dirname, '..', '.env.production.local');
const LOG_PATH = path.resolve(__dirname, '..', '.ai', 'creds', 'key-collection.log');
const CHROME_PATH = '/opt/google/chrome/chrome';
const DEBUG_PORT = 9222;

const PROVIDERS = [
  {
    id: 'openai',
    envKey: 'OPENAI_API_KEY',
    url: 'https://platform.openai.com/api-keys',
    createLabels: [
      /create new secret key/i,
      /create new key/i,
      /create new api key/i,
      /create api key/i,
      /create secret key/i,
      /new api key/i,
      /create.*key/i,
      /new secret key/i,
    ],
    keyPattern: /sk-[A-Za-z0-9_-]{20,}/,
  },
  {
    id: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    url: 'https://console.anthropic.com/settings/keys',
    createLabels: [/create.*key/i, /new.*key/i, /generate.*key/i],
    keyPattern: /sk-ant-[A-Za-z0-9_-]{20,}/i,
    timeoutMs: 120000,
    captureTimeoutMs: 30000,
  },
  {
    id: 'cohere',
    envKey: 'COHERE_API_KEY',
    url: 'https://dashboard.cohere.com/api-keys',
    createLabels: [/create.*key/i, /new.*key/i, /generate.*key/i, /add.*key/i],
    avoidUuid: true,
    disallowEmail: true,
  },
  {
    id: 'groq',
    envKey: 'GROQ_API_KEY',
    url: 'https://console.groq.com/keys',
    createLabels: [/create.*key/i, /new.*key/i, /generate.*key/i, /add.*key/i],
    keyPattern: /gsk_[A-Za-z0-9_-]{20,}/i,
    captureTimeoutMs: 30000,
  },
  {
    id: 'mistral',
    envKey: 'MISTRAL_API_KEY',
    url: 'https://console.mistral.ai/api-keys',
    createLabels: [/create.*key/i, /new.*key/i, /generate.*key/i, /add.*key/i],
    avoidUuid: true,
  },
  {
    id: 'deepseek',
    envKey: 'DEEPSEEK_API_KEY',
    urls: ['https://platform.deepseek.com/api-keys', 'https://platform.deepseek.com/api_keys'],
    createLabels: [/create.*key/i, /new.*key/i, /generate.*key/i, /add.*key/i],
    navLabel: /api keys/i,
    avoidUuid: true,
  },
  {
    id: 'xai',
    envKey: 'XAI_API_KEY',
    urls: ['https://console.x.ai/', 'https://console.x.ai/api-keys', 'https://console.x.ai/keys', 'https://console.x.ai/settings/api-keys'],
    createLabels: [
      /create.*key/i,
      /new.*key/i,
      /generate.*key/i,
      /add.*key/i,
      /create.*token/i,
      /new.*token/i,
      /generate.*token/i,
      /^create$/i,
      /^new$/i,
    ],
    navLabel: /api keys/i,
    avoidUuid: true,
  },
  {
    id: 'azure',
    envKey: 'AZURE_OPENAI_API_KEY',
    url: 'https://portal.azure.com/',
    createLabels: [],
    skipReason: 'Azure keys require a specific Azure OpenAI resource; creation is handled separately.',
  },
];

function logLine(message) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${message}\n`);
}

function waitForPort(port, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const attempt = () => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timeout waiting for port ${port}`));
          return;
        }
        setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

function isPortOpen(port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);
    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.end();
      resolve(true);
    });
    socket.once('error', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(false);
    });
  });
}

function findKeyInObject(value, pattern) {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (pattern) {
      return pattern.test(trimmed) ? trimmed : null;
    }
    if (trimmed.length >= 24 && !/\s/.test(trimmed)) {
      return trimmed;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findKeyInObject(item, pattern);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') {
    for (const entry of Object.values(value)) {
      const found = findKeyInObject(entry, pattern);
      if (found) return found;
    }
  }
  return null;
}

function isValidKeyCandidate(value, pattern) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  if (pattern) return pattern.test(trimmed);
  return trimmed.length >= 24 && /[A-Za-z0-9]/.test(trimmed);
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function normalizeKeyCandidate(value, pattern, options = {}) {
  if (!isValidKeyCandidate(value, pattern)) return null;
  const trimmed = value.trim();
  if (options.excludePrefixes) {
    const lower = trimmed.toLowerCase();
    if (options.excludePrefixes.some((prefix) => lower.startsWith(prefix))) {
      return null;
    }
  }
  if (options.disallowEmail && trimmed.includes('@')) {
    return null;
  }
  if (!pattern && options.avoidUuid && isUuidLike(trimmed)) return null;
  return trimmed;
}

function redactTokens(value) {
  if (!value) return '';
  return value
    .replace(/sk-[A-Za-z0-9_-]{16,}/gi, '<redacted>')
    .replace(/gsk_[A-Za-z0-9_-]{16,}/gi, '<redacted>')
    .replace(/[A-Za-z0-9_-]{24,}/g, '<redacted>');
}

async function snapshotKeyContext(page, providerId) {
  const data = await page.evaluate(() => {
    const dialog =
      document.querySelector('[role="dialog"]') ||
      document.querySelector('[role="alertdialog"]') ||
      document.querySelector('.modal') ||
      document.querySelector('.MuiDialog-root') ||
      document.querySelector('.chakra-modal__content') ||
      document.querySelector('.ant-modal');

    const dialogText = dialog ? dialog.innerText || '' : '';
    const buttons = Array.from(document.querySelectorAll('button'))
      .slice(0, 40)
      .map((el) => (el.textContent || '').trim())
      .filter(Boolean);
    const inputs = Array.from(document.querySelectorAll('input,textarea'))
      .slice(0, 20)
      .map((el) => ({
        placeholder: el.getAttribute('placeholder') || '',
        name: el.getAttribute('name') || '',
        type: el.getAttribute('type') || '',
        aria: el.getAttribute('aria-label') || '',
        value: el.value || '',
      }));
    const labels = Array.from(document.querySelectorAll('[aria-label],[title]'))
      .slice(0, 40)
      .map((el) => el.getAttribute('aria-label') || el.getAttribute('title') || '')
      .filter(Boolean);

    return {
      url: window.location.href,
      title: document.title,
      dialogText,
      buttons,
      inputs,
      labels,
    };
  });

  const redacted = {
    url: data.url,
    title: redactTokens(data.title),
    dialogText: redactTokens(data.dialogText).slice(0, 2000),
    buttons: data.buttons.map((text) => redactTokens(text)).slice(0, 40),
    inputs: data.inputs.map((input) => ({
      ...input,
      placeholder: redactTokens(input.placeholder),
      name: redactTokens(input.name),
      type: input.type,
      aria: redactTokens(input.aria),
      value: redactTokens(input.value),
    })),
    labels: data.labels.map((text) => redactTokens(text)).slice(0, 40),
  };

  const outPath = path.resolve(__dirname, '..', '.ai', 'creds', `${providerId}-key-context.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(redacted, null, 2));
}

async function launchChromeWithDebugging() {
  if (await isPortOpen(DEBUG_PORT)) {
    logLine('chrome: debug port already open, reusing');
    return null;
  }
  try {
    execSync(`pkill -f "${USER_DATA_DIR}"`, { stdio: 'ignore' });
  } catch {}

  const args = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run',
    '--disable-popup-blocking',
    '--disable-blink-features=AutomationControlled',
  ];

  const proc = spawn(CHROME_PATH, args, { stdio: 'ignore', detached: true });
  proc.unref();
  await waitForPort(DEBUG_PORT);
  return proc;
}

function parseEnv(contents) {
  const result = {};
  contents.split(/\r?\n/).forEach((line) => {
    if (!line || line.trim().startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
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

function writeEnv(env, originalContents) {
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
      updated.push(`${key}=${formatEnvValue(env[key])}`);
      seen.add(key);
    } else {
      updated.push(line);
    }
  }

  Object.keys(env).forEach((key) => {
    if (!seen.has(key)) {
      updated.push(`${key}=${formatEnvValue(env[key])}`);
    }
  });

  fs.writeFileSync(ENV_PATH, `${updated.filter((line) => line !== undefined).join('\n')}\n`);
}

async function findCreateButton(page, labels) {
  for (const label of labels) {
    const candidate = page.getByRole('button', { name: label }).first();
    if (await candidate.isVisible().catch(() => false)) return candidate;
    const fallback = page.locator('button', { hasText: label }).first();
    if (await fallback.isVisible().catch(() => false)) return fallback;
    const link = page.getByRole('link', { name: label }).first();
    if (await link.isVisible().catch(() => false)) return link;
    const linkFallback = page.locator('a', { hasText: label }).first();
    if (await linkFallback.isVisible().catch(() => false)) return linkFallback;
    const roleButton = page.locator('[role="button"]', { hasText: label }).first();
    if (await roleButton.isVisible().catch(() => false)) return roleButton;
  }
  return null;
}

async function logButtonHints(page, providerId) {
  const hints = await page.evaluate(() => {
    const results = new Set();
    const matcher = /(create|new|generate|add|api key|secret key|key)/i;
    document.querySelectorAll('button,a').forEach((el) => {
      const text = (el.textContent || '').trim();
      const aria = el.getAttribute('aria-label') || '';
      const title = el.getAttribute('title') || '';
      const combined = `${text} ${aria} ${title}`.trim();
      if (combined && matcher.test(combined)) {
        results.add(combined.slice(0, 80));
      }
    });
    return Array.from(results).slice(0, 12);
  });
  if (hints.length > 0) {
    logLine(`${providerId}: button hints -> ${hints.join(' | ')}`);
  }
}

async function logKeyControls(page, providerId) {
  const hints = await page.evaluate(() => {
    const results = new Set();
    const matcher = /(copy|reveal|show|view|key)/i;
    document.querySelectorAll('[aria-label],[title]').forEach((el) => {
      const label = el.getAttribute('aria-label') || el.getAttribute('title') || '';
      if (label && matcher.test(label)) {
        results.add(label.slice(0, 80));
      }
    });
    return Array.from(results).slice(0, 12);
  });
  if (hints.length > 0) {
    logLine(`${providerId}: key controls -> ${hints.join(' | ')}`);
  }
}

async function logAccessHints(page, providerId) {
  const hints = await page.evaluate(() => {
    const results = new Set();
    const matcher = /(access|waitlist|request|billing|payment|upgrade|workspace|subscription)/i;
    const collect = (text) => {
      if (text && matcher.test(text)) {
        results.add(text.slice(0, 120));
      }
    };
    document.querySelectorAll('button,a,p,span,div').forEach((el) => {
      const text = (el.textContent || '').trim();
      if (text.length > 0 && text.length < 140) {
        collect(text);
      }
    });
    return Array.from(results).slice(0, 12);
  });
  if (hints.length > 0) {
    logLine(`${providerId}: access hints -> ${hints.join(' | ')}`);
  }
}

async function extractKeyCandidates(container) {
  if (!container || typeof container.evaluate !== 'function') return [];
  const isPage = typeof container.goto === 'function';
  if (isPage) {
    return container.evaluate(() => {
      const root = document;
      const results = new Set();
      const isKeyLike = (value) => {
        if (typeof value !== 'string') return false;
        const trimmed = value.trim();
        if (trimmed.length < 24) return false;
        if (/\s/.test(trimmed)) return false;
        return /[A-Za-z0-9]/.test(trimmed);
      };

      const collect = (value) => {
        if (isKeyLike(value)) results.add(value.trim());
      };

      root.querySelectorAll('input,textarea').forEach((el) => collect(el.value));
      root.querySelectorAll('code,pre').forEach((el) => collect(el.textContent || ''));
      root.querySelectorAll('[data-testid],[data-test],[data-qa],[data-key],[data-secret],[data-value]').forEach((el) => {
        collect(el.textContent || '');
        collect(el.getAttribute('data-value') || '');
        collect(el.getAttribute('data-key') || '');
        collect(el.getAttribute('data-secret') || '');
        collect(el.getAttribute('data-qa') || '');
        collect(el.getAttribute('data-test') || '');
      });
      return Array.from(results);
    });
  }
  return container.evaluate((root) => {
    const results = new Set();
    const isKeyLike = (value) => {
      if (typeof value !== 'string') return false;
      const trimmed = value.trim();
      if (trimmed.length < 24) return false;
      if (/\s/.test(trimmed)) return false;
      return /[A-Za-z0-9]/.test(trimmed);
    };

    const collect = (value) => {
      if (isKeyLike(value)) results.add(value.trim());
    };

    root.querySelectorAll('input,textarea').forEach((el) => collect(el.value));
    root.querySelectorAll('code,pre').forEach((el) => collect(el.textContent || ''));
    root.querySelectorAll('[data-testid],[data-test],[data-qa],[data-key],[data-secret],[data-value]').forEach((el) => {
      collect(el.textContent || '');
      collect(el.getAttribute('data-value') || '');
      collect(el.getAttribute('data-key') || '');
      collect(el.getAttribute('data-secret') || '');
      collect(el.getAttribute('data-qa') || '');
      collect(el.getAttribute('data-test') || '');
    });
    return Array.from(results);
  });
}

async function captureKey(page, provider) {
  const dialog = page
    .locator('[role="dialog"], [role="alertdialog"], .modal, .MuiDialog-root, .chakra-modal__content, .ant-modal')
    .first();
  let container = page;
  if (await dialog.isVisible().catch(() => false)) {
    container = dialog;
  }

  const candidates = await extractKeyCandidates(container);
  if (!candidates.length && container !== page) {
    const fallbackCandidates = await extractKeyCandidates(page);
    candidates.push(...fallbackCandidates);
  }

  const pattern = provider.keyPattern;
  const excludedPrefixes = ['ai-status-'];
  const filteredCandidates = (provider.avoidUuid ? candidates.filter((value) => !isUuidLike(value)) : candidates)
    .filter((value) => !excludedPrefixes.some((prefix) => value.toLowerCase().startsWith(prefix)))
    .filter((value) => (provider.disallowEmail ? !value.includes('@') : true));
  if (pattern && filteredCandidates.length) {
    const match = filteredCandidates.find((value) => pattern.test(value));
    if (match) return match.trim();
  }

  if (pattern) {
    const fromText = await page.evaluate((source) => {
      const regex = new RegExp(source, 'i');
      const match = document.body?.innerText?.match(regex);
      return match ? match[0] : null;
    }, pattern.source);
    if (fromText) return fromText.trim();
    return null;
  }

  if (!filteredCandidates.length) return null;
  filteredCandidates.sort((a, b) => b.length - a.length);
  return filteredCandidates[0];
}

async function tryCopyFromPage(page, provider) {
  const copySelectors = [
    page.getByRole('button', { name: /copy/i }).first(),
    page.locator('button[aria-label*="copy" i]').first(),
    page.locator('button[title*="copy" i]').first(),
    page.locator('[data-testid*="copy" i]').first(),
    page.locator('button:has-text("Copy")').first(),
    page.locator('[aria-label*="copy" i], [title*="copy" i]').first(),
  ];
  for (const copyButton of copySelectors) {
    if (await copyButton.isVisible().catch(() => false)) {
      await copyButton.click().catch(() => {});
      const clipboardValue = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null);
      const normalized = normalizeKeyCandidate(clipboardValue, provider.keyPattern, {
        avoidUuid: provider.avoidUuid,
        disallowEmail: provider.disallowEmail,
        excludePrefixes: ['ai-status-'],
      });
      if (normalized) return normalized;
    }
  }
  return null;
}

async function tryRevealKey(page, provider) {
  const revealSelectors = [
    page.getByRole('button', { name: /reveal|show|view/i }).first(),
    page.locator('button[aria-label*="reveal" i], button[aria-label*="show" i], button[aria-label*="view" i]').first(),
    page.locator('button[title*="reveal" i], button[title*="show" i], button[title*="view" i]').first(),
    page.locator('[aria-label*="reveal" i], [aria-label*="show" i], [aria-label*="view" i]').first(),
  ];
  for (const revealButton of revealSelectors) {
    if (await revealButton.isVisible().catch(() => false)) {
      await revealButton.click().catch(() => {});
      await page.waitForTimeout(1000);
      const key = await captureKey(page, provider);
      if (key) return key;
    }
  }
  return null;
}

async function waitForKey(page, provider, getResponseKey, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const responseKey = normalizeKeyCandidate(getResponseKey(), provider.keyPattern, {
      avoidUuid: provider.avoidUuid,
      disallowEmail: provider.disallowEmail,
      excludePrefixes: ['ai-status-'],
    });
    if (responseKey) return responseKey;

    const key = await captureKey(page, provider);
    if (key) return key;

    const copied = await tryCopyFromPage(page, provider);
    if (copied) return copied;

    const clipboardValue = normalizeKeyCandidate(
      await page.evaluate(() => navigator.clipboard.readText()).catch(() => null),
      provider.keyPattern,
      { avoidUuid: provider.avoidUuid, disallowEmail: provider.disallowEmail, excludePrefixes: ['ai-status-'] }
    );
    if (clipboardValue) return clipboardValue;

    const revealed = await tryRevealKey(page, provider);
    if (revealed) return revealed;

    await page.waitForTimeout(1000);
  }
  return null;
}

async function createKeyForProvider(context, env, provider, options = {}) {
  const forceRegen = Boolean(options.forceRegen);
  if (provider.skipReason) {
    logLine(`${provider.id}: skipped (${provider.skipReason})`);
    return { id: provider.id, status: 'skipped', reason: provider.skipReason };
  }

  if (env[provider.envKey] && !forceRegen) {
    logLine(`${provider.id}: existing key detected, skipping creation`);
    return { id: provider.id, status: 'existing' };
  }
  if (env[provider.envKey] && forceRegen) {
    logLine(`${provider.id}: force regen enabled, replacing existing key`);
  }

  const page = await context.newPage();
  try {
    const urls = provider.urls || [provider.url];
    let loaded = false;
    for (const url of urls) {
      if (!url) continue;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(1500);
      if (page.url() && !page.url().includes('about:blank')) {
        loaded = true;
        break;
      }
    }
    if (!loaded) {
      logLine(`${provider.id}: failed to load url`);
      return { id: provider.id, status: 'no_url' };
    }
    logLine(`${provider.id}: loaded ${page.url()}`);
    logLine(`${provider.id}: title ${await page.title().catch(() => 'unknown')}`);

    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);

    const title = await page.title().catch(() => '');
    if (/just a moment|attention required|checking your browser/i.test(title)) {
      logLine(`${provider.id}: waiting for challenge to clear`);
      await page.waitForFunction(
        () => !/just a moment|attention required|checking your browser/i.test(document.title),
        { timeout: 20000 }
      ).catch(() => {});
      await page.waitForTimeout(1500);
      logLine(`${provider.id}: title after wait ${await page.title().catch(() => 'unknown')}`);
      logLine(`${provider.id}: url after wait ${page.url()}`);
    }

    const finalTitle = await page.title().catch(() => '');
    if (/just a moment|attention required|checking your browser/i.test(finalTitle)) {
      logLine(`${provider.id}: challenge still active, skipping`);
      return { id: provider.id, status: 'blocked' };
    }

    const passwordField = page.locator('input[type="password"]').first();
    if (await passwordField.isVisible().catch(() => false)) {
      logLine(`${provider.id}: login prompt detected, skipping`);
      return { id: provider.id, status: 'needs_login' };
    }

    if (provider.navLabel) {
      const navLink = page.getByRole('link', { name: provider.navLabel }).first();
      const navButton = page.getByRole('button', { name: provider.navLabel }).first();
      const navFallback = page.locator('a,button', { hasText: provider.navLabel }).first();
      if (await navLink.isVisible().catch(() => false)) {
        await navLink.click().catch(() => {});
        await page.waitForTimeout(1500);
      } else if (await navButton.isVisible().catch(() => false)) {
        await navButton.click().catch(() => {});
        await page.waitForTimeout(1500);
      } else if (await navFallback.isVisible().catch(() => false)) {
        await navFallback.click().catch(() => {});
        await page.waitForTimeout(1500);
      }
    }

    let responseKey = null;
    const requestHints = [];
    const requestAll = [];
    const requestListener = (request) => {
      const url = request.url();
      if (requestAll.length < 40) {
        requestAll.push(url);
      }
      if (/key|token|secret|graphql|api/i.test(url)) {
        requestHints.push(url);
      }
    };
    const responseListener = async (response) => {
      if (responseKey) return;
      const headers = response.headers();
      const contentType = headers['content-type'] || '';
      const url = response.url();
      if (!/key|token|secret/i.test(url) && !contentType.includes('application/json')) {
        return;
      }

      const text = await response.text().catch(() => null);
      if (text && provider.keyPattern) {
        const match = text.match(provider.keyPattern);
        if (match) {
          responseKey = match[0];
          return;
        }
      }

      if (text && contentType.includes('application/json')) {
        try {
          const data = JSON.parse(text);
          const found = findKeyInObject(data, provider.keyPattern);
          if (found) responseKey = found;
        } catch {}
      }
    };

    page.on('request', requestListener);
    page.on('response', responseListener);

    const button = await findCreateButton(page, provider.createLabels);
    if (!button) {
      logLine(`${provider.id}: create key button not found`);
      await logButtonHints(page, provider.id);
      await logAccessHints(page, provider.id);
      page.off('request', requestListener);
      page.off('response', responseListener);
      return { id: provider.id, status: 'no_button' };
    }

    if (!(await button.isEnabled().catch(() => false))) {
      logLine(`${provider.id}: create key button disabled`);
      await logButtonHints(page, provider.id);
      await logAccessHints(page, provider.id);
      const enableCandidates = [
        /generate one/i,
        /generate key/i,
        /generate/i,
        /create workspace/i,
        /new workspace/i,
        /create project/i,
        /new project/i,
        /create organization/i,
        /new organization/i,
        /choose a plan/i,
        /get started/i,
        /start now/i,
        /upgrade/i,
      ];
      for (const label of enableCandidates) {
        const enableButton = page.getByRole('button', { name: label }).first();
        const enableLink = page.getByRole('link', { name: label }).first();
        const enableText = page.getByText(label).first();
        if (await enableButton.isVisible().catch(() => false)) {
          await enableButton.click().catch(() => {});
          await page.waitForTimeout(1500);
          break;
        }
        if (await enableLink.isVisible().catch(() => false)) {
          await enableLink.click().catch(() => {});
          await page.waitForTimeout(1500);
          break;
        }
        if (await enableText.isVisible().catch(() => false)) {
          await enableText.click().catch(() => {});
          await page.waitForTimeout(1500);
          break;
        }
      }
      if (!(await button.isEnabled().catch(() => false))) {
        page.off('request', requestListener);
        page.off('response', responseListener);
        return { id: provider.id, status: 'disabled' };
      }
    }

    await button.click({ timeout: 10000 });
    await page.waitForTimeout(1500);

    const modal = page
      .locator('[role="dialog"], [role="alertdialog"], .modal, .MuiDialog-root, .chakra-modal__content, .ant-modal')
      .first();
    if (await modal.isVisible().catch(() => false)) {
      logLine(`${provider.id}: modal detected`);
      const nameInput = modal.locator('input[placeholder*="Name" i], input[name*="name" i]').first();
      if (await nameInput.isVisible().catch(() => false)) {
        logLine(`${provider.id}: modal name input detected`);
        await nameInput.fill(`ai-status-${provider.id}-${Date.now()}`).catch(() => {});
      }
      const confirmButton = modal
        .getByRole('button', { name: /create|generate|confirm|add/i })
        .first();
      if (await confirmButton.isVisible().catch(() => false)) {
        logLine(`${provider.id}: modal confirm button detected`);
        await confirmButton.click().catch(() => {});
      }
    }

    const pageNameInput = page.locator('input[placeholder*="Name" i], input[name*="name" i]').first();
    if (await pageNameInput.isVisible().catch(() => false)) {
      logLine(`${provider.id}: page name input detected`);
      const currentValue = await pageNameInput.inputValue().catch(() => '');
      if (!currentValue) {
        await pageNameInput.fill(`ai-status-${provider.id}-${Date.now()}`).catch(() => {});
      }
    }

    await page.waitForTimeout(1500);

    const fallbackConfirm = page.getByRole('button', { name: /create.*key|generate.*key|confirm|add/i }).first();
    if (await fallbackConfirm.isVisible().catch(() => false)) {
      logLine(`${provider.id}: fallback confirm button detected`);
      if (await fallbackConfirm.isEnabled().catch(() => false)) {
        await fallbackConfirm.click().catch(() => {});
        await page.waitForTimeout(1500);
      }
    }
    const captureTimeoutMs = provider.captureTimeoutMs || 20000;
    const key = await waitForKey(page, provider, () => responseKey, captureTimeoutMs);
    page.off('request', requestListener);
    page.off('response', responseListener);
    if (!key) {
      logLine(`${provider.id}: key not found after creation`);
      if (requestHints.length) {
        const uniqueHints = Array.from(new Set(requestHints)).slice(0, 6);
        logLine(`${provider.id}: request hints -> ${uniqueHints.join(' | ')}`);
      } else if (provider.id === 'anthropic' && requestAll.length) {
        const uniqueAll = Array.from(new Set(requestAll)).slice(0, 6);
        logLine(`${provider.id}: request sample -> ${uniqueAll.join(' | ')}`);
      }
      await logKeyControls(page, provider.id);
      await logAccessHints(page, provider.id);
      await snapshotKeyContext(page, provider.id);
      return { id: provider.id, status: 'no_key' };
    }

    env[provider.envKey] = key;
    logLine(`${provider.id}: key captured`);
    return { id: provider.id, status: 'ok' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    logLine(`${provider.id}: error (${message})`);
    return { id: provider.id, status: 'error', reason: message };
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  if (!fs.existsSync(USER_DATA_DIR)) {
    throw new Error(`User data dir not found: ${USER_DATA_DIR}`);
  }

  const args = process.argv.slice(2);
  const forceRegen = args.includes('--force') || args.includes('--force-regen');
  const onlyArg = args.find((arg) => arg.startsWith('--only=') || arg.startsWith('--provider='));
  const onlyList = onlyArg
    ? onlyArg
        .split('=')[1]
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : null;
  const providerList = onlyList
    ? PROVIDERS.filter((provider) => onlyList.includes(provider.id))
    : PROVIDERS;

  const originalContents = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const existingEnv = originalContents ? parseEnv(originalContents) : {};

  const chromeProcess = await launchChromeWithDebugging();
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
  const context = browser.contexts()[0] || (await browser.newContext());

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  const results = [];
  for (const provider of providerList) {
    const timeoutMs = provider.timeoutMs || 45000;
    const result = await Promise.race([
      createKeyForProvider(context, existingEnv, provider, { forceRegen }),
      new Promise((resolve) =>
        setTimeout(() => resolve({ id: provider.id, status: 'timeout' }), timeoutMs)
      ),
    ]);
    if (result?.status === 'timeout') {
      logLine(`${provider.id}: timed out`);
    }
    results.push(result);
  }

  await browser.close().catch(() => {});
  if (chromeProcess) {
    try {
      process.kill(chromeProcess.pid);
    } catch {}
  }
  writeEnv(existingEnv, originalContents);

  const summary = results.map((r) => `${r.id}:${r.status}`).join(',');
  logLine(`summary:${summary}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logLine(`fatal:${message}`);
  process.exitCode = 1;
});
