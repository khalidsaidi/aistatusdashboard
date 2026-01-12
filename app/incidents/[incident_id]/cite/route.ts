import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest, { params }: { params: { incident_id: string } }) {
  const id = params.incident_id;
  const now = new Date().toISOString();
  const payload = {
    title: `Incident ${id}`,
    incident_id: id,
    providers: [],
    impacted: { models: [], regions: [], endpoints: [] },
    time_window: { started_at: now, observed_at: now },
    evidence_urls: [`https://aistatusdashboard.com/incidents/${id}`],
    source_urls: ['https://status.openai.com'],
    generated_at: now,
    content_hash: '',
  };
  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=600',
    },
  });
}
