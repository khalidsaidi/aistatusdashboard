import { StatusResult } from './types';
import { log } from './logger';

export interface EmailSubscription {
  id: string;
  email: string;
  providers: string[]; // Empty array means all providers
  notificationTypes: ('incident' | 'recovery' | 'degradation')[];
  createdAt: string;
  confirmed: boolean;
  confirmationToken?: string;
}

export interface EmailNotification {
  type: 'incident' | 'recovery' | 'degradation';
  provider: string;
  status: string;
  previousStatus: string;
  timestamp: string;
  responseTime?: number;
}

// In-memory storage for demo - in production, use database
const emailSubscriptions = new Map<string, EmailSubscription>();
const notificationQueue: Array<{ subscription: EmailSubscription; notification: EmailNotification }> = [];

/**
 * Add email subscription
 */
export function addEmailSubscription(
  email: string,
  providers: string[] = [],
  notificationTypes: ('incident' | 'recovery' | 'degradation')[] = ['incident', 'recovery']
): EmailSubscription {
  const subscription: EmailSubscription = {
    id: generateId(),
    email,
    providers,
    notificationTypes,
    createdAt: new Date().toISOString(),
    confirmed: false,
    confirmationToken: generateId()
  };
  
  emailSubscriptions.set(subscription.id, subscription);
  
  log('info', 'Email subscription added', {
    id: subscription.id,
    email: subscription.email,
    providers: subscription.providers,
    notificationTypes: subscription.notificationTypes
  });
  
  return subscription;
}

/**
 * Confirm email subscription
 */
export function confirmEmailSubscription(token: string): boolean {
  for (const subscription of Array.from(emailSubscriptions.values())) {
    if (subscription.confirmationToken === token) {
      subscription.confirmed = true;
      subscription.confirmationToken = undefined;
      
      log('info', 'Email subscription confirmed', {
        id: subscription.id,
        email: subscription.email
      });
      
      return true;
    }
  }
  return false;
}

/**
 * Remove email subscription
 */
export function removeEmailSubscription(id: string): boolean {
  const result = emailSubscriptions.delete(id);
  
  if (result) {
    log('info', 'Email subscription removed', { id });
  }
  
  return result;
}

/**
 * Get all subscriptions (for admin)
 */
export function getAllSubscriptions(): EmailSubscription[] {
  return Array.from(emailSubscriptions.values());
}

/**
 * Process status change and queue notifications
 */
export function processStatusChange(
  current: StatusResult,
  previous: StatusResult | null
): void {
  if (!previous || current.status === previous.status) {
    return; // No status change
  }
  
  const notificationType = determineNotificationType(current.status, previous.status);
  if (!notificationType) {
    return; // Not a significant change
  }
  
  const notification: EmailNotification = {
    type: notificationType,
    provider: current.name,
    status: current.status,
    previousStatus: previous.status,
    timestamp: current.lastChecked,
    responseTime: current.responseTime
  };
  
  // Queue notifications for relevant subscribers
  for (const subscription of Array.from(emailSubscriptions.values())) {
    if (!subscription.confirmed) continue;
    
    // Check if subscriber wants this type of notification
    if (!subscription.notificationTypes.includes(notificationType)) continue;
    
    // Check if subscriber wants notifications for this provider
    if (subscription.providers.length > 0 && !subscription.providers.includes(current.id)) continue;
    
    notificationQueue.push({ subscription, notification });
  }
  
  log('info', 'Status change processed for email notifications', {
    provider: current.id,
    change: `${previous.status} → ${current.status}`,
    type: notificationType,
    queuedNotifications: notificationQueue.length
  });
}

/**
 * Real email sending using fetch to email service endpoint
 */
