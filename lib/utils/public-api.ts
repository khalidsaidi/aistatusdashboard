import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export type EvidenceItem = {
  source_url?: string;
  metric_window?: {
    since: string;
    until: string;
  };
  ids?: string[];
  note?: string;
};

export type ResponseMeta = {
  request_id: string;
  generated_at: string;
  evidence: EvidenceItem[];
  confidence: number;
};

export function buildResponseMeta(options: {
  evidence?: EvidenceItem[];
  confidence?: number;
} = {}): ResponseMeta {
  return {
    request_id: crypto.randomUUID(),
    generated_at: new Date().toISOString(),
    evidence: options.evidence || [],
    confidence: typeof options.confidence === 'number' ? options.confidence : 0.5,
  };
}

export function withResponseMeta<T>(data: T, options?: { evidence?: EvidenceItem[]; confidence?: number }) {
  return {
    ...buildResponseMeta(options),
    data,
  };
}

export function jsonResponse(
  request: NextRequest,
  payload: unknown,
  options: { cacheSeconds?: number; status?: number } = {}
) {
  const body = JSON.stringify(payload);
  const etag = `"${crypto.createHash('sha256').update(body).digest('hex')}"`;
  const cacheSeconds = typeof options.cacheSeconds === 'number' ? options.cacheSeconds : 60;
  const status = typeof options.status === 'number' ? options.status : 200;

  if (status === 200 && request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds * 2}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }

  return new NextResponse(body, {
    status,
    headers: {
      ETag: etag,
      'Cache-Control': `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds * 2}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
