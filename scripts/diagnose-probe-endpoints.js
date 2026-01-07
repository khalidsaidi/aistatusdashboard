#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_TIMEOUT_MS = 12000;
const SEMANTIC_PROMPT = 'Respond with the single word READY.';

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value.replace(/\\n/g, '\n');
    }
  }
}

function withTimeout(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeout };
}

async function fetchJson(url, options, timeoutMs) {
  const { controller, timeout } = withTimeout(timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const latencyMs = Date.now() - start;
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return { response, data, latencyMs };
  } finally {
    clearTimeout(timeout);
  }
}

function safeMessage(data) {
  if (!data) return null;
  if (typeof data?.error?.message === 'string') return data.error.message.slice(0, 200);
  if (typeof data?.message === 'string') return data.message.slice(0, 200);
  if (typeof data?.error === 'string') return data.error.slice(0, 200);
  return null;
}

async function probeOpenAICompatible(entry, apiKey) {
  const url = `${entry.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const payload = {
    model: entry.model,
    messages: [{ role: 'user', content: SEMANTIC_PROMPT }],
    max_tokens: 16,
    temperature: 0,
  };
  return fetchJson(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    DEFAULT_TIMEOUT_MS
  );
}

async function probeAnthropic(entry, apiKey) {
  const url = `${entry.baseUrl.replace(/\/$/, '')}/messages`;
  const payload = {
    model: entry.model,
    max_tokens: 16,
    temperature: 0,
    messages: [{ role: 'user', content: SEMANTIC_PROMPT }],
  };
  return fetchJson(
    url,
    {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    DEFAULT_TIMEOUT_MS
  );
}

async function probeGemini(entry, apiKey) {
  const url = `${entry.baseUrl.replace(/\/$/, '')}/models/${entry.model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: SEMANTIC_PROMPT }] }],
    generationConfig: { maxOutputTokens: 16, temperature: 0 },
  };
  return fetchJson(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    DEFAULT_TIMEOUT_MS
  );
}

async function probeCohere(entry, apiKey) {
  const url = `${entry.baseUrl.replace(/\/$/, '')}/chat`;
  const payload = {
    model: entry.model,
    message: SEMANTIC_PROMPT,
    max_tokens: 16,
    temperature: 0,
  };
  return fetchJson(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    DEFAULT_TIMEOUT_MS
  );
}

async function probeAzure(entry, apiKey) {
  const url = `${entry.baseUrl.replace(/\/$/, '')}/openai/deployments/${entry.deployment}/chat/completions?api-version=${entry.apiVersion}`;
  const payload = {
    messages: [{ role: 'user', content: SEMANTIC_PROMPT }],
    max_tokens: 16,
    temperature: 0,
  };
  return fetchJson(
    url,
    {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    DEFAULT_TIMEOUT_MS
  );
}

async function probeBedrock(entry) {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
  const client = new BedrockRuntimeClient({ region: entry.region });
  let payload = null;
  const model = entry.model || '';
  if (model.includes('anthropic') || model.includes('claude')) {
    payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 16,
      messages: [{ role: 'user', content: [{ type: 'text', text: SEMANTIC_PROMPT }] }],
    };
  } else if (model.includes('titan')) {
    payload = {
      inputText: SEMANTIC_PROMPT,
      textGenerationConfig: {
        maxTokenCount: 16,
        temperature: 0,
      },
    };
  } else {
    payload = { prompt: SEMANTIC_PROMPT, max_tokens: 16 };
  }
  const start = Date.now();
  const encoder = new TextEncoder();
  const response = await client.send(
    new InvokeModelCommand({
      modelId: model,
      contentType: 'application/json',
      accept: 'application/json',
      body: encoder.encode(JSON.stringify(payload)),
    })
  );
  const latencyMs = Date.now() - start;
  return { response: { ok: true, status: 200 }, data: null, latencyMs };
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env.production.local'));
  const probes = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../lib/data/probe_providers.json'), 'utf8'));
  const results = [];

  for (const entry of probes.providers) {
    const apiKey = entry.envKey ? process.env[entry.envKey] : undefined;
    if (entry.type !== 'bedrock' && !apiKey) {
      results.push({ providerId: entry.providerId, status: 'skipped', detail: `missing ${entry.envKey}` });
      continue;
    }

    try {
      let res;
      switch (entry.type) {
        case 'openai':
          res = await probeOpenAICompatible(entry, apiKey);
          break;
        case 'anthropic':
          res = await probeAnthropic(entry, apiKey);
          break;
        case 'gemini':
          res = await probeGemini(entry, apiKey);
          break;
        case 'cohere':
          res = await probeCohere(entry, apiKey);
          break;
        case 'azure-openai':
          res = await probeAzure({
            baseUrl: process.env[entry.baseUrlEnvKey],
            model: process.env[entry.modelEnvKey] || entry.model,
            deployment: process.env[entry.deploymentEnvKey],
            apiVersion: entry.apiVersion || '2024-02-15-preview',
          }, apiKey);
          break;
        case 'bedrock':
          res = await probeBedrock({
            model: process.env[entry.modelEnvKey] || entry.model,
            region: process.env[entry.regionEnvKey] || process.env.AWS_REGION || entry.region,
          });
          break;
        default:
          results.push({ providerId: entry.providerId, status: 'skipped', detail: 'unsupported type' });
          continue;
      }

      results.push({
        providerId: entry.providerId,
        status: res.response.ok ? 'ok' : 'error',
        httpStatus: res.response.status,
        latencyMs: res.latencyMs,
        message: res.response.ok ? null : safeMessage(res.data),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        providerId: entry.providerId,
        status: 'error',
        httpStatus: null,
        latencyMs: null,
        message: message.slice(0, 200),
      });
    }
  }

  console.log(JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
