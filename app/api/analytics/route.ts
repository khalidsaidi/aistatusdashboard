import { NextRequest, NextResponse } from 'next/server';
import { globalProviderAnalytics } from '@/lib/provider-analytics';

/**
 * ANALYTICS API ENDPOINT
 * 
 * Provides analytics data and demonstrates the tracking system
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const providerId = searchParams.get('provider');

    // If this is a tracking request, track the interaction
    if (action === 'track' && providerId) {
      await globalProviderAnalytics.trackProviderInteraction({
        providerId,
        action: 'view',
        sessionId: `api-${Date.now()}`,
        timestamp: new Date(),
        metadata: {
          source: 'api',
          userAgent: request.headers.get('user-agent') || 'Unknown'
        }
      });

      return NextResponse.json({
        success: true,
        message: `Tracked interaction for ${providerId}`,
        timestamp: new Date().toISOString()
      });
    }

    // Get analytics data
    const [topProviders, costMetrics, recommendations] = await Promise.all([
      globalProviderAnalytics.getTopProviders(10),
      Promise.resolve(globalProviderAnalytics.getCostMetrics()),
      globalProviderAnalytics.getProviderRecommendations()
    ]);

    return NextResponse.json({
      success: true,
      data: {
        topProviders,
        costMetrics,
        recommendations,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch analytics data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { providerId, action, userId, metadata } = body;

    if (!providerId || !action) {
      return NextResponse.json(
        { success: false, error: 'Provider ID and action are required' },
        { status: 400 }
      );
    }

    // Track the interaction
    await globalProviderAnalytics.trackProviderInteraction({
      providerId,
      action,
      userId,
      sessionId: `api-${Date.now()}`,
      timestamp: new Date(),
      metadata: {
        source: 'api',
        userAgent: request.headers.get('user-agent') || 'Unknown',
        ...metadata
      }
    });

    return NextResponse.json({
      success: true,
      message: `Tracked ${action} for ${providerId}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analytics tracking error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to track interaction',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 