import { NextResponse } from 'next/server';
import { insightsService } from '@/lib/services/insights';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('providerId') || 'openai';
    const model = searchParams.get('model') || 'core';
    const endpoint = searchParams.get('endpoint') || 'api';
    const region = searchParams.get('region') || 'global';
    const tier = searchParams.get('tier') || 'unknown';
    const streaming = searchParams.get('streaming') === 'true';
    const windowMinutes = Number(searchParams.get('windowMinutes') || '30');
    const accountId = searchParams.get('accountId') || undefined;

    const data = await insightsService.getCanaryCopilot({
      providerId,
      model,
      endpoint,
      region,
      tier,
      streaming,
      windowMinutes,
      accountId,
    });

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load canary data' }, { status: 500 });
  }
}
