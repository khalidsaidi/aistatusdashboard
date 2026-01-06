import { NextRequest, NextResponse } from 'next/server';
import { intelligenceService } from '@/lib/services/intelligence';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Provider id is required' }, { status: 400 });
  }
  const detail = await intelligenceService.getProviderDetail(id);
  return NextResponse.json(detail);
}
