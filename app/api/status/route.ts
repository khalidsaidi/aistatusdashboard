import { NextRequest, NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const firebaseUrl = getApiUrl('status');

    const response = await fetch(firebaseUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    // Log error internally but don't expose details
    return NextResponse.json(
      { error: 'Failed to proxy request to Firebase Functions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const firebaseUrl = getApiUrl('status');

    const response = await fetch(firebaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
    // Log error internally but don't expose details
    return NextResponse.json(
      { error: 'Failed to proxy request to Firebase Functions' },
      { status: 500 }
    );
  }
}
