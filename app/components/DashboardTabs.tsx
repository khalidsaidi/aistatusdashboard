'use client';

import { useState, useEffect } from 'react';
import { StatusResult } from '@/lib/types';
import NotificationPanel from './NotificationPanel';
import APIDemo from './APIDemo';
import CommentSection from './CommentSection';
import ClientTimestamp from './ClientTimestamp';
import AnalyticsDashboard from './AnalyticsDashboard';
import React from 'react';
import Image from 'next/image';

interface DashboardTabsProps {
  statuses?: StatusResult[];
}

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    // Dashboard error handled by error boundary
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
            Something went wrong
          </h3>
          <p className="text-red-600 dark:text-red-400 mb-4">
            {this.state.error?.message || 'An unexpected error occurred while rendering the dashboard.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function DashboardTabs({ statuses = [] }: DashboardTabsProps) {
  // Initialize ALL hooks first - React requires hooks to be called in the same order
  const [activeTab, setActiveTab] = useState<'dashboard' | 'notifications' | 'api' | 'comments' | 'analytics'>('dashboard');
  
  // Handle URL parameters for tab switching
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam && ['dashboard', 'notifications', 'api', 'comments', 'analytics'].includes(tabParam)) {
        setActiveTab(tabParam as 'dashboard' | 'notifications' | 'api' | 'comments' | 'analytics');
      }
    }
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'operational' | 'degraded' | 'down' | 'unknown'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'responseTime' | 'lastChecked'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [responseTimeFilter, setResponseTimeFilter] = useState<'all' | 'fast' | 'medium' | 'slow'>('all');
  const [uptimeFilter, setUptimeFilter] = useState<'all' | 'excellent' | 'good' | 'poor'>('all');
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Global keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on '/' key (both regular slash and numpad slash)
      if ((e.key === '/' || e.code === 'NumpadDivide') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        // Only focus if we're on dashboard tab and search input exists
        if (activeTab === 'dashboard' && searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', handleKeyDown, true);
      return () => document.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [activeTab]);

  // Calculate stats safely
  const safeStatuses = statuses.filter(s => s && typeof s === 'object' && s.status);
  const operationalCount = safeStatuses.filter(s => s.status === 'operational').length;
  const degradedCount = safeStatuses.filter(s => s.status === 'degraded').length;
  const downCount = safeStatuses.filter(s => s.status === 'down').length;
  const unknownCount = safeStatuses.filter(s => s.status === 'unknown').length;
  
  const avgResponseTime = safeStatuses.length > 0 
    ? Math.round(safeStatuses.reduce((acc, s) => acc + (typeof s.responseTime === 'number' ? s.responseTime : 0), 0) / safeStatuses.length)
    : 0;

  const healthPercentage = safeStatuses.length > 0 
    ? Math.round((operationalCount / safeStatuses.length) * 100)
    : 0;

  // Calculate global last updated time
  const lastUpdated = React.useMemo(() => {
    const timestamps = safeStatuses
      .map(s => s.lastChecked)
      .filter(Boolean)
      .map(t => new Date(t).getTime())
      .sort((a, b) => b - a); // Sort descending to get most recent
    
    return timestamps.length > 0 ? new Date(timestamps[0]) : new Date();
  }, [safeStatuses]);

  const systemStatus = React.useMemo(() => {
    if (downCount > 0) return { status: 'issues', color: 'text-red-600 dark:text-red-400', icon: '🔴' };
    if (degradedCount > 0) return { status: 'degraded', color: 'text-yellow-600 dark:text-yellow-400', icon: '🟡' };
    if (operationalCount === safeStatuses.length && safeStatuses.length > 0) {
      return { status: 'operational', color: 'text-green-600 dark:text-green-400', icon: '🟢' };
    }
    return { status: 'unknown', color: 'text-gray-600 dark:text-gray-400', icon: '⚪' };
  }, [operationalCount, degradedCount, downCount, safeStatuses.length]);

  // Filter and sort statuses
  const filteredAndSortedStatuses = React.useMemo(() => {
    const safeStatuses = statuses.filter(s => s && typeof s === 'object' && s.status);
    
    // Apply search filter
    let filtered = safeStatuses.filter(status => 
      status.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      status.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(status => status.status === statusFilter);
    }
    
    // Apply response time filter
    if (responseTimeFilter !== 'all') {
      filtered = filtered.filter(status => {
        const responseTime = typeof status.responseTime === 'number' ? status.responseTime : 999999;
        switch (responseTimeFilter) {
          case 'fast': return responseTime <= 100;
          case 'medium': return responseTime > 100 && responseTime <= 500;
          case 'slow': return responseTime > 500;
          default: return true;
        }
      });
    }
    
    // Apply uptime filter
    if (uptimeFilter !== 'all') {
      filtered = filtered.filter(status => {
        // Calculate uptime percentage (same logic as in renderStatusCard)
        const uptimePercentage = 
          status.status === 'operational' ? 99.9 :
          status.status === 'degraded' ? 95.0 :
          status.status === 'down' ? 0.0 : 85.0;
        
        switch (uptimeFilter) {
          case 'excellent': return uptimePercentage >= 99;
          case 'good': return uptimePercentage >= 95 && uptimePercentage < 99;
          case 'poor': return uptimePercentage < 95;
          default: return true;
        }
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'status':
          // Sort by status priority: operational > degraded > down > unknown
          const statusPriority = { operational: 4, degraded: 3, down: 2, unknown: 1 };
          aValue = statusPriority[a.status as keyof typeof statusPriority] || 0;
          bValue = statusPriority[b.status as keyof typeof statusPriority] || 0;
          break;
        case 'responseTime':
          aValue = typeof a.responseTime === 'number' ? a.responseTime : 999999;
          bValue = typeof b.responseTime === 'number' ? b.responseTime : 999999;
          break;
        case 'lastChecked':
          aValue = new Date(a.lastChecked || 0).getTime();
          bValue = new Date(b.lastChecked || 0).getTime();
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  }, [statuses, searchQuery, statusFilter, responseTimeFilter, uptimeFilter, sortBy, sortOrder]);

  // Validate statuses prop after hooks initialization
  if (!Array.isArray(statuses)) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
        <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
          Invalid Data
        </h3>
        <p className="text-yellow-600 dark:text-yellow-400">
          Status data is not in the expected format. Please try refreshing the page.
        </p>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: '📊 Status Dashboard', count: filteredAndSortedStatuses.length },
    { id: 'analytics', label: '📈 Analytics & Costs', count: null },
    { id: 'notifications', label: '🔔 Notifications', count: null },
    { id: 'api', label: '🚀 API & Badges', count: null },
    { id: 'comments', label: '💬 Comments', count: null }
  ];

  const renderStatusCard = (status: StatusResult) => {
    // Validate status object
    if (!status || typeof status !== 'object' || !status.id || !status.name) {
      return (
        <div key={Math.random()} className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">Invalid status data</p>
        </div>
      );
    }

    const statusIcon = 
      status.status === 'operational' ? '✅' :
      status.status === 'degraded' ? '⚠️' :
      status.status === 'down' ? '❌' : '❓';
    
    const borderColor = 
      status.status === 'operational' ? 'border-green-500' :
      status.status === 'degraded' ? 'border-yellow-500' :
      status.status === 'down' ? 'border-red-500' : 'border-gray-500';

    const statusColor = 
      status.status === 'operational' ? 'text-green-600 dark:text-green-400' :
      status.status === 'degraded' ? 'text-yellow-600 dark:text-yellow-400' :
      status.status === 'down' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400';

    // Calculate uptime percentage (simplified - in production this would come from historical data)
    const uptimePercentage = 
      status.status === 'operational' ? 99.9 :
      status.status === 'degraded' ? 95.0 :
      status.status === 'down' ? 0.0 : 85.0; // unknown

    const uptimeColor = 
      uptimePercentage >= 99 ? 'text-green-600 dark:text-green-400' :
      uptimePercentage >= 95 ? 'text-yellow-600 dark:text-yellow-400' :
      'text-red-600 dark:text-red-400';

    return (
      <div 
        key={status.id} 
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 ${borderColor} p-6 hover:shadow-md transition-shadow`}
        data-testid="provider-card"
        data-provider={status.id}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <Image 
                src={`/logos/${status.id}.svg`} 
                alt={`${status.name} logo`}
                className="w-6 h-6"
                width={24}
                height={24}
                unoptimized
                onError={(e) => {
                  // Fallback to PNG if SVG fails
                  const target = e.target as HTMLImageElement;
                  if (target.src.endsWith('.svg')) {
                    target.src = `/logos/${status.id}.png`;
                  } else {
                    // Hide image if both fail
                    target.style.display = 'none';
                  }
                }}
              />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{status.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">AI Provider</p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl ${statusColor} flex items-center gap-2`}>
              {statusIcon}
              <span className="text-sm font-medium capitalize">{status.status}</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600 dark:text-gray-400">Response Time</p>
            <p className="font-medium text-gray-900 dark:text-white" data-testid="response-time">
              {typeof status.responseTime === 'number' ? `${status.responseTime}ms` : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Uptime (30d)</p>
            <p className={`font-medium ${uptimeColor}`}>
              {uptimePercentage.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Last Checked</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {status.lastChecked ? new Date(status.lastChecked).toLocaleTimeString() : 'N/A'}
            </p>
          </div>
        </div>
        
        {/* Status Details */}
        {status.details && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Details:</strong> {status.details}
            </p>
          </div>
        )}
        
        {status.error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">
              <strong>Error:</strong> {status.error}
            </p>
          </div>
        )}
        
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <a 
            href={status.statusPageUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium transition-colors"
            data-testid="official-status-link"
          >
            View Official Status →
          </a>
        </div>
      </div>
    );
  };

  return (
    <ErrorBoundary>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {systemStatus.status === 'operational' ? '🚀 All Systems Operational' :
                 systemStatus.status === 'degraded' ? '⚠️ Some Services Degraded' :
                 systemStatus.status === 'issues' ? '🔴 Service Issues Detected' :
                 '📊 AI Provider Status'}
              </h2>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className={systemStatus.color}>{systemStatus.icon}</span>
                  <span className="text-gray-600 dark:text-gray-400">
                    System Status: <span className={`font-medium ${systemStatus.color}`}>
                      {systemStatus.status.charAt(0).toUpperCase() + systemStatus.status.slice(1)}
                    </span>
                  </span>
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  Last updated: <span className="font-medium">{lastUpdated.toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Updates every 60 seconds
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300">
                  {operationalCount}/{safeStatuses.length} Operational
                </span>
                {degradedCount > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">
                    {degradedCount} Degraded
                  </span>
                )}
                {downCount > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300">
                    {downCount} Down
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status Summary Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-green-600 dark:text-green-400">✅</span>
              <span className="text-gray-700 dark:text-gray-300">
                {operationalCount} Operational
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-600 dark:text-yellow-400">⚠️</span>
              <span className="text-gray-700 dark:text-gray-300">
                {degradedCount} Degraded
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-600 dark:text-red-400">❌</span>
              <span className="text-gray-700 dark:text-gray-300">
                {downCount} Down
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">❓</span>
              <span className="text-gray-700 dark:text-gray-300">
                {unknownCount} Unknown
              </span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-blue-600 dark:text-blue-400">📊</span>
              <span className="text-gray-700 dark:text-gray-300">
                Avg: {avgResponseTime}ms
              </span>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        {activeTab === 'dashboard' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <div className="flex flex-col gap-4">
              {/* Search Input - Full width on mobile */}
              <div className="w-full">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search providers... (Press / to focus)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setSearchQuery('');
                        e.currentTarget.blur();
                      }
                    }}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    ref={searchInputRef}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 min-h-[44px] min-w-[44px] justify-center"
                      aria-label="Clear search"
                      title="Clear search"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Filters Row - Wrap on mobile */}
              <div className="flex flex-wrap gap-4">
                {/* Status Filter */}
                <div className="flex items-center gap-2 min-w-0">
                  <label htmlFor="status-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Status:</label>
                  <select
                    id="status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="operational">✅ Operational</option>
                    <option value="degraded">⚠️ Degraded</option>
                    <option value="down">❌ Down</option>
                    <option value="unknown">❓ Unknown</option>
                  </select>
                </div>

                {/* Response Time Filter */}
                <div className="flex items-center gap-2 min-w-0">
                  <label htmlFor="speed-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Speed:</label>
                  <select
                    id="speed-filter"
                    value={responseTimeFilter}
                    onChange={(e) => setResponseTimeFilter(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="fast">⚡ Fast (≤100ms)</option>
                    <option value="medium">🚀 Medium (100-500ms)</option>
                    <option value="slow">🐌 Slow (&gt;500ms)</option>
                  </select>
                </div>

                {/* Uptime Filter */}
                <div className="flex items-center gap-2 min-w-0">
                  <label htmlFor="uptime-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Uptime:</label>
                  <select
                    id="uptime-filter"
                    value={uptimeFilter}
                    onChange={(e) => setUptimeFilter(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="all">All</option>
                    <option value="excellent">🏆 Excellent (&gt;=99%)</option>
                    <option value="good">👍 Good (95-99%)</option>
                    <option value="poor">👎 Poor (&lt;95%)</option>
                  </select>
                </div>

                {/* Sort Options */}
                <div className="flex items-center gap-2 min-w-0">
                  <label htmlFor="sort-filter" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Sort:</label>
                  <select
                    id="sort-filter"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="name">Name</option>
                    <option value="status">Status</option>
                    <option value="responseTime">Response Time</option>
                    <option value="lastChecked">Last Checked</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                    aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    <svg className={`h-4 w-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                  </button>
                </div>

                {/* Clear Filters */}
                {(searchQuery || statusFilter !== 'all' || responseTimeFilter !== 'all' || uptimeFilter !== 'all' || sortBy !== 'name' || sortOrder !== 'asc') && (
                  <button
                    data-testid="clear-filters-button"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                      setResponseTimeFilter('all');
                      setUptimeFilter('all');
                      setSortBy('name');
                      setSortOrder('asc');
                    }}
                    className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline whitespace-nowrap"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Results Summary */}
            {(searchQuery || statusFilter !== 'all' || responseTimeFilter !== 'all' || uptimeFilter !== 'all') && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {filteredAndSortedStatuses.length} of {statuses.length} providers
                  {searchQuery && (
                    <span> matching &quot;{searchQuery}&quot;</span>
                  )}
                  {statusFilter !== 'all' && (
                    <span> with status &quot;{statusFilter}&quot;</span>
                  )}
                  {responseTimeFilter !== 'all' && (
                    <span> with {responseTimeFilter} response times</span>
                  )}
                  {uptimeFilter !== 'all' && (
                    <span> with {uptimeFilter} uptime</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-8 py-4 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 min-h-[48px] min-w-[48px] ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {tab.label}
              {tab.count && (
                <span className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs px-3 py-2 rounded-full min-h-[24px]">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[600px]">
          {activeTab === 'dashboard' && (
            <ErrorBoundary fallback={
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Unable to load dashboard content</p>
              </div>
            }>
              <div>
                {filteredAndSortedStatuses.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredAndSortedStatuses.map(renderStatusCard)}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-6xl mb-4">🔍</div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      No providers found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {searchQuery || statusFilter !== 'all' || responseTimeFilter !== 'all' || uptimeFilter !== 'all'
                        ? 'Try adjusting your search or filter criteria.'
                        : 'No provider data available.'}
                    </p>
                    {(searchQuery || statusFilter !== 'all' || responseTimeFilter !== 'all' || uptimeFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setStatusFilter('all');
                          setResponseTimeFilter('all');
                          setUptimeFilter('all');
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                )}
                
                {/* Quick Stats */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">System Health</h3>
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {healthPercentage}%
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Overall Uptime</p>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Response Time</h3>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {avgResponseTime}ms
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Average Latency</p>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Providers</h3>
                    <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{filteredAndSortedStatuses.length}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">AI Services Monitored</p>
                  </div>
                </div>
              </div>
            </ErrorBoundary>
          )}

          {activeTab === 'notifications' && (
            <ErrorBoundary fallback={
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Unable to load notifications</p>
              </div>
            }>
              <NotificationPanel />
            </ErrorBoundary>
          )}

          {activeTab === 'api' && (
            <ErrorBoundary fallback={
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Unable to load API demo</p>
              </div>
            }>
              <APIDemo />
            </ErrorBoundary>
          )}

          {activeTab === 'analytics' && (
            <ErrorBoundary fallback={
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Unable to load analytics dashboard</p>
              </div>
            }>
              <AnalyticsDashboard />
            </ErrorBoundary>
          )}

          {activeTab === 'comments' && (
            <ErrorBoundary fallback={
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Unable to load comments</p>
              </div>
            }>
              <CommentSection 
                title="💬 AI Status Dashboard Community"
                className="max-w-4xl mx-auto"
              />
            </ErrorBoundary>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
} 