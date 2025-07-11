'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getApiUrl } from '../../lib/utils';
import {
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from '../../lib/firebase-messaging';

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

export default function NotificationPanel() {
  const [activeTab, setActiveTab] = useState('push');
  const [email, setEmail] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedNotificationTypes, setSelectedNotificationTypes] = useState<string[]>([]);
  const [subscriptions, setSubscriptions] = useState<EmailSubscription[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);

  const fetchEmailSubscriptions = useCallback(async () => {
    try {
      const response = await fetch(getApiUrl('/api/subscriptions'));
      if (response.ok) {
        const data = await response.json();
        setSubscriptions(data.subscriptions || []);
      }
    } catch (error) {
      console.error('Failed to fetch email subscriptions:', error);
    }
  }, []);

  const fetchWebhooks = useCallback(async () => {
    try {
      const response = await fetch(getApiUrl('/api/webhooks'));
      if (response.ok) {
        const data = await response.json();
        setWebhooks(data.webhooks || []);
      }
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    }
  }, []);

  const fetchIncidents = useCallback(async () => {
    try {
      const response = await fetch(getApiUrl('/api/incidents'));
      if (response.ok) {
        const data = await response.json();
        setIncidents(data.incidents || []);
      }
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
    }
  }, []);

  // Check for push notification support
  useEffect(() => {
    const checkPushSupport = () => {
      const supported =
        'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
      setPushSupported(supported);

      if (supported && Notification.permission === 'granted') {
        // Check if already subscribed
        navigator.serviceWorker.ready.then((registration) => {
          registration.pushManager.getSubscription().then((subscription) => {
            if (subscription) {
              setPushEnabled(true);
              setPushSubscription(subscription);
            }
          });
        });
      }
    };

    checkPushSupport();
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    fetchEmailSubscriptions();
    fetchWebhooks();
    fetchIncidents();
  }, [fetchEmailSubscriptions, fetchWebhooks, fetchIncidents]);

  const handleEmailSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || selectedProviders.length === 0 || selectedNotificationTypes.length === 0) return;

    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/subscribe'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          providers: selectedProviders,
          notificationTypes: selectedNotificationTypes,
        }),
      });

      if (response.ok) {
        setEmail('');
        setSelectedProviders([]);
        setSelectedNotificationTypes([]);
        await fetchEmailSubscriptions();
        alert('Successfully subscribed to email notifications!');
      } else {
        alert('Failed to subscribe. Please try again.');
      }
    } catch (error) {
      console.error('Failed to subscribe:', error);
      alert('Failed to subscribe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePushSubscription = async () => {
    if (!pushSupported) {
      alert('Push notifications are not supported in your browser.');
      return;
    }

    setLoading(true);
    try {
      if (pushEnabled) {
        // Unsubscribe
        const success = await unsubscribeFromPushNotifications();
        if (success) {
          setPushEnabled(false);
          setPushSubscription(null);
          alert('Successfully unsubscribed from push notifications!');
        } else {
          alert('Failed to unsubscribe from push notifications.');
        }
      } else {
        // Subscribe with selected providers (default to all if none selected)
        const providersToUse =
          selectedProviders.length > 0
            ? selectedProviders
            : [
                'OpenAI',
                'Anthropic',
                'Google AI',
                'Hugging Face',
                'Cohere',
                'AWS Bedrock',
                'Azure OpenAI',
                'Replicate',
                'Stability AI',
              ];

        const success = await subscribeToPushNotifications(providersToUse);
        if (success) {
          setPushEnabled(true);
          // Note: Firebase messaging returns a boolean, not a subscription object
          setPushSubscription(null); // We don't have the actual subscription object
          alert('Successfully subscribed to push notifications!');
        } else {
          alert('Failed to subscribe to push notifications.');
        }
      }
    } catch (error) {
      console.error('Failed to handle push subscription:', error);
      alert('Failed to handle push subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleWebhookSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl) return;

    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/webhooks'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: webhookUrl,
          secret: webhookSecret,
        }),
      });

      if (response.ok) {
        setWebhookUrl('');
        setWebhookSecret('');
        await fetchWebhooks();
        alert('Webhook successfully added!');
      } else {
        alert('Failed to add webhook. Please try again.');
      }
    } catch (error) {
      console.error('Failed to add webhook:', error);
      alert('Failed to add webhook. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;

    try {
      const response = await fetch(getApiUrl(`/api/webhooks/${id}`), {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchWebhooks();
        alert('Webhook deleted successfully!');
      } else {
        alert('Failed to delete webhook. Please try again.');
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      alert('Failed to delete webhook. Please try again.');
    }
  };

  const unsubscribeEmail = async (id: string) => {
    if (!confirm('Are you sure you want to unsubscribe?')) return;

    try {
      const response = await fetch(getApiUrl(`/api/subscriptions/${id}`), {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchEmailSubscriptions();
        alert('Successfully unsubscribed!');
      } else {
        alert('Failed to unsubscribe. Please try again.');
      }
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      alert('Failed to unsubscribe. Please try again.');
    }
  };

  const providers = [
    'OpenAI',
    'Anthropic',
    'Google AI',
    'Hugging Face',
    'Cohere',
    'AWS Bedrock',
    'Azure OpenAI',
    'Replicate',
    'Stability AI',
  ];

  const notificationTypes = [
    'outages',
    'degraded_performance',
    'maintenance',
    'incidents',
    'updates',
  ];

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          🔔 Notifications & Alerts
        </h2>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => handleTabChange('email')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors min-h-[44px] min-w-[44px] ${
              activeTab === 'email'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            📧 Email Alerts
          </button>
          <button
            onClick={() => handleTabChange('push')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors min-h-[44px] min-w-[44px] ${
              activeTab === 'push'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            🔔 Web Push
          </button>
          <button
            onClick={() => handleTabChange('webhooks')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors min-h-[44px] min-w-[44px] ${
              activeTab === 'webhooks'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            🪝 Webhooks
          </button>
          <button
            onClick={() => handleTabChange('incidents')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors min-h-[44px] min-w-[44px] ${
              activeTab === 'incidents'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            📋 Incidents
          </button>
        </div>

        {/* Email Notifications Tab */}
        {activeTab === 'email' && (
          <div className="space-y-6">
            <form onSubmit={handleEmailSubscription} className="space-y-4">
              <div>
                <label
                  htmlFor="email-address"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Email Address
                </label>
                <input
                  id="email-address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter your email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select AI Providers
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {providers.map((provider) => (
                    <label key={provider} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedProviders.includes(provider)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProviders([...selectedProviders, provider]);
                          } else {
                            setSelectedProviders(selectedProviders.filter((p) => p !== provider));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{provider}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notification Types
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {notificationTypes.map((type) => (
                    <label key={type} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedNotificationTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedNotificationTypes([...selectedNotificationTypes, type]);
                          } else {
                            setSelectedNotificationTypes(
                              selectedNotificationTypes.filter((t) => t !== type)
                            );
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {type.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  loading ||
                  !email ||
                  selectedProviders.length === 0 ||
                  selectedNotificationTypes.length === 0
                }
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                {loading ? '🔄 Subscribing...' : '📧 Subscribe to Email Alerts'}
              </button>
            </form>

            {/* Current Email Subscriptions */}
            {subscriptions.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Current Subscriptions
                </h3>
                <div className="space-y-3">
                  {subscriptions.map((subscription) => (
                    <div
                      key={subscription.id}
                      className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {subscription.email}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Providers: {subscription.providers.join(', ')}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Types: {subscription.notificationTypes.join(', ')}
                          </p>
                          <p className="text-sm">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                subscription.confirmed
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              }`}
                            >
                              {subscription.confirmed ? '✅ Confirmed' : '⏳ Pending Confirmation'}
                            </span>
                          </p>
                        </div>
                        <button
                          onClick={() => unsubscribeEmail(subscription.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Unsubscribe
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Web Push Notifications Tab */}
        {activeTab === 'push' && (
          <div className="space-y-6">
            {!pushSupported ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md">
                <h4 className="font-medium text-yellow-900 dark:text-yellow-200 mb-2">
                  ⚠️ Web Push Not Supported
                </h4>
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  Your browser doesn&apos;t support web push notifications. Please use a modern
                  browser like Chrome, Firefox, or Safari.
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Browser Push Notifications
                </h3>

                {pushEnabled ? (
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-green-900 dark:text-green-200 mb-1">
                          ✅ Push Notifications Enabled
                        </h4>
                        <p className="text-sm text-green-800 dark:text-green-300">
                          You&apos;ll receive real-time notifications about AI service status
                          changes.
                        </p>
                      </div>
                      <button
                        onClick={handlePushSubscription}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-md transition-colors"
                      >
                        {loading ? '🔄 Processing...' : '🔕 Disable'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-1">
                          🔔 Enable Push Notifications
                        </h4>
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          Get instant notifications when AI services experience issues or
                          maintenance.
                        </p>
                      </div>
                      <button
                        onClick={handlePushSubscription}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-md transition-colors"
                      >
                        {loading ? '🔄 Enabling...' : '🔔 Enable Notifications'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  <p className="mb-2">
                    <strong>What you&apos;ll receive:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Real-time alerts when services go down</li>
                    <li>Notifications when services are restored</li>
                    <li>Maintenance and update announcements</li>
                    <li>Performance degradation warnings</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Webhooks Tab */}
        {activeTab === 'webhooks' && (
          <div className="space-y-6">
            <form onSubmit={handleWebhookSubmission} className="space-y-4">
              <div>
                <label
                  htmlFor="webhook-url"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Webhook URL
                </label>
                <input
                  id="webhook-url"
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="https://your-domain.com/webhook"
                />
              </div>

              <div>
                <label
                  htmlFor="webhook-secret"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Secret (Optional)
                </label>
                <input
                  id="webhook-secret"
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Optional secret for webhook verification"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !webhookUrl}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                {loading ? '🔄 Adding...' : '🪝 Add Webhook'}
              </button>
            </form>

            {/* Current Webhooks */}
            {webhooks.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Active Webhooks
                </h3>
                <div className="space-y-3">
                  {webhooks.map((webhook) => (
                    <div key={webhook.id} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white break-all">
                            {webhook.url}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Created: {new Date(webhook.createdAt).toLocaleDateString()}
                          </p>
                          {webhook.lastTriggered && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Last triggered: {new Date(webhook.lastTriggered).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteWebhook(webhook.id)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
              <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                📡 Webhook Information
              </h4>
              <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <p>Webhooks will receive POST requests with JSON payloads containing:</p>
                <ul className="list-disc list-inside ml-4 space-y-1">
                  <li>Event type (outage, restoration, maintenance)</li>
                  <li>Affected service/provider</li>
                  <li>Timestamp and severity level</li>
                  <li>Detailed status information</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Incidents Tab */}
        {activeTab === 'incidents' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Recent Incidents
              </h3>
              <button
                onClick={fetchIncidents}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                🔄 Refresh
              </button>
            </div>

            {incidents.length > 0 ? (
              <div className="space-y-3">
                {incidents.map((incident) => (
                  <div key={incident.id} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {incident.title}
                      </h4>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          incident.status === 'resolved'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : incident.status === 'investigating'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {incident.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Provider: {incident.provider}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Severity: {incident.severity}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Started: {new Date(incident.startTime).toLocaleString()}
                    </p>
                    {incident.endTime && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Resolved: {new Date(incident.endTime).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No recent incidents to display.</p>
                <p className="text-sm mt-1">This is good news! 🎉</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
