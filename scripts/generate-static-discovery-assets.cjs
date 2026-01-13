/* eslint-disable no-console */
const fs = require('fs/promises');
const path = require('path');

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

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} for ${url}`);
  }
  return res.text();
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
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
