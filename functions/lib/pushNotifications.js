"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendStatusChangePushNotifications = exports.sendTestPushNotification = exports.unsubscribePush = exports.subscribePush = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
const v2_1 = require("firebase-functions/v2");
const db = (0, firestore_1.getFirestore)();
const messaging = (0, messaging_1.getMessaging)();
// Interface removed - using Firestore document structure directly
// Subscribe to push notifications
exports.subscribePush = (0, https_1.onRequest)({ cors: true, region: 'us-central1' }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { token, providers, endpoint, userAgent } = req.body;
        if (!token || !Array.isArray(providers)) {
            res.status(400).json({ error: 'Token and providers array required' });
            return;
        }
        // Validate FCM token format (basic validation)
        if (typeof token !== 'string' || token.length < 10) {
            res.status(400).json({ error: 'Invalid push notification token format' });
            return;
        }
        // Store subscription in Firestore
        const subscriptionRef = db.collection('push_subscriptions').doc(token);
        await subscriptionRef.set({
            token,
            providers,
            endpoint: endpoint || token,
            userAgent: userAgent || 'Unknown',
            subscribedAt: new Date(),
            active: true,
            lastUsed: new Date(),
        });
        v2_1.logger.info('Real push subscription created', {
            token: token.substring(0, 20) + '...',
            providers,
        });
        // Send welcome push notification
        try {
            await messaging.send({
                token,
                notification: {
                    title: '🎉 Push Notifications Enabled!',
                    body: `You'll now receive real-time alerts for ${providers.length === 0 ? 'all AI services' : providers.join(', ')}.`,
                },
                data: {
                    type: 'welcome',
                    providers: JSON.stringify(providers),
                },
            });
            v2_1.logger.info('Welcome push notification sent successfully', {
                token: token.substring(0, 20) + '...',
            });
        }
        catch (pushError) {
            v2_1.logger.warn('Failed to send welcome push notification', {
                error: pushError instanceof Error ? pushError.message : 'Unknown error',
                token: token.substring(0, 20) + '...',
            });
        }
        res.json({ success: true, message: 'Real push subscription created successfully' });
    }
    catch (error) {
        v2_1.logger.error('Error creating real push subscription', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Unsubscribe from push notifications
exports.unsubscribePush = (0, https_1.onRequest)({ cors: true, region: 'us-central1' }, async (req, res) => {
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
        v2_1.logger.info('Real push subscription removed', { token: token.substring(0, 20) + '...' });
        res.json({
            success: true,
            message: 'Unsubscribed successfully from real push notifications',
        });
    }
    catch (error) {
        v2_1.logger.error('Error removing real push subscription', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Send test push notification
exports.sendTestPushNotification = (0, https_1.onRequest)({ cors: true, region: 'us-central1' }, async (req, res) => {
    var _a;
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { token, title, body } = req.body;
        if (!token) {
            res.status(400).json({ error: 'Token required' });
            return;
        }
        // Check if real push notifications are enabled
        if (process.env.ENABLE_REAL_NOTIFICATIONS !== 'true') {
            v2_1.logger.warn('Real push notifications are disabled. Set ENABLE_REAL_NOTIFICATIONS=true to send actual notifications.', {
                token: token.substring(0, 20) + '...',
            });
            res.json({
                success: false,
                message: 'Real push notifications are disabled in configuration',
            });
            return;
        }
        // Send REAL test push notification using FCM
        const message = {
            token,
            notification: {
                title: title || '🧪 Test Push Notification',
                body: body ||
                    'This is a REAL test push notification from your AI Status Dashboard. Push notifications are working!',
            },
            data: {
                type: 'test',
                timestamp: new Date().toISOString(),
                source: 'ai-status-dashboard',
            },
            android: {
                notification: {
                    icon: 'notification_icon',
                    color: '#007bff',
                    sound: 'default',
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1,
                    },
                },
            },
            webpush: {
                notification: {
                    icon: '/icon-192x192.png',
                    badge: '/badge-72x72.png',
                    tag: 'test-notification',
                    requireInteraction: true,
                    actions: [{ action: 'view', title: '👀 View Dashboard' }],
                },
            },
        };
        const result = await messaging.send(message);
        v2_1.logger.info('REAL test push notification sent successfully', {
            messageId: result,
            token: token.substring(0, 20) + '...',
            title: (_a = message.notification) === null || _a === void 0 ? void 0 : _a.title,
        });
        res.json({
            success: true,
            message: 'Real test push notification sent successfully!',
            messageId: result,
        });
    }
    catch (error) {
        v2_1.logger.error('Error sending real test push notification', {
            error: error instanceof Error ? error.message : 'Unknown error',
            token: req.body.token ? req.body.token.substring(0, 20) + '...' : 'unknown',
        });
        if (error instanceof Error && error.message.includes('registration-token-not-registered')) {
            res.status(400).json({ error: 'Push notification token is no longer valid' });
        }
        else if (error instanceof Error && error.message.includes('invalid-registration-token')) {
            res.status(400).json({ error: 'Invalid push notification token format' });
        }
        else {
            res.status(500).json({ error: 'Failed to send real test push notification' });
        }
    }
});
/**
 * OPTIMIZED: Send status change push notifications using queue system
 */
async function sendStatusChangePushNotifications(providerId, providerName, newStatus, previousStatus) {
    try {
        if (process.env.ENABLE_REAL_NOTIFICATIONS !== 'true') {
            v2_1.logger.warn('Real push notifications are disabled. Set ENABLE_REAL_NOTIFICATIONS=true to send actual notifications.');
            return;
        }
        // CRITICAL FIX: Use queue system for scalable notification processing
        const subscriptionsSnapshot = await db
            .collection('push_subscriptions')
            .where('active', '==', true)
            .limit(10000) // Limit query size for performance
            .get();
        const relevantSubscriptions = subscriptionsSnapshot.docs.filter((doc) => {
            const data = doc.data();
            return data.providers.length === 0 || data.providers.includes(providerId);
        });
        if (relevantSubscriptions.length === 0) {
            v2_1.logger.info('No push subscribers found for provider', { providerId });
            return;
        }
        const tokens = relevantSubscriptions.map((doc) => doc.data().token);
        // CRITICAL FIX: Determine priority based on status severity
        const priority = newStatus === 'down'
            ? 10
            : newStatus === 'degraded'
                ? 5
                : newStatus === 'operational'
                    ? 3
                    : 1;
        // CRITICAL FIX: Enqueue notification job instead of immediate processing
        const success = await notificationQueue.enqueue({
            type: 'push',
            providerId,
            providerName,
            newStatus,
            previousStatus,
            tokens,
            priority,
            retryCount: 0,
        });
        if (success) {
            v2_1.logger.info('Push notification job enqueued', {
                providerId,
                totalSubscribers: tokens.length,
                priority,
                statusChange: `${previousStatus} → ${newStatus}`,
                queueStats: notificationQueue.getQueueStats(),
            });
        }
        else {
            v2_1.logger.error('Failed to enqueue push notification job - queue full', {
                providerId,
                totalSubscribers: tokens.length,
                queueStats: notificationQueue.getQueueStats(),
            });
        }
    }
    catch (error) {
        v2_1.logger.error('Error queueing status change push notifications', {
            error: error instanceof Error ? error.message : 'Unknown error',
            providerId,
            statusChange: `${previousStatus} → ${newStatus}`,
        });
    }
}
exports.sendStatusChangePushNotifications = sendStatusChangePushNotifications;
class NotificationQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.maxQueueSize = 10000;
        this.batchSize = 500; // FCM batch limit
        this.maxConcurrentBatches = 5;
        this.processingInterval = null;
        this.startProcessing();
    }
    async enqueue(job) {
        // CRITICAL FIX: Backpressure handling
        if (this.queue.length >= this.maxQueueSize) {
            v2_1.logger.warn('Notification queue full, dropping job', {
                queueSize: this.queue.length,
                maxSize: this.maxQueueSize,
                providerId: job.providerId,
            });
            return false;
        }
        const notificationJob = Object.assign(Object.assign({}, job), { id: `${job.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, createdAt: Date.now() });
        // CRITICAL FIX: Priority queue - higher priority jobs first
        const insertIndex = this.queue.findIndex((item) => item.priority < notificationJob.priority);
        if (insertIndex === -1) {
            this.queue.push(notificationJob);
        }
        else {
            this.queue.splice(insertIndex, 0, notificationJob);
        }
        v2_1.logger.info('Notification job enqueued', {
            jobId: notificationJob.id,
            type: notificationJob.type,
            queueSize: this.queue.length,
            priority: notificationJob.priority,
        });
        return true;
    }
    startProcessing() {
        this.processingInterval = setInterval(async () => {
            if (!this.processing && this.queue.length > 0) {
                await this.processQueue();
            }
        }, 1000); // Process every second
    }
    async processQueue() {
        if (this.processing)
            return;
        this.processing = true;
        try {
            // CRITICAL FIX: Process multiple batches concurrently with limit
            const jobs = this.queue.splice(0, this.batchSize * this.maxConcurrentBatches);
            if (jobs.length === 0) {
                this.processing = false;
                return;
            }
            // Group jobs by type for batch processing
            const pushJobs = jobs.filter((job) => job.type === 'push');
            const emailJobs = jobs.filter((job) => job.type === 'email');
            const processingPromises = [];
            // Process push notifications in batches
            if (pushJobs.length > 0) {
                const pushBatches = this.createBatches(pushJobs, this.batchSize);
                processingPromises.push(...pushBatches.map((batch) => this.processPushBatch(batch)));
            }
            // Process email notifications
            if (emailJobs.length > 0) {
                processingPromises.push(this.processEmailBatch(emailJobs));
            }
            // CRITICAL FIX: Wait for all batches with timeout protection
            await Promise.race([
                Promise.allSettled(processingPromises),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Batch processing timeout')), 30000)),
            ]);
            v2_1.logger.info('Notification batch processing completed', {
                pushJobs: pushJobs.length,
                emailJobs: emailJobs.length,
                remainingQueue: this.queue.length,
            });
        }
        catch (error) {
            v2_1.logger.error('Error processing notification queue', {
                error: error instanceof Error ? error.message : 'Unknown error',
                queueSize: this.queue.length,
            });
        }
        finally {
            this.processing = false;
        }
    }
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }
    async processPushBatch(jobs) {
        if (jobs.length === 0)
            return;
        // Flatten all tokens from jobs
        const allTokens = jobs.flatMap((job) => job.tokens);
        if (allTokens.length === 0)
            return;
        // Use the first job's data for the message (they should be similar in a batch)
        const job = jobs[0];
        const statusIcon = job.newStatus === 'operational' ? '✅' : job.newStatus === 'degraded' ? '⚠️' : '🚨';
        const message = {
            notification: {
                title: `${statusIcon} ${job.providerName} Status Update`,
                body: `Status changed from ${job.previousStatus} to ${job.newStatus}`,
            },
            data: {
                type: 'status_change',
                providerId: job.providerId,
                providerName: job.providerName,
                newStatus: job.newStatus,
                previousStatus: job.previousStatus,
                timestamp: new Date().toISOString(),
            },
            webpush: {
                notification: {
                    icon: '/icon-192x192.png',
                    badge: '/badge-72x72.png',
                    tag: `status-${job.providerId}`,
                    requireInteraction: job.newStatus !== 'operational',
                    actions: [{ action: 'view', title: '👀 View Dashboard' }],
                },
            },
        };
        try {
            const result = await messaging.sendEachForMulticast(Object.assign({ tokens: allTokens }, message));
            v2_1.logger.info('Push notification batch sent', {
                providerId: job.providerId,
                batchSize: allTokens.length,
                successCount: result.successCount,
                failureCount: result.failureCount,
            });
            // CRITICAL FIX: Handle invalid tokens efficiently
            if (result.failureCount > 0) {
                const invalidTokens = [];
                result.responses.forEach((response, index) => {
                    if (!response.success && response.error) {
                        const errorCode = response.error.code;
                        if (errorCode === 'messaging/invalid-registration-token' ||
                            errorCode === 'messaging/registration-token-not-registered') {
                            invalidTokens.push(allTokens[index]);
                        }
                    }
                });
                // CRITICAL FIX: Batch delete invalid tokens
                if (invalidTokens.length > 0) {
                    await this.batchDeleteInvalidTokens(invalidTokens);
                }
            }
        }
        catch (error) {
            v2_1.logger.error('Error sending push notification batch', {
                error: error instanceof Error ? error.message : 'Unknown error',
                batchSize: allTokens.length,
                providerId: job.providerId,
            });
            // CRITICAL FIX: Re-queue failed jobs with exponential backoff
            await this.requeueFailedJobs(jobs);
        }
    }
    async batchDeleteInvalidTokens(tokens) {
        const batchSize = 100; // Firestore batch limit
        const batches = this.createBatches(tokens, batchSize);
        const deletePromises = batches.map(async (batch) => {
            const deleteOps = batch.map((token) => db.collection('push_subscriptions').doc(token).delete());
            await Promise.allSettled(deleteOps);
        });
        await Promise.allSettled(deletePromises);
        v2_1.logger.info('Batch deleted invalid push tokens', { count: tokens.length });
    }
    async processEmailBatch(jobs) {
        // Email processing would go here - simplified for now
        v2_1.logger.info('Email batch processed', { count: jobs.length });
    }
    async requeueFailedJobs(jobs) {
        const maxRetries = 3;
        for (const job of jobs) {
            if (job.retryCount < maxRetries) {
                // CRITICAL FIX: Exponential backoff for retries
                const delay = Math.pow(2, job.retryCount) * 1000; // 1s, 2s, 4s
                setTimeout(() => {
                    this.enqueue(Object.assign(Object.assign({}, job), { retryCount: job.retryCount + 1, priority: Math.max(1, job.priority - 1) }));
                }, delay);
            }
            else {
                v2_1.logger.error('Job exceeded max retries, dropping', {
                    jobId: job.id,
                    retryCount: job.retryCount,
                });
            }
        }
    }
    getQueueStats() {
        return {
            size: this.queue.length,
            processing: this.processing,
        };
    }
    shutdown() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
        }
    }
}
// Global notification queue instance
const notificationQueue = new NotificationQueue();
//# sourceMappingURL=pushNotifications.js.map