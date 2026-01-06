'use client';

import { useEffect, useMemo, useState } from 'react';
import type { StatusHistoryRecord, StatusResult } from '@/lib/types';
import { useRouter, useSearchParams } from 'next/navigation';
import { trackEvent } from '@/lib/utils/analytics-client';
import ClientTimestamp from './ClientTimestamp';

interface ProviderTimelineProps {
  statuses: StatusResult[];
  className?: string;
}

function pickDefaultProvider(statuses: StatusResult[]): string {
  const issue = statuses.find((status) => status.status === 'down') || statuses.find((status) => status.status === 'degraded');
  if (issue) return issue.id;
  return statuses[0]?.id || 'openai';
}

export default function ProviderTimeline({ statuses, className = '' }: ProviderTimelineProps) {
  const [providerId, setProviderId] = useState(() => pickDefaultProvider(statuses));
  const [windowDays, setWindowDays] = useState(7);
  const [records, setRecords] = useState<StatusHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  const providerOptions = useMemo(
    () =>
      statuses.map((status) => ({
        id: status.id,
        name: status.displayName || status.name,
      })),
    [statuses]
  );

  useEffect(() => {
    if (!providerOptions.find((p) => p.id === providerId) && providerOptions.length > 0) {
      setProviderId(providerOptions[0].id);
    }
  }, [providerId, providerOptions]);

  useEffect(() => {
    let active = true;
    const loadTimeline = async () => {
      try {
        setLoading(true);
        setError(null);
        const startDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
        const response = await fetch(
          `/api/intel/incidents?providerId=${providerId}&startDate=${encodeURIComponent(startDate)}&limit=200`
        );
        if (!response.ok) throw new Error('Failed to load history');
        const payload = await response.json();
        if (Array.isArray(payload.incidents) && payload.incidents.length > 0) {
          const incidents = payload.incidents.map((incident: any) => ({
            id: incident.id,
            name: incident.title,
            status: incident.severity || incident.status || 'unknown',
            responseTime: 0,
            lastChecked: incident.startedAt,
            checkedAt: incident.updatedAt || incident.startedAt,
            error: incident.summary || undefined,
            statusPageUrl: incident.rawUrl || undefined,
          })) as StatusHistoryRecord[];
          if (active) setRecords(incidents);
          return;
        }

        const legacyResponse = await fetch(
          `/api/status/history/${providerId}?startDate=${encodeURIComponent(startDate)}&limit=200`
        );
        if (!legacyResponse.ok) throw new Error('Failed to load history');
        const data: StatusHistoryRecord[] = await legacyResponse.json();
        const incidents = data.filter((item) => item.status !== 'operational');
        if (active) setRecords(incidents);
      } catch (err) {
        if (active) {
          setRecords([]);
          setError('Unable to load history.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    loadTimeline();
    trackEvent('timeline_view', { providerId, metadata: { windowDays } });
    return () => {
      active = false;
    };
  }, [providerId, windowDays]);

  const navigateToNotifications = (mode: 'email' | 'webhooks') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'notifications');
    params.set('notify', mode);
    params.set('providers', providerId);
    router.replace(`/?${params.toString()}`, { scroll: false });
  };

  return (
    <div className={`surface-card-strong ${className}`} data-tour="analytics-timeline">
      <div className="p-6 border-b border-slate-200/70 dark:border-slate-700/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Incident history
            </p>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-2">
              Provider timeline
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Recent degradations and outages for each provider.
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

      <div className="p-6 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="w-full lg:w-72 px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-white"
          >
            {providerOptions.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigateToNotifications('email')} className="cta-primary">
              Email alerts
            </button>
            <button onClick={() => navigateToNotifications('webhooks')} className="cta-secondary">
              Webhook alerts
            </button>
            <a
              href={`/rss.xml?provider=${providerId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-secondary"
            >
              RSS feed
            </a>
          </div>
        </div>

        {loading && (
          <div className="text-sm text-slate-500 dark:text-slate-400">Loading incidents...</div>
        )}
        {!loading && error && (
          <div className="text-sm text-rose-600 dark:text-rose-400">{error}</div>
        )}
        {!loading && !error && records.length === 0 && (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            No incidents recorded in the last {windowDays} days.
          </div>
        )}

        <div className="space-y-3">
          {records.map((record) => {
            const statusTone =
              record.status === 'down'
                ? 'text-rose-600 dark:text-rose-400'
                : record.status === 'degraded'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-600 dark:text-slate-400';

            return (
              <div
                key={`${record.id}-${record.checkedAt}`}
                className="surface-card p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {record.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <ClientTimestamp format="datetime" date={new Date(record.checkedAt)} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className={`text-xs uppercase tracking-[0.2em] ${statusTone}`}>
                    {record.status}
                  </span>
                  <span className="text-slate-600 dark:text-slate-300">
                    Response time {record.responseTime}ms
                  </span>
                </div>
                {record.error && (
                  <div className="text-sm text-rose-600 dark:text-rose-400 mt-2">
                    {record.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
