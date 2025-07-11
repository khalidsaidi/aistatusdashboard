import { StatusResult } from './types';
import { log } from './logger';

export interface NotificationChannel {
  name: string;
  enabled: boolean;
  send(notification: NotificationData): Promise<void>;
}

export interface NotificationData {
  type: 'status_change' | 'incident' | 'recovery';
  provider: StatusResult;
  previousStatus?: StatusResult;
  message: string;
  timestamp: string;
}

class NotificationManager {
  private channels: Map<string, NotificationChannel> = new Map();

  registerChannel(channel: NotificationChannel): void {
    this.channels.set(channel.name, channel);
    log('info', 'Notification channel registered', { channel: channel.name });
  }

  unregisterChannel(channelName: string): void {
    this.channels.delete(channelName);
    log('info', 'Notification channel unregistered', { channel: channelName });
  }

  async sendNotification(data: NotificationData): Promise<void> {
    const enabledChannels = Array.from(this.channels.values()).filter((c) => c.enabled);

    if (enabledChannels.length === 0) {
      log('info', 'No enabled notification channels', { type: data.type });
      return;
    }

    const results = await Promise.allSettled(
      enabledChannels.map(async (channel) => {
        try {
          await channel.send(data);
          log('info', 'Notification sent successfully', {
            channel: channel.name,
            type: data.type,
            provider: data.provider.id,
          });
        } catch (error) {
          log('error', 'Notification failed', {
            channel: channel.name,
            type: data.type,
            provider: data.provider.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }
      })
    );

    const failures = results.filter((r) => r.status === 'rejected').length;
    if (failures > 0) {
      log('warn', 'Some notifications failed', {
        total: enabledChannels.length,
        failures,
        type: data.type,
        provider: data.provider.id,
      });
    }
  }

  getChannelStatus(): Array<{ name: string; enabled: boolean }> {
    return Array.from(this.channels.values()).map((c) => ({
      name: c.name,
      enabled: c.enabled,
    }));
  }
}

// Global notification manager instance
export const notificationManager = new NotificationManager();

// Helper function to process status changes
export async function processStatusChange(
  currentStatus: StatusResult,
  previousStatus: StatusResult
): Promise<void> {
  if (currentStatus.status === previousStatus.status) {
    return; // No change
  }

  const notificationData: NotificationData = {
    type: currentStatus.status === 'operational' ? 'recovery' : 'status_change',
    provider: currentStatus,
    previousStatus,
    message: `${currentStatus.name} status changed from ${previousStatus.status} to ${currentStatus.status}`,
    timestamp: new Date().toISOString(),
  };

  await notificationManager.sendNotification(notificationData);
}
