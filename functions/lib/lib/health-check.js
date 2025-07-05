"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProviderHealth = exports.getLatestHealthCheck = exports.stopHealthCheckMonitoring = exports.startHealthCheckMonitoring = exports.runHealthChecks = void 0;
const providers_1 = require("./providers");
const logger_1 = require("./logger");
/**
 * Performs a health check on a single provider
 */
async function checkProviderHealth(provider) {
    const startTime = Date.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for health checks
        const response = await fetch(provider.statusUrl, {
            signal: controller.signal,
            method: 'HEAD' // Use HEAD for faster checks
        });
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        const healthy = response.ok;
        const result = {
            providerId: provider.id,
            healthy,
            responseTime,
            timestamp: new Date().toISOString()
        };
        if (!healthy) {
            result.error = `HTTP ${response.status}`;
        }
        return result;
    }
    catch (error) {
        const responseTime = Date.now() - startTime;
        return {
            providerId: provider.id,
            healthy: false,
            responseTime,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        };
    }
}
/**
 * Runs health checks for all providers
 */
async function runHealthChecks() {
    (0, logger_1.log)('info', 'Starting health checks for all providers');
    const results = await Promise.all(providers_1.PROVIDERS.map(provider => checkProviderHealth(provider)));
    // Log summary
    const healthy = results.filter(r => r.healthy).length;
    const unhealthy = results.filter(r => !r.healthy).length;
    (0, logger_1.log)('info', 'Health check completed', {
        totalProviders: results.length,
        healthy,
        unhealthy,
        avgResponseTime: Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / results.length)
    });
    // Log individual failures
    results.filter(r => !r.healthy).forEach(result => {
        (0, logger_1.log)('warn', 'Provider health check failed', {
            provider: result.providerId,
            error: result.error,
            responseTime: result.responseTime
        });
    });
    return results;
}
exports.runHealthChecks = runHealthChecks;
// Store health check results in memory
let lastHealthCheck = [];
let healthCheckInterval = null;
/**
 * Starts periodic health checks
 */
function startHealthCheckMonitoring(intervalMs = 5 * 60 * 1000) {
    if (healthCheckInterval) {
        (0, logger_1.log)('warn', 'Health check monitoring already running');
        return;
    }
    (0, logger_1.log)('info', 'Starting health check monitoring', { intervalMs });
    // Run initial check
    runHealthChecks().then(results => {
        lastHealthCheck = results;
    });
    // Set up periodic checks
    healthCheckInterval = setInterval(async () => {
        const results = await runHealthChecks();
        lastHealthCheck = results;
    }, intervalMs);
}
exports.startHealthCheckMonitoring = startHealthCheckMonitoring;
/**
 * Stops periodic health checks
 */
function stopHealthCheckMonitoring() {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
        (0, logger_1.log)('info', 'Stopped health check monitoring');
    }
}
exports.stopHealthCheckMonitoring = stopHealthCheckMonitoring;
/**
 * Gets the latest health check results
 */
function getLatestHealthCheck() {
    return lastHealthCheck;
}
exports.getLatestHealthCheck = getLatestHealthCheck;
/**
 * Gets health status for a specific provider
 */
function getProviderHealth(providerId) {
    return lastHealthCheck.find(r => r.providerId === providerId);
}
exports.getProviderHealth = getProviderHealth;
//# sourceMappingURL=health-check.js.map