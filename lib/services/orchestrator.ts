import { statusService } from './status';
import { persistenceService } from './persistence';
import { notificationService } from './notifications';
import { providerService } from './providers';
import { log } from '@/lib/utils/logger';

export class StatusOrchestrator {
    async runCycle(): Promise<{ providersChecked: number; changesDetected: number }> {
        let changesDetected = 0;
        const providers = providerService.getProviders();

        try {
            log('info', `Starting status check cycle for ${providers.length} providers`);

            await Promise.all(providers.map(async (provider) => {
                // 1. Get current status
                const current = await statusService.checkProvider(provider);

                // 2. Get previous status
                const previous = await persistenceService.getLastStatus(provider.id);

                // 3. Detect change and notify
                if (previous && previous.status !== current.status) {
                    changesDetected++;
                    await notificationService.notifyStatusChange(current, previous);
                }

                // 4. Persist result
                await persistenceService.saveStatus(current);
            }));

            log('info', 'Status check cycle complete', { providersChecked: providers.length, changesDetected });
            return { providersChecked: providers.length, changesDetected };
        } catch (error) {
            log('error', 'Status orchestrator cycle failed', { error });
            throw error;
        }
    }
}

export const statusOrchestrator = new StatusOrchestrator();
