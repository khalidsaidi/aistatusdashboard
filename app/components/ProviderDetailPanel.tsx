'use client';

import { useEffect, useMemo, useState } from 'react';
import { providerService } from '@/lib/services/providers';
import ClientTimestamp from './ClientTimestamp';

interface ProviderComponent {
  id: string;
  name: string;
  status: string;
  description?: string;
}

interface IncidentUpdate {
  id: string;
  status: string;
  body: string;
  createdAt: string;
}

interface ProviderIncident {
  id: string;
  title: string;
  status: string;
  severity: string;
  startedAt: string;
  updatedAt: string;
  resolvedAt?: string;
  impactedComponents?: string[];
  impactedRegions?: string[];
  updates?: IncidentUpdate[];
}

interface ProviderMaintenance {
  id: string;
  title: string;
  status: string;
  scheduledFor: string;
  updatedAt: string;
  completedAt?: string;
  affectedComponents?: string[];
  updates?: IncidentUpdate[];
}

interface ProviderDetailPanelProps {
  className?: string;
}

export default function ProviderDetailPanel({ className = '' }: ProviderDetailPanelProps) {
  const providers = providerService.getProviders();
  const [providerId, setProviderId] = useState(providers[0]?.id || 'openai');
  const [components, setComponents] = useState<ProviderComponent[]>([]);
  const [incidents, setIncidents] = useState<ProviderIncident[]>([]);
  const [maintenances, setMaintenances] = useState<ProviderMaintenance[]>([]);
  const [activeTab, setActiveTab] = useState<'components' | 'incidents' | 'maintenance'>('components');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/intel/provider/${providerId}`);
        if (!response.ok) throw new Error('Failed to load provider detail');
        const data = await response.json();
        if (!active) return;
        setComponents(Array.isArray(data.components) ? data.components : []);
        setIncidents(Array.isArray(data.incidents) ? data.incidents : []);
        setMaintenances(Array.isArray(data.maintenances) ? data.maintenances : []);
      } catch {
        if (active) {
          setComponents([]);
          setIncidents([]);
          setMaintenances([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchDetail();
    return () => {
      active = false;
    };
  }, [providerId]);

  const providerName = useMemo(() => {
    return providers.find((provider) => provider.id === providerId)?.displayName || providerId;
  }, [providers, providerId]);

  return (
    <div className={`surface-card-strong ${className}`} data-tour="analytics-detail">
      <div className="p-6 border-b border-slate-200/70 dark:border-slate-700/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              Provider detail
            </p>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-2">
              {providerName}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Components, incidents, and maintenance windows.
            </p>
          </div>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="px-3 py-2 text-xs rounded-full border border-slate-200/70 dark:border-slate-700/70 bg-white/80 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200"
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.displayName || provider.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 surface-card p-2 inline-flex gap-2">
          {['components', 'incidents', 'maintenance'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as typeof activeTab)}
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
        {loading && (
          <div className="text-sm text-slate-500 dark:text-slate-400">Loading provider detail...</div>
        )}

        {!loading && activeTab === 'components' && (
          <div className="space-y-3">
            {components.length === 0 && (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                No component data yet.
              </div>
            )}
            {components.map((component) => (
              <div key={component.id} className="surface-card p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {component.name}
                  </div>
                  {component.description && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {component.description}
                    </div>
                  )}
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {component.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {!loading && activeTab === 'incidents' && (
          <div className="space-y-3">
            {incidents.length === 0 && (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                No incidents recorded.
              </div>
            )}
            {incidents.map((incident) => (
              <div key={incident.id} className="surface-card p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {incident.title}
                  </div>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {incident.severity || incident.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex flex-wrap gap-3">
                  <span>
                    Local:{' '}
                    <ClientTimestamp format="datetime" date={new Date(incident.startedAt)} />
                  </span>
                  <span>
                    UTC:{' '}
                    <ClientTimestamp
                      format="datetime"
                      timeZone="utc"
                      date={new Date(incident.startedAt)}
                    />
                  </span>
                </div>
                {incident.updates && incident.updates.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {incident.updates.map((update) => (
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
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && activeTab === 'maintenance' && (
          <div className="space-y-3">
            {maintenances.length === 0 && (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                No maintenance windows scheduled.
              </div>
            )}
            {maintenances.map((maintenance) => (
              <div key={maintenance.id} className="surface-card p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {maintenance.title}
                  </div>
                  <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {maintenance.status}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Scheduled:{' '}
                  <ClientTimestamp format="datetime" date={new Date(maintenance.scheduledFor)} /> /{' '}
                  <ClientTimestamp
                    format="datetime"
                    timeZone="utc"
                    date={new Date(maintenance.scheduledFor)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
