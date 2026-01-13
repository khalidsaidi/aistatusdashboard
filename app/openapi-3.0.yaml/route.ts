import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { buildOpenApiSpec } from '@/lib/openapi';
import { toYaml } from '@/lib/utils/yaml';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const spec = buildOpenApiSpec('3.0.0');
    const yaml = toYaml(spec);
    const etag = `"${crypto.createHash('sha256').update(yaml).digest('hex')}"`;

    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'public, max-age=600, s-maxage=1200',
          'Content-Type': 'application/yaml; charset=utf-8',
        },
      });
    }

    return new NextResponse(yaml, {
      headers: {
        ETag: etag,
        'Cache-Control': 'public, max-age=600, s-maxage=1200',
        'Content-Type': 'application/yaml; charset=utf-8',
      },
    });
  } catch (error) {
    const fallback = `openapi: 3.0.0\ninfo:\n  title: AIStatusDashboard Public API\n  version: 1.0.0\npaths: {}`;
    return new NextResponse(fallback, {
      headers: {
        'Content-Type': 'application/yaml; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=120',
        'X-OpenAPI-Status': 'fallback',
      },
    });
  }
}
