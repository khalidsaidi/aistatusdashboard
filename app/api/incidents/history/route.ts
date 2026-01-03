import { NextRequest, NextResponse } from 'next/server';
import { persistenceService } from '@/lib/services/persistence';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const results = await persistenceService.getIncidents({
      providerId: searchParams.get('provider') || undefined,
      limit: parseInt(searchParams.get('limit') || '50')
    });

    // Transform results to match the UI Incident interface
    const incidents = results.map(r => ({
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