'use client';

import { useState, useEffect } from 'react';

interface AutoRefreshIndicatorProps {
  isRefreshing: boolean;
  nextRefreshIn: number; // seconds
  onRefresh: () => void;
  className?: string;
}

export default function AutoRefreshIndicator({
  isRefreshing,
  nextRefreshIn,
  onRefresh,
  className = ''
}: AutoRefreshIndicatorProps) {
  const [timeLeft, setTimeLeft] = useState(nextRefreshIn);

  useEffect(() => {
    setTimeLeft(nextRefreshIn);
  }, [nextRefreshIn]);

  useEffect(() => {
    if (timeLeft > 0 && !isRefreshing) {
      const timer = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, isRefreshing]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    return ((nextRefreshIn - timeLeft) / nextRefreshIn) * 100;
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Refresh Status */}
      <div className="flex items-center gap-2">
        {isRefreshing ? (
          <>
            <div className="animate-spin h-4 w-4 text-blue-600">
              <svg className="w-full h-full" fill="none" viewBox="0 0 24 24">
                <circle 
                  className="opacity-25" 
                  cx="12" 
                  cy="12" 
                  r="10" 
                  stroke="currentColor" 
                  strokeWidth="4"
                />
                <path 
                  className="opacity-75" 
                  fill="currentColor" 
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              Refreshing...
            </span>
          </>
        ) : (
          <>
            <div className="h-4 w-4 text-green-600">
              <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Next refresh in {formatTime(timeLeft)}
            </span>
          </>
        )}
      </div>

      {/* Progress Bar */}
      <div className="flex-1 max-w-32">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${getProgressPercentage()}%` }}
          />
        </div>
      </div>

      {/* Manual Refresh Button */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Refresh now"
        title="Refresh now"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  );
}

// Compact version for mobile
export function CompactAutoRefreshIndicator({
  isRefreshing,
  nextRefreshIn,
  onRefresh,
  className = ''
}: AutoRefreshIndicatorProps) {
  const [timeLeft, setTimeLeft] = useState(nextRefreshIn);

  useEffect(() => {
    setTimeLeft(nextRefreshIn);
  }, [nextRefreshIn]);

  useEffect(() => {
    if (timeLeft > 0 && !isRefreshing) {
      const timer = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, isRefreshing]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 min-h-[44px] min-w-[44px] flex items-center justify-center relative"
        aria-label={isRefreshing ? 'Refreshing...' : `Refresh now (auto-refresh in ${timeLeft}s)`}
        title={isRefreshing ? 'Refreshing...' : `Auto-refresh in ${timeLeft}s`}
      >
        {isRefreshing ? (
          <div className="animate-spin h-5 w-5">
            <svg className="w-full h-full" fill="none" viewBox="0 0 24 24">
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
        
        {/* Progress ring */}
        {!isRefreshing && (
          <svg className="absolute -inset-1 w-full h-full" viewBox="0 0 44 44">
            <circle
              cx="22"
              cy="22"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-blue-600 opacity-20"
              strokeDasharray={`${((nextRefreshIn - timeLeft) / nextRefreshIn) * 125.6} 125.6`}
              strokeDashoffset="0"
              transform="rotate(-90 22 22)"
            />
          </svg>
        )}
      </button>
      
      {!isRefreshing && (
        <span className="text-xs text-gray-500 dark:text-gray-500 font-mono">
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </span>
      )}
    </div>
  );
} 