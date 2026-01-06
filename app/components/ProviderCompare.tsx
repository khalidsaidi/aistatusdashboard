'use client';

import { useEffect, useMemo, useState } from 'react';
import type { StatusResult } from '@/lib/types';
import { trackEvent } from '@/lib/utils/analytics-client';
import ClientTimestamp from './ClientTimestamp';

interface ProviderMetric {
  providerId: string;
  providerName: string;
  totalChecks: number;
  operationalChecks: number;
  degradedChecks: number;
  downChecks: number;
  incidentChecks: number;
  avgResponseTime: number | null;
  uptime: number | null;
  lastIncidentAt: string | null;
}

interface CompareResponse {
  windowDays: number;
  sampleSize: number;
  providers: ProviderMetric[];
  generatedAt: string;
}

interface ProviderCompareProps {
  statuses: StatusResult[];
  className?: string;
}

type SortKey = 'uptime' | 'latency' | 'incidents';

export default function ProviderCompare({ statuses, className = '' }: ProviderCompareProps) {
  const [windowDays, setWindowDays] = useState(7);
  const [metrics, setMetrics] = useState<ProviderMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('uptime');

  useEffect(() => {
    let active = true;
    const loadMetrics = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/status/compare?days=${windowDays}`);
        if (!response.ok) throw new Error('Failed to load compare metrics');
        const data: CompareResponse = await response.json();
        if (active) {
          setMetrics(data.providers || []);
        }
      } catch (error) {
        if (active) {
          setMetrics([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadMetrics();
    trackEvent('compare_window_change', { metadata: { windowDays } });
    return () => {
      active = false;
    };
  }, [windowDays]);

  const rows = useMemo(() => {
    const byId = new Map(metrics.map((entry) => [entry.providerId, entry]));
    return statuses.map((status) => {
      const metric = byId.get(status.id);
      return {
        id: status.id,
        name: status.displayName || status.name,
        status: status.status,
        currentLatency: typeof status.responseTime === 'number' ? status.responseTime : null,
        avgLatency: metric?.avgResponseTime ?? null,
        uptime: metric?.uptime ?? null,
        incidents: metric?.incidentChecks ?? null,
        lastIncidentAt: metric?.lastIncidentAt ?? null,
        sampleSize: metric?.totalChecks ?? 0,
      };
    });
  }, [metrics, statuses]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === 'uptime') {
        const aVal = a.uptime ?? -1;
        const bVal = b.uptime ?? -1;
        return bVal - aVal;
      }
      if (sortKey === 'latency') {
        const aVal = a.avgLatency ?? a.currentLatency ?? Number.POSITIVE_INFINITY;
        const bVal = b.avgLatency ?? b.currentLatency ?? Number.POSITIVE_INFINITY;
        return aVal - bVal;
      }
      const aVal = a.incidents ?? Number.POSITIVE_INFINITY;
      const bVal = b.incidents ?? Number.POSITIVE_INFINITY;
      return aVal - bVal;
    });
    return copy;
  }, [rows, sortKey]);

  return (
    <div className={`surface-card-strong ${className}`} data-tour="analytics-compare">
      <div className="p-6 border-b border-slate-200/70 dark:border-slate-700/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Compare providers
            </p>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-2">
              Reliability benchmark
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Quick decision view: latency, uptime, and incidents.
            </p>
          </div>
          <div className="surface-card p-2 flex items-center gap-2">
            {[7, 30].map((days) => (
              <button
                key={days}
                onClick={() => setWindowDays(days)}
                className={`px-3 py-2 text-xs font-semibold rounded-full transition ${
                  windowDays === days
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {loading
              ? 'Loading metrics...'
              : `Based on ${rows.reduce((acc, row) => acc + row.sampleSize, 0)} checks`}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">Sort by</label>
            <select
              value={sortKey}
              onChange={(e) => {
                const value = e.target.value as SortKey;
                setSortKey(value);
                trackEvent('compare_sort_change', { metadata: { sortKey: value } });
              }}
              className="px-3 py-2 text-xs rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200"
            >
              <option value="uptime">Uptime</option>
              <option value="latency">Latency</option>
              <option value="incidents">Incidents</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-slate-500 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-700/70">
              <tr>
                <th className="text-left py-2 pr-4">Provider</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-left py-2 pr-4">Latency (avg)</th>
                <th className="text-left py-2 pr-4">Uptime</th>
                <th className="text-left py-2 pr-4">Incidents</th>
                <th className="text-left py-2">Last Incident</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-200">
              {sortedRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100/80 dark:border-slate-800/70">
                  <td className="py-3 pr-4 font-medium">{row.name}</td>
                  <td className="py-3 pr-4 capitalize">{row.status}</td>
                  <td className="py-3 pr-4">
                    {row.avgLatency !== null
                      ? `${row.avgLatency}ms`
                      : row.currentLatency
                        ? `${row.currentLatency}ms`
                        : 'N/A'}
                  </td>
                  <td className="py-3 pr-4">{row.uptime !== null ? `${row.uptime}%` : 'N/A'}</td>
                  <td className="py-3 pr-4">{row.incidents ?? 'N/A'}</td>
                  <td className="py-3">
                    {row.lastIncidentAt ? (
                      <ClientTimestamp format="datetime" date={new Date(row.lastIncidentAt)} />
                    ) : (
                      'N/A'
                    )}
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500 dark:text-slate-400">
                    No comparison data available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
