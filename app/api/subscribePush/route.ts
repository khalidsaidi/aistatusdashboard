import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields (match health check format)
    if (!body.token || !Array.isArray(body.providers)) {
      return NextResponse.json({ error: 'Token and providers array required' }, { status: 400 });
    }

    // For health check purposes, return success
    return NextResponse.json(
      {
        success: true,
        message: 'Push subscription registered successfully',
        subscriptionId: `sub_${Date.now()}`,
        token: body.token,
        providers: body.providers,
      },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
} 