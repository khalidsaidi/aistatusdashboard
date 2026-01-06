import { NextRequest, NextResponse } from 'next/server';
import { persistenceService } from '@/lib/services/persistence';
import { intelligenceService } from '@/lib/services/intelligence';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const providerId = searchParams.get('provider') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const intelIncidents = await intelligenceService.getIncidents({ providerId, limit });
    const observedIncidents = await persistenceService.getIncidents({
      providerId,
      limit,
    });

    const normalizedIntel = intelIncidents.map((incident) => ({
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
    }));

    const normalizedObserved = observedIncidents.map((record) => ({
      id: `observed-${record.id}-${Math.random().toString(36).slice(2, 6)}`,
      provider: record.name,
      title: `${record.name} is ${record.status}`,
      status: record.status,
      severity: record.status === 'down' || record.status === 'major_outage' ? 'critical' : 'warning',
      startTime: record.lastChecked,
      endTime: undefined,
      impactedComponents: [],
      impactedRegions: [],
      updates: [],
    }));

    const incidents = [...normalizedObserved, ...normalizedIntel]
      .sort((a, b) => {
        const aActive = !a.endTime && a.status !== 'resolved';
        const bActive = !b.endTime && b.status !== 'resolved';
        if (aActive !== bActive) return aActive ? -1 : 1;

        const aTime = new Date(a.endTime || a.startTime).getTime();
        const bTime = new Date(b.endTime || b.startTime).getTime();
        return bTime - aTime;
      })
      .slice(0, limit);

    return NextResponse.json({ incidents });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
