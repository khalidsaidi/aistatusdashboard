import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { emailService } from './emailService';

const db = getFirestore();

// Subscribe to email notifications
export const subscribeEmail = onRequest({ cors: true, region: 'us-central1' }, async (req, res) => {
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

    logger.info('Email subscription created', { email, providers });

    // Send confirmation email
    await emailService.sendEmail({
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
  } catch (error) {
    logger.error('Error creating email subscription', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unsubscribe from email notifications
export const unsubscribeEmail = onRequest(
  { cors: true, region: 'us-central1' },
  async (req, res) => {
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

      logger.info('Email subscription removed', { email });
      res.json({ success: true, message: 'Unsubscribed successfully' });
    } catch (error) {
      logger.error('Error removing email subscription', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Subscribe to webhook notifications
export const subscribeWebhook = onRequest(
  { cors: true, region: 'us-central1' },
  async (req, res) => {
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
        subscribedAt: new Date(),
        active: true,
      });

      logger.info('Webhook subscription created', { webhookUrl, providers });
      res.json({ success: true, message: 'Webhook subscription created successfully', webhookId });
    } catch (error) {
      logger.error('Error creating webhook subscription', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Send test notification
export const sendTestNotification = onRequest(
  { cors: true, region: 'us-central1' },
  async (req, res) => {
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
        success = await emailService.sendIncidentAlert(email, {
          title: 'Test Incident Alert',
          status: 'investigating',
          impact: 'minor',
          body: 'This is a test incident notification to verify your email subscription is working correctly.',
        });
      } else {
        success = await emailService.sendStatusAlert(email, 'OpenAI GPT-4', 'degraded');
      }

      if (success) {
        res.json({ success: true, message: 'Test notification sent successfully' });
      } else {
        res.status(500).json({ error: 'Failed to send test notification' });
      }
    } catch (error) {
      logger.error('Error sending test notification', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);
