import * as functions from 'firebase-functions';

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';
import { emailService } from './emailService';
import fetch from 'node-fetch';

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

// Create Express app
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Provider configurations
interface Provider {
  id: string;
  name: string;
  url: string;
  statusPageUrl: string;
}

const PROVIDERS: Provider[] = [
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
  // Additional AI Providers - using alternative detection methods
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

// Rate limiting storage
interface RateLimit {
  count: number;
  resetTime: number;
}

const rateLimits = new Map<string, RateLimit>();

function checkRateLimit(clientId: string, maxRequests = 60, windowMs = 60000): boolean {
  const now = Date.now();
  const clientLimit = rateLimits.get(clientId);

  if (!clientLimit || now > clientLimit.resetTime) {
    rateLimits.set(clientId, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (clientLimit.count >= maxRequests) {
    return false;
  }

  clientLimit.count++;
  return true;
}

function getClientId(req: express.Request): string {
  return req.ip || 'unknown';
}

// Fetch provider status
interface ProviderStatus {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'down';
  responseTime: number;
  statusCode: number;
  lastChecked: string;
  error?: string;
}

async function fetchProviderStatus(provider: Provider): Promise<ProviderStatus> {
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
    let status: 'operational' | 'degraded' | 'down';

    // Handle different response formats based on provider
    if (provider.id === 'aws' || provider.id === 'azure') {
      // RSS/XML feeds - treat as operational if we can fetch them
      const textResponse = await response.text();
      status = textResponse.length > 0 ? 'operational' : 'degraded';
    } else if (provider.id === 'huggingface') {
      // HuggingFace may return HTML instead of JSON
      const textResponse = await response.text();
      if (textResponse.includes('<!DOCTYPE')) {
        status = 'operational';
      } else {
        try {
          const data = JSON.parse(textResponse);
          const indicator = data.status?.indicator || 'unknown';
          status =
            indicator === 'none'
              ? 'operational'
              : indicator === 'minor'
                ? 'degraded'
                : indicator === 'major' || indicator === 'critical'
                  ? 'down'
                  : 'operational';
        } catch {
          status = 'operational'; // Fallback if we can access the page
        }
      }
    } else if (['meta', 'xai', 'mistral', 'perplexity'].includes(provider.id)) {
      // These providers don't have proper status APIs, just check if accessible
      status = 'operational';
    } else {
      // JSON responses
      try {
        const data = await response.json();

        if (provider.id === 'google-ai') {
          // Google Cloud status format - API returns array of incidents directly
          const incidents = data as Array<{
            id: string;
            end?: string;
            status_impact?: string;
          }>;
          const hasActiveIncidents =
            Array.isArray(incidents) &&
            incidents.length > 0 &&
            incidents.some(
              (incident) =>
                !incident.end && // Incident is ongoing
                incident.status_impact &&
                ['SERVICE_OUTAGE', 'SERVICE_DISRUPTION'].includes(incident.status_impact)
            );
          status = hasActiveIncidents ? 'degraded' : 'operational';
        } else {
          // Standard status page format (StatusPage.io)
          const statusData = data as {
            status?: { indicator?: string };
          };
          const indicator = statusData.status?.indicator || 'unknown';

          // Map status page indicators to our status types
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
        // If JSON parsing fails, treat as degraded
        status = 'degraded';
        console.warn('Failed to parse JSON response', {
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

// Status endpoint
app.get('/status', async (req: express.Request, res: express.Response) => {
  const clientId = getClientId(req);

  if (!checkRateLimit(clientId, 30)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  try {
    // Get all providers
    const statusPromises = PROVIDERS.map((provider) => fetchProviderStatus(provider));
    const providers = await Promise.all(statusPromises);

    // Save to Firestore with proper error handling
    try {
      const batch = db.batch();
      providers.forEach((provider) => {
        const docRef = db.collection('status_history').doc();
        batch.set(docRef, {
          providerId: provider.id,
          providerName: provider.name,
          status: provider.status,
          responseTime: provider.responseTime,
          error: provider.error || null,
          checkedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          statusPageUrl: PROVIDERS.find((p) => p.id === provider.id)?.statusPageUrl || '',
        });
      });
      await batch.commit();
      console.log('Status results saved to Firestore');
    } catch (firestoreError) {
      console.error('Failed to save to Firestore:', firestoreError);
      // Continue with response even if Firestore fails
    }

    // Calculate summary
    const operational = providers.filter((p) => p.status === 'operational').length;
    const degraded = providers.filter((p) => p.status === 'degraded').length;
    const down = providers.filter((p) => p.status === 'down').length;

    res.json({
      timestamp: new Date().toISOString(),
      summary: {
        total: providers.length,
        operational,
        degraded,
        down,
        unknown: 0,
      },
      providers: providers.map((p) => ({
        ...p,
        statusPageUrl: PROVIDERS.find((provider) => provider.id === p.id)?.statusPageUrl,
      })),
    });
  } catch (error) {
    console.error('Status endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health endpoint
app.get('/health', async (req: express.Request, res: express.Response) => {
  const clientId = getClientId(req);

  if (!checkRateLimit(clientId, 30)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  try {
    const force = req.query.force === 'true';
    let results: any[] = [];

    if (force) {
      const healthPromises = PROVIDERS.map(async (provider) => {
        const status = await fetchProviderStatus(provider);
        return {
          provider: provider.id,
          healthy: status.status === 'operational',
          responseTime: status.responseTime,
          lastChecked: status.lastChecked,
        };
      });
      results = await Promise.all(healthPromises);
    } else {
      const recentResults = await db
        .collection('status_results')
        .orderBy('timestamp', 'desc')
        .limit(PROVIDERS.length)
        .get();

      if (recentResults.size > 0) {
        results = recentResults.docs.map((doc) => {
          const data = doc.data();
          return {
            provider: data.id,
            healthy: data.status === 'operational',
            responseTime: data.responseTime,
            lastChecked: data.lastChecked,
          };
        });
      } else {
        const healthPromises = PROVIDERS.map(async (provider) => {
          const status = await fetchProviderStatus(provider);
          return {
            provider: provider.id,
            healthy: status.status === 'operational',
            responseTime: status.responseTime,
            lastChecked: status.lastChecked,
          };
        });
        results = await Promise.all(healthPromises);
      }
    }

    const summary = {
      timestamp: new Date().toISOString(),
      totalProviders: results.length,
      healthy: results.filter((r) => r.healthy).length,
      unhealthy: results.filter((r) => !r.healthy).length,
      avgResponseTime: Math.round(
        results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
      ),
      providers: results,
    };

    res.json(summary);
  } catch (error) {
    console.error('Health endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Comments endpoints
app.get('/comments', async (req: express.Request, res: express.Response) => {
  const clientId = getClientId(req);

  if (!checkRateLimit(clientId, 30)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  try {
    // Get comments from Firestore
    const commentsSnapshot = await db
      .collection('comments')
      .where('approved', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const comments = commentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
    }));

    res.json(comments);
  } catch (error) {
    console.error('Comments endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/comments', async (req: express.Request, res: express.Response) => {
  const clientId = getClientId(req);

  if (!checkRateLimit(clientId, 5)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  try {
    const { author, content, provider } = req.body;

    if (!author || !content) {
      res.status(400).json({ error: 'Author and content are required' });
      return;
    }

    // Save comment to Firestore
    const comment = {
      author: author.substring(0, 50),
      content: content.substring(0, 500),
      provider: provider || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      approved: false, // Requires moderation
      ip: clientId,
    };

    const docRef = await db.collection('comments').add(comment);

    res.status(201).json({
      id: docRef.id,
      message: 'Comment submitted for moderation',
    });
  } catch (error) {
    console.error('Comment creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Notification endpoints
app.get('/notifications', async (req: express.Request, res: express.Response) => {
  const clientId = getClientId(req);

  if (!checkRateLimit(clientId, 30)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  try {
    const subscriptionsSnapshot = await db
      .collection('email_subscriptions')
      .where('active', '==', true)
      .limit(50)
      .get();

    const subscriptions = subscriptionsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ subscriptions });
  } catch (error) {
    console.error('Error fetching subscriptions', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/incidents', async (req: express.Request, res: express.Response) => {
  const clientId = getClientId(req);

  if (!checkRateLimit(clientId, 30)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  try {
    const limit = parseInt(req.query.limit as string) || 10;

    // Get recent incidents from Firestore
    const incidentsSnapshot = await db
      .collection('incidents')
      .orderBy('startTime', 'desc')
      .limit(limit)
      .get();

    const incidents = incidentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      startTime: doc.data().startTime?.toDate?.()?.toISOString() || doc.data().startTime,
      lastUpdate: doc.data().lastUpdate?.toDate?.()?.toISOString() || doc.data().lastUpdate,
      endTime: doc.data().endTime?.toDate?.()?.toISOString() || doc.data().endTime,
    }));

    res.json({ incidents });
  } catch (error) {
    console.error('Error fetching incidents', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/subscribeEmail', async (req: express.Request, res: express.Response) => {
  const clientId = getClientId(req);

  if (!checkRateLimit(clientId, 5)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  try {
    const { email, providers } = req.body;

    if (!email || !Array.isArray(providers)) {
      res.status(400).json({ error: 'Email and providers array required' });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // Store subscription in Firestore
    const subscriptionRef = db.collection('email_subscriptions').doc(email);
    await subscriptionRef.set({
      email,
      providers,
      subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
      active: true,
    });

    console.log('Email subscription created', { email, providers });
    res.json({ success: true, message: 'Subscription created successfully' });
  } catch (error) {
    console.error('Error creating email subscription', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/unsubscribeEmail', async (req: express.Request, res: express.Response) => {
  const clientId = getClientId(req);

  if (!checkRateLimit(clientId, 5)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email required' });
      return;
    }

    // Remove subscription from Firestore
    const subscriptionRef = db.collection('email_subscriptions').doc(email);
    await subscriptionRef.delete();

    console.log('Email subscription removed', { email });
    res.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Error removing email subscription', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/subscribeWebhook', async (req: express.Request, res: express.Response) => {
  const clientId = getClientId(req);

  if (!checkRateLimit(clientId, 5)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  try {
    const { webhookUrl, providers } = req.body;

    if (!webhookUrl || !Array.isArray(providers)) {
      res.status(400).json({ error: 'Webhook URL and providers array required' });
      return;
    }

    // Validate webhook URL format
    try {
      new URL(webhookUrl);
    } catch {
      res.status(400).json({ error: 'Invalid webhook URL format' });
      return;
    }

    // Store subscription in Firestore
    const webhookId = `webhook_${Date.now()}`;
    const subscriptionRef = db.collection('webhook_subscriptions').doc(webhookId);
    await subscriptionRef.set({
      webhookUrl,
      providers,
      subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
      active: true,
    });

    console.log('Webhook subscription created', { webhookUrl, providers });
    res.json({ success: true, message: 'Webhook subscription created successfully', webhookId });
  } catch (error) {
    console.error('Error creating webhook subscription', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/sendTestNotification', async (req: express.Request, res: express.Response) => {
  const clientId = getClientId(req);

  if (!checkRateLimit(clientId, 5)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email required' });
      return;
    }

    // For now, just simulate sending a test notification
    console.log('Test notification sent to:', email);
    res.json({ success: true, message: 'Test notification sent successfully' });
  } catch (error) {
    console.error('Error sending test notification', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// RSS Feed endpoint
app.get('/rss.xml', async (req: express.Request, res: express.Response) => {
  const clientId = getClientId(req);

  if (!checkRateLimit(clientId, 30)) {
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  try {
    // Get recent incidents from Firestore
    const incidentsSnapshot = await db
      .collection('incidents')
      .orderBy('startTime', 'desc')
      .limit(20)
      .get();

    const incidents = incidentsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'Service Incident',
        description: data.description || 'Service status update',
        provider: data.provider || 'Unknown',
        status: data.status || 'investigating',
        startTime: data.startTime?.toDate?.() || new Date(),
        link: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'}/incidents/${doc.id}`,
      };
    });

    const now = new Date();
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI Status Dashboard - Service Incidents</title>
    <link>${process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'}</link>
    <description>Real-time status updates for AI services and providers</description>
    <language>en-us</language>
    <lastBuildDate>${now.toUTCString()}</lastBuildDate>
    <atom:link href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'}/rss.xml" rel="self" type="application/rss+xml"/>
    ${incidents
      .map(
        (incident) => `
    <item>
      <title>[${incident.provider}] ${incident.title}</title>
      <description>${incident.description}</description>
      <link>${incident.link}</link>
      <guid isPermaLink="false">${incident.id}</guid>
      <pubDate>${incident.startTime.toUTCString()}</pubDate>
      <category>${incident.status}</category>
    </item>`
      )
      .join('')}
  </channel>
</rss>`;

    res.set('Content-Type', 'application/rss+xml');
    res.send(rssXml);
  } catch (error) {
    console.error('RSS feed error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export the Express app as a Cloud Function
export const api = functions.https.onRequest(app);

// Individual Cloud Functions
export const subscribeEmail = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { email, providers } = req.body;

    if (!email || !Array.isArray(providers)) {
      res.status(400).json({ error: 'Email and providers array required' });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // Store subscription in Firestore
    const subscriptionRef = db.collection('email_subscriptions').doc(email);
    await subscriptionRef.set({
      email,
      providers,
      subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
      active: true,
    });

    console.log('Email subscription created', { email, providers });
    res.json({ success: true, message: 'Subscription created successfully' });
  } catch (error) {
    console.error('Error creating email subscription', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const unsubscribeEmail = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email required' });
      return;
    }

    // Remove subscription from Firestore
    const subscriptionRef = db.collection('email_subscriptions').doc(email);
    await subscriptionRef.delete();

    console.log('Email subscription removed', { email });
    res.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Error removing email subscription', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const subscribeWebhook = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { url, providers } = req.body;

    if (!url || !Array.isArray(providers)) {
      res.status(400).json({ error: 'Webhook URL and providers array required' });
      return;
    }

    // Validate webhook URL format
    try {
      new URL(url);
    } catch {
      res.status(400).json({ error: 'Invalid webhook URL format' });
      return;
    }

    // Store subscription in Firestore
    const webhookId = `webhook_${Date.now()}`;
    const subscriptionRef = db.collection('webhook_subscriptions').doc(webhookId);
    await subscriptionRef.set({
      webhookUrl: url,
      providers,
      subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
      active: true,
    });

    console.log('Webhook subscription created', { url, providers });
    res.json({ success: true, message: 'Webhook subscription created successfully', webhookId });
  } catch (error) {
    console.error('Error creating webhook subscription', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const subscribePush = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { token, providers } = req.body;

    if (!token || !Array.isArray(providers)) {
      res.status(400).json({ error: 'Token and providers array required' });
      return;
    }

    // Store subscription in Firestore
    const subscriptionRef = db.collection('push_subscriptions').doc(token);
    await subscriptionRef.set({
      token,
      providers,
      subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
      active: true,
    });

    console.log('Push subscription created', { token: token.substring(0, 20) + '...', providers });
    res.json({ success: true, message: 'Push subscription created successfully' });
  } catch (error) {
    console.error('Error creating push subscription', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const unsubscribePush = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Token required' });
      return;
    }

    // Remove subscription from Firestore
    const subscriptionRef = db.collection('push_subscriptions').doc(token);
    await subscriptionRef.delete();

    console.log('Push subscription removed', { token: token.substring(0, 20) + '...' });
    res.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Error removing push subscription', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const sendTestNotification = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email required' });
      return;
    }

    // Send test email using email service
    const success = await emailService.sendStatusAlert(email, 'Test Provider', 'operational');

    if (success) {
      console.log('Test notification sent to:', email);
      res.json({ success: true, message: 'Test notification sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  } catch (error) {
    console.error('Error sending test notification', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const sendTestPushNotification = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { subscription, message } = req.body;

    if (!subscription || !message) {
      res.status(400).json({ error: 'Subscription and message required' });
      return;
    }

    // For now, simulate push notification
    console.log('Test push notification sent:', { subscription, message });
    res.json({ success: true, message: 'Test push notification sent successfully' });
  } catch (error) {
    console.error('Error sending test push notification', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const monitorProviderStatus = onSchedule('every 5 minutes', async (event) => {
  console.log('Running scheduled status monitoring...');

  try {
    // Fetch status for all providers
    const statusPromises = PROVIDERS.map((provider) => fetchProviderStatus(provider));
    const providers = await Promise.all(statusPromises);

    // Save results to Firestore
    const batch = db.batch();
    providers.forEach((provider) => {
      const docRef = db.collection('status_results').doc();
      batch.set(docRef, {
        ...provider,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    console.log('Status monitoring completed for', providers.length, 'providers');
  } catch (error) {
    console.error('Error in scheduled monitoring:', error);
  }
});
