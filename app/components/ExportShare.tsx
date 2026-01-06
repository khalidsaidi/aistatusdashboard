'use client';

import { useEffect, useState } from 'react';
import { StatusResult } from '@/lib/types';
import { trackEvent } from '@/lib/utils/analytics-client';

interface ExportShareProps {
  statuses: StatusResult[];
  className?: string;
}

export default function ExportShare({ statuses, className = '' }: ExportShareProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'txt'>('json');
  const [badgeProvider, setBadgeProvider] = useState(() => statuses[0]?.id || 'openai');

  useEffect(() => {
    if (!statuses.find((status) => status.id === badgeProvider) && statuses.length > 0) {
      setBadgeProvider(statuses[0].id);
    }
  }, [statuses, badgeProvider]);

  const exportData = async (format: 'json' | 'csv' | 'txt') => {
    setIsExporting(true);

    try {
      let content = '';
      let filename = '';
      let mimeType = '';

      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

      switch (format) {
        case 'json':
          content = JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              providers: statuses.map((s) => ({
                id: s.id,
                name: s.displayName || s.name,
                status: s.status,
                responseTime: s.responseTime,
                lastChecked: s.lastChecked,
              })),
            },
            null,
            2
          );
          filename = `ai-status-${timestamp}.json`;
          mimeType = 'application/json';
          break;

        case 'csv':
          const headers = ['ID', 'Name', 'Status', 'Response Time (ms)', 'Last Checked'];
          const rows = statuses.map((s) => [
            s.id,
            s.displayName || s.name,
            s.status,
            s.responseTime?.toString() || 'N/A',
            s.lastChecked || 'N/A',
          ]);

          content = [headers, ...rows]
            .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
            .join('\n');
          filename = `ai-status-${timestamp}.csv`;
          mimeType = 'text/csv';
          break;

        case 'txt':
          content = `AI Provider Status Report\nGenerated: ${new Date().toLocaleString()}\n\n`;
          content += statuses
            .map(
              (s) =>
                `${s.displayName || s.name} (${s.id})\n` +
                `Status: ${s.status}\n` +
                `Response Time: ${s.responseTime ? `${s.responseTime}ms` : 'N/A'}\n` +
                `Last Checked: ${s.lastChecked || 'N/A'}\n\n`
            )
            .join('');
          filename = `ai-status-${timestamp}.txt`;
          mimeType = 'text/plain';
          break;
      }

      const shouldDebugExport =
        process.env.NEXT_PUBLIC_EXPORT_DEBUG === 'true' || process.env.NODE_ENV !== 'production';
      if (shouldDebugExport) {
        (window as any).__exportDebug = { format, content, filename, mimeType };
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      trackEvent('export', { metadata: { format } });
    } catch (error) {
      // Export error handled - show user feedback instead
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const shareStatus = async () => {
    const operationalCount = statuses.filter((s) => s.status === 'operational').length;
    const totalCount = statuses.length;
    const healthPercentage = Math.round((operationalCount / totalCount) * 100);

    const shareData = {
      title: 'AI Provider Status Dashboard',
      text: `AI Provider Status: ${operationalCount}/${totalCount} providers operational (${healthPercentage}% healthy)`,
      url: window.location.href,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        trackEvent('share', { metadata: { method: 'native' } });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        alert('Status copied to clipboard!');
        trackEvent('share', { metadata: { method: 'clipboard' } });
      }
    } catch (error) {
      // Share error handled - show user feedback instead
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        alert('Status copied to clipboard!');
        trackEvent('share', { metadata: { method: 'clipboard' } });
      } catch (clipboardError) {
        // Clipboard fallback failed - silent handling
        alert('Unable to share. Please copy the URL manually.');
      }
    }
  };

  const copyApiUrl = async () => {
    const apiUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/status` : '/api/status';
    try {
      await navigator.clipboard.writeText(apiUrl);
      alert('API URL copied to clipboard!');
      trackEvent('copy_api_url');
    } catch (error) {
      // Copy operation failed - show user feedback
      alert('Unable to copy. Please copy manually: ' + apiUrl);
    }
  };

  const badgeProviderLabel =
    statuses.find((status) => status.id === badgeProvider)?.displayName ||
    statuses.find((status) => status.id === badgeProvider)?.name ||
    badgeProvider;

  const badgeUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/badge/${badgeProvider}`
      : `/api/badge/${badgeProvider}`;

  const badgeMarkdown = `![${badgeProviderLabel} Status](${badgeUrl})`;

  const copyBadgeMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(badgeMarkdown);
      alert('Badge markdown copied!');
      trackEvent('share', { metadata: { method: 'badge_markdown', providerId: badgeProvider } });
    } catch (error) {
      alert('Unable to copy badge markdown.');
    }
  };

  const copyBadgeUrl = async () => {
    try {
      await navigator.clipboard.writeText(badgeUrl);
      alert('Badge URL copied!');
      trackEvent('share', { metadata: { method: 'badge_url', providerId: badgeProvider } });
    } catch (error) {
      alert('Unable to copy badge URL.');
    }
  };

  return (
    <div
      className={`surface-card-strong p-6 ${className}`}
      data-testid="export-share"
      data-tour="share-export"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Share & Export
          </p>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-2">
            Shareable status snapshots
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            Export data, copy API links, or publish a live badge for any provider.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
        <div className="surface-card p-4">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Export snapshot
          </h4>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as any)}
              className="px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-400/70 text-sm"
              disabled={isExporting}
              data-testid="export-format-select"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="txt">Text</option>
            </select>
            <button
              onClick={() => exportData(exportFormat)}
              disabled={isExporting}
              className="cta-primary"
            >
              {isExporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            Snapshots include provider status, latency, and last check time.
          </p>
        </div>

        <div className="surface-card p-4">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
            Share live status
          </h4>
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={shareStatus} className="cta-primary">
              Share dashboard
            </button>
            <button onClick={copyApiUrl} className="cta-secondary">
              Copy API URL
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            Ideal for Slack, docs, or incident channels.
          </p>
        </div>
      </div>

      {/* Share Section */}
      <div className="border-t border-slate-200/70 dark:border-slate-700/70 pt-5 mt-6">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Share as badge</h4>
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <select
            value={badgeProvider}
            onChange={(e) => setBadgeProvider(e.target.value)}
            className="px-3 py-2 border border-slate-200/70 dark:border-slate-700/70 rounded-full bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-white text-sm"
            data-testid="badge-provider-select"
          >
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.displayName || status.name}
              </option>
            ))}
          </select>
          <button
            onClick={copyBadgeMarkdown}
            className="cta-primary"
          >
            Copy Markdown
          </button>
          <button
            onClick={copyBadgeUrl}
            className="cta-secondary"
          >
            Copy Badge URL
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Use badges in README files, dashboards, or team status channels.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="border-t border-slate-200/70 dark:border-slate-700/70 pt-4 mt-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-600 dark:text-slate-400">Total Providers:</span>
            <span className="font-medium text-slate-900 dark:text-white ml-2">
              {statuses.length}
            </span>
          </div>
          <div>
            <span className="text-slate-600 dark:text-slate-400">Operational:</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400 ml-2">
              {statuses.filter((s) => s.status === 'operational').length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
