/**
 * Safe environment variable access for both server and client.
 * Prevents "process is not defined" errors in the browser.
 */
export function getEnv(key: string, defaultValue: string = ''): string {
    if (typeof process !== 'undefined' && process.env) {
        return process.env[key] || defaultValue;
    }

    // In Next.js, prefixed variables are sometimes injected directly
    // but we can't reliably access them via window._env_ etc without setup.
    return defaultValue;
}

export const isDev = getEnv('NODE_ENV') === 'development';
export const isProd = getEnv('NODE_ENV') === 'production';
export const isTest = getEnv('NODE_ENV') === 'test';
