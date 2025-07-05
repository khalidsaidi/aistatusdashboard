"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchProviderStatus = void 0;
const logger_1 = require("./logger");
const cache_1 = require("./cache");
async function fetchProviderStatus(provider) {
    var _a;
    const cacheKey = `provider:${provider.id}`;
    // Check cache first
    const cached = (0, cache_1.getCached)(cacheKey);
    if (cached) {
        (0, logger_1.log)('info', 'Cache hit for provider', {
            provider: provider.id,
            cacheKey
        });
        return cached;
    }
    (0, logger_1.log)('info', 'Cache miss for provider', {
        provider: provider.id,
        cacheKey
    });
    const startTime = Date.now();
    try {
        // Create an AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        const response = await fetch(provider.statusUrl, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        let data;
        let status;
        const responseTime = Date.now() - startTime;
        // Special handling for HuggingFace which returns HTML instead of JSON
        if (provider.id === 'huggingface') {
            const textResponse = await response.text();
            // If we get HTML with DOCTYPE, it means their status page is accessible (operational)
            status = textResponse.includes('<!DOCTYPE') ? 'operational' : 'unknown';
        }
        else {
            try {
                data = await response.json();
                // Special handling for different provider formats
                if (provider.id === 'google-ai') {
                    // If no incidents array or empty, it's operational
                    const incidents = data;
                    const hasIncidents = Array.isArray(incidents) && incidents.length > 0;
                    status = hasIncidents ? 'degraded' : 'operational';
                }
                else {
                    // Standard status page format
                    const statusData = data;
                    const indicator = ((_a = statusData.status) === null || _a === void 0 ? void 0 : _a.indicator) || 'unknown';
                    // Map status page indicators to our status types
                    status = indicator === 'none' ? 'operational' :
                        indicator === 'minor' ? 'degraded' :
                            (indicator === 'major' || indicator === 'critical') ? 'down' :
                                'unknown';
                }
            }
            catch (jsonError) {
                // If JSON parsing fails, treat as unknown
                status = 'unknown';
                (0, logger_1.log)('warn', 'Failed to parse JSON response', {
                    provider: provider.id,
                    error: jsonError instanceof Error ? jsonError.message : 'Unknown JSON error'
                });
            }
        }
        (0, logger_1.log)('info', 'Provider status fetched successfully', {
            provider: provider.id,
            responseTime,
            status: response.status
        });
        const result = {
            id: provider.id,
            name: provider.name,
            status,
            statusPageUrl: provider.statusPageUrl,
            responseTime,
            lastChecked: new Date().toISOString()
        };
        // Cache successful result
        (0, cache_1.setCache)(cacheKey, result);
        return result;
    }
    catch (error) {
        const responseTime = Date.now() - startTime;
        (0, logger_1.log)('error', 'Provider fetch failed', {
            provider: provider.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            responseTime
        });
        return {
            id: provider.id,
            name: provider.name,
            status: 'unknown',
            statusPageUrl: provider.statusPageUrl,
            responseTime,
            lastChecked: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
exports.fetchProviderStatus = fetchProviderStatus;
//# sourceMappingURL=status-fetcher.js.map