import { NextRequest, NextResponse } from 'next/server';
import { intelligenceService } from '@/lib/services/intelligence';
import { normalizeIncidentDates } from '@/lib/utils/normalize-dates';

export const dynamic = 'force-dynamic';

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

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
