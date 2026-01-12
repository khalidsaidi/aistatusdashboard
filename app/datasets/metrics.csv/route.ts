import { NextResponse } from 'next/server';
import { listProviders } from '@/lib/services/public-data';
import { queryMetricSeries } from '@/lib/services/metrics';

export const dynamic = 'force-dynamic';

const METRIC = 'latency_p95_ms';

export async function GET() {
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

  return new NextResponse(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
