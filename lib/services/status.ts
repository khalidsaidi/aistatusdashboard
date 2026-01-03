import { Provider, StatusResult, ProviderStatus } from '@/lib/types';
import { log } from '@/lib/utils/logger';
import { config } from '@/lib/config';
import {
    parseInstatusSummaryResponse,
    parseGoogleCloudResponse,
    parseHtmlResponse,
    parseMetaStatusResponse,
    parseRssFeedResponse,
    parseStatusPageResponse,
} from '@/lib/utils/status-parsers';

export class StatusService {
    private cache = new Map<string, { result: StatusResult; expires: number }>();

    async checkProvider(provider: Provider): Promise<StatusResult> {
        const cached = this.getCached(provider.id);
        if (cached) return cached;

        const startTime = Date.now();
        let lastError: string | undefined;

        for (let attempt = 0; attempt <= config.monitoring.defaultRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(),
                    provider.timeout || config.monitoring.defaultTimeout
                );

                const response = await fetch(provider.statusUrl, {
                    signal: controller.signal,
                    cache: 'no-store',
                    headers: { 'User-Agent': 'AI-Status-Dashboard/1.0' },
                });

                clearTimeout(timeoutId);
                const responseTime = Date.now() - startTime;

                const { status, details } = await this.parseStatus(provider, response);
                const result: StatusResult = {
                    id: provider.id,
                    name: provider.name,
                    status,
                    responseTime,
                    lastChecked: new Date().toISOString(),
                    statusPageUrl: provider.statusPageUrl,
                    ...(details ? { details } : {}),
                };

                this.setCached(provider.id, result);
                return result;
            } catch (error) {
                lastError = error instanceof Error ? error.message : 'Unknown error';
                if (attempt < config.monitoring.defaultRetries) {
                    await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
                }
            }
        }

        return {
            id: provider.id,
            name: provider.name,
            status: 'unknown',
            responseTime: Date.now() - startTime,
            lastChecked: new Date().toISOString(),
            error: lastError,
            statusPageUrl: provider.statusPageUrl,
        };
    }

    async checkAll(providers: Provider[]): Promise<StatusResult[]> {
        const results = await Promise.allSettled(
            providers.map((p) => this.checkProvider(p))
        );

        return results.map((r, index) => {
            if (r.status === 'fulfilled') return r.value;
            const p = providers[index];
            return {
                id: p.id,
                name: p.name,
                status: 'unknown',
                responseTime: 0,
                lastChecked: new Date().toISOString(),
                error: r.reason,
                statusPageUrl: p.statusPageUrl,
            };
        });
    }

    private async parseStatus(
        provider: Provider,
        response: Response
    ): Promise<{ status: ProviderStatus; details?: string }> {
        const contentType = response.headers.get('content-type') || '';
        const format = provider.format?.toLowerCase() || '';
        const looksLikeJson =
            contentType.includes('application/json') || provider.statusUrl.endsWith('.json');

        const readJson = async () => {
            try {
                return await response.clone().json();
            } catch {
                return null;
            }
        };

        if (
            format === 'google-cloud' ||
            format === 'statuspage' ||
            format === 'instatus' ||
            format === 'meta'
        ) {
            const data = await readJson();
            if (!data) {
                return { status: this.statusFromHttp(response) };
            }

            if (format === 'google-cloud') {
                const status = parseGoogleCloudResponse(data);
                return {
                    status: status === 'unknown' ? this.statusFromHttp(response) : status,
                };
            }

            if (format === 'instatus') {
                const status = parseInstatusSummaryResponse(data);
                const rawStatus =
                    typeof data?.page?.status === 'string'
                        ? data.page.status
                        : typeof data?.status === 'string'
                            ? data.status
                            : undefined;

                return {
                    status: status === 'unknown' ? this.statusFromHttp(response) : status,
                    details: rawStatus ? `status:${rawStatus}` : undefined,
                };
            }

            if (format === 'meta') {
                const status = parseMetaStatusResponse(data);
                return {
                    status: status === 'unknown' ? this.statusFromHttp(response) : status,
                };
            }

            const status = parseStatusPageResponse(data);
            const indicator = data?.status?.indicator;
            const description =
                typeof data?.status?.description === 'string' ? data.status.description : undefined;

            return {
                status: status === 'unknown' ? this.statusFromHttp(response) : status,
                details:
                    typeof indicator === 'string'
                        ? `indicator:${indicator}${description ? ` (${description})` : ''}`
                        : description,
            };
        }

        if (format === 'rss') {
            try {
                const text = await response.clone().text();
                const parsed = parseRssFeedResponse(text);
                return { status: parsed === 'unknown' ? this.statusFromHttp(response) : parsed };
            } catch {
                return { status: this.statusFromHttp(response) };
            }
        }

        if (format === 'html') {
            try {
                const text = await response.clone().text();
                const parsed = parseHtmlResponse(text);
                return { status: parsed === 'unknown' ? this.statusFromHttp(response) : parsed };
            } catch {
                return { status: this.statusFromHttp(response) };
            }
        }

        if (looksLikeJson) {
            try {
                const data = await response.clone().json();
                const status =
                    provider.id === 'google-ai'
                        ? parseGoogleCloudResponse(data)
                        : parseStatusPageResponse(data);

                const indicator = data?.status?.indicator;
                const description =
                    typeof data?.status?.description === 'string' ? data.status.description : undefined;

                return {
                    status: status === 'unknown' ? this.statusFromHttp(response) : status,
                    details:
                        typeof indicator === 'string'
                            ? `indicator:${indicator}${description ? ` (${description})` : ''}`
                            : description,
                };
            } catch {
                return { status: this.statusFromHttp(response) };
            }
        }

        try {
            const text = await response.clone().text();
            const parsed = parseHtmlResponse(text);
            return { status: parsed === 'unknown' ? this.statusFromHttp(response) : parsed };
        } catch {
            return { status: this.statusFromHttp(response) };
        }
    }

    private statusFromHttp(response: Response): ProviderStatus {
        if (response.ok) return 'operational';
        if (response.status >= 500) return 'down';
        return 'degraded';
    }

    private getCached(id: string): StatusResult | null {
        const item = this.cache.get(id);
        if (item && Date.now() < item.expires) return item.result;
        return null;
    }

    private setCached(id: string, result: StatusResult) {
        this.cache.set(id, {
            result,
            expires: Date.now() + config.monitoring.cacheTTL,
        });
    }
}

export const statusService = new StatusService();
