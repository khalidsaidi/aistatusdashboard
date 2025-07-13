"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTestNotification = exports.subscribeWebhook = exports.unsubscribeEmail = exports.subscribeEmail = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const v2_1 = require("firebase-functions/v2");
const emailService_1 = require("./emailService");
const db = (0, firestore_1.getFirestore)();
// Subscribe to email notifications
exports.subscribeEmail = (0, https_1.onRequest)({ cors: true, region: 'us-central1' }, async (req, res) => {
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
            subscribedAt: new Date(),
            active: true,
        });
        v2_1.logger.info('Email subscription created', { email, providers });
        // Send confirmation email
        await emailService_1.emailService.sendEmail({
            to: email,
            subject: 'AI Status Dashboard - Subscription Confirmed',
            html: `
          <h2>Subscription Confirmed!</h2>
          <p>You've successfully subscribed to AI status notifications for:</p>
          <ul>
            ${providers.map((provider) => `<li>${provider}</li>`).join('')}
          </ul>
          <p>You'll receive alerts when these services experience status changes.</p>
          <hr>
          <p><small>To unsubscribe, visit <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com'}">AI Status Dashboard</a></small></p>
        `,
        });
        res.json({ success: true, message: 'Subscription created successfully' });
    }
    catch (error) {
        v2_1.logger.error('Error creating email subscription', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Unsubscribe from email notifications
exports.unsubscribeEmail = (0, https_1.onRequest)({ cors: true, region: 'us-central1' }, async (req, res) => {
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
        v2_1.logger.info('Email subscription removed', { email });
        res.json({ success: true, message: 'Unsubscribed successfully' });
    }
    catch (error) {
        v2_1.logger.error('Error removing email subscription', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Subscribe to webhook notifications
exports.subscribeWebhook = (0, https_1.onRequest)({ cors: true, region: 'us-central1' }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
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
            subscribedAt: new Date(),
            active: true,
        });
        v2_1.logger.info('Webhook subscription created', { webhookUrl, providers });
        res.json({ success: true, message: 'Webhook subscription created successfully', webhookId });
    }
    catch (error) {
        v2_1.logger.error('Error creating webhook subscription', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Send test notification
exports.sendTestNotification = (0, https_1.onRequest)({ cors: true, region: 'us-central1' }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { email, type } = req.body;
        if (!email) {
            res.status(400).json({ error: 'Email required' });
            return;
        }
        let success = false;
        if (type === 'incident') {
            success = await emailService_1.emailService.sendIncidentAlert(email, {
                title: 'Test Incident Alert',
                status: 'investigating',
                impact: 'minor',
                body: 'This is a test incident notification to verify your email subscription is working correctly.',
            });
        }
        else {
            success = await emailService_1.emailService.sendStatusAlert(email, 'OpenAI GPT-4', 'degraded');
        }
        if (success) {
            res.json({ success: true, message: 'Test notification sent successfully' });
        }
        else {
            res.status(500).json({ error: 'Failed to send test notification' });
        }
    }
    catch (error) {
        v2_1.logger.error('Error sending test notification', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=notifications.js.map