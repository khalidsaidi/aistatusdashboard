'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { providerService } from '@/lib/services/providers';
import { trackEvent } from '@/lib/utils/analytics-client';
import Image from 'next/image';

export default function APIDemo() {
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [response, setResponse] = useState('');
  const [loadingButtons, setLoadingButtons] = useState<{ [key: string]: boolean }>({});
  const [lastRequestTime, setLastRequestTime] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>(() => process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
  const responseRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to response when it changes
  useEffect(() => {
    if (response && responseRef.current) {
      responseRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [response]);

  const providers = useMemo(() => providerService.getProviders(), []);
  const providerCount = providers.length;
  const selectedProviderLabel =
    providers.find((p) => p.id === selectedProvider)?.displayName ||
    providers.find((p) => p.id === selectedProvider)?.name ||
    selectedProvider;

  // Base URL for API
  const API_BASE_PATH = '/api';
  const fallbackOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const apiBaseUrl = `${origin || fallbackOrigin}${API_BASE_PATH}`;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const apiExamples = useMemo(
    () => [
      {
        id: 'health-check',
        title: 'System Health Check',
        path: '/health',
        description: 'Check system health and provider status summary',
      },
      {
        id: 'all-status',
        title: 'Get All Provider Status',
        path: '/status',
        description: `Fetch status for all ${providerCount} AI providers with response times`,
      },
      {
        id: 'provider-detail',
        title: 'Provider Detail (Components + Incidents)',
        path: `/intel/provider/${selectedProvider}`,
        description: `Normalized components, incidents, and maintenances for ${selectedProviderLabel}`,
      },
      {
        id: 'incident-feed',
        title: 'Incident Feed',
        path: `/intel/incidents?providerId=${selectedProvider}`,
        description: 'Normalized incidents with updates and impacted regions/components',
      },
      {
        id: 'maintenance-feed',
        title: 'Maintenance Feed',
        path: `/intel/maintenances?providerId=${selectedProvider}`,
        description: 'Scheduled and active maintenance windows',
      },
      {
        id: 'single-provider',
        title: 'Get Single Provider',
        path: `/status?provider=${selectedProvider}`,
        description: `Get detailed status for ${selectedProviderLabel} with response time`,
      },
      {
        id: 'early-warnings',
        title: 'Early Warning Signals',
        path: '/insights/early-warnings?windowMinutes=30',
        description: 'Suspected incidents from synthetic + crowd telemetry',
      },
      {
        id: 'staleness-signals',
        title: 'Status Staleness Signals',
        path: '/insights/staleness?windowMinutes=30',
        description: 'Official status vs observed telemetry drift detection',
      },
      {
        id: 'webhook-registration',
        title: 'Webhook Registration',
        path: '/webhooks',
        description: 'Register a webhook for status change notifications',
        method: 'POST',
      },
      {
        id: 'ingest-sources',
        title: 'Ingest Public Status Sources',
        path: '/cron/ingest',
        description: 'Trigger source ingestion pipeline (cron-protected)',
        method: 'GET',
      },
      {
        id: 'test-notification',
        title: 'Test Email Notification',
        path: '/cron/notifications',
        description: 'Trigger notification queue processing',
        method: 'GET',
      },
      {
        id: 'trigger-sync',
        title: 'Trigger System Status Sync',
        path: '/cron/status',
        description: 'Force a full refresh of all provider statuses (Status Orchestrator)',
        method: 'GET',
      },
    ],
    [selectedProvider, providerCount, selectedProviderLabel]
  );

  const testAPI = async (endpoint: string, buttonId: string, method: string = 'GET') => {
    setLoadingButtons((prev) => ({ ...prev, [buttonId]: true }));
    setResponse('');

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };

      // Add test data for POST requests
      if (method === 'POST') {
        if (buttonId === 'webhook-registration') {
          fetchOptions.body = JSON.stringify({
            url: 'https://example.com/webhook',
            providers: ['openai', 'anthropic'],
          });
        } else if (buttonId === 'email-subscribe') {
          fetchOptions.body = JSON.stringify({
            email: 'test@example.com',
          });
        } else {
          // Default empty object for other POSTs to avoid "Unexpected end of JSON"
          fetchOptions.body = JSON.stringify({});
        }
      }

      const res = await fetch(endpoint, fetchOptions);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.text();

      try {
        // Try to parse as JSON
        const jsonData = JSON.parse(data);
        setResponse(JSON.stringify(jsonData, null, 2));
      } catch (parseError) {
        // If not JSON, show raw response
        setResponse(`Raw response:\n${data}`);
      }
      setLastRequestTime(new Date().toLocaleTimeString());
      trackEvent('api_test', { metadata: { endpoint, method, ok: res.ok } });
    } catch (error) {
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLastRequestTime(new Date().toLocaleTimeString());
      trackEvent('api_test', { metadata: { endpoint, method, ok: false } });
    } finally {
      setLoadingButtons((prev) => ({ ...prev, [buttonId]: false }));
    }
  };

  return (
    <div className="surface-card-strong" data-testid="api-demo">
      <div className="p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
          Developer tools
        </p>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mt-2">
          API & Integrations
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
          Real-time API access to monitor {providerCount}+ AI providers. Test endpoints and
          integrate status data into your applications.
        </p>
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-4">
          Current API base: <span className="font-semibold">{apiBaseUrl}</span>
        </div>

        {/* Provider Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Select Provider for Testing
          </label>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full shadow-sm bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-white"
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.displayName || provider.name}
              </option>
            ))}
          </select>
        </div>

        {/* API Examples */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white">
            Available API Endpoints
          </h3>
          <div className="grid gap-3">
            {apiExamples.map((example) => {
              const endpointPath = `${API_BASE_PATH}${example.path}`;
              const displayEndpoint = `${apiBaseUrl}${example.path}`;
              return (
                <div
                  key={example.id}
                  className="surface-card p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900 dark:text-white">{example.title}</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                      {example.description}
                    </p>
                    <code className="text-xs bg-slate-100/80 dark:bg-slate-800/70 px-2 py-1 rounded text-slate-700 dark:text-slate-200 break-all">
                      {(example as any).method || 'GET'} {displayEndpoint}
                    </code>
                  </div>
                  <button
                    onClick={() =>
                      testAPI(endpointPath, example.id, (example as any).method || 'GET')
                    }
                    disabled={loadingButtons[example.id]}
                    className="cta-primary min-w-[90px] disabled:opacity-60"
                  >
                    {loadingButtons[example.id] ? 'Testing...' : 'Test'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Badge Preview Section */}
        <div className="mb-6 pt-6 border-t border-slate-200/70 dark:border-slate-700/70">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">
            Live Status Badges
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Embed real-time status badges for <b>{selectedProvider}</b> in your GitHub README or documentation.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="surface-card p-4 flex flex-col items-center justify-center min-h-[120px]">
              <span className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Preview</span>
              <Image
                src={`/api/badge/${selectedProvider}`}
                alt={`${selectedProvider} Status Badge`}
                key={selectedProvider} // Force reload when provider changes
                className="shadow-sm"
                width={200}
                height={40}
                unoptimized
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase">
                  Markdown
                </label>
                <code className="block p-2 bg-slate-100/80 dark:bg-slate-900 text-xs rounded border border-slate-200/70 dark:border-slate-700/70 break-all overflow-x-auto text-slate-700 dark:text-slate-200">
                  {`![${selectedProvider} Status](${origin || fallbackOrigin}/api/badge/${selectedProvider})`}
                </code>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase">
                  HTML
                </label>
                <code className="block p-2 bg-slate-100/80 dark:bg-slate-900 text-xs rounded border border-slate-200/70 dark:border-slate-700/70 break-all overflow-x-auto text-slate-700 dark:text-slate-200">
                  {`<img src="${origin || fallbackOrigin}/api/badge/${selectedProvider}" alt="${selectedProvider} Status">`}
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* API Usage Examples */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-3">
            Integration Examples
          </h3>
          <div className="surface-card p-4">
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">JavaScript Example</h4>
            <pre className="text-sm bg-slate-900 text-emerald-300 p-3 rounded-xl overflow-x-auto">
              {`// Fetch all provider statuses
const response = await fetch('${apiBaseUrl}/status');
const data = await response.json();
console.log('Provider statuses:', data);

// Fetch system health
const healthResponse = await fetch('${apiBaseUrl}/health');
const healthData = await healthResponse.json();
console.log('Health data:', healthData);`}
            </pre>
          </div>
        </div>

        {/* Response Display */}
        {response && (
          <div className="mt-6 pt-6 border-t border-slate-200/70 dark:border-slate-700/70" ref={responseRef}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                API Response
              </h3>
              {lastRequestTime && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Last updated: {lastRequestTime}
                </span>
              )}
            </div>
            <div className="bg-slate-100/80 dark:bg-slate-900 rounded-xl p-4 overflow-auto max-h-96 border border-slate-200/70 dark:border-slate-800 shadow-inner">
              <pre className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {response}
              </pre>
            </div>
          </div>
        )}

        {/* API Documentation Link */}
        <div className="mt-6 p-4 surface-card">
          <h4 className="font-medium text-slate-900 dark:text-white mb-2">
            Complete API Documentation
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
            Integrate AI Status Dashboard into your applications with our API. Monitor {providerCount}+ providers
            in real-time.
          </p>
          <div className="flex gap-4 flex-wrap">
            <a
              href={`${API_BASE_PATH}/health`}
              target="_blank"
              className="text-sm text-slate-700 dark:text-slate-200 hover:underline py-2 px-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              Health Endpoint
            </a>
            <a
              href={`${API_BASE_PATH}/status`}
              target="_blank"
              className="text-sm text-slate-700 dark:text-slate-200 hover:underline py-2 px-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              Status Endpoint
            </a>
            <a
              href="/rss.xml"
              target="_blank"
              className="text-sm text-slate-700 dark:text-slate-200 hover:underline py-2 px-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              RSS Feed
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
