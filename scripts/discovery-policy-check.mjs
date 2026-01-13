#!/usr/bin/env node
import process from 'node:process';

const base = process.env.BASE_URL || 'https://aistatusdashboard.com';

async function fetchText(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  return { res, text };
}

function fail(errors) {
  console.error('Discovery policy check failed:');
  errors.forEach((err) => console.error(`- ${err}`));
  process.exit(1);
}

async function run() {
  const errors = [];
  const robotsUrl = `${base}/robots.txt`;
  const { res: robotsRes, text: robotsText } = await fetchText(robotsUrl);
  if (robotsRes.status !== 200) {
    errors.push(`robots.txt status ${robotsRes.status}`);
  }
  const robotsLines = robotsText.split(/\r?\n/);
  if (robotsLines.length < 3) {
    errors.push('robots.txt missing newlines');
  }
  if (!robotsText.includes('Sitemap: https://aistatusdashboard.com/sitemap.xml')) {
    errors.push('robots.txt missing sitemap line');
  }

  let inGpt = false;
  let gptBlocked = false;
  for (const line of robotsLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      inGpt = false;
      continue;
    }
    if (/^user-agent:/i.test(trimmed)) {
      inGpt = trimmed.toLowerCase().includes('gptbot');
      continue;
    }
    if (inGpt && /^disallow:/i.test(trimmed)) {
      const value = trimmed.split(':')[1]?.trim() || '';
      if (value === '/' || value === '/*') {
        gptBlocked = true;
      }
    }
  }
  if (gptBlocked) {
    errors.push('robots.txt blocks GPTBot at root');
  }

  const privateDisallows = ['/app/', '/account/', '/org/', '/billing/', '/api/private/'];
  for (const path of privateDisallows) {
    if (!robotsText.includes(`Disallow: ${path}`)) {
      errors.push(`robots.txt missing Disallow for ${path}`);
    }
  }

  const publicUrls = [
    '/ai',
    '/providers',
    '/provider/openai',
    '/datasets',
    '/discovery/audit',
    '/llms.txt',
    '/openapi.json',
  ];

  for (const path of publicUrls) {
    const url = `${base}${path}`;
    const { res, text } = await fetchText(url, {
      headers: { 'User-Agent': 'aistatusdashboard-policy-check' },
    });
    if (res.status !== 200) {
      errors.push(`${path} status ${res.status}`);
      continue;
    }
    const xRobots = res.headers.get('x-robots-tag') || '';
    if (!xRobots.toLowerCase().includes('index')) {
      errors.push(`${path} missing X-Robots-Tag index,follow`);
    }
    if (xRobots.toLowerCase().includes('noindex')) {
      errors.push(`${path} has noindex X-Robots-Tag`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const metaNoindex = /<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(text);
      if (metaNoindex) {
        errors.push(`${path} contains meta noindex`);
      }
    }
  }

  const privateUrl = `${base}/app`;
  const privateRes = await fetch(privateUrl, { headers: { 'User-Agent': 'aistatusdashboard-policy-check' } });
  const privateTag = privateRes.headers.get('x-robots-tag') || '';
  if (!privateTag.toLowerCase().includes('noindex')) {
    errors.push('/app missing X-Robots-Tag noindex');
  }

  const cacheTargets = [
    { path: '/sitemap.xml', expectsPublic: true },
    { path: '/rss.xml', expectsPublic: true },
    { path: '/llms.txt', expectsPublic: true },
    { path: '/llms-full.txt', expectsPublic: true },
    { path: '/discovery/audit/latest.json', expectsPublic: true },
    { path: '/openapi.json', expectsPublic: true },
    { path: '/openapi.yaml', expectsPublic: true },
  ];

  for (const target of cacheTargets) {
    const url = `${base}${target.path}`;
    const res = await fetch(url, { method: 'HEAD' });
    if (res.status !== 200) {
      errors.push(`${target.path} status ${res.status}`);
      continue;
    }
    const cacheControl = (res.headers.get('cache-control') || '').toLowerCase();
    if (cacheControl.includes('private')) {
      errors.push(`${target.path} cache-control contains private`);
    }
    if (target.expectsPublic && !cacheControl.includes('public')) {
      errors.push(`${target.path} cache-control missing public`);
    }
  }

  if (errors.length > 0) {
    fail(errors);
  }

  console.log('Discovery policy check passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
