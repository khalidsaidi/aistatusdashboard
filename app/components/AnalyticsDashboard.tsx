'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { AnalyticsOverview, ProviderAnalytics } from '@/lib/types/analytics';

interface AnalyticsDashboardProps {
  className?: string;
}

const WINDOW_DAYS = 7;

export default function AnalyticsDashboard({ className = '' }: AnalyticsDashboardProps) {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [topProviders, setTopProviders] = useState<ProviderAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'providers'>('overview');

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      const [overviewRes, providersRes] = await Promise.all([
        fetch(`/api/analytics/overview?windowDays=${WINDOW_DAYS}`),
        fetch(`/api/analytics/providers?windowDays=${WINDOW_DAYS}&limit=12`),
      ]);

      if (overviewRes.ok) {
        setOverview(await overviewRes.json());
      }
      if (providersRes.ok) {
        setTopProviders(await providersRes.json());
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value: number) => value.toLocaleString('en-US');

  const eventCounts = overview?.eventCounts;
  const totalTracked = overview?.totalEvents || 0;

  const eventMix = useMemo(() => {
    if (!eventCounts) return [];
    const entries = [
      { label: 'Page Views', value: eventCounts.pageViews, color: 'bg-blue-500' },
      { label: 'Provider Clicks', value: eventCounts.providerClicks, color: 'bg-emerald-500' },
      { label: 'Alert Sign-ups', value: eventCounts.subscriptions, color: 'bg-indigo-500' },
      { label: 'Comments', value: eventCounts.comments, color: 'bg-pink-500' },
      { label: 'Exports & Shares', value: eventCounts.exports, color: 'bg-slate-500' },
    ];
    return entries.filter((entry) => entry.value > 0);
  }, [eventCounts]);

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg ${className}`}>
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              📈 Analytics & Engagement
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Public engagement signals from the last {WINDOW_DAYS} days.
            </p>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Last activity:{' '}
            <span className="font-medium text-gray-700 dark:text-gray-200">
              {overview?.lastEventAt
                ? new Date(overview.lastEventAt).toLocaleString()
                : 'No recent activity'}
            </span>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 px-6">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'providers', label: 'Providers' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as 'overview' | 'providers')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6 space-y-6">
        {selectedTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="text-xs uppercase tracking-wide text-blue-500 dark:text-blue-300">
                  Active Sessions
                </div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-200">
                  {formatNumber(overview?.uniqueSessions || 0)}
                </div>
                <div className="text-xs text-blue-500 dark:text-blue-300">Last {WINDOW_DAYS} days</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="text-xs uppercase tracking-wide text-green-500 dark:text-green-300">
                  Engagement Actions
                </div>
                <div
                  className="text-2xl font-bold text-green-700 dark:text-green-200"
                  data-testid="total-interactions"
                >
                  {formatNumber(overview?.totalEvents || 0)}
                </div>
                <div className="text-xs text-green-500 dark:text-green-300">Tracked signals</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <div className="text-xs uppercase tracking-wide text-purple-500 dark:text-purple-300">
                  Provider Clicks
                </div>
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-200">
                  {formatNumber(eventCounts?.providerClicks || 0)}
                </div>
                <div className="text-xs text-purple-500 dark:text-purple-300">Status link taps</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                <div className="text-xs uppercase tracking-wide text-amber-500 dark:text-amber-300">
                  Alert Sign-ups
                </div>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-200">
                  {formatNumber(eventCounts?.subscriptions || 0)}
                </div>
                <div className="text-xs text-amber-500 dark:text-amber-300">Requests started</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Engagement Mix
                </h3>
                {totalTracked === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    No tracked events yet.
                  </div>
                ) : (
                  <>
                    <div className="flex h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      {eventMix.map((entry) => (
                        <div
                          key={entry.label}
                          className={entry.color}
                          style={{ width: `${(entry.value / totalTracked) * 100}%` }}
                          title={`${entry.label}: ${entry.value}`}
                        />
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-400">
                      {eventMix.map((entry) => (
                        <div key={entry.label} className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${entry.color}`} />
                          <span className="flex-1">{entry.label}</span>
                          <span className="font-semibold text-gray-700 dark:text-gray-200">
                            {formatNumber(entry.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Community Pulse
                </h3>
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center justify-between">
                    <span>Comments posted</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {formatNumber(eventCounts?.comments || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Exports & shares</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {formatNumber(eventCounts?.exports || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Page views</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {formatNumber(eventCounts?.pageViews || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {selectedTab === 'providers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Top Providers by Engagement
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Last {WINDOW_DAYS} days
              </span>
            </div>

            {topProviders.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <div className="text-4xl mb-2">📊</div>
                <p>No provider engagement yet</p>
                <p className="text-sm mt-2">Real interactions will show up automatically.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topProviders.map((provider) => (
                  <div
                    key={provider.providerId}
                    data-testid="provider-engagement-item"
                    data-provider={provider.providerId}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {provider.providerName}
                        </h4>
                        <span className="text-xs uppercase tracking-wide text-gray-400">
                          {provider.tier} engagement
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatNumber(provider.totalInteractions)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Total interactions
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Clicks</div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {formatNumber(provider.interactionsByType.clicks)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Subscriptions</div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {formatNumber(provider.interactionsByType.subscriptions)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 dark:text-gray-400">Engagement Score</div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {formatNumber(provider.popularityScore)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
