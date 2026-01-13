import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const target = new URL(`/provider/${encodeURIComponent(params.id)}`, request.url);
  return NextResponse.redirect(target, 301);
}
