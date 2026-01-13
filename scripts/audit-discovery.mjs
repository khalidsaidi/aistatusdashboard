#!/usr/bin/env node
import fs from 'node:fs';

const baseUrl = process.env.BASE_URL || 'https://aistatusdashboard.com';
const label = process.env.AUDIT_LABEL || 'Audit';
const outputFile = process.env.OUT_FILE || '';
const allowFailures = process.env.ALLOW_FAILURES === '1';

const urls = [
  `${baseUrl}/sitemap.xml`,
  `${baseUrl}/rss.xml`,
  `${baseUrl}/rss.xml?provider=openai`,
  `${baseUrl}/provider/openai`,
  `${baseUrl}/provider/anthropic`,
  `${baseUrl}/provider/google-ai`,
  `${baseUrl}/provider/mistral`,
  `${baseUrl}/datasets/incidents.ndjson`,
  `${baseUrl}/datasets/metrics.csv`,
  `${baseUrl}/openapi.yaml`,
  `${baseUrl}/openapi-3.0.yaml`,
  `${baseUrl}/docs.md`,
  `${baseUrl}/status.md`,
  `${baseUrl}/providers.md`,
  `${baseUrl}/api/health`,
];

const sanitizeSnippet = (text) =>
  text.replace(/\s+/g, ' ').trim().slice(0, 200);

async function fetchWith(method, url) {
  const res = await fetch(url, { method, redirect: 'follow' });
  const headers = {
    'content-type': res.headers.get('content-type') || '-',
    'cache-control': res.headers.get('cache-control') || '-',
  };
  return { status: res.status, headers, res };
}

async function run() {
  const rows = [];
  let failures = 0;

  for (const url of urls) {
    const head = await fetchWith('HEAD', url);
    const get = await fetchWith('GET', url);
    const body = await get.res.text();
    const bytes = Buffer.byteLength(body, 'utf8');
    const snippet = sanitizeSnippet(body);

    if (head.status !== 200 || get.status !== 200) failures += 1;

    rows.push({
      url,
      headStatus: head.status,
      getStatus: get.status,
      contentType: get.headers['content-type'],
      cacheControl: get.headers['cache-control'],
      bytes,
      snippet,
    });
  }

  const lines = [];
  lines.push(`## ${label}`);
  lines.push('');
  lines.push('| URL | HEAD | GET | Content-Type | Cache-Control | Bytes | Snippet |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  rows.forEach((row) => {
    lines.push(
      `| ${row.url} | ${row.headStatus} | ${row.getStatus} | ${row.contentType} | ${row.cacheControl} | ${row.bytes} | ${row.snippet.replace(/\|/g, '\\|')} |`
    );
  });
  lines.push('');

  const output = lines.join('\n');

  if (outputFile) {
    fs.writeFileSync(outputFile, output, 'utf8');
  } else {
    process.stdout.write(output);
  }

  if (failures > 0 && !allowFailures) {
    console.error(`audit-discovery failed: ${failures} non-200 responses`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
