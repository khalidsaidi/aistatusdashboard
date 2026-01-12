import { NextRequest, NextResponse } from 'next/server';
import { getIncidentById } from '@/lib/services/public-data';
import crypto from 'crypto';

export async function GET(_request: NextRequest, { params }: { params: { incident_id: string } }) {
  const id = params.incident_id;
  const incident = await getIncidentById(id);
  if (!incident) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const now = new Date().toISOString();
  const evidenceUrls = [`https://aistatusdashboard.com/incidents/${id}`];
  if (incident.rawUrl) evidenceUrls.push(incident.rawUrl);
  const content_hash = crypto.createHash('sha256').update(JSON.stringify(incident)).digest('hex');
  const payload = {
    title: incident.title,
    incident_id: id,
    providers: [incident.providerId],
    impacted: {
      models: incident.impactedModels || [],
      regions: incident.impactedRegions || [],
      endpoints: incident.impactedComponents || [],
    },
    time_window: { started_at: incident.startedAt, observed_at: incident.updatedAt },
    evidence_urls: evidenceUrls,
    source_urls: incident.rawUrl ? [incident.rawUrl] : [],
    generated_at: now,
    content_hash,
  };
  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
