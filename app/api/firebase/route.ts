import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize Firebase Admin only once
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    // Firebase Admin initialization error
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, title, body: messageBody, data } = body;
    
    if (!token || !title || !messageBody) {
      return NextResponse.json(
        { error: 'Missing required fields: token, title, body' },
        { status: 400 }
      );
    }

    if (!process.env.FIREBASE_PROJECT_ID) {
      return NextResponse.json(
        { error: 'Firebase not configured' },
        { status: 503 }
      );
    }

    const messaging = getMessaging();
    
    const message = {
      token,
      notification: {
        title,
        body: messageBody,
      },
      data: {
        timestamp: Date.now().toString(),
        source: 'ai-status-dashboard',
        ...data
      },
      webpush: {
        headers: {
          'TTL': '86400' // 24 hours
        },
        notification: {
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          requireInteraction: true
        }
      }
    };

    const response = await messaging.send(message);
    
    return NextResponse.json({ 
      success: true, 
      messageId: response 
    });
  } catch (error) {
    // Error sending Firebase message
    return NextResponse.json(
      { 
        error: 'Failed to send Firebase message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 