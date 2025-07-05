"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendQueuedNotifications = exports.processStatusChange = exports.getAllSubscriptions = exports.removeEmailSubscription = exports.confirmEmailSubscription = exports.addEmailSubscription = void 0;
const logger_1 = require("./logger");
// In-memory storage for demo - in production, use database
const emailSubscriptions = new Map();
const notificationQueue = [];
/**
 * Add email subscription
 */
function addEmailSubscription(email, providers = [], notificationTypes = ['incident', 'recovery']) {
    const subscription = {
        id: generateId(),
        email,
        providers,
        notificationTypes,
        createdAt: new Date().toISOString(),
        confirmed: false,
        confirmationToken: generateId()
    };
    emailSubscriptions.set(subscription.id, subscription);
    (0, logger_1.log)('info', 'Email subscription added', {
        id: subscription.id,
        email: subscription.email,
        providers: subscription.providers,
        notificationTypes: subscription.notificationTypes
    });
    return subscription;
}
exports.addEmailSubscription = addEmailSubscription;
/**
 * Confirm email subscription
 */
function confirmEmailSubscription(token) {
    for (const subscription of Array.from(emailSubscriptions.values())) {
        if (subscription.confirmationToken === token) {
            subscription.confirmed = true;
            subscription.confirmationToken = undefined;
            (0, logger_1.log)('info', 'Email subscription confirmed', {
                id: subscription.id,
                email: subscription.email
            });
            return true;
        }
    }
    return false;
}
exports.confirmEmailSubscription = confirmEmailSubscription;
/**
 * Remove email subscription
 */
function removeEmailSubscription(id) {
    const result = emailSubscriptions.delete(id);
    if (result) {
        (0, logger_1.log)('info', 'Email subscription removed', { id });
    }
    return result;
}
exports.removeEmailSubscription = removeEmailSubscription;
/**
 * Get all subscriptions (for admin)
 */
function getAllSubscriptions() {
    return Array.from(emailSubscriptions.values());
}
exports.getAllSubscriptions = getAllSubscriptions;
/**
 * Process status change and queue notifications
 */
function processStatusChange(current, previous) {
    if (!previous || current.status === previous.status) {
        return; // No status change
    }
    const notificationType = determineNotificationType(current.status, previous.status);
    if (!notificationType) {
        return; // Not a significant change
    }
    const notification = {
        type: notificationType,
        provider: current.name,
        status: current.status,
        previousStatus: previous.status,
        timestamp: current.lastChecked,
        responseTime: current.responseTime
    };
    // Queue notifications for relevant subscribers
    for (const subscription of Array.from(emailSubscriptions.values())) {
        if (!subscription.confirmed)
            continue;
        // Check if subscriber wants this type of notification
        if (!subscription.notificationTypes.includes(notificationType))
            continue;
        // Check if subscriber wants notifications for this provider
        if (subscription.providers.length > 0 && !subscription.providers.includes(current.id))
            continue;
        notificationQueue.push({ subscription, notification });
    }
    (0, logger_1.log)('info', 'Status change processed for email notifications', {
        provider: current.id,
        change: `${previous.status} → ${current.status}`,
        type: notificationType,
        queuedNotifications: notificationQueue.length
    });
}
exports.processStatusChange = processStatusChange;
/**
 * Mock email sending - in production, use SendGrid/AWS SES/Resend
 */
async function sendQueuedNotifications() {
    if (notificationQueue.length === 0)
        return;
    const notifications = notificationQueue.splice(0);
    for (const item of notifications) {
        try {
            // Mock implementation - log instead of actual email
            (0, logger_1.log)('info', 'Email notification sent (mock)', {
                to: item.subscription.email,
                provider: item.notification.provider,
                type: item.notification.type,
                change: `${item.notification.previousStatus} → ${item.notification.status}`
            });
        }
        catch (error) {
            (0, logger_1.log)('error', 'Failed to send email notification', {
                email: item.subscription.email,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
exports.sendQueuedNotifications = sendQueuedNotifications;
/**
 * Determine notification type based on status change
 */
function determineNotificationType(currentStatus, previousStatus) {
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
function generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
/**
 * Auto-send notifications every 5 minutes
 */
setInterval(async () => {
    try {
        await sendQueuedNotifications();
    }
    catch (error) {
        (0, logger_1.log)('error', 'Failed to process notification queue', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}, 5 * 60 * 1000); // 5 minutes 
//# sourceMappingURL=email-notifications.js.map