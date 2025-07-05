'use client';

import { useState, useEffect } from 'react';
import { getApiUrl, fetchWithPerformance } from '../../lib/utils';

interface EmailSubscription {
  id: string;
  email: string;
  providers: string[];
  notificationTypes: string[];
  confirmed: boolean;
}

interface Incident {
  id: string;
  provider: string;
  title: string;
  status: string;
  severity: string;
  startTime: string;
  endTime?: string;
}

// Client-side only date component to avoid hydration mismatch
function ClientDateTime({ dateString }: { dateString: string }) {
  const [mounted, setMounted] = useState(false);
  const [formattedDate, setFormattedDate] = useState('');

  useEffect(() => {
    setMounted(true);
    setFormattedDate(new Date(dateString).toLocaleString());
  }, [dateString]);

  return <span>{mounted ? formattedDate : 'Loading...'}</span>;
}

export default function NotificationPanel() {
  const [activeTab, setActiveTab] = useState<'email' | 'webhooks' | 'incidents'>('email');
  const [email, setEmail] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [notificationTypes, setNotificationTypes] = useState<string[]>(['incident', 'recovery']);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [subscriptions, setSubscriptions] = useState<EmailSubscription[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const providers = [
    'openai', 'anthropic', 'huggingface', 'google-ai', 
    'cohere', 'replicate', 'groq', 'deepseek',
    'meta', 'xai', 'perplexity', 'claude', 'mistral', 'aws', 'azure'
  ];

  // Fetch current subscriptions and incidents
  useEffect(() => {
    if (activeTab === 'email') {
      fetchSubscriptions();
    } else if (activeTab === 'incidents') {
      fetchIncidents();
    }
  }, [activeTab]);

  const fetchSubscriptions = async () => {
    try {
      const response = await fetch('/api/notifications');
      const data = await response.json();
      setSubscriptions(data.subscriptions || []);
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
    }
  };

  const fetchIncidents = async () => {
    try {
      const response = await fetch('/api/incidents?limit=10');
      const data = await response.json();
      setIncidents(data.incidents || []);
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
    }
  };

  const handleEmailSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetchWithPerformance(getApiUrl('subscribeEmail'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          providers: selectedProviders
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('✅ Email subscription created! Check your email to confirm.');
        setEmail('');
        setSelectedProviders([]);
        fetchSubscriptions();
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ Failed to subscribe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleWebhookRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetchWithPerformance(getApiUrl('subscribeWebhook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl,
          providers: selectedProviders
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('✅ Webhook registered successfully!');
        setWebhookUrl('');
        setWebhookSecret('');
        setSelectedProviders([]);
      } else {
        setMessage(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ Failed to register webhook. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleProvider = (provider: string) => {
    setSelectedProviders(prev => 
      prev.includes(provider) 
        ? prev.filter(p => p !== provider)
        : [...prev, provider]
    );
  };

  const toggleNotificationType = (type: string) => {
    setNotificationTypes(prev => 
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          🔔 Notifications & Alerts
        </h2>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          {[
            { id: 'email', label: '📧 Email Alerts' },
            { id: 'webhooks', label: '🪝 Webhooks' },
            { id: 'incidents', label: '📋 Incidents' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors min-h-[44px] min-w-[44px] ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Email Notifications Tab */}
        {activeTab === 'email' && (
          <div className="space-y-6">
            <form onSubmit={handleEmailSubscription} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Providers (leave empty for all)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {providers.map(provider => (
                    <label key={provider} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedProviders.includes(provider)}
                        onChange={() => toggleProvider(provider)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {provider.replace('-', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notification Types
                </label>
                <div className="flex flex-wrap gap-4">
                  {['incident', 'recovery', 'degradation'].map(type => (
                    <label key={type} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={notificationTypes.includes(type)}
                        onChange={() => toggleNotificationType(type)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {type}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-md transition-colors min-h-[44px]"
              >
                {loading ? 'Subscribing...' : 'Subscribe to Email Alerts'}
              </button>
            </form>

            {/* Current Subscriptions */}
            {subscriptions.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Current Subscriptions ({subscriptions.length})
                </h3>
                <div className="space-y-2">
                  {subscriptions.map(sub => (
                    <div key={sub.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{sub.email}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Types: {sub.notificationTypes.join(', ')}
                          </p>
                          {sub.providers.length > 0 && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Providers: {sub.providers.join(', ')}
                            </p>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          sub.confirmed 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        }`}>
                          {sub.confirmed ? 'Confirmed' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Webhooks Tab */}
        {activeTab === 'webhooks' && (
          <div className="space-y-6">
            <form onSubmit={handleWebhookRegistration} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Webhook URL
                </label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="https://your-app.com/webhook"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Secret (optional, for HMAC verification)
                </label>
                <input
                  type="text"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="your-secret-key"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Event Types
                </label>
                <div className="flex flex-wrap gap-4">
                  {['status_change', 'incident', 'recovery'].map(type => (
                    <label key={type} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={notificationTypes.includes(type)}
                        onChange={() => toggleNotificationType(type)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {type.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !webhookUrl}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-md transition-colors min-h-[44px]"
              >
                {loading ? 'Registering...' : 'Register Webhook'}
              </button>
            </form>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
              <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                📚 Webhook Documentation
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                Your webhook will receive POST requests with JSON payloads when status changes occur.
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                See the API Reference for payload structure and signature verification.
              </p>
            </div>
          </div>
        )}

        {/* Incidents Tab */}
        {activeTab === 'incidents' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Recent Incidents ({incidents.length})
              </h3>
              <button
                onClick={fetchIncidents}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline py-2 px-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                🔄 Refresh
              </button>
            </div>

            {incidents.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                🎉 No incidents recorded. All systems operational!
              </div>
            ) : (
              <div className="space-y-3">
                {incidents.map(incident => (
                  <div key={incident.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {incident.title}
                      </h4>
                      <div className="flex gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          incident.severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          incident.severity === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                          incident.severity === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                        }`}>
                          {incident.severity}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          incident.status === 'resolved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }`}>
                          {incident.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {incident.id} • {incident.provider} • <ClientDateTime dateString={incident.startTime} />
                      {incident.endTime && <span> - <ClientDateTime dateString={incident.endTime} /></span>}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message Display */}
        {message && (
          <div className={`mt-4 p-3 rounded-md ${
            message.includes('✅') 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
} 