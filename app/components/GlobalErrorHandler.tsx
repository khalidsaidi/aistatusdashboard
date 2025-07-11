'use client';

import { useEffect } from 'react';
import { useToast } from './Toast';

export default function GlobalErrorHandler() {
  const { showError, showWarning } = useToast();

  useEffect(() => {
    let fontErrorShown = false; // Prevent duplicate font error toasts

    // Catch unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);

      // Check if it's a font loading error
      if (event.reason?.message?.includes('font') || event.reason?.toString().includes('.woff')) {
        if (!fontErrorShown) {
          showWarning(
            'Font Loading Error',
            'Some fonts failed to load, but the site will continue to work with fallback fonts.'
          );
          fontErrorShown = true;
        }
      } else {
        // Show user-friendly error message for other rejections
        showError(
          'Network Error',
          'Something went wrong. Please check your connection and try again.'
        );
      }

      // Prevent default browser error handling
      event.preventDefault();
    };

    // Catch JavaScript errors
    const handleError = (event: ErrorEvent) => {
      console.error('JavaScript error:', event.error);

      // Show user-friendly error message
      showError('Application Error', 'An unexpected error occurred. Please refresh the page.');
    };

    // Catch resource loading errors (fonts, images, scripts, etc.)
    const handleResourceError = (event: Event) => {
      const target = event.target as HTMLElement;

      if (target) {
        // Check for font loading errors
        if (target.tagName === 'LINK' && (target as HTMLLinkElement).href?.includes('.woff')) {
          console.warn('Font loading error:', (target as HTMLLinkElement).href);
          if (!fontErrorShown) {
            showWarning(
              'Font Loading Error',
              'Some fonts failed to load, but the site will continue to work with fallback fonts.'
            );
            fontErrorShown = true;
          }
        }
        // Check for image loading errors
        else if (target.tagName === 'IMG') {
          console.warn('Image loading error:', (target as HTMLImageElement).src);
          showWarning('Image Loading Error', 'An image failed to load.');
        }
        // Check for script loading errors
        else if (target.tagName === 'SCRIPT') {
          console.error('Script loading error:', (target as HTMLScriptElement).src);
          showError(
            'Script Loading Error',
            'A required script failed to load. Please refresh the page.'
          );
        }
        // Generic resource error
        else {
          console.warn('Resource loading error:', target);
        }
      }
    };

    // Monitor Performance Observer for failed resource loads
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          // Check for font loading failures
          if (entry.name.includes('.woff')) {
            const resourceEntry = entry as PerformanceResourceTiming;
            if (resourceEntry.transferSize === 0) {
              console.warn('Font failed to load via Performance Observer:', entry.name);
              if (!fontErrorShown) {
                showWarning(
                  'Font Loading Error',
                  'Some fonts failed to load, but the site will continue to work with fallback fonts.'
                );
                fontErrorShown = true;
              }
            }
          }
        });
      });

      try {
        observer.observe({ entryTypes: ['resource'] });
      } catch (e) {
        console.warn('Performance Observer not supported for resource monitoring');
      }
    }

    // Monitor console errors for font loading issues
    const originalConsoleError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');

      // Check for font-related errors in console
      if (
        (message.includes('.woff') || (message.includes('font') && message.includes('404'))) &&
        !fontErrorShown
      ) {
        showWarning(
          'Font Loading Error',
          'Some fonts failed to load, but the site will continue to work with fallback fonts.'
        );
        fontErrorShown = true;
      }

      // Call original console.error
      originalConsoleError.apply(console, args);
    };

    // Monitor console warnings for font loading issues
    const originalConsoleWarn = console.warn;
    console.warn = (...args) => {
      const message = args.join(' ');

      // Check for font-related warnings in console
      if ((message.includes('.woff') || message.includes('font')) && !fontErrorShown) {
        showWarning(
          'Font Loading Error',
          'Some fonts failed to load, but the site will continue to work with fallback fonts.'
        );
        fontErrorShown = true;
      }

      // Call original console.warn
      originalConsoleWarn.apply(console, args);
    };

    // Catch React errors (in addition to ErrorBoundary)
    const handleReactError = (event: any) => {
      if (event.detail?.error) {
        console.error('React error:', event.detail.error);

        showError('Component Error', 'A component failed to load. Please try refreshing the page.');
      }
    };

    // Network error handler for fetch failures
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);

        // Show toast for HTTP errors
        if (!response.ok) {
          // Get URL from fetch arguments
          let url = '';
          if (typeof args[0] === 'string') {
            url = args[0];
          } else if (args[0] instanceof Request) {
            url = args[0].url;
          } else if (args[0] instanceof URL) {
            url = args[0].toString();
          }

          // Handle font loading errors specifically
          if (url.includes('.woff') && !fontErrorShown) {
            showWarning(
              'Font Loading Error',
              'Some fonts failed to load, but the site will continue to work with fallback fonts.'
            );
            fontErrorShown = true;
          }
          // Skip showing toasts for other static assets
          else if (!url.includes('.css') && !url.includes('.js')) {
            if (response.status >= 500) {
              showError('Server Error', `Service temporarily unavailable (${response.status})`);
            } else if (response.status === 404) {
              showWarning('Not Found', 'The requested resource was not found');
            } else if (response.status === 401 || response.status === 403) {
              showWarning('Access Denied', "You don't have permission to access this resource");
            }
          }
        }

        return response;
      } catch (error) {
        // Network connectivity issues
        showError(
          'Connection Error',
          'Unable to connect to the server. Please check your internet connection.'
        );
        throw error;
      }
    };

    // Monitor document for font loading using CSS Font Loading API
    if ('fonts' in document) {
      document.fonts.addEventListener('loadingerror', (event: any) => {
        console.warn('Font loading error via CSS Font Loading API:', event);
        if (!fontErrorShown) {
          showWarning(
            'Font Loading Error',
            'Some fonts failed to load, but the site will continue to work with fallback fonts.'
          );
          fontErrorShown = true;
        }
      });
    }

    // Add event listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);
    window.addEventListener('error', handleResourceError, true); // Use capture phase for resource errors
    window.addEventListener('reactError', handleReactError);

    // Cleanup
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
      window.removeEventListener('error', handleResourceError, true);
      window.removeEventListener('reactError', handleReactError);

      // Restore original fetch and console methods
      window.fetch = originalFetch;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
    };
  }, [showError, showWarning]);

  return null; // This component doesn't render anything
}
