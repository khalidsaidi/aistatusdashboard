import { NextRequest, NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields (match frontend format)
    if (!body.token || !Array.isArray(body.providers)) {
      return NextResponse.json(
        { error: 'Token and providers array required' },
        { status: 400 }
      );
    }
    
    // Transform to Firebase Cloud Function format
    const firebaseBody = {
      endpoint: body.token, // Use token as endpoint for now
      keys: { auth: 'temp', p256dh: 'temp' }, // Placeholder keys
      providers: body.providers
    };
    
    // Forward to Firebase Cloud Function
    const firebaseUrl = getApiUrl('subscribePush');
    
    const response = await fetch(firebaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(firebaseBody),
    });

    const data = await response.json();
    
    return NextResponse.json(data, { 
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
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