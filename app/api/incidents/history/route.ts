import { NextRequest, NextResponse } from 'next/server';
import { persistenceService } from '@/lib/services/persistence';
import { intelligenceService } from '@/lib/services/intelligence';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const providerId = searchParams.get('provider') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const intelIncidents = await intelligenceService.getIncidents({ providerId, limit });

    const incidents = intelIncidents.length
      ? intelIncidents.map((incident) => ({
          id: incident.id,
          provider: incident.providerId,
          title: incident.title,
          status: incident.status,
          severity: incident.severity || 'warning',
          startTime: incident.startedAt,
          endTime: incident.resolvedAt || undefined,
          impactedComponents: incident.impactedComponents || [],
          impactedRegions: incident.impactedRegions || [],
          updates: incident.updates,
        }))
      : (await persistenceService.getIncidents({
          providerId,
          limit,
        })).map((r) => ({
          id: Math.random().toString(36).substr(2, 9),
          provider: r.name,
          title: `${r.name} is ${r.status}`,
          status: r.status,
          severity: r.status === 'down' ? 'critical' : 'warning',
          startTime: r.lastChecked,
        }));

    return NextResponse.json({ incidents });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
