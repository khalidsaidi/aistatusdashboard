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
  const API_BASE = '/api';
  const fallbackOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

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
        endpoint: `${API_BASE}/health`,
        description: 'Check system health and provider status summary',
      },
      {
        id: 'all-status',
        title: 'Get All Provider Status',
        endpoint: `${API_BASE}/status`,
        description: `Fetch status for all ${providerCount} AI providers with response times`,
      },
      {
        id: 'single-provider',
        title: 'Get Single Provider',
        endpoint: `${API_BASE}/status?provider=${selectedProvider}`,
        description: `Get detailed status for ${selectedProviderLabel} with response time`,
      },
      {
        id: 'webhook-registration',
        title: 'Webhook Registration',
        endpoint: `${API_BASE}/webhooks`,
        description: 'Register a webhook for status change notifications',
        method: 'POST',
      },
      {
        id: 'test-notification',
        title: 'Test Email Notification',
        endpoint: `${API_BASE}/cron/notifications`,
        description: 'Trigger notification queue processing',
        method: 'GET',
      },
      {
        id: 'trigger-sync',
        title: 'Trigger System Status Sync',
        endpoint: `${API_BASE}/cron/status`,
        description: 'Force a full refresh of all provider statuses (Status Orchestrator)',
        method: 'GET',
      },
    ],
    [selectedProvider, API_BASE, providerCount]
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
      setResponse(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setLastRequestTime(new Date().toLocaleTimeString());
      trackEvent('api_test', { metadata: { endpoint, method, ok: false } });
    } finally {
      setLoadingButtons((prev) => ({ ...prev, [buttonId]: false }));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          🚀 AI Status Dashboard API
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Real-time API access to monitor {providerCount}+ AI providers. Test our API endpoints and integrate
          status data into your applications.
        </p>

        {/* Provider Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Provider for Testing
          </label>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Available API Endpoints
          </h3>
          <div className="grid gap-3">
            {apiExamples.map((example) => (
              <div
                key={example.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-md"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">{example.title}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {example.description}
                  </p>
                  <code className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded text-blue-600 dark:text-blue-400 break-all">
                    {(example as any).method || 'GET'} {example.endpoint}
                  </code>
                </div>
                <button
                  onClick={() =>
                    testAPI(example.endpoint, example.id, (example as any).method || 'GET')
                  }
                  disabled={loadingButtons[example.id]}
                  className="ml-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-md text-sm transition-colors min-h-[44px] min-w-[44px]"
                >
                  {loadingButtons[example.id] ? '⏳' : 'Test'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Badge Preview Section */}
        <div className="mb-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            🏷️ Live Status Badges
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Embed real-time status badges for <b>{selectedProvider}</b> in your GitHub README or documentation.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md flex flex-col items-center justify-center min-h-[120px]">
              <span className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Preview</span>
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
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase">
                  Markdown
                </label>
                <code className="block p-2 bg-gray-100 dark:bg-gray-900 text-xs rounded border border-gray-200 dark:border-gray-700 break-all overflow-x-auto text-blue-600 dark:text-blue-400">
                  {`![${selectedProvider} Status](${origin || fallbackOrigin}/api/badge/${selectedProvider})`}
                </code>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase">
                  HTML
                </label>
                <code className="block p-2 bg-gray-100 dark:bg-gray-900 text-xs rounded border border-gray-200 dark:border-gray-700 break-all overflow-x-auto text-green-600 dark:text-green-400">
                  {`<img src="${origin || fallbackOrigin}/api/badge/${selectedProvider}" alt="${selectedProvider} Status">`}
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* API Usage Examples */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Integration Examples
          </h3>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">JavaScript Example</h4>
            <pre className="text-sm bg-gray-800 text-green-400 p-3 rounded overflow-x-auto">
              {`// Fetch all provider statuses
const response = await fetch('${API_BASE}/status');
const data = await response.json();
console.log('Provider statuses:', data);

// Fetch system health
const healthResponse = await fetch('${API_BASE}/health');
const healthData = await healthResponse.json();
console.log('Health data:', healthData);`}
            </pre>
          </div>
        </div>

        {/* Response Display */}
        {response && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700" ref={responseRef}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                API Response
              </h3>
              {lastRequestTime && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Last updated: {lastRequestTime}
                </span>
              )}
            </div>
            <div className="bg-gray-100 dark:bg-gray-900 rounded-md p-4 overflow-auto max-h-96 border border-gray-200 dark:border-gray-800 shadow-inner">
              <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {response}
              </pre>
            </div>
          </div>
        )}

        {/* API Documentation Link */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
          <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
            📚 Complete API Documentation
          </h4>
          <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
            Integrate AI Status Dashboard into your applications with our API. Monitor {providerCount}+ providers
            in real-time.
          </p>
          <div className="flex gap-4 flex-wrap">
            <a
              href={`${API_BASE}/health`}
              target="_blank"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline py-2 px-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              🔗 Health Endpoint
            </a>
            <a
              href={`${API_BASE}/status`}
              target="_blank"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline py-2 px-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              📊 Status Endpoint
            </a>
            <a
              href="/rss.xml"
              target="_blank"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline py-2 px-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              📡 RSS Feed
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
