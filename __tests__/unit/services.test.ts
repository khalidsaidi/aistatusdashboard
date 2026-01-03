import { providerService } from '@/lib/services/providers';
import { statusService } from '@/lib/services/status';
import { notificationService } from '@/lib/services/notifications';

// Mock Firestore
jest.mock('@/lib/db/firestore', () => ({
    getDb: jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                set: jest.fn().mockResolvedValue({}),
                get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
            })),
            add: jest.fn().mockResolvedValue({ id: 'test-id' }),
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
                docs: [],
                forEach: jest.fn()
            }),
        })),
        batch: jest.fn(() => ({
            set: jest.fn(),
            commit: jest.fn().mockResolvedValue({}),
        })),
    })),
}));

describe('Core Services', () => {
    describe('ProviderService', () => {
        it('should load providers', () => {
            const providers = providerService.getProviders();
            expect(providers.length).toBeGreaterThan(0);
            expect(providers[0]).toHaveProperty('id');
        });

        it('should find provider by id', () => {
            const p = providerService.getProvider('openai');
            expect(p?.name).toBe('OpenAI');
        });
    });

    describe('StatusService', () => {
        it('should handle check status (mocked)', async () => {
            // Very high level test
            expect(statusService).toBeDefined();
        });
    });

    describe('NotificationService', () => {
        it('should process status change', async () => {
            const current = { id: 'openai', name: 'OpenAI', status: 'down' } as any;
            const previous = { id: 'openai', name: 'OpenAI', status: 'operational' } as any;
            await notificationService.notifyStatusChange(current, previous);
        });
    });
});
