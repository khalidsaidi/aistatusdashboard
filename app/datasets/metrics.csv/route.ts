import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { listProviders } from '@/lib/services/public-data';
import { queryMetricSeries } from '@/lib/services/metrics';

export const dynamic = 'force-dynamic';

const METRIC = 'latency_p95_ms';

export async function GET(request: NextRequest) {
  const providers = listProviders().slice(0, 6);
  const until = new Date();
  const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);

  const rows: string[] = [
    'timestamp,provider_id,metric,value,sample_count,sources',
  ];

  for (const provider of providers) {
    const series = await queryMetricSeries({
      metric: METRIC,
      providerId: provider.id,
      since,
      until,
      granularitySeconds: 3600,
    });

    series.series.forEach((point) => {
      rows.push(
        [
          point.timestamp,
          provider.id,
          METRIC,
          point.value === null ? '' : point.value,
          point.sample_count,
          point.sources.join('|'),
        ].join(',')
      );
    });
  }

  const body = rows.join('\n');
  const etag = `"${crypto.createHash('sha256').update(body).digest('hex')}"`;
  const lastModified = until.toUTCString();

  const ifNoneMatch = request.headers.get('if-none-match');
  const ifModifiedSince = request.headers.get('if-modified-since');
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Last-Modified': lastModified,
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=120',
      },
    });
  }
  if (ifModifiedSince) {
    const sinceValue = new Date(ifModifiedSince).getTime();
    if (!Number.isNaN(sinceValue) && sinceValue >= until.getTime()) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Last-Modified': lastModified,
          'Content-Type': 'text/csv; charset=utf-8',
          'Cache-Control': 'public, max-age=60, s-maxage=120',
        },
      });
    }
  }

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=120',
      ETag: etag,
      'Last-Modified': lastModified,
    },
  });
}
