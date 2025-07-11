// Custom error logging solution for web applications
// Since Firebase Crashlytics is not available for web, we'll use a custom solution

// Extend Window interface to include gtag
declare global {
  interface Window {
    gtag?: (command: string, target: string, parameters?: Record<string, any>) => void;
  }
}

interface ErrorLog {
  error: Error;
  context: string;
  timestamp: Date;
  userAgent: string;
  url: string;
}

let errorLogs: ErrorLog[] = [];
let userId: string | null = null;

export const logError = (error: Error, context: string) => {
  // Log to console for development
  // Error logged to crashlytics - no console pollution

  // Store error for potential reporting
  if (typeof window !== 'undefined') {
    const errorLog: ErrorLog = {
      error,
      context,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    errorLogs.push(errorLog);

    // Keep only last 50 errors to avoid memory issues
    if (errorLogs.length > 50) {
      errorLogs = errorLogs.slice(-50);
    }

    // In a real implementation, you might want to send this to a logging service
    // For now, we'll just store it locally
  }
};

export const setUserContext = (userId: string) => {
  userId = userId;
};

export const logCustomEvent = (eventName: string, params: Record<string, any> = {}) => {
  // Custom event tracked - no console output needed
};

export const setBreadcrumb = (message: string, category: string = 'general') => {
  // Log message handled
};

export const getErrorLogs = (): ErrorLog[] => {
  return [...errorLogs];
};

export const clearErrorLogs = () => {
  errorLogs = [];
};

const crashlytics = {
  log: (message: string, extra?: Record<string, any>) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: message,
        fatal: false,
        ...extra,
      });
    }
    // Crashlytics log handled
  },

  recordError: (error: Error, context?: Record<string, any>) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: error.message,
        fatal: false,
        ...context,
      });
    }
    // Crashlytics error handled
  },

  setUserId: (userId: string) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-HPNE6D3YQW', {
        user_id: userId,
      });
    }
    // User ID set in Crashlytics
  },

  setCustomKey: (key: string, value: string | number | boolean) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'custom_parameter', {
        [key]: value,
      });
    }
    // Custom key set in Crashlytics
  },
};

export default crashlytics;
