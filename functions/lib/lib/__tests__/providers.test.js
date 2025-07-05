"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const status_fetcher_1 = require("../status-fetcher");
const providers_1 = require("../providers");
// Mock fetch is already set up in jest.setup.js
describe('Providers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('providers array', () => {
        it('should have required providers', () => {
            const providerIds = providers_1.PROVIDERS.map(p => p.id);
            expect(providerIds).toContain('openai');
            expect(providerIds).toContain('anthropic');
            expect(providerIds).toContain('google-ai');
            expect(providerIds).toContain('cohere');
            expect(providerIds).toContain('huggingface');
        });
        it('should have valid properties for each provider', () => {
            providers_1.PROVIDERS.forEach(provider => {
                expect(provider.id).toBeTruthy();
                expect(provider.name).toBeTruthy();
                expect(provider.statusPageUrl).toMatch(/^https:\/\//);
            });
        });
    });
    describe('fetchProviderStatus', () => {
        it('should return operational status for successful response', async () => {
            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    status: { indicator: 'none' },
                    page: { name: 'OpenAI' }
                })
            });
            const provider = providers_1.PROVIDERS[0];
            const status = await (0, status_fetcher_1.fetchProviderStatus)(provider);
            expect(status.id).toBe(provider.id);
            expect(status.name).toBe(provider.name);
            expect(status.status).toBe('operational');
            expect(status.lastChecked).toBeTruthy();
            expect(status.responseTime).toBeGreaterThan(0);
            expect(status.statusPageUrl).toBe(provider.statusPageUrl);
        });
        it('should handle different status indicators correctly', async () => {
            const testCases = [
                { indicator: 'none', expected: 'operational' },
                { indicator: 'minor', expected: 'degraded' },
                { indicator: 'major', expected: 'down' },
                { indicator: 'critical', expected: 'down' },
            ];
            for (const testCase of testCases) {
                global.fetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        status: { indicator: testCase.indicator }
                    })
                });
                const provider = providers_1.PROVIDERS[0];
                const status = await (0, status_fetcher_1.fetchProviderStatus)(provider);
                expect(status.status).toBe(testCase.expected);
            }
        });
        it('should return unknown status on network error', async () => {
            global.fetch.mockRejectedValueOnce(new Error('Network error'));
            const provider = providers_1.PROVIDERS[0];
            const status = await (0, status_fetcher_1.fetchProviderStatus)(provider);
            expect(status.status).toBe('unknown');
            expect(status.id).toBe(provider.id);
            expect(status.lastChecked).toBeTruthy();
        });
        it('should measure response time', async () => {
            global.fetch.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({
                ok: true,
                json: async () => ({ status: { indicator: 'none' } })
            }), 100)));
            const provider = providers_1.PROVIDERS[0];
            const status = await (0, status_fetcher_1.fetchProviderStatus)(provider);
            expect(status.responseTime).toBeDefined();
            expect(status.responseTime).toBeGreaterThanOrEqual(50); // Allow some variance
        });
    });
    describe('fetchAllProviders', () => {
        it('should check all providers in parallel', async () => {
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    status: { indicator: 'none' }
                })
            });
            const results = await Promise.all(providers_1.PROVIDERS.map(p => (0, status_fetcher_1.fetchProviderStatus)(p)));
            expect(results).toHaveLength(providers_1.PROVIDERS.length);
            expect(global.fetch).toHaveBeenCalledTimes(providers_1.PROVIDERS.length);
        });
        it('should handle mixed success and failure', async () => {
            global.fetch
                .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ status: { indicator: 'none' } })
            })
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ status: { indicator: 'minor' } })
            });
            const results = await Promise.all(providers_1.PROVIDERS.slice(0, 3).map(p => (0, status_fetcher_1.fetchProviderStatus)(p)));
            const statuses = results.map(r => r.status);
            expect(statuses).toContain('operational');
            expect(statuses).toContain('unknown');
            expect(statuses).toContain('degraded');
        });
        it('should not throw if one provider fails', async () => {
            global.fetch
                .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ status: { indicator: 'none' } })
            })
                .mockRejectedValueOnce(new Error('Critical failure'));
            const promise = Promise.all(providers_1.PROVIDERS.slice(0, 2).map(p => (0, status_fetcher_1.fetchProviderStatus)(p)));
            await expect(promise).resolves.toBeDefined();
        });
    });
});
//# sourceMappingURL=providers.test.js.map