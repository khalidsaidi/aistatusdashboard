'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'critical';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

/**
 * COMPREHENSIVE ERROR BOUNDARY
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 * 
 * CRITICAL FIXES:
 * - Proper error logging and reporting
 * - Graceful degradation with fallback UI
 * - Error recovery mechanisms
 * - Production-safe error handling
 */
export class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;
  
  constructor(props: Props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }
  
  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    this.logError(error, errorInfo);
    
    // Update state with error info
    this.setState({
      errorInfo
    });
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // Set up automatic retry for non-critical errors
    if (this.props.level !== 'critical') {
      this.scheduleRetry();
    }
  }
  
  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }
  
  private logError(error: Error, errorInfo: ErrorInfo) {
    const errorDetails = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      level: this.props.level || 'component',
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server'
    };
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 Error Boundary Caught Error:', errorDetails);
      console.error('Original Error:', error);
      console.error('Error Info:', errorInfo);
    }
    
    // In production, send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      this.reportError(errorDetails);
    }
  }
  
  private async reportError(errorDetails: any) {
    try {
      // Send error to monitoring service
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorDetails)
      });
    } catch (reportingError) {
      // Fallback: log to console if error reporting fails
      console.error('Failed to report error:', reportingError);
    }
  }
  
  private scheduleRetry() {
    // Clear existing timeout
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
    
    // Schedule retry after 5 seconds
    this.retryTimeoutId = setTimeout(() => {
      this.handleRetry();
    }, 5000);
  }
  
  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };
  
  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };
  
  private renderFallbackUI() {
    const { fallback, level = 'component' } = this.props;
    const { error, errorId } = this.state;
    
    // Use custom fallback if provided
    if (fallback) {
      return fallback;
    }
    
    // Default fallback UI based on error level
    switch (level) {
      case 'critical':
        return (
          <div className="min-h-screen flex items-center justify-center bg-red-50 px-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Critical System Error
              </h2>
              <p className="text-gray-600 mb-4">
                A critical error has occurred. Please refresh the page or contact support if the problem persists.
              </p>
              {process.env.NODE_ENV === 'development' && (
                <details className="text-left mb-4 p-3 bg-gray-50 rounded text-sm">
                  <summary className="cursor-pointer font-medium">Error Details</summary>
                  <pre className="mt-2 text-xs overflow-auto">
                    {error?.message}
                    {error?.stack}
                  </pre>
                </details>
              )}
              <div className="space-y-2">
                <button
                  onClick={this.handleReload}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Reload Page
                </button>
                <p className="text-xs text-gray-500">
                  Error ID: {errorId}
                </p>
              </div>
            </div>
          </div>
        );
        
      case 'page':
        return (
          <div className="min-h-96 flex items-center justify-center bg-yellow-50 px-4">
            <div className="max-w-lg w-full bg-white rounded-lg shadow p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Page Error
              </h3>
              <p className="text-gray-600 mb-4">
                This page encountered an error. We&apos;re automatically retrying...
              </p>
              <div className="space-y-2">
                <button
                  onClick={this.handleRetry}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors mr-2"
                >
                  Retry Now
                </button>
                <button
                  onClick={this.handleReload}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        );
        
      case 'component':
      default:
        return (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <div className="w-8 h-8 mx-auto mb-2 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 mb-2">
              Component temporarily unavailable
            </p>
            <button
              onClick={this.handleRetry}
              className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        );
    }
  }
  
  render() {
    if (this.state.hasError) {
      return this.renderFallbackUI();
    }
    
    return this.props.children;
  }
}

// Higher-order component for easy wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for manual error reporting
export function useErrorHandler() {
  const reportError = (error: Error, context?: string) => {
    const errorDetails = {
      errorId: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message: error.message,
      stack: error.stack,
      context: context || 'manual',
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server'
    };
    
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 Manual Error Report:', errorDetails);
    }
    
    if (process.env.NODE_ENV === 'production') {
      fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorDetails)
      }).catch(reportingError => {
        console.error('Failed to report manual error:', reportingError);
      });
    }
  };
  
  return { reportError };
} 