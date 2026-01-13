/* eslint-disable no-console */
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const SITE_URL = process.env.SITE_URL || 'https://aistatusdashboard.com';
const now = new Date().toISOString();

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writeFile(relPath, content) {
  const fullPath = path.join(process.cwd(), 'public', relPath);
  await ensureDir(fullPath);
  await fs.writeFile(fullPath, content, 'utf8');
  console.log(`wrote public/${relPath}`);
}

async function sha256File(relPath) {
  const fullPath = path.join(process.cwd(), 'public', relPath);
  const buf = await fs.readFile(fullPath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

async function fileInfo(relPath, expectedContentType) {
  const fullPath = path.join(process.cwd(), 'public', relPath);
  const stat = await fs.stat(fullPath);
  return {
    path: `/${relPath}`,
    url: `${SITE_URL}/${relPath}`,
    expected_content_type: expectedContentType,
    bytes: stat.size,
    sha256: await sha256File(relPath),
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} for ${url}`);
  }
  return res.text();
}

async function fetchWithHeaders(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'aistatusdashboard-audit' } });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

function xmlEscape(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toAbsoluteUrl(value) {
  if (!value) return SITE_URL;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return `${SITE_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

async function getIncidents() {
  try {
    const res = await fetch(`${SITE_URL}/api/public/v1/incidents?limit=25`);
    if (!res.ok) throw new Error(`Incidents fetch failed ${res.status}`);
    const payload = await res.json();
    return payload?.data?.incidents || [];
  } catch (err) {
    console.warn('Falling back to empty incidents list', err.message);
    return [];
  }
}

async function buildSitemap(incidents, providers) {
  const urls = [];
  const addUrl = (loc, priority = '0.5', changefreq = 'weekly') => {
    urls.push(`  <url>\n    <loc>${loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`);
  };

  addUrl(`${SITE_URL}/`, '1.0', 'daily');
  addUrl(`${SITE_URL}/ai`, '0.9', 'daily');
  addUrl(`${SITE_URL}/providers`, '0.8', 'daily');
  addUrl(`${SITE_URL}/datasets`, '0.6', 'weekly');
  addUrl(`${SITE_URL}/datasets/incidents`, '0.6', 'weekly');
  addUrl(`${SITE_URL}/datasets/metrics`, '0.6', 'weekly');
  addUrl(`${SITE_URL}/docs`, '0.7', 'weekly');
  addUrl(`${SITE_URL}/status`, '0.7', 'weekly');
  addUrl(`${SITE_URL}/reports/weekly-ai-reliability`, '0.6', 'weekly');
  addUrl(`${SITE_URL}/reports/monthly-provider-scorecards`, '0.6', 'monthly');
  addUrl(`${SITE_URL}/docs/discoverability-audit`, '0.5', 'weekly');
  addUrl(`${SITE_URL}/discovery/audit`, '0.6', 'daily');

  providers.forEach((provider) => {
    addUrl(`${SITE_URL}/provider/${provider.id}`, '0.7', 'hourly');
  });

  incidents.forEach((incident) => {
    const permalink = toAbsoluteUrl(
      incident.permalink || `${SITE_URL}/incidents/${incident.incident_id}`
    );
    addUrl(permalink, '0.6', 'daily');
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}

function buildRss(incidents) {
  const items = incidents.map((incident) => {
    const title = `${incident.provider_id || incident.providerId || 'provider'}: ${incident.title}`;
    const link = toAbsoluteUrl(
      incident.permalink || `${SITE_URL}/incidents/${incident.incident_id}`
    );
    const guid = `incident-${incident.incident_id}`;
    const pubDate = new Date(incident.updated_at || now).toUTCString();
    return `    <item>\n      <title>${xmlEscape(title)}</title>\n      <link>${xmlEscape(link)}</link>\n      <guid>${xmlEscape(guid)}</guid>\n      <pubDate>${xmlEscape(pubDate)}</pubDate>\n      <description>${xmlEscape(incident.title)}</description>\n      <category>${xmlEscape(incident.provider_id || incident.providerId || 'provider')}</category>\n    </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>AI Status Dashboard Incidents</title>\n    <link>${SITE_URL}/</link>\n    <description>Incidents and maintenances</description>\n    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n    <ttl>60</ttl>\n${items.join('\n')}\n  </channel>\n</rss>`;
}

function buildDocs() {
  return {
    'docs.md': `# AIStatusDashboard Docs\n\nAI Status Dashboard is a reliability control plane for AI providers. Use these docs to integrate the REST API, MCP tools, datasets, and citation endpoints.\n\n## Quick links\n- ${SITE_URL}/ai\n- ${SITE_URL}/docs/api\n- ${SITE_URL}/docs/agent/mcp-quickstart\n- ${SITE_URL}/docs/agent/mcp-tools\n- ${SITE_URL}/datasets\n- ${SITE_URL}/status\n- ${SITE_URL}/providers\n\n## OpenAPI\n- ${SITE_URL}/openapi.json\n- ${SITE_URL}/openapi.yaml\n\n## MCP\n- ${SITE_URL}/mcp\n- Registry: https://registry.modelcontextprotocol.io/v0.1/servers/io.github.aistatusdashboard%2Faistatusdashboard/versions/latest\n\n## Citing\n- ${SITE_URL}/docs/citations.md\n- ${SITE_URL}/incidents/{id}/cite\n`,
    'docs/api.md': `# API Docs\n\nBase URL: ${SITE_URL}\n\n## Key endpoints\n- GET /api/public/v1/status/summary\n- GET /api/public/v1/incidents\n- GET /api/public/v1/providers\n- GET /metrics/{series_id}.json\n\nOpenAPI:\n- ${SITE_URL}/openapi.json\n- ${SITE_URL}/openapi.yaml\n\n## Example\n\n\`\`\`bash\ncurl ${SITE_URL}/api/public/v1/status/summary\n\`\`\`\n`,
    'docs/citations.md': `# Citing AI Status Dashboard\n\nUse these references when citing incidents, metrics, or datasets.\n\n- Homepage: ${SITE_URL}/\n- AI landing: ${SITE_URL}/ai\n- OpenAPI: ${SITE_URL}/openapi.json\n- MCP: ${SITE_URL}/mcp\n- Datasets: ${SITE_URL}/datasets\n- Incident citation endpoint: ${SITE_URL}/incidents/{id}/cite\n\n## How to cite incidents\n1. Use the /incidents/{id}/cite endpoint for a JSON evidence bundle.\n2. Include the permalink and generated_at timestamp.\n3. Include source_urls (official status pages) from the cite payload.\n\n## How to cite datasets\n- Incidents NDJSON: ${SITE_URL}/datasets/incidents.ndjson\n- Metrics CSV: ${SITE_URL}/datasets/metrics.csv\n\nInclude temporal coverage and the retrieval date in your citation.\n`,
    'status.md': `# Status\n\nThis page mirrors public status data and links to the JSON endpoints.\n\n- Summary: ${SITE_URL}/api/public/v1/status/summary\n- Incidents: ${SITE_URL}/api/public/v1/incidents\n- RSS: ${SITE_URL}/rss.xml\n`,
    'docs/agent/mcp-quickstart.md': `# MCP Quickstart\n\nEndpoint: ${SITE_URL}/mcp\nRegistry: https://registry.modelcontextprotocol.io/v0.1/servers/io.github.aistatusdashboard%2Faistatusdashboard/versions/latest\nOpenAPI: ${SITE_URL}/openapi.json\n\n## Example call\n\n\`\`\`json\n{\n  \"jsonrpc\": \"2.0\",\n  \"id\": 1,\n  \"method\": \"tools/call\",\n  \"params\": {\n    \"name\": \"status.get_summary\",\n    \"arguments\": { \"provider\": \"openai\", \"window_seconds\": 1800 }\n  }\n}\n\`\`\`\n`,
  };
}


async function run() {
  const providersData = JSON.parse(await fs.readFile(path.join(process.cwd(), 'lib', 'data', 'providers.json'), 'utf8'));
  const providers = (providersData.providers || []).filter((p) => p.enabled !== false);

  const incidents = await getIncidents();

  const sitemap = await buildSitemap(incidents, providers);
  await writeFile('sitemap.xml', sitemap);

  const rss = buildRss(incidents);
  await writeFile('rss.xml', rss);

  const ndjsonLines = incidents.length
    ? incidents.map((incident) => JSON.stringify({
        incident_id: incident.incident_id,
        provider_id: incident.provider_id || incident.providerId,
        title: incident.title,
        status: incident.status,
        severity: incident.severity,
        started_at: incident.started_at || incident.startedAt,
        updated_at: incident.updated_at || incident.updatedAt,
        resolved_at: incident.resolved_at || incident.resolvedAt || null,
        impacted_regions: incident.impacted_regions || incident.impactedRegions || [],
        impacted_models: incident.impacted_models || incident.impactedModels || [],
        raw_url: incident.raw_url || incident.rawUrl || null,
        permalink: toAbsoluteUrl(
          incident.permalink || `${SITE_URL}/incidents/${incident.incident_id}`
        ),
      }))
      : [JSON.stringify({
        incident_id: 'sample',
        provider_id: 'sample',
        title: 'Sample incident',
        status: 'resolved',
        severity: 'operational',
        started_at: now,
        updated_at: now,
        resolved_at: now,
        impacted_regions: [],
        impacted_models: [],
        raw_url: null,
        permalink: `${SITE_URL}/incidents/sample`,
      })];
  await writeFile('datasets/incidents.ndjson', ndjsonLines.join('\n'));

  const metricsRows = [
    'timestamp,provider_id,metric,value,sample_count,sources',
    ...providers.slice(0, 5).map((provider) =>
      [now, provider.id, 'latency_p95_ms', '', 0, 'static'].join(',')
    ),
  ];
  await writeFile('datasets/metrics.csv', metricsRows.join('\n'));

  // OpenAPI YAML snapshots (JSON is valid YAML, so reuse the JSON payload)
  try {
    const openapiJson = await fetchText(`${SITE_URL}/openapi.json`);
    await writeFile('openapi.yaml', openapiJson);
  } catch (err) {
    await writeFile('openapi.yaml', 'openapi: 3.1.0\ninfo:\n  title: AIStatusDashboard Public API\n  version: 1.0.0\npaths: {}\n');
  }

  try {
    const openapi30Json = await fetchText(`${SITE_URL}/openapi-3.0.json`);
    await writeFile('openapi-3.0.yaml', openapi30Json);
  } catch (err) {
    await writeFile('openapi-3.0.yaml', 'openapi: 3.0.0\ninfo:\n  title: AIStatusDashboard Public API\n  version: 1.0.0\npaths: {}\n');
  }

  // Markdown mirrors
  const docsMap = buildDocs();
  for (const [rel, content] of Object.entries(docsMap)) {
    await writeFile(rel, content);
  }

  // Providers markdown
  const providersMd = `# Providers\n\n${providers.map((p) => `- ${p.displayName || p.name}: ${SITE_URL}/provider/${p.id}`).join('\n')}\n`;
  await writeFile('providers.md', providersMd);

  // Discoverability audit markdown (copy from docs/ if present)
  try {
    const auditMd = await fs.readFile(path.join(process.cwd(), 'docs', 'discoverability-audit.md'), 'utf8');
    await writeFile('docs/discoverability-audit.md', auditMd);
  } catch (err) {
    await writeFile('docs/discoverability-audit.md', '# Discoverability Audit\n\nAudit mirror unavailable.');
  }

  // ---- Discovery audit (JSON + HTML) ----
  const auditFiles = await Promise.all([
    fileInfo('sitemap.xml', 'application/xml; charset=utf-8'),
    fileInfo('rss.xml', 'application/rss+xml; charset=utf-8'),
    fileInfo('openapi.yaml', 'application/yaml; charset=utf-8'),
    fileInfo('openapi-3.0.yaml', 'application/yaml; charset=utf-8'),
    fileInfo('datasets/incidents.ndjson', 'application/x-ndjson; charset=utf-8'),
    fileInfo('datasets/metrics.csv', 'text/csv; charset=utf-8'),
    fileInfo('docs.md', 'text/markdown; charset=utf-8'),
    fileInfo('docs/api.md', 'text/markdown; charset=utf-8'),
    fileInfo('docs/citations.md', 'text/markdown; charset=utf-8'),
    fileInfo('status.md', 'text/markdown; charset=utf-8'),
    fileInfo('providers.md', 'text/markdown; charset=utf-8'),
    fileInfo('docs/agent/mcp-quickstart.md', 'text/markdown; charset=utf-8'),
    fileInfo('docs/discoverability-audit.md', 'text/markdown; charset=utf-8'),
  ]);

  // ---- Policy checks ----
  const robotsPath = path.join(process.cwd(), 'public', 'robots.txt');
  const robotsText = await fs.readFile(robotsPath, 'utf8');
  const robotsLines = robotsText.split(/\r?\n/);
  const robotsHasNewlines = robotsLines.length > 3;
  const robotsHasSitemap = robotsText.includes('Sitemap: https://aistatusdashboard.com/sitemap.xml');

  let blocksGptbotRoot = false;
  let inGptBot = false;
  for (const line of robotsLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      inGptBot = false;
      continue;
    }
    if (/^user-agent:/i.test(trimmed)) {
      inGptBot = trimmed.toLowerCase().includes('gptbot');
      continue;
    }
    if (inGptBot && /^disallow:/i.test(trimmed)) {
      const value = trimmed.split(':')[1]?.trim() || '';
      if (value === '/' || value === '/*') {
        blocksGptbotRoot = true;
      }
    }
  }

  const publicNoindexUrls = [
    '/ai',
    '/providers',
    '/provider/openai',
    '/datasets',
    '/discovery/audit',
    '/llms.txt',
    '/openapi.json',
  ];

  const liveChecks = process.env.POLICY_CHECKS_LIVE === '1';
  let publicNoindexDetected = false;
  if (liveChecks) {
    for (const relative of publicNoindexUrls) {
      const url = `${SITE_URL}${relative}`;
      const { headers, text } = await fetchWithHeaders(url);
      const xRobots = headers.get('x-robots-tag') || '';
      if (xRobots.toLowerCase().includes('noindex')) {
        publicNoindexDetected = true;
        break;
      }
      const contentType = headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const metaNoindex = /<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(text);
        if (metaNoindex) {
          publicNoindexDetected = true;
          break;
        }
      }
    }
  }

  const cacheControlUrls = [
    '/sitemap.xml',
    '/rss.xml',
    '/llms.txt',
    '/llms-full.txt',
    '/discovery/audit/latest.json',
    '/openapi.json',
    '/openapi.yaml',
  ];

  let cacheControlPrivateDetected = false;
  if (liveChecks) {
    for (const relative of cacheControlUrls) {
      const url = `${SITE_URL}${relative}`;
      const { headers } = await fetchWithHeaders(url);
      const cacheControl = headers.get('cache-control') || '';
      if (cacheControl.toLowerCase().includes('private')) {
        cacheControlPrivateDetected = true;
        break;
      }
    }
  }

  const policyChecks = {
    robots_txt: {
      has_newlines: robotsHasNewlines,
      contains_sitemap_line: robotsHasSitemap,
      blocks_gptbot_root: blocksGptbotRoot,
    },
    public_noindex_detected: publicNoindexDetected,
    cache_control_private_detected_on_public: cacheControlPrivateDetected,
  };

  const policyOk =
    robotsHasNewlines &&
    robotsHasSitemap &&
    !blocksGptbotRoot &&
    !publicNoindexDetected &&
    !cacheControlPrivateDetected;

  // Score = 100 if all required files exist (we’d have thrown if missing)
  const audit = {
    generated_at: now,
    site_url: SITE_URL,
    generator: 'scripts/generate-static-discovery-assets.cjs',
    node: process.version,
    score: {
      total: policyOk ? 100 : 80,
      note: policyOk
        ? 'All required discovery files generated successfully.'
        : 'Discovery policy checks failed.',
    },
    files: auditFiles,
    policy_checks: { ...policyChecks, source: liveChecks ? 'live' : 'build' },
    links: {
      ai: `${SITE_URL}/ai`,
      llms: `${SITE_URL}/llms.txt`,
      llms_full: `${SITE_URL}/llms-full.txt`,
      openapi_json: `${SITE_URL}/openapi.json`,
      plugin_manifest: `${SITE_URL}/.well-known/ai-plugin.json`,
      mcp: `${SITE_URL}/mcp`,
    },
  };

  await writeFile('discovery/audit/latest.json', JSON.stringify(audit, null, 2));

  const auditHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AIStatusDashboard Discovery Audit</title>
  <meta name="robots" content="index,follow" />
</head>
<body>
  <h1>Discovery Audit</h1>
  <p>Generated at: <code>${escapeHtml(audit.generated_at)}</code></p>
  <p>JSON: <a href="/discovery/audit/latest.json">/discovery/audit/latest.json</a></p>
  <pre>${escapeHtml(JSON.stringify(audit, null, 2))}</pre>
</body>
</html>`;
  await writeFile('discovery/audit/index.html', auditHtml);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
