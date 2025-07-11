import webpush from 'web-push';

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
}

export class PushNotificationService {
  constructor() {
    this.initializeWebPush();
  }

  private initializeWebPush() {
    try {
      if (process.env.FCM_VAPID_PUBLIC_KEY && process.env.FCM_VAPID_PRIVATE_KEY) {
        webpush.setVapidDetails(
          'mailto:' + (process.env.DEFAULT_FROM || 'noreply@localhost'),
          process.env.FCM_VAPID_PUBLIC_KEY,
          process.env.FCM_VAPID_PRIVATE_KEY
        );
      } else {
        // VAPID keys not configured - push notifications disabled
      }
    } catch (error) {
      // Failed to initialize web push
    }
  }

  async sendNotification(
    subscription: PushSubscription,
    payload: NotificationPayload
  ): Promise<any> {
    try {
      if (!process.env.FCM_VAPID_PUBLIC_KEY) {
        throw new Error('Push notification service not configured. Please set VAPID keys.');
      }

      const notificationPayload = {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icon-192x192.png',
          badge: payload.badge || '/icon-192x192.png',
          data: payload.data || {},
        },
      };

      const result = await webpush.sendNotification(
        subscription,
        JSON.stringify(notificationPayload)
      );

      return result;
    } catch (error) {
      // Failed to send push notification
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // Test if VAPID keys are configured
      return !!(process.env.FCM_VAPID_PUBLIC_KEY && process.env.FCM_VAPID_PRIVATE_KEY);
    } catch (error) {
      // Push notification service connection test failed
      return false;
    }
  }
}
