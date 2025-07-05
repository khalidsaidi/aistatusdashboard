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
 * Mock email sending - in production, use SendGrid/AWS SES/Resend
 */
export async function sendQueuedNotifications(): Promise<void> {
  if (notificationQueue.length === 0) return;
  
  const notifications = notificationQueue.splice(0);
  
  for (const item of notifications) {
    try {
      // Mock implementation - log instead of actual email
      log('info', 'Email notification sent (mock)', {
        to: item.subscription.email,
        provider: item.notification.provider,
        type: item.notification.type,
        change: `${item.notification.previousStatus} → ${item.notification.status}`
      });
    } catch (error) {
      log('error', 'Failed to send email notification', {
        email: item.subscription.email,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
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