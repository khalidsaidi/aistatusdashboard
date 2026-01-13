import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { intelligenceService } from '@/lib/services/intelligence';
import { normalizeIncidentDates } from '@/lib/utils/normalize-dates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const incidents = (await intelligenceService.getIncidents({ limit: 200 })).map(normalizeIncidentDates);

  const lines = incidents.map((incident) =>
    JSON.stringify({
      incident_id: `${incident.providerId}:${incident.id}`,
      provider_id: incident.providerId,
      title: incident.title,
      status: incident.status,
      severity: incident.severity,
      started_at: incident.startedAt,
      updated_at: incident.updatedAt,
      resolved_at: incident.resolvedAt || null,
      impacted_regions: incident.impactedRegions || [],
      impacted_models: incident.impactedModels || [],
      raw_url: incident.rawUrl || null,
      source_id: incident.sourceId,
      service_id: incident.serviceId || null,
      service_name: incident.serviceName || null,
      updates: incident.updates || [],
    })
  );

  const body = lines.join('\n');
  const etag = `"${crypto.createHash('sha256').update(body).digest('hex')}"`;
  const latestUpdatedAt = incidents.reduce((latest, incident) => {
    const value = incident.updatedAt ? new Date(incident.updatedAt).getTime() : 0;
    return Math.max(latest, Number.isNaN(value) ? 0 : value);
  }, 0);
  const lastModified = new Date(latestUpdatedAt || Date.now()).toUTCString();

  const ifNoneMatch = request.headers.get('if-none-match');
  const ifModifiedSince = request.headers.get('if-modified-since');
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Last-Modified': lastModified,
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=120',
      },
    });
  }
  if (ifModifiedSince) {
    const since = new Date(ifModifiedSince).getTime();
    if (!Number.isNaN(since) && since >= latestUpdatedAt) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Last-Modified': lastModified,
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'public, max-age=60, s-maxage=120',
        },
      });
    }
  }

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=120',
      ETag: etag,
      'Last-Modified': lastModified,
    },
  });
}
