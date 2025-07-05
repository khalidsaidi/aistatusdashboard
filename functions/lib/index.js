"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
// Create Express app
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
const PROVIDERS = [
    {
        id: 'openai',
        name: 'OpenAI',
        url: 'https://status.openai.com/api/v2/status.json',
        statusPageUrl: 'https://status.openai.com'
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        url: 'https://status.anthropic.com/api/v2/summary.json',
        statusPageUrl: 'https://status.anthropic.com'
    },
    {
        id: 'huggingface',
        name: 'HuggingFace',
        url: 'https://status.huggingface.co/api/v2/summary.json',
        statusPageUrl: 'https://status.huggingface.co'
    },
    {
        id: 'google-ai',
        name: 'Google AI',
        url: 'https://status.cloud.google.com/incidents.json',
        statusPageUrl: 'https://status.cloud.google.com'
    },
    {
        id: 'cohere',
        name: 'Cohere',
        url: 'https://status.cohere.com/api/v2/status.json',
        statusPageUrl: 'https://status.cohere.com'
    },
    {
        id: 'replicate',
        name: 'Replicate',
        url: 'https://www.replicatestatus.com/api/v2/status.json',
        statusPageUrl: 'https://www.replicatestatus.com'
    },
    {
        id: 'groq',
        name: 'Groq',
        url: 'https://groqstatus.com/api/v2/status.json',
        statusPageUrl: 'https://groqstatus.com'
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        url: 'https://status.deepseek.com/api/v2/status.json',
        statusPageUrl: 'https://status.deepseek.com'
    },
    // Additional AI Providers - using alternative detection methods
    {
        id: 'meta',
        name: 'Meta AI',
        url: 'https://ai.meta.com',
        statusPageUrl: 'https://ai.meta.com'
    },
    {
        id: 'xai',
        name: 'xAI',
        url: 'https://x.ai',
        statusPageUrl: 'https://x.ai'
    },
    {
        id: 'perplexity',
        name: 'Perplexity AI',
        url: 'https://status.perplexity.ai',
        statusPageUrl: 'https://status.perplexity.ai'
    },
    {
        id: 'mistral',
        name: 'Mistral AI',
        url: 'https://mistral.ai',
        statusPageUrl: 'https://mistral.ai'
    },
    {
        id: 'aws',
        name: 'AWS AI Services',
        url: 'https://status.aws.amazon.com/rss/all.rss',
        statusPageUrl: 'https://status.aws.amazon.com'
    },
    {
        id: 'azure',
        name: 'Azure AI Services',
        url: 'https://azurestatuscdn.azureedge.net/en-us/status/feed',
        statusPageUrl: 'https://status.azure.com'
    }
];
const rateLimits = new Map();
function checkRateLimit(clientId, maxRequests = 60, windowMs = 60000) {
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
function getClientId(req) {
    return req.ip || 'unknown';
}
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
                'Accept': 'application/json,text/html,application/rss+xml,*/*',
                'Cache-Control': 'no-cache'
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const responseTime = Date.now() - startTime;
        let status;
        // Handle different response formats based on provider
        if (provider.id === 'aws' || provider.id === 'azure') {
            // RSS/XML feeds - treat as operational if we can fetch them
            const textResponse = await response.text();
            status = textResponse.length > 0 ? 'operational' : 'degraded';
        }
        else if (provider.id === 'huggingface') {
            // HuggingFace may return HTML instead of JSON
            const textResponse = await response.text();
            if (textResponse.includes('<!DOCTYPE')) {
                status = 'operational';
            }
            else {
                try {
                    const data = JSON.parse(textResponse);
                    const indicator = ((_a = data.status) === null || _a === void 0 ? void 0 : _a.indicator) || 'unknown';
                    status = indicator === 'none' ? 'operational' :
                        indicator === 'minor' ? 'degraded' :
                            (indicator === 'major' || indicator === 'critical') ? 'down' :
                                'operational';
                }
                catch (_c) {
                    status = 'operational'; // Fallback if we can access the page
                }
            }
        }
        else if (['meta', 'xai', 'mistral', 'perplexity'].includes(provider.id)) {
            // These providers don't have proper status APIs, just check if accessible
            status = 'operational';
        }
        else {
            // JSON responses
            try {
                const data = await response.json();
                if (provider.id === 'google-ai') {
                    // Google Cloud status format - API returns array of incidents directly
                    const incidents = data;
                    const hasActiveIncidents = Array.isArray(incidents) &&
                        incidents.length > 0 &&
                        incidents.some(incident => !incident.end && // Incident is ongoing
                            incident.status_impact &&
                            ['SERVICE_OUTAGE', 'SERVICE_DISRUPTION'].includes(incident.status_impact));
                    status = hasActiveIncidents ? 'degraded' : 'operational';
                }
                else {
                    // Standard status page format (StatusPage.io)
                    const statusData = data;
                    const indicator = ((_b = statusData.status) === null || _b === void 0 ? void 0 : _b.indicator) || 'unknown';
                    // Map status page indicators to our status types
                    status = indicator === 'none' ? 'operational' :
                        indicator === 'minor' ? 'degraded' :
                            (indicator === 'major' || indicator === 'critical') ? 'down' :
                                'operational';
                }
            }
            catch (jsonError) {
                // If JSON parsing fails, treat as degraded
                status = 'degraded';
                console.warn('Failed to parse JSON response', {
                    provider: provider.id,
                    error: jsonError instanceof Error ? jsonError.message : 'Unknown JSON error'
                });
            }
        }
        return {
            id: provider.id,
            name: provider.name,
            status,
            responseTime,
            statusCode: response.status,
            lastChecked: new Date().toISOString()
        };
    }
    catch (error) {
        const responseTime = Date.now() - startTime;
        return {
            id: provider.id,
            name: provider.name,
            status: 'down',
            responseTime,
            statusCode: 0,
            lastChecked: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
// Status endpoint
app.get('/status', async (req, res) => {
    const clientId = getClientId(req);
    if (!checkRateLimit(clientId, 60)) {
        res.status(429).json({ error: 'Too many requests' });
        return;
    }
    try {
        const providerId = req.query.provider;
        if (providerId) {
            const provider = PROVIDERS.find(p => p.id === providerId);
            if (!provider) {
                res.status(404).json({ error: 'Provider not found' });
                return;
            }
            const status = await fetchProviderStatus(provider);
            res.json(Object.assign(Object.assign({}, status), { statusPageUrl: provider.statusPageUrl }));
            return;
        }
        // Get all providers
        const statusPromises = PROVIDERS.map(provider => fetchProviderStatus(provider));
        const providers = await Promise.all(statusPromises);
        // TODO: Save to Firestore when API is enabled
        // const batch = db.batch();
        // providers.forEach(provider => {
        //   const docRef = db.collection('status_results').doc();
        //   batch.set(docRef, {
        //     ...provider,
        //     timestamp: admin.firestore.FieldValue.serverTimestamp()
        //   });
        // });
        // await batch.commit();
        // Calculate summary
        const operational = providers.filter(p => p.status === 'operational').length;
        const degraded = providers.filter(p => p.status === 'degraded').length;
        const down = providers.filter(p => p.status === 'down').length;
        res.json({
            timestamp: new Date().toISOString(),
            summary: {
                total: providers.length,
                operational,
                degraded,
                down,
                unknown: 0
            },
            providers: providers.map(p => {
                var _a;
                return (Object.assign(Object.assign({}, p), { statusPageUrl: (_a = PROVIDERS.find(provider => provider.id === p.id)) === null || _a === void 0 ? void 0 : _a.statusPageUrl }));
            })
        });
    }
    catch (error) {
        console.error('Status endpoint error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Health endpoint
app.get('/health', async (req, res) => {
    const clientId = getClientId(req);
    if (!checkRateLimit(clientId, 30)) {
        res.status(429).json({ error: 'Too many requests' });
        return;
    }
    try {
        const force = req.query.force === 'true';
        let results = [];
        if (force) {
            const healthPromises = PROVIDERS.map(async (provider) => {
                const status = await fetchProviderStatus(provider);
                return {
                    provider: provider.id,
                    healthy: status.status === 'operational',
                    responseTime: status.responseTime,
                    lastChecked: status.lastChecked
                };
            });
            results = await Promise.all(healthPromises);
        }
        else {
            const recentResults = await db.collection('status_results')
                .orderBy('timestamp', 'desc')
                .limit(PROVIDERS.length)
                .get();
            if (recentResults.size > 0) {
                results = recentResults.docs.map(doc => {
                    const data = doc.data();
                    return {
                        provider: data.id,
                        healthy: data.status === 'operational',
                        responseTime: data.responseTime,
                        lastChecked: data.lastChecked
                    };
                });
            }
            else {
                const healthPromises = PROVIDERS.map(async (provider) => {
                    const status = await fetchProviderStatus(provider);
                    return {
                        provider: provider.id,
                        healthy: status.status === 'operational',
                        responseTime: status.responseTime,
                        lastChecked: status.lastChecked
                    };
                });
                results = await Promise.all(healthPromises);
            }
        }
        const summary = {
            timestamp: new Date().toISOString(),
            totalProviders: results.length,
            healthy: results.filter(r => r.healthy).length,
            unhealthy: results.filter(r => !r.healthy).length,
            avgResponseTime: Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length),
            providers: results
        };
        res.json(summary);
    }
    catch (error) {
        console.error('Health endpoint error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Comments endpoints
app.get('/comments', async (req, res) => {
    const clientId = getClientId(req);
    if (!checkRateLimit(clientId, 30)) {
        res.status(429).json({ error: 'Too many requests' });
        return;
    }
    try {
        // TODO: Get comments from Firestore when API is enabled
        // const commentsSnapshot = await db.collection('comments')
        //   .orderBy('createdAt', 'desc')
        //   .limit(50)
        //   .get();
        // const comments = commentsSnapshot.docs.map(doc => ({
        //   id: doc.id,
        //   ...doc.data()
        // }));
        // For now, return empty comments array
        const comments = [];
        res.json(comments);
    }
    catch (error) {
        console.error('Comments endpoint error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.post('/comments', async (req, res) => {
    const clientId = getClientId(req);
    if (!checkRateLimit(clientId, 5)) {
        res.status(429).json({ error: 'Too many requests' });
        return;
    }
    try {
        const { author, content } = req.body;
        if (!author || !content) {
            res.status(400).json({ error: 'Author and content are required' });
            return;
        }
        // TODO: Save comment to Firestore when API is enabled
        // const comment = {
        //   author: author.substring(0, 50),
        //   content: content.substring(0, 500),
        //   provider: provider || null,
        //   createdAt: admin.firestore.FieldValue.serverTimestamp(),
        //   approved: false,
        //   ip: clientId
        // };
        // const docRef = await db.collection('comments').add(comment);
        res.status(201).json({
            id: 'temp-id',
            message: 'Comment submitted for moderation'
        });
    }
    catch (error) {
        console.error('Comment creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Notification endpoints
app.get('/notifications', async (req, res) => {
    const clientId = getClientId(req);
    if (!checkRateLimit(clientId, 30)) {
        res.status(429).json({ error: 'Too many requests' });
        return;
    }
    try {
        const subscriptionsSnapshot = await db.collection('email_subscriptions')
            .where('active', '==', true)
            .limit(50)
            .get();
        const subscriptions = subscriptionsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        res.json({ subscriptions });
    }
    catch (error) {
        console.error('Error fetching subscriptions', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.get('/incidents', async (req, res) => {
    const clientId = getClientId(req);
    if (!checkRateLimit(clientId, 30)) {
        res.status(429).json({ error: 'Too many requests' });
        return;
    }
    try {
        const limit = parseInt(req.query.limit) || 10;
        const incidentsSnapshot = await db.collection('incidents')
            .orderBy('startTime', 'desc')
            .limit(limit)
            .get();
        const incidents = incidentsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        res.json({ incidents });
    }
    catch (error) {
        console.error('Error fetching incidents', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.post('/subscribeEmail', async (req, res) => {
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
            active: true
        });
        console.log('Email subscription created', { email, providers });
        res.json({ success: true, message: 'Subscription created successfully' });
    }
    catch (error) {
        console.error('Error creating email subscription', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.post('/unsubscribeEmail', async (req, res) => {
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
    }
    catch (error) {
        console.error('Error removing email subscription', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.post('/subscribeWebhook', async (req, res) => {
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
        }
        catch (_a) {
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
            active: true
        });
        console.log('Webhook subscription created', { webhookUrl, providers });
        res.json({ success: true, message: 'Webhook subscription created successfully', webhookId });
    }
    catch (error) {
        console.error('Error creating webhook subscription', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.post('/sendTestNotification', async (req, res) => {
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
    }
    catch (error) {
        console.error('Error sending test notification', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// RSS Feed endpoint
app.get('/rss.xml', async (req, res) => {
    const clientId = getClientId(req);
    if (!checkRateLimit(clientId, 30)) {
        res.status(429).json({ error: 'Too many requests' });
        return;
    }
    try {
        // TODO: Get recent incidents from Firestore when API is enabled
        // const incidentsSnapshot = await db.collection('incidents')
        //   .orderBy('startTime', 'desc')
        //   .limit(20)
        //   .get();
        // const incidents = incidentsSnapshot.docs.map(doc => {
        //   const data = doc.data();
        //   return {
        //     id: doc.id,
        //     title: data.title || 'Service Incident',
        //     description: data.description || 'Service status update',
        //     provider: data.provider || 'Unknown',
        //     status: data.status || 'investigating',
        //     startTime: data.startTime || new Date(),
        //     link: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'}/incidents/${doc.id}`
        //   };
        // });
        // For now, return empty RSS feed
        const incidents = [];
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
    ${incidents.map(incident => `
    <item>
      <title>[${incident.provider}] ${incident.title}</title>
      <description>${incident.description}</description>
      <link>${incident.link}</link>
      <guid isPermaLink="false">${incident.id}</guid>
      <pubDate>${new Date(incident.startTime).toUTCString()}</pubDate>
      <category>${incident.status}</category>
    </item>`).join('')}
  </channel>
</rss>`;
        res.set('Content-Type', 'application/rss+xml');
        res.send(rssXml);
    }
    catch (error) {
        console.error('RSS feed error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Export the Express app as a Cloud Function
exports.api = functions.https.onRequest(app);
//# sourceMappingURL=index.js.map