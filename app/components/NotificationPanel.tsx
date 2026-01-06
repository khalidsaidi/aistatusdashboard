'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { providerService } from '@/lib/services/providers';
import { getAnalyticsSessionId } from '@/lib/utils/analytics-client';
import { useSearchParams } from 'next/navigation';
import ClientTimestamp from './ClientTimestamp';
import { useToast } from './ToastProvider';

interface Incident {
  id: string;
  provider: string;
  title: string;
  status: string;
  severity: string;
  startTime: string;
  endTime?: string;
  impactedComponents?: string[];
  impactedRegions?: string[];
  updates?: Array<{ id: string; status: string; body: string; createdAt: string }>;
}

interface Maintenance {
  id: string;
  provider: string;
  title: string;
  status: string;
  scheduledFor: string;
  completedAt?: string;
}

export default function NotificationPanel() {
  const [activeTab, setActiveTab] = useState('email');
  const [email, setEmail] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const { showSuccess, showError } = useToast();

  const fetchIncidents = useCallback(async () => {
    try {
      // Prefer Next route handler, but fall back to Firebase Functions/Express endpoint if deployed there
      let response = await fetch('/api/incidents/history');
      if (response.status === 404) {
        response = await fetch('/api/incidents');
      }
      if (response.ok) {
        const data = await response.json();
        setIncidents(data.incidents || []);
      }
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
    }
  }, []);

  const fetchMaintenances = useCallback(async () => {
    try {
      const response = await fetch('/api/intel/maintenances?limit=50');
      if (response.ok) {
        const data = await response.json();
        const formatted = Array.isArray(data.maintenances)
          ? data.maintenances.map((maintenance: any) => ({
              id: maintenance.id,
              provider: maintenance.providerId || maintenance.provider || '',
              title: maintenance.title || 'Maintenance',
              status: maintenance.status || 'scheduled',
              scheduledFor: maintenance.scheduledFor || maintenance.updatedAt,
              completedAt: maintenance.completedAt,
            }))
          : [];
        setMaintenances(formatted);
      }
    } catch (error) {
      console.error('Failed to fetch maintenances:', error);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    fetchMaintenances();
  }, [fetchIncidents, fetchMaintenances]);

  useEffect(() => {
    const notifyParam = searchParams.get('notify');
    if (notifyParam && ['email', 'webhooks', 'incidents', 'maintenance'].includes(notifyParam) && notifyParam !== activeTab) {
      setActiveTab(notifyParam);
    }
    const providersParam = searchParams.get('providers');
    if (providersParam) {
      const ids = providersParam.split(',').map((id) => id.trim()).filter(Boolean);
      const sameSelection =
        ids.length === selectedProviders.length && ids.every((id) => selectedProviders.includes(id));
      if (!sameSelection) {
        setSelectedProviders(ids);
      }
    }
  }, [searchParams, activeTab, selectedProviders]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: string }>).detail;
      if (!detail?.tab) return;
      if (['email', 'webhooks', 'incidents', 'maintenance'].includes(detail.tab)) {
        setActiveTab(detail.tab);
      }
    };
    window.addEventListener('ai-status:notifications-tab', handler as EventListener);
    return () => window.removeEventListener('ai-status:notifications-tab', handler as EventListener);
  }, []);

  const handleEmailSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      // Prefer Next email confirmation flow, fall back to Firebase Functions endpoint if deployed there
      const sessionId = getAnalyticsSessionId();
      let response = await fetch('/api/email/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, providers: selectedProviders, sessionId }),
      });
      if (response.status === 404) {
        response = await fetch('/api/subscribeEmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, providers: selectedProviders, sessionId }),
        });
      }

      if (response.ok) {
        setEmail('');
        showSuccess('Subscription started', 'Check your inbox to confirm the alert subscription.');
      } else {
        showError('Subscription failed', 'We could not register the email alert. Please try again.');
      }
    } catch (error) {
      console.error(error);
      showError('Subscription error', 'We could not reach the alert service. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleWebhookSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl) return;

    setLoading(true);
    try {
      // Prefer Next route handler, but fall back to Firebase Functions endpoint if deployed there
      const sessionId = getAnalyticsSessionId();
      let response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, providers: selectedProviders, sessionId }),
      });
      if (response.status === 404) {
        response = await fetch('/api/subscribeWebhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl, providers: selectedProviders, sessionId }),
        });
      }

      if (response.ok) {
        setWebhookUrl('');
        showSuccess('Webhook registered', 'We will send updates to your webhook endpoint.');
      } else {
        showError('Webhook failed', 'We could not register that webhook. Please try again.');
      }
    } catch (error) {
      console.error(error);
      showError('Webhook error', 'We could not reach the webhook service. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'incidents') {
      fetchIncidents();
    }
    if (activeTab === 'maintenance') {
      fetchMaintenances();
    }
    if (activeTab !== 'incidents') {
      setSelectedIncident(null);
    }
  }, [activeTab, fetchIncidents, fetchMaintenances]);

  const providers = providerService.getProviders();

  return (
    <div className="surface-card-strong overflow-hidden" data-tour="notifications-panel">
      <div className="p-6 border-b border-slate-200/70 dark:border-slate-700/70">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
          Alerts
        </p>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-2">
          Keep teams ahead of outages
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
          Subscribe to provider changes, wire webhooks, or review incident history.
        </p>
        <div className="mt-4 surface-card p-2 inline-flex gap-2" data-tour="notifications-tabs">
          {['email', 'webhooks', 'incidents', 'maintenance'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
                activeTab === tab
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
                {tab === 'maintenance' ? 'Maintenance' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'email' && (
          <form onSubmit={handleEmailSubscription} className="space-y-6" data-tour="notifications-email">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-full border border-slate-200/70 dark:border-slate-700/70 dark:bg-slate-900/70 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-400/70 transition-all"
                placeholder="name@example.com"
                required
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 mb-2">
                Track providers
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {providers.map((p) => {
                  const label = p.displayName || p.name;
                  const isSelected = selectedProviders.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setSelectedProviders((prev) =>
                          prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                        )
                      }
                      className={`px-3 py-2 rounded-full text-xs font-medium transition-all border ${
                        isSelected
                          ? 'bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900'
                          : 'border-slate-200/70 dark:border-slate-700/70 text-slate-600 dark:text-slate-300'
                      }`}
                      data-provider-id={p.id}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Leave empty to monitor all providers.
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                Component-level subscriptions follow the same pattern and will appear once component feeds are fully ingested.
              </p>
            </div>
            <button
              disabled={loading}
              className="w-full py-3 cta-primary disabled:opacity-60"
            >
              {loading ? 'Subscribing...' : 'Subscribe to Alerts'}
            </button>
            <div className="text-xs text-slate-400 dark:text-slate-500 text-center">
              Channels: Email now · SMS/Slack/Teams coming next.
            </div>
          </form>
        )}

        {activeTab === 'webhooks' && (
          <form onSubmit={handleWebhookSubmission} className="space-y-6" data-tour="notifications-webhooks">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-full border border-slate-200/70 dark:border-slate-700/70 dark:bg-slate-900/70 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-400/70 transition-all"
                placeholder="https://api.yoursite.com/webhook"
                required
              />
            </div>
            <button
              disabled={loading}
              className="w-full py-3 cta-primary disabled:opacity-60"
            >
              {loading ? 'Adding...' : 'Register Webhook'}
            </button>
          </form>
        )}

        {activeTab === 'incidents' && (
          <div className="space-y-4" data-tour="notifications-incidents">
            {incidents.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                No recent incidents found.
              </div>
            ) : (
              incidents.map((incident) => {
                const severityLabel = incident.severity || incident.status;
                return (
                  <button
                    key={incident.id}
                    onClick={() => setSelectedIncident(incident)}
                    className="surface-card p-4 text-left w-full hover:shadow-sm transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-semibold text-slate-900 dark:text-white">
                        {incident.title}
                      </h4>
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {severityLabel}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-300">
                      {incident.provider} - {incident.status}
                    </p>
                  </button>
                );
              })
            )}
            {selectedIncident && (
              <div className="surface-card-strong p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Incident detail
                    </p>
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-white mt-2">
                      {selectedIncident.title}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
                      {selectedIncident.provider} · {selectedIncident.status}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedIncident(null)}
                    className="text-xs text-slate-500 dark:text-slate-400"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-3">
                  <span>
                    Local:{' '}
                    <ClientTimestamp format="datetime" date={new Date(selectedIncident.startTime)} />
                  </span>
                  <span>
                    UTC:{' '}
                    <ClientTimestamp
                      format="datetime"
                      timeZone="utc"
                      date={new Date(selectedIncident.startTime)}
                    />
                  </span>
                  {selectedIncident.endTime && (
                    <span>
                      Resolved:{' '}
                      <ClientTimestamp
                        format="datetime"
                        timeZone="utc"
                        date={new Date(selectedIncident.endTime)}
                      />
                    </span>
                  )}
                </div>
                {selectedIncident.impactedComponents && selectedIncident.impactedComponents.length > 0 && (
                  <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    Components: {selectedIncident.impactedComponents.slice(0, 6).join(', ')}
                  </div>
                )}
                {selectedIncident.impactedRegions && selectedIncident.impactedRegions.length > 0 && (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Regions: {selectedIncident.impactedRegions.slice(0, 6).join(', ')}
                  </div>
                )}
                <div className="mt-4 space-y-3">
                  {(selectedIncident.updates || []).map((update) => (
                    <div key={update.id} className="surface-card p-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="uppercase tracking-[0.2em]">{update.status}</span>
                        <span>
                          <ClientTimestamp format="datetime" date={new Date(update.createdAt)} /> /{' '}
                          <ClientTimestamp
                            format="datetime"
                            timeZone="utc"
                            date={new Date(update.createdAt)}
                          />
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{update.body}</p>
                    </div>
                  ))}
                  {(!selectedIncident.updates || selectedIncident.updates.length === 0) && (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      No timeline updates available yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="space-y-4" data-tour="notifications-maintenance">
            {maintenances.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                No scheduled maintenance updates yet.
              </div>
            ) : (
              maintenances.map((maintenance) => (
                <div key={maintenance.id} className="surface-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      {maintenance.title}
                    </h4>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {maintenance.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    {maintenance.provider || 'Provider'} —{' '}
                    <ClientTimestamp format="datetime" date={new Date(maintenance.scheduledFor)} />
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
