#!/usr/bin/env node

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

function getTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return (
    `${now.getUTCFullYear()}-` +
    `${pad(now.getUTCMonth() + 1)}-` +
    `${pad(now.getUTCDate())}T` +
    `${pad(now.getUTCHours())}-` +
    `${pad(now.getUTCMinutes())}-` +
    `${pad(now.getUTCSeconds())}Z`
  );
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function severityRank(status) {
  switch (status) {
    case 'operational':
      return 0;
    case 'unknown':
      return 1;
    case 'maintenance':
      return 2;
    case 'degraded':
      return 3;
    case 'partial_outage':
      return 4;
    case 'major_outage':
    case 'down':
      return 5;
    default:
      return 1;
  }
}

function isActiveIncident(incident) {
  if (!incident || typeof incident !== 'object') return false;
  if (incident.resolvedAt) return false;
  const status = String(incident.status || '').toLowerCase();
  return !['resolved', 'completed', 'cancelled'].includes(status);
}

function isActiveMaintenance(maintenance) {
  if (!maintenance || typeof maintenance !== 'object') return false;
  if (maintenance.completedAt) return false;
  const status = String(maintenance.status || '').toLowerCase();
  return !['resolved', 'completed', 'cancelled'].includes(status);
}

function isDegradedComponent(component) {
  if (!component || typeof component !== 'object') return false;
  const status = String(component.status || '').toLowerCase();
  return ['degraded', 'partial_outage', 'major_outage', 'down', 'maintenance'].includes(status);
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'AI-Status-Dashboard/1.0' } });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function main() {
  const args = process.argv.slice(2);
  const baseArg = readArgValue(args, '--base');
  const outputArg = readArgValue(args, '--output');
  const envArg = readArgValue(args, '--env');
  const strict = !args.includes('--allow-mismatch');
  const refresh = args.includes('--refresh');

  const envFile = envArg || (refresh ? path.resolve(process.cwd(), '.env.production.local') : null);
  if (envFile) {
    loadEnvFile(envFile);
  }

  const baseUrl =
    baseArg ||
    process.env.STATUS_CHECK_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000';

  if (refresh) {
    const secret = process.env.APP_CRON_SECRET || process.env.CRON_SECRET;
    if (!secret) {
      throw new Error('Missing APP_CRON_SECRET/CRON_SECRET for refresh step.');
    }
    const refreshUrl = new URL('/api/cron/ingest?force=1', baseUrl).toString();
    const refreshResponse = await fetch(refreshUrl, {
      headers: { 'x-cron-secret': secret },
    });
    if (!refreshResponse.ok) {
      throw new Error(`Refresh failed: ${refreshResponse.status} ${refreshResponse.statusText}`);
    }
  }

  const providersPath = path.resolve(__dirname, '../lib/data/providers.json');
  const providers = JSON.parse(fs.readFileSync(providersPath, 'utf8')).providers || [];

  const sourcesPath = path.resolve(__dirname, '../lib/data/sources.json');
  const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8')).sources || [];
  const sourceProviders = new Set(sources.map((source) => source.providerId));
  const providerPolls = sources.reduce((acc, source) => {
    const current = acc[source.providerId];
    const next = typeof source.pollIntervalSeconds === 'number' ? source.pollIntervalSeconds : null;
    if (!next) return acc;
    acc[source.providerId] = current ? Math.min(current, next) : next;
    return acc;
  }, {});

  const timestamp = getTimestamp();
  const outputDir = outputArg || path.resolve(process.cwd(), '.ai/status-accuracy', timestamp);
  ensureDir(outputDir);

  const summary = [];
  let hasMismatch = false;

  const intelProviders = await fetchJson(`${baseUrl}/api/intel/providers`);
  const intelList = Array.isArray(intelProviders?.providers) ? intelProviders.providers : [];

  for (const provider of providers) {
    if (provider.enabled === false) continue;
    const providerId = provider.id;

    let liveStatus = 'unknown';
    let ingestedStatus = 'unknown';
    let evidence = { activeIncidents: 0, activeMaintenances: 0, degradedComponents: 0 };
    let errors = [];

    if (!sourceProviders.has(providerId)) {
      errors.push('source:missing');
    }

    try {
      const live = await fetchJson(`${baseUrl}/api/status?provider=${encodeURIComponent(providerId)}`);
      const liveEntry = Array.isArray(live?.data) ? live.data[0] : null;
      liveStatus = liveEntry?.status || 'unknown';
    } catch (error) {
      errors.push(`live:${error.message}`);
    }

    try {
      const summaryEntry = intelList.find((item) => item.providerId === providerId);
      ingestedStatus = summaryEntry?.status || 'unknown';
      const lastUpdated = summaryEntry?.lastUpdated;
      if (!lastUpdated) {
        errors.push('summary:missing-lastUpdated');
      } else {
        const updatedMs = Date.parse(lastUpdated);
        if (Number.isFinite(updatedMs)) {
          const pollSeconds = providerPolls[providerId] || 120;
          const maxAgeMs = pollSeconds * 2 * 1000 + 60000;
          if (Date.now() - updatedMs > maxAgeMs) {
            errors.push(`summary:stale(${Math.round((Date.now() - updatedMs) / 1000)}s)`);
          }
        }
      }
    } catch (error) {
      errors.push(`summary:${error.message}`);
    }

    try {
      const detail = await fetchJson(`${baseUrl}/api/intel/provider/${encodeURIComponent(providerId)}`);
      const incidents = Array.isArray(detail?.incidents) ? detail.incidents : [];
      const maintenances = Array.isArray(detail?.maintenances) ? detail.maintenances : [];
      const components = Array.isArray(detail?.components) ? detail.components : [];
      evidence = {
        activeIncidents: incidents.filter(isActiveIncident).length,
        activeMaintenances: maintenances.filter(isActiveMaintenance).length,
        degradedComponents: components.filter(isDegradedComponent).length,
      };
    } catch (error) {
      errors.push(`detail:${error.message}`);
    }

    const liveRank = severityRank(liveStatus);
    const ingestedRank = severityRank(ingestedStatus);

    const mismatch = {
      overreported: ingestedRank > liveRank,
      underreported: ingestedRank < liveRank,
      noEvidence:
        ingestedRank > 0 &&
        evidence.activeIncidents === 0 &&
        evidence.activeMaintenances === 0 &&
        evidence.degradedComponents === 0,
    };

    const statusEntry = {
      providerId,
      liveStatus,
      ingestedStatus,
      evidence,
      mismatch,
      errors,
    };

    if (mismatch.overreported || mismatch.underreported || errors.length > 0) {
      hasMismatch = true;
    }

    summary.push(statusEntry);
  }

  const report = {
    baseUrl,
    timestamp: new Date().toISOString(),
    strict,
    mismatches: summary.filter((item) => item.mismatch.overreported || item.mismatch.underreported || item.errors.length > 0),
    results: summary,
  };

  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));

  const lines = [];
  lines.push(`# Status Accuracy Report (${timestamp})`);
  lines.push('');
  lines.push(`Base URL: ${baseUrl}`);
  lines.push(`Providers checked: ${summary.length}`);
  lines.push(`Mismatches: ${report.mismatches.length}`);
  lines.push('');
  report.mismatches.forEach((item) => {
    const flags = [
      item.mismatch.overreported ? 'overreported' : null,
      item.mismatch.underreported ? 'underreported' : null,
      item.mismatch.noEvidence ? 'no-evidence' : null,
      item.errors.length ? `errors:${item.errors.join(',')}` : null,
    ].filter(Boolean);
    lines.push(`- ${item.providerId}: live=${item.liveStatus}, ingested=${item.ingestedStatus} (${flags.join(' | ') || 'ok'})`);
  });
  fs.writeFileSync(path.join(outputDir, 'summary.md'), lines.join('\n'));

  console.log(`Status accuracy report saved to ${outputDir}`);

  if (strict && hasMismatch) {
    console.error('Status accuracy check failed: mismatches detected.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`Status accuracy check failed: ${error.message}`);
  process.exit(1);
});
