'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';

export default function APIDemo() {
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [response, setResponse] = useState('');
  const [loadingButtons, setLoadingButtons] = useState<{ [key: string]: boolean }>({});

  const providers = [
    'openai',
    'anthropic',
    'huggingface',
    'google-ai',
    'cohere',
    'replicate',
    'groq',
    'deepseek',
    'meta',
    'xai',
    'perplexity',
    'claude',
    'mistral',
    'aws',
    'azure',
  ];

  // Base URL for Cloud Functions
  const CLOUD_FUNCTIONS_BASE = 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/api';

  const apiExamples = useMemo(
    () => [
      {
        id: 'health-check',
        title: 'System Health Check',
        endpoint: `${CLOUD_FUNCTIONS_BASE}/health`,
        description: 'Check system health and provider status summary',
      },
      {
        id: 'all-status',
        title: 'Get All Provider Status',
        endpoint: `${CLOUD_FUNCTIONS_BASE}/status`,
        description: 'Fetch status for all 15 AI providers with response times',
      },
      {
        id: 'single-provider',
        title: 'Get Single Provider',
        endpoint: `${CLOUD_FUNCTIONS_BASE}/status?provider=${selectedProvider}`,
        description: `Get detailed status for ${selectedProvider} with response time`,
      },
      {
        id: 'webhook-registration',
        title: 'Webhook Registration',
        endpoint: `${CLOUD_FUNCTIONS_BASE}/subscribeWebhook`,
        description: 'Register a webhook for status change notifications',
        method: 'POST',
      },
      {
        id: 'test-notification',
        title: 'Test Email Notification',
        endpoint: `${CLOUD_FUNCTIONS_BASE}/sendTestNotification`,
        description: 'Test the notification system with an email',
        method: 'POST',
      },
    ],
    [selectedProvider, CLOUD_FUNCTIONS_BASE]
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
        if (endpoint.includes('sendTestNotification')) {
          fetchOptions.body = JSON.stringify({
            email: 'test@example.com',
          });
        } else if (endpoint.includes('subscribeWebhook')) {
          fetchOptions.body = JSON.stringify({
            webhookUrl: 'https://example.com/webhook',
            providers: ['openai', 'anthropic'],
          });
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
    } catch (error) {
      setResponse(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
          Real-time API access to monitor 15+ AI providers. Test our Cloud Function endpoints and
          integrate status data into your applications.
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
              <option key={provider} value={provider}>
                {provider.charAt(0).toUpperCase() + provider.slice(1).replace('-', ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* API Examples */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Available Cloud Function Endpoints
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

        {/* API Usage Examples */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Integration Examples
          </h3>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">JavaScript Example</h4>
            <pre className="text-sm bg-gray-800 text-green-400 p-3 rounded overflow-x-auto">
              {`// Fetch all provider statuses
const response = await fetch('${CLOUD_FUNCTIONS_BASE}/status');
const data = await response.json();
console.log('Provider statuses:', data);

// Fetch system health
const healthResponse = await fetch('${CLOUD_FUNCTIONS_BASE}/health');
const healthData = await healthResponse.json();
console.log('Health data:', healthData);`}
            </pre>
          </div>
        </div>

        {/* Response Display */}
        {response && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">API Response</h3>
            <div className="bg-gray-100 dark:bg-gray-900 rounded-md p-4 overflow-auto max-h-96">
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
            Integrate AI Status Dashboard into your applications with our Firebase Cloud Functions
            API. Monitor 15+ providers in real-time.
          </p>
          <div className="flex gap-4 flex-wrap">
            <a
              href={`${CLOUD_FUNCTIONS_BASE}/health`}
              target="_blank"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline py-2 px-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              🔗 Health Endpoint
            </a>
            <a
              href={`${CLOUD_FUNCTIONS_BASE}/status`}
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