export async function sendQueuedNotifications(): Promise<void> {
  if (notificationQueue.length === 0) return;
  
  const notifications = notificationQueue.splice(0);
  
  for (const item of notifications) {
    try {
      // Real email implementation - send to actual email service
      const emailData = {
        to: item.subscription.email,
        subject: generateEmailSubject(item.notification),
        html: generateEmailHtml(item.notification),
        text: generateEmailText(item.notification)
      };
      
      // Try to send via email service API
      try {
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailData)
        });
        
        if (response.ok) {
          log('info', 'Email notification sent successfully', {
            to: item.subscription.email,
            provider: item.notification.provider,
            type: item.notification.type,
            change: `${item.notification.previousStatus} → ${item.notification.status}`
          });
        } else {
          throw new Error(`Email service responded with status ${response.status}`);
        }
      } catch (fetchError) {
        // Fallback: Log notification details for manual processing
        log('warn', 'Email service unavailable, notification logged for manual processing', {
          to: item.subscription.email,
          provider: item.notification.provider,
          type: item.notification.type,
          change: `${item.notification.previousStatus} → ${item.notification.status}`,
          subject: emailData.subject,
          error: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        });
      }
    } catch (error) {
      log('error', 'Failed to process email notification', {
        email: item.subscription.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

/**
 * Generate email subject based on notification type
 */
function generateEmailSubject(notification: EmailNotification): string {
  const { provider, type, status } = notification;
  
  switch (type) {
    case 'incident':
      return `🚨 ${provider} Service Issue Detected`;
    case 'recovery':
      return `✅ ${provider} Service Recovered`;
    case 'degradation':
      return `⚠️ ${provider} Service Degraded`;
    default:
      return `📊 ${provider} Status Update`;
  }
}

/**
 * Generate HTML email content
 */
function generateEmailHtml(notification: EmailNotification): string {
  const { provider, type, status, previousStatus, timestamp, responseTime } = notification;
  
  const statusIcon = type === 'incident' ? '🚨' : type === 'recovery' ? '✅' : '⚠️';
  const statusColor = type === 'incident' ? '#dc3545' : type === 'recovery' ? '#28a745' : '#ffc107';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>AI Status Dashboard - ${provider} Update</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: ${statusColor};">${statusIcon} ${provider} Status Update</h1>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Provider:</strong> ${provider}</p>
          <p><strong>Status Change:</strong> ${previousStatus} → <span style="color: ${statusColor};">${status}</span></p>
          <p><strong>Time:</strong> ${new Date(timestamp).toLocaleString()}</p>
          ${responseTime ? `<p><strong>Response Time:</strong> ${responseTime}ms</p>` : ''}
        </div>
        
        <p>Visit the <a href="https://aistatusdashboard.com" style="color: #007bff;">AI Status Dashboard</a> for more details.</p>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #666;">
          You're receiving this because you subscribed to ${provider} status notifications.
          <a href="https://aistatusdashboard.com/unsubscribe" style="color: #007bff;">Unsubscribe</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate plain text email content
 */
function generateEmailText(notification: EmailNotification): string {
  const { provider, type, status, previousStatus, timestamp, responseTime } = notification;
  
  const statusIcon = type === 'incident' ? '[ISSUE]' : type === 'recovery' ? '[RECOVERED]' : '[DEGRADED]';
  
  return `
${statusIcon} ${provider} Status Update

Provider: ${provider}
Status Change: ${previousStatus} → ${status}
Time: ${new Date(timestamp).toLocaleString()}
${responseTime ? `Response Time: ${responseTime}ms` : ''}

Visit https://aistatusdashboard.com for more details.

---
You're receiving this because you subscribed to ${provider} status notifications.
Unsubscribe: https://aistatusdashboard.com/unsubscribe
  `.trim();
}

/**
 * Determine notification type based on status change
 */
function determineNotificationType(
  currentStatus: string,
  previousStatus: string
): 'incident' | 'recovery' | 'degradation' | null {
  // Recovery: any status to operational
  if (currentStatus === 'operational' && previousStatus !== 'operational') {
    return 'recovery';
  }
  
  // Incident: operational to down
  if (currentStatus === 'down' && previousStatus === 'operational') {
    return 'incident';
  }
  
  // Degradation: operational to degraded
  if (currentStatus === 'degraded' && previousStatus === 'operational') {
    return 'degradation';
  }
  
  return null; // No significant change
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Auto-send notifications every 5 minutes
 */
setInterval(async () => {
  try {
    await sendQueuedNotifications();
  } catch (error) {
    log('error', 'Failed to process notification queue', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}, 5 * 60 * 1000); // 5 minutes 