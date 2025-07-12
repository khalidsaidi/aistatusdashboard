'use client';

import { useState } from 'react';
import Image from 'next/image';
import { trackApiCall } from '@/lib/firebase';

interface NotificationSubscriptionProps {}

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', logo: '/logos/openai.svg' },
  { id: 'anthropic', name: 'Anthropic', logo: '/logos/anthropic.svg' },
  { id: 'huggingface', name: 'HuggingFace', logo: '/logos/huggingface.svg' },
  { id: 'google-ai', name: 'Google AI', logo: '/logos/google-ai.svg' },
  { id: 'cohere', name: 'Cohere', logo: '/logos/cohere.svg' },
  { id: 'replicate', name: 'Replicate', logo: '/logos/replicate.svg' },
  { id: 'groq', name: 'Groq', logo: '/logos/groq.svg' },
  { id: 'deepseek', name: 'DeepSeek', logo: '/logos/deepseek.svg' },
  { id: 'meta', name: 'Meta AI', logo: '/logos/meta.svg' },
  { id: 'xai', name: 'xAI', logo: '/logos/xai.svg' },
  { id: 'perplexity', name: 'Perplexity AI', logo: '/logos/perplexity.svg' },
  { id: 'claude', name: 'Claude', logo: '/logos/claude.svg' },
  { id: 'mistral', name: 'Mistral AI', logo: '/logos/mistral.svg' },
  { id: 'aws', name: 'AWS AI Services', logo: '/logos/aws.svg' },
  { id: 'azure', name: 'Azure AI Services', logo: '/logos/azure.svg' },
];

