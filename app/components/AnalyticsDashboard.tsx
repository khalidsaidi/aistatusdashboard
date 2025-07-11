'use client';

import React, { useState, useEffect } from 'react';
import {
  globalProviderAnalytics,
  type ProviderAnalytics,
  type CostMetrics,
} from '@/lib/provider-analytics';

interface AnalyticsDashboardProps {
  className?: string;
}

export default function AnalyticsDashboard({ className = '' }: AnalyticsDashboardProps) {
  const [topProviders, setTopProviders] = useState<ProviderAnalytics[]>([]);
  const [costMetrics, setCostMetrics] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<{
    addProviders: string[];
    removeProviders: string[];
    optimizations: string[];
    reasoning: Record<string, string>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'providers' | 'costs' | 'recommendations'>(
    'providers'
  );

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);

      const [providers, costs, recs] = await Promise.all([
        globalProviderAnalytics.getTopProviders(15),
        Promise.resolve(globalProviderAnalytics.getCostMetrics()),
        globalProviderAnalytics.getProviderRecommendations(),
      ]);

      setTopProviders(providers);
      setCostMetrics(costs);
      setRecommendations(recs);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const trackProviderInteraction = async (
    providerId: string,
    action: 'view' | 'click' | 'bookmark'
  ) => {
    try {
      await globalProviderAnalytics.trackProviderInteraction({
        providerId,
        action,
        sessionId: 'web-session-' + Date.now(),
        timestamp: new Date(),
        metadata: {
          source: 'dashboard',
        },
      });

      // Reload data to show updated metrics
      await loadAnalyticsData();
    } catch (error) {
      console.error('Failed to track interaction:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const getTierColor = (tier: 'high' | 'medium' | 'low') => {
    switch (tier) {
      case 'high':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          📊 Provider Analytics & Cost Monitoring
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Track user engagement and optimize costs based on real usage data
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 px-6">
          {[
            { id: 'providers', label: 'Provider Analytics', icon: '📈' },
            { id: 'costs', label: 'Cost Monitoring', icon: '💰' },
            { id: 'recommendations', label: 'Smart Recommendations', icon: '🎯' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {/* Provider Analytics Tab */}
        {selectedTab === 'providers' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {topProviders.length}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">Active Providers</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {topProviders.reduce((sum, p) => sum + p.totalInteractions, 0)}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">Total Interactions</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {topProviders.filter((p) => p.tier === 'high').length}
                </div>
                <div className="text-sm text-purple-600 dark:text-purple-400">
                  High-Tier Providers
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Top Providers by Engagement
              </h3>

              {topProviders.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">📊</div>
                  <p>No provider analytics data yet</p>
                  <p className="text-sm mt-2">Start interacting with providers to see analytics</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topProviders.map((provider) => (
                    <div
                      key={provider.providerId}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {provider.providerName}
                          </h4>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getTierColor(provider.tier)}`}
                          >
                            {provider.tier.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-gray-900 dark:text-white">
                            {provider.popularityScore}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Popularity Score
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Total Interactions</div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {provider.totalInteractions}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Unique Users</div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {provider.uniqueUsers}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Views</div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {provider.interactionsByType.views}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Subscriptions</div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {provider.interactionsByType.subscriptions}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Cost/Interaction</div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(provider.costMetrics.costPerInteraction)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex space-x-2">
                        <button
                          onClick={() => trackProviderInteraction(provider.providerId, 'view')}
                          className="px-3 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded text-xs"
                        >
                          👀 Track View
                        </button>
                        <button
                          onClick={() => trackProviderInteraction(provider.providerId, 'click')}
                          className="px-3 py-1 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 text-green-700 dark:text-green-300 rounded text-xs"
                        >
                          🖱️ Track Click
                        </button>
                        <button
                          onClick={() => trackProviderInteraction(provider.providerId, 'bookmark')}
                          className="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900 dark:hover:bg-yellow-800 text-yellow-700 dark:text-yellow-300 rounded text-xs"
                        >
                          🔖 Bookmark
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cost Monitoring Tab */}
        {selectedTab === 'costs' && costMetrics && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(costMetrics.currentMonth.estimatedCost)}
                </div>
                <div className="text-sm text-red-600 dark:text-red-400">Current Month</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(costMetrics.projectedMonthlyCost)}
                </div>
                <div className="text-sm text-orange-600 dark:text-orange-400">
                  Projected Monthly
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {costMetrics.currentMonth.firestoreWrites.toLocaleString()}
                </div>
                <div className="text-sm text-blue-600 dark:text-blue-400">Firestore Writes</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(costMetrics.costTrends.dailyAverage)}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">Daily Average</div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Top Cost Providers
              </h3>

              {costMetrics.topCostProviders.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">💰</div>
                  <p>No cost data available yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {costMetrics.topCostProviders.map((provider: any, index: number) => (
                    <div
                      key={provider.providerId}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg font-semibold text-gray-500 dark:text-gray-400">
                            #{index + 1}
                          </span>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {provider.providerId}
                          </h4>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(provider.cost)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Monthly Cost
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Operations</div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {provider.operations.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-500 dark:text-gray-400">Cost Efficiency</div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {formatCurrency(provider.costEfficiency)}/op
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {costMetrics.recommendations.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  💡 Cost Optimization Recommendations
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                  {costMetrics.recommendations.map((rec: string, index: number) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Recommendations Tab */}
        {selectedTab === 'recommendations' && recommendations && (
          <div className="space-y-6">
            {recommendations.removeProviders.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="font-medium text-red-800 dark:text-red-200 mb-3">
                  🚨 Consider Removing These Providers
                </h4>
                <div className="space-y-2">
                  {recommendations.removeProviders.map((providerId) => (
                    <div key={providerId} className="flex items-center justify-between">
                      <span className="font-medium text-red-700 dark:text-red-300">
                        {providerId}
                      </span>
                      <span className="text-sm text-red-600 dark:text-red-400">
                        {recommendations.reasoning[providerId]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recommendations.optimizations.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-3">
                  ⚡ Optimization Opportunities
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-blue-700 dark:text-blue-300">
                  {recommendations.optimizations.map((opt, index) => (
                    <li key={index}>{opt}</li>
                  ))}
                </ul>
              </div>
            )}

            {recommendations.addProviders.length === 0 &&
              recommendations.removeProviders.length === 0 &&
              recommendations.optimizations.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <div className="text-4xl mb-2">🎯</div>
                  <p>No specific recommendations at this time</p>
                  <p className="text-sm mt-2">Your provider setup looks optimized!</p>
                </div>
              )}
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <button
          onClick={loadAnalyticsData}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
        >
          {loading ? '🔄 Loading...' : '🔄 Refresh Analytics'}
        </button>
      </div>
    </div>
  );
}
