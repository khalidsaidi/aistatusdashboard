'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.monitorProviderStatus = void 0;
const scheduler_1 = require('firebase-functions/v2/scheduler');
const firestore_1 = require('firebase-admin/firestore');
const v2_1 = require('firebase-functions/v2');
const pushNotifications_1 = require('./pushNotifications');
const db = (0, firestore_1.getFirestore)();
const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    url: 'https://status.openai.com/api/v2/status.json',
    statusPageUrl: 'https://status.openai.com',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    url: 'https://status.anthropic.com/api/v2/summary.json',
    statusPageUrl: 'https://status.anthropic.com',
  },
  {
    id: 'huggingface',
    name: 'HuggingFace',
    url: 'https://status.huggingface.co/api/v2/summary.json',
    statusPageUrl: 'https://status.huggingface.co',
  },
  {
    id: 'google-ai',
    name: 'Google AI',
    url: 'https://status.cloud.google.com/incidents.json',
    statusPageUrl: 'https://status.cloud.google.com',
  },
  {
    id: 'cohere',
    name: 'Cohere',
    url: 'https://status.cohere.com/api/v2/status.json',
    statusPageUrl: 'https://status.cohere.com',
  },
  {
    id: 'replicate',
    name: 'Replicate',
    url: 'https://www.replicatestatus.com/api/v2/status.json',
    statusPageUrl: 'https://www.replicatestatus.com',
  },
  {
    id: 'groq',
    name: 'Groq',
    url: 'https://groqstatus.com/api/v2/status.json',
    statusPageUrl: 'https://groqstatus.com',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://status.deepseek.com/api/v2/status.json',
    statusPageUrl: 'https://status.deepseek.com',
  },
  {
    id: 'meta',
    name: 'Meta AI',
    url: 'https://ai.meta.com',
    statusPageUrl: 'https://ai.meta.com',
  },
  {
    id: 'xai',
    name: 'xAI',
    url: 'https://x.ai',
    statusPageUrl: 'https://x.ai',
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    url: 'https://status.perplexity.ai',
    statusPageUrl: 'https://status.perplexity.ai',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    url: 'https://mistral.ai',
    statusPageUrl: 'https://mistral.ai',
  },
  {
    id: 'aws',
    name: 'AWS AI Services',
    url: 'https://status.aws.amazon.com/rss/all.rss',
    statusPageUrl: 'https://status.aws.amazon.com',
  },
  {
    id: 'azure',
    name: 'Azure AI Services',
    url: 'https://azurestatuscdn.azureedge.net/en-us/status/feed',
    statusPageUrl: 'https://status.azure.com',
  },
];
async function fetchProviderStatus(provider) {
  var _a, _b;
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(provider.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'AI-Status-Dashboard/1.0',
        Accept: 'application/json,text/html,application/rss+xml,*/*',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const responseTime = Date.now() - startTime;
    let status;
    // Handle different response formats based on provider
    if (provider.id === 'aws' || provider.id === 'azure') {
      const textResponse = await response.text();
      status = textResponse.length > 0 ? 'operational' : 'degraded';
    } else if (provider.id === 'huggingface') {
      const textResponse = await response.text();
      if (textResponse.includes('<!DOCTYPE')) {
        status = 'operational';
      } else {
        try {
          const data = JSON.parse(textResponse);
          const indicator =
            ((_a = data.status) === null || _a === void 0 ? void 0 : _a.indicator) || 'unknown';
          status =
            indicator === 'none'
              ? 'operational'
              : indicator === 'minor'
                ? 'degraded'
                : indicator === 'major' || indicator === 'critical'
                  ? 'down'
                  : 'operational';
        } catch (_c) {
          status = 'operational';
        }
      }
    } else if (['meta', 'xai', 'mistral', 'perplexity'].includes(provider.id)) {
      status = 'operational';
    } else {
      try {
        const data = await response.json();
        if (provider.id === 'google-ai') {
          const incidents = data;
          const hasActiveIncidents =
            Array.isArray(incidents) &&
            incidents.length > 0 &&
            incidents.some(
              (incident) =>
                !incident.end &&
                incident.status_impact &&
                ['SERVICE_OUTAGE', 'SERVICE_DISRUPTION'].includes(incident.status_impact)
            );
          status = hasActiveIncidents ? 'degraded' : 'operational';
        } else {
          const statusData = data;
          const indicator =
            ((_b = statusData.status) === null || _b === void 0 ? void 0 : _b.indicator) ||
            'unknown';
          status =
            indicator === 'none'
              ? 'operational'
              : indicator === 'minor'
                ? 'degraded'
                : indicator === 'major' || indicator === 'critical'
                  ? 'down'
                  : 'operational';
        }
      } catch (jsonError) {
        status = 'degraded';
        v2_1.logger.warn('Failed to parse JSON response', {
          provider: provider.id,
          error: jsonError instanceof Error ? jsonError.message : 'Unknown JSON error',
        });
      }
    }
    return {
      id: provider.id,
      name: provider.name,
      status,
      responseTime,
      statusCode: response.status,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      id: provider.id,
      name: provider.name,
      status: 'down',
      responseTime,
      statusCode: 0,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
// Scheduled function to monitor status changes
exports.monitorProviderStatus = (0, scheduler_1.onSchedule)(
  {
    schedule: 'every 5 minutes',
    timeZone: 'UTC',
    region: 'us-central1',
  },
  async (event) => {
    var _a, _b, _c;
    v2_1.logger.info('Starting scheduled status monitoring');
    try {
      // Fetch current status for all providers
      const statusPromises = PROVIDERS.map((provider) => fetchProviderStatus(provider));
      const currentStatuses = await Promise.all(statusPromises);
      // Get previous statuses from Firestore
      const previousStatusesSnapshot = await db.collection('current_status').get();
      const previousStatuses = new Map();
      previousStatusesSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        previousStatuses.set(data.id, data);
      });
      // Check for status changes and send notifications
      const batch = db.batch();
      const statusChanges = [];
      for (const currentStatus of currentStatuses) {
        const previousStatus = previousStatuses.get(currentStatus.id) || null;
        // Update current status in Firestore
        const statusRef = db.collection('current_status').doc(currentStatus.id);
        batch.set(statusRef, currentStatus);
        // Check if status changed
        if (previousStatus && currentStatus.status !== previousStatus.status) {
          v2_1.logger.info('Status change detected', {
            provider: currentStatus.id,
            previous: previousStatus.status,
            current: currentStatus.status,
          });
          statusChanges.push({
            provider: currentStatus,
            previous: previousStatus,
          });
          // Send push notification
          try {
            await (0, pushNotifications_1.sendStatusChangePushNotifications)(
              currentStatus.id,
              currentStatus.name,
              currentStatus.status,
              previousStatus.status
            );
          } catch (error) {
            v2_1.logger.error('Failed to send push notification', {
              provider: currentStatus.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
        // Log status result
        const logRef = db.collection('status_logs').doc();
        batch.set(
          logRef,
          Object.assign(Object.assign({}, currentStatus), {
            timestamp: new Date(),
            statusChanged: previousStatus ? currentStatus.status !== previousStatus.status : false,
          })
        );
      }
      // Commit all updates
      await batch.commit();
      v2_1.logger.info('Status monitoring completed', {
        totalProviders: currentStatuses.length,
        statusChanges: statusChanges.length,
        operational: currentStatuses.filter((s) => s.status === 'operational').length,
        degraded: currentStatuses.filter((s) => s.status === 'degraded').length,
        down: currentStatuses.filter((s) => s.status === 'down').length,
      });
      // Create incidents for new outages
      for (const change of statusChanges) {
        if (
          ((_a = change.previous) === null || _a === void 0 ? void 0 : _a.status) ===
            'operational' &&
          change.provider.status !== 'operational'
        ) {
          // Create incident
          const incidentRef = db.collection('incidents').doc();
          await incidentRef.set({
            provider: change.provider.id,
            providerName: change.provider.name,
            title: `${change.provider.name} Service Issues`,
            status: change.provider.status === 'down' ? 'major_outage' : 'service_degradation',
            severity: change.provider.status === 'down' ? 'critical' : 'medium',
            startTime: new Date(),
            lastUpdate: new Date(),
            description: `${change.provider.name} is experiencing ${change.provider.status === 'down' ? 'service outages' : 'performance issues'}`,
            statusPageUrl:
              (_b = PROVIDERS.find((p) => p.id === change.provider.id)) === null || _b === void 0
                ? void 0
                : _b.statusPageUrl,
          });
          v2_1.logger.info('Incident created', {
            provider: change.provider.id,
            incidentId: incidentRef.id,
            status: change.provider.status,
          });
        }
        // Update incident when service recovers
        if (
          ((_c = change.previous) === null || _c === void 0 ? void 0 : _c.status) !==
            'operational' &&
          change.provider.status === 'operational'
        ) {
          // Find and update the most recent incident
          const incidentsSnapshot = await db
            .collection('incidents')
            .where('provider', '==', change.provider.id)
            .where('endTime', '==', null)
            .orderBy('startTime', 'desc')
            .limit(1)
            .get();
          if (!incidentsSnapshot.empty) {
            const incidentDoc = incidentsSnapshot.docs[0];
            await incidentDoc.ref.update({
              status: 'resolved',
              endTime: new Date(),
              lastUpdate: new Date(),
              description: `${change.provider.name} services have been restored and are operating normally`,
            });
            v2_1.logger.info('Incident resolved', {
              provider: change.provider.id,
              incidentId: incidentDoc.id,
            });
          }
        }
      }
    } catch (error) {
      v2_1.logger.error('Status monitoring failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);
//# sourceMappingURL=statusMonitor.js.map