export function NotificationSubscription({}: NotificationSubscriptionProps) {
  const [email, setEmail] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [testEmail, setTestEmail] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [webhookMessage, setWebhookMessage] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [loading, setLoading] = useState({
    email: false,
    webhook: false,
    test: false,
  });

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  };

  const toggleProvider = (providerId: string) => {
    setSelectedProviders((prev) =>
      prev.includes(providerId) ? prev.filter((id) => id !== providerId) : [...prev, providerId]
    );
  };

  const selectAllProviders = () => {
    setSelectedProviders(PROVIDERS.map((p) => p.id));
  };

  const clearAllProviders = () => {
    setSelectedProviders([]);
  };

  const handleEmailSubscribe = async () => {
    if (!validateEmail(email)) {
      setEmailMessage('Please enter a valid email address');
      return;
    }

    if (selectedProviders.length === 0) {
      setEmailMessage('Please select at least one provider');
      return;
    }

    setLoading((prev) => ({ ...prev, email: true }));
    setEmailMessage('');

    try {
      const response = await trackApiCall('subscribeEmail', () =>
        fetch('/api/subscribeEmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, providers: selectedProviders }),
        })
      );

      const data = await response.json();

      if (response.ok) {
        setEmailMessage(data.message || 'Subscribed successfully');
        setEmail('');
        setSelectedProviders([]);
      } else {
        setEmailMessage(data.error || 'Failed to subscribe');
      }
    } catch (error) {
      setEmailMessage('Network error. Please try again.');
    } finally {
      setLoading((prev) => ({ ...prev, email: false }));
    }
  };

  const handleEmailUnsubscribe = async () => {
    if (!validateEmail(email)) {
      setEmailMessage('Please enter a valid email address');
      return;
    }

    setLoading((prev) => ({ ...prev, email: true }));
    setEmailMessage('');

    try {
      const response = await trackApiCall('unsubscribeEmail', () =>
        fetch('/api/unsubscribeEmail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
      );

      const data = await response.json();

      if (response.ok) {
        setEmailMessage(data.message || 'Unsubscribed successfully');
        setEmail('');
      } else {
        setEmailMessage(data.error || 'Failed to unsubscribe');
      }
    } catch (error) {
      setEmailMessage('Network error. Please try again.');
    } finally {
      setLoading((prev) => ({ ...prev, email: false }));
    }
  };

  const handleWebhookSubscribe = async () => {
    if (!validateUrl(webhookUrl)) {
      setWebhookMessage('Please enter a valid URL');
      return;
    }

    if (selectedProviders.length === 0) {
      setWebhookMessage('Please select at least one provider');
      return;
    }

    setLoading((prev) => ({ ...prev, webhook: true }));
    setWebhookMessage('');

    try {
      const response = await trackApiCall('subscribeWebhook', () =>
        fetch('/api/subscribeWebhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl, providers: selectedProviders }),
        })
      );

      const data = await response.json();

      if (response.ok) {
        setWebhookMessage(data.message || 'Webhook added successfully');
        setWebhookUrl('');
        setSelectedProviders([]);
      } else {
        setWebhookMessage(data.error || 'Failed to add webhook');
      }
    } catch (error) {
      setWebhookMessage('Network error. Please try again.');
    } finally {
      setLoading((prev) => ({ ...prev, webhook: false }));
    }
  };

  const handleTestNotification = async () => {
    if (!validateEmail(testEmail)) {
      setTestMessage('Please enter a valid email address');
      return;
    }

    setLoading((prev) => ({ ...prev, test: true }));
    setTestMessage('');

    try {
      const response = await trackApiCall('sendTestNotification', () =>
        fetch('/api/sendTestNotification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: testEmail, type: 'status' }),
        })
      );

      const data = await response.json();

      if (response.ok) {
        setTestMessage(data.message || 'Test notification sent');
      } else {
        setTestMessage(data.error || 'Failed to send test notification');
      }
    } catch (error) {
      setTestMessage('Network error. Please try again.');
    } finally {
      setLoading((prev) => ({ ...prev, test: false }));
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🔔 AI Status Dashboard Notifications
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Stay informed about AI service status changes across 15+ providers. Get instant alerts via
          email or webhooks.
        </p>
      </div>

      {/* Provider Selection */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Select Providers ({selectedProviders.length}/15)
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={selectAllProviders}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 py-2 px-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Select All
            </button>
            <button
              onClick={clearAllProviders}
              className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 py-2 px-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              onClick={() => toggleProvider(provider.id)}
              className={`p-3 rounded-lg border-2 transition-all ${
                selectedProviders.includes(provider.id)
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <div className="flex flex-col items-center space-y-2">
                <Image
                  src={provider.logo}
                  alt={provider.name}
                  width={32}
                  height={32}
                  loading="lazy"
                  className="w-8 h-8"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {provider.name}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Email Notifications */}
      <form
        aria-label="Email notifications"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleEmailSubscribe();
        }}
      >
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Email Notifications
          </h3>
          <div className="space-y-3">
            <div>
              <label
                htmlFor="email-input"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Email Address
              </label>
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                aria-describedby="email-help"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <p id="email-help" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                We&apos;ll send you notifications when service status changes
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={loading.email}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {loading.email ? 'Subscribing...' : 'Subscribe'}
              </button>

              <button
                type="button"
                onClick={handleEmailUnsubscribe}
                disabled={loading.email}
                className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                {loading.email ? 'Processing...' : 'Unsubscribe'}
              </button>
            </div>

            {emailMessage && (
              <div
                className={`p-3 rounded-md text-sm ${
                  emailMessage.toLowerCase().includes('error') ||
                  emailMessage.toLowerCase().includes('failed') ||
                  emailMessage.toLowerCase().includes('already')
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                }`}
              >
                {emailMessage}
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Webhook Notifications */}
      <form
        aria-label="Webhook notifications"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          handleWebhookSubscribe();
        }}
      >
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Webhook Notifications
          </h3>
          <div className="space-y-3">
            <div>
              <label
                htmlFor="webhook-input"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Webhook URL
              </label>
              <input
                id="webhook-input"
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-app.com/webhook"
                aria-describedby="webhook-help"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <p id="webhook-help" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                We&apos;ll POST status change notifications to this URL
              </p>
            </div>

            <button
              type="submit"
              disabled={loading.webhook}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              {loading.webhook ? 'Adding...' : 'Add Webhook'}
            </button>

            {webhookMessage && (
              <div
                className={`p-3 rounded-md text-sm ${
                  webhookMessage.toLowerCase().includes('error') ||
                  webhookMessage.toLowerCase().includes('failed')
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                }`}
              >
                {webhookMessage}
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Test Notification */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Test Notifications
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Send a test notification to verify your setup
          </p>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="test-email-input"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Test Email Address
              </label>
              <input
                id="test-email-input"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <button
              onClick={handleTestNotification}
              disabled={loading.test}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              {loading.test ? 'Sending...' : 'Send Test Notification'}
            </button>

            {testMessage && (
              <div
                className={`p-3 rounded-md text-sm ${
                  testMessage.toLowerCase().includes('error') ||
                  testMessage.toLowerCase().includes('failed')
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                }`}
              >
                {testMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
