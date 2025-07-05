"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendQueuedWebhooks = exports.processWebhookStatusChange = exports.getAllWebhookSubscriptions = exports.updateWebhookSubscription = exports.removeWebhookSubscription = exports.addWebhookSubscription = void 0;
const logger_1 = require("./logger");
// In-memory storage for demo - in production, use database
const webhookSubscriptions = new Map();
const webhookQueue = [];
/**
 * Add webhook subscription
 */
function addWebhookSubscription(url, secret, providers = [], events = ['status_change']) {
    const subscription = {
        id: generateId(),
        url,
        secret,
        providers,
        events,
        active: true,
        createdAt: new Date().toISOString(),
        failureCount: 0,
        maxRetries: 3
    };
    webhookSubscriptions.set(subscription.id, subscription);
    (0, logger_1.log)('info', 'Webhook subscription added', {
        id: subscription.id,
        url: subscription.url,
        providers: subscription.providers,
        events: subscription.events
    });
    return subscription;
}
exports.addWebhookSubscription = addWebhookSubscription;
/**
 * Remove webhook subscription
 */
function removeWebhookSubscription(id) {
    const result = webhookSubscriptions.delete(id);
    if (result) {
        (0, logger_1.log)('info', 'Webhook subscription removed', { id });
    }
    return result;
}
exports.removeWebhookSubscription = removeWebhookSubscription;
/**
 * Update webhook subscription
 */
function updateWebhookSubscription(id, updates) {
    const subscription = webhookSubscriptions.get(id);
    if (!subscription)
        return false;
    Object.assign(subscription, updates);
    (0, logger_1.log)('info', 'Webhook subscription updated', {
        id,
        updates: Object.keys(updates)
    });
    return true;
}
exports.updateWebhookSubscription = updateWebhookSubscription;
/**
 * Get all webhook subscriptions
 */
function getAllWebhookSubscriptions() {
    const subscriptions = [];
    webhookSubscriptions.forEach(subscription => subscriptions.push(subscription));
    return subscriptions;
}
exports.getAllWebhookSubscriptions = getAllWebhookSubscriptions;
/**
 * Process status change and queue webhook notifications
 */
function processWebhookStatusChange(current, previous) {
    if (!previous || current.status === previous.status) {
        return; // No status change
    }
    const event = determineWebhookEvent(current.status, previous.status);
    const payload = {
        event,
        timestamp: current.lastChecked,
        provider: {
            id: current.id,
            name: current.name,
            statusPageUrl: current.statusPageUrl
        },
        status: {
            current: current.status,
            previous: previous.status,
            responseTime: current.responseTime
        },
        metadata: {
            dashboardUrl: 'https://aistatusdashboard.com',
            apiUrl: `https://aistatusdashboard.com/api/status/${current.id}`
        }
    };
    // Queue webhooks for relevant subscribers
    for (const subscription of Array.from(webhookSubscriptions.values())) {
        if (!subscription.active)
            continue;
        // Check if subscriber wants this type of event
        if (!subscription.events.includes(event))
            continue;
        // Check if subscriber wants notifications for this provider
        if (subscription.providers.length > 0 && !subscription.providers.includes(current.id))
            continue;
        webhookQueue.push({ subscription, payload, retryCount: 0 });
    }
    (0, logger_1.log)('info', 'Status change processed for webhook notifications', {
        provider: current.id,
        change: `${previous.status} → ${current.status}`,
        event,
        queuedWebhooks: webhookQueue.length
    });
}
exports.processWebhookStatusChange = processWebhookStatusChange;
/**
 * Send queued webhook notifications
 */
async function sendQueuedWebhooks() {
    if (webhookQueue.length === 0)
        return;
    const webhooks = webhookQueue.splice(0, 10); // Process up to 10 at a time
    const results = await Promise.allSettled(webhooks.map(item => sendWebhook(item.subscription, item.payload, item.retryCount)));
    // Handle retries for failed webhooks
    results.forEach((result, index) => {
        const webhook = webhooks[index];
        if (result.status === 'rejected') {
            if (webhook.retryCount < webhook.subscription.maxRetries) {
                // Retry with exponential backoff
                setTimeout(() => {
                    webhookQueue.push(Object.assign(Object.assign({}, webhook), { retryCount: webhook.retryCount + 1 }));
                }, Math.pow(2, webhook.retryCount) * 1000);
                (0, logger_1.log)('warn', 'Webhook failed, queued for retry', {
                    subscriptionId: webhook.subscription.id,
                    retryCount: webhook.retryCount + 1,
                    maxRetries: webhook.subscription.maxRetries
                });
            }
            else {
                // Max retries exceeded
                webhook.subscription.failureCount++;
                // Disable webhook after too many failures
                if (webhook.subscription.failureCount >= 10) {
                    webhook.subscription.active = false;
                    (0, logger_1.log)('error', 'Webhook disabled due to repeated failures', {
                        subscriptionId: webhook.subscription.id,
                        failureCount: webhook.subscription.failureCount
                    });
                }
            }
        }
        else {
            // Success - reset failure count
            webhook.subscription.failureCount = 0;
            webhook.subscription.lastTriggered = new Date().toISOString();
        }
    });
}
exports.sendQueuedWebhooks = sendQueuedWebhooks;
/**
 * Send individual webhook
 */
async function sendWebhook(subscription, payload, retryCount) {
    const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Status-Dashboard-Webhook/1.0',
        'X-Webhook-Event': payload.event,
        'X-Webhook-Timestamp': payload.timestamp,
        'X-Webhook-Retry': retryCount.toString()
    };
    // Add signature if secret is provided
    if (subscription.secret) {
        const signature = await generateWebhookSignature(JSON.stringify(payload), subscription.secret);
        headers['X-Webhook-Signature'] = signature;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    try {
        const response = await fetch(subscription.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        (0, logger_1.log)('info', 'Webhook sent successfully', {
            subscriptionId: subscription.id,
            url: subscription.url,
            event: payload.event,
            provider: payload.provider.id,
            responseStatus: response.status,
            retryCount
        });
    }
    catch (error) {
        clearTimeout(timeoutId);
        (0, logger_1.log)('error', 'Webhook failed', {
            subscriptionId: subscription.id,
            url: subscription.url,
            event: payload.event,
            provider: payload.provider.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            retryCount
        });
        throw error;
    }
}
/**
 * Generate webhook signature for verification
 */
async function generateWebhookSignature(payload, secret) {
    // Use Web Crypto API for HMAC-SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `sha256=${hashHex}`;
}
/**
 * Determine webhook event type based on status change
 */
function determineWebhookEvent(currentStatus, previousStatus) {
    // Recovery: any status to operational
    if (currentStatus === 'operational' && previousStatus !== 'operational') {
        return 'recovery';
    }
    // Incident: operational to down/degraded
    if (previousStatus === 'operational' && (currentStatus === 'down' || currentStatus === 'degraded')) {
        return 'incident';
    }
    // Any other change
    return 'status_change';
}
/**
 * Generate unique ID
 */
function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
/**
 * Auto-send webhooks every 30 seconds
 */
setInterval(async () => {
    try {
        await sendQueuedWebhooks();
    }
    catch (error) {
        (0, logger_1.log)('error', 'Failed to process webhook queue', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}, 30 * 1000); // 30 seconds 
//# sourceMappingURL=webhook-notifications.js.map