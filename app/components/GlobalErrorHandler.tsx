'use client';

import { useEffect, useRef } from 'react';
import { useToast } from './Toast';

export default function GlobalErrorHandler() {
  const { showError, showWarning } = useToast();

  const toastApiRef = useRef({ showError, showWarning });
  toastApiRef.current = { showError, showWarning };

  useEffect(() => {
    let fontErrorShown = false;

    const originalConsoleError = console.error;
    const originalOnError = window.onerror;
    const originalOnUnhandledRejection = window.onunhandledrejection;
    const originalFetch = window.fetch;

    const seenToastKeys = new Set<string>();
    let toastCount = 0;
    let lastToastAt = 0;
    const TOAST_THROTTLE_MS = 1500;
    const MAX_TOASTS_PER_SESSION = 6;

    const shouldIgnoreMessage = (message: string) => {
      if (!message) return true;
      return false;
    };

    const showToastOnce = (key: string, type: 'error' | 'warning', title: string, message: string) => {
      if (shouldIgnoreMessage(message)) return;
      if (toastCount >= MAX_TOASTS_PER_SESSION) return;
      if (seenToastKeys.has(key)) return;

      const now = Date.now();
      if (now - lastToastAt < TOAST_THROTTLE_MS) return;

      seenToastKeys.add(key);
      toastCount += 1;
      lastToastAt = now;

      if (type === 'warning') {
        toastApiRef.current.showWarning(title, message);
      } else {
        toastApiRef.current.showError(title, message);
      }
    };

    const safeToString = (value: unknown) => {
      if (value instanceof Error) return value.message;
      if (typeof value === 'string') return value;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    };

    console.error = (...args) => {
      originalConsoleError.apply(console, args);

      try {
        const message = args.map(safeToString).join(' ');

        if (message.includes('font') || message.includes('.woff')) {
          if (!fontErrorShown) {
            toastApiRef.current.showWarning(
              'Font Loading Error',
              'Some fonts failed to load, but the site will continue to work with fallback fonts.'
            );
            fontErrorShown = true;
          }
          return;
        }

        showToastOnce(`console.error:${message}`, 'error', 'Application Error', message.slice(0, 200));
      } catch {
        // Never throw from a console patch.
      }
    };

    window.onerror = function (message, source, lineno, colno, error) {
      try {
        const details =
          (message ? message.toString() : 'Unknown error') +
          (source ? `\n${source}:${lineno ?? 0}:${colno ?? 0}` : '') +
          (error && (error as Error).stack ? `\n${(error as Error).stack}` : '');

        showToastOnce('window.onerror', 'error', 'Application Error', details.slice(0, 400));
      } catch {
        // ignore
      }

      if (typeof originalOnError === 'function') {
        return originalOnError(message, source, lineno, colno, error);
      }
      return false;
    };

    window.onunhandledrejection = function (event) {
      try {
        const reason = (event as PromiseRejectionEvent).reason;
        const details = reason instanceof Error ? reason.message : reason ? String(reason) : 'Unknown reason';
        showToastOnce('window.onunhandledrejection', 'error', 'Unhandled Promise Rejection', details.slice(0, 300));
      } catch {
        // ignore
      }

      if (typeof originalOnUnhandledRejection === 'function') {
        return originalOnUnhandledRejection.call(window, event);
      }
      return false;
    };

    window.fetch = async function (...args) {
      try {
        const response = await originalFetch.apply(window, args);

        if (!response.ok) {
          let url = 'Unknown URL';
          if (typeof args[0] === 'string') {
            url = args[0];
          } else if (args[0] instanceof Request) {
            url = args[0].url;
          } else if (args[0] instanceof URL) {
            url = args[0].toString();
          }

          if (!shouldIgnoreMessage(url)) {
            const truncatedUrl = url.slice(0, 120);

            if (response.status >= 500) {
              showToastOnce(
                `fetch:${response.status}:${truncatedUrl}`,
                'error',
                'Server Error',
                `Server error (${response.status}): ${truncatedUrl}`
              );
            } else if (response.status === 404) {
              showToastOnce(
                `fetch:${response.status}:${truncatedUrl}`,
                'warning',
                'Resource Not Found',
                `The requested resource was not found: ${truncatedUrl}`
              );
            }
          }
        }

        return response;
      } catch (error) {
        let url = 'Unknown URL';
        if (typeof args[0] === 'string') {
          url = args[0];
        } else if (args[0] instanceof Request) {
          url = args[0].url;
        } else if (args[0] instanceof URL) {
          url = args[0].toString();
        }

        if (!shouldIgnoreMessage(url)) {
          showToastOnce(
            `fetch:network:${url}`,
            'error',
            'Network Error',
            `Failed to connect to: ${url.slice(0, 120)}. Please check your internet connection.`
          );
        }

        throw error;
      }
    };

    return () => {
      console.error = originalConsoleError;
      window.onerror = originalOnError;
      window.onunhandledrejection = originalOnUnhandledRejection;
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
