'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { providerService } from '@/lib/services/providers';
import { getAnalyticsSessionId } from '@/lib/utils/analytics-client';

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
  const [activeTab, setActiveTab] = useState('email');
  const [email, setEmail] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

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
        alert('Check your email to confirm subscription!');
      } else {
        alert('Failed to subscribe.');
      }
    } catch (error) {
      console.error(error);
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
        alert('Webhook added successfully!');
      } else {
        alert('Failed to add webhook.');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'incidents') {
      fetchIncidents();
    }
  }, [activeTab, fetchIncidents]);

  const providers = providerService.getProviders();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="flex border-b border-gray-100 dark:border-gray-700">
        {['email', 'webhooks', 'incidents'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${activeTab === tab
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/20'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="p-8">
        {activeTab === 'email' && (
          <form onSubmit={handleEmailSubscription} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="name@example.com"
                required
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {providers.map((p) => {
                const label = p.displayName || p.name;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setSelectedProviders((prev) =>
                        prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                      )
                    }
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                      selectedProviders.includes(p.id)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <button
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Subscribing...' : 'Subscribe to Alerts'}
            </button>
          </form>
        )}

        {activeTab === 'webhooks' && (
          <form onSubmit={handleWebhookSubmission} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Webhook URL</label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="https://api.yoursite.com/webhook"
                required
              />
            </div>
            <button
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Register Webhook'}
            </button>
          </form>
        )}

        {activeTab === 'incidents' && (
          <div className="space-y-4">
            {incidents.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No recent incidents found.
              </div>
            ) : (
              incidents.map((incident) => (
                <div key={incident.id} className="p-4 border border-gray-100 dark:border-gray-700 rounded-lg">
                  <h4 className="font-bold text-gray-900 dark:text-white">{incident.title}</h4>
                  <p className="text-sm text-gray-500">{incident.provider} - {incident.status}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
