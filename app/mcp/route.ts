import { NextRequest, NextResponse } from 'next/server';
import { handleMcpRequest, handleMcpStream } from '@/lib/mcp/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function GET(request: NextRequest) {
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/event-stream')) {
    return handleMcpStream(request);
  }
  return NextResponse.json(
    {
      error: 'Unsupported request. Use POST for JSON-RPC or GET with Accept: text/event-stream.',
    },
    { status: 400 }
  );
}
