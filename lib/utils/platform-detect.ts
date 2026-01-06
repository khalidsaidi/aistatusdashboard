import type { PlatformType } from '@/lib/types/ingestion';

async function fetchJson(url: string) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AI-Status-Dashboard/1.0' },
      cache: 'no-store',
    });
    if (!response.ok) return { ok: false, status: response.status, json: null as any };
    const json = await response.json().catch(() => null);
    return { ok: Boolean(json), status: response.status, json };
  } catch (error) {
    return { ok: false, status: 0, json: null as any };
  }
}

async function fetchHtml(url: string) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AI-Status-Dashboard/1.0' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    return null;
  }
}

export function extractStatusIoPageId(html: string): string | null {
  const patterns = [
    /page_id\s*[:=]\s*['"]([a-zA-Z0-9]+)['"]/i,
    /statusio_page_id\s*[:=]\s*['"]([a-zA-Z0-9]+)['"]/i,
    /data-page-id=['"]([a-zA-Z0-9]+)['"]/i,
    /status\.io\/pages\/([a-zA-Z0-9]+)/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export async function detectPlatform(baseUrl: string): Promise<{
  platform: PlatformType;
  detectedUrl?: string;
  statusIoPageId?: string;
}> {
  const normalizedBase = baseUrl.replace(/\/$/, '');

  const statuspageProbe = await fetchJson(`${normalizedBase}/api/v2/status.json`);
  if (statuspageProbe.ok && (statuspageProbe.json?.status || statuspageProbe.json?.page)) {
    return { platform: 'statuspage', detectedUrl: `${normalizedBase}/api/v2/status.json` };
  }

  const instatusProbe = await fetchJson(`${normalizedBase}/summary.json`);
  if (
    instatusProbe.ok &&
    (instatusProbe.json?.page || instatusProbe.json?.components || instatusProbe.json?.status)
  ) {
    return { platform: 'instatus', detectedUrl: `${normalizedBase}/summary.json` };
  }

  const cachetProbe = await fetchJson(`${normalizedBase}/api/v1/components`);
  if (cachetProbe.ok && cachetProbe.json?.meta && Array.isArray(cachetProbe.json?.data)) {
    return { platform: 'cachet', detectedUrl: `${normalizedBase}/api/v1/components` };
  }

  const betterstackProbe = await fetchJson(`${normalizedBase}/index.json`);
  if (
    betterstackProbe.ok &&
    (betterstackProbe.json?.data?.type === 'status_page' ||
      betterstackProbe.json?.data?.attributes?.aggregate_state)
  ) {
    return { platform: 'betterstack', detectedUrl: `${normalizedBase}/index.json` };
  }

  const html = await fetchHtml(normalizedBase);
  if (html) {
    const lower = html.toLowerCase();
    if (lower.includes('statuspage') || lower.includes('statuspage.io')) {
      return { platform: 'statuspage' };
    }
    if (lower.includes('instatus')) {
      return { platform: 'instatus' };
    }
    if (lower.includes('betterstack') || lower.includes('status.betterstack')) {
      return { platform: 'betterstack' };
    }
    if (lower.includes('status.io') || lower.includes('statusio')) {
      const pageId = extractStatusIoPageId(html) || undefined;
      return { platform: 'statusio', statusIoPageId: pageId };
    }
    if (lower.includes('cachet')) {
      return { platform: 'cachet' };
    }
  }

  return { platform: 'html' };
}
