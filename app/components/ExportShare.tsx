'use client';

import { useState } from 'react';
import { StatusResult } from '@/lib/types';

interface ExportShareProps {
  statuses: StatusResult[];
  className?: string;
}

export default function ExportShare({ statuses, className = '' }: ExportShareProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'txt'>('json');

  const exportData = async (format: 'json' | 'csv' | 'txt') => {
    setIsExporting(true);
    
    try {
      let content = '';
      let filename = '';
      let mimeType = '';

      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

      switch (format) {
        case 'json':
          content = JSON.stringify({
            timestamp: new Date().toISOString(),
            providers: statuses.map(s => ({
              id: s.id,
              name: s.name,
              status: s.status,
              responseTime: s.responseTime,
              lastChecked: s.lastChecked
            }))
          }, null, 2);
          filename = `ai-status-${timestamp}.json`;
          mimeType = 'application/json';
          break;

        case 'csv':
          const headers = ['ID', 'Name', 'Status', 'Response Time (ms)', 'Last Checked'];
          const rows = statuses.map(s => [
            s.id,
            s.name,
            s.status,
            s.responseTime?.toString() || 'N/A',
            s.lastChecked || 'N/A'
          ]);
          
          content = [headers, ...rows]
            .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
            .join('\n');
          filename = `ai-status-${timestamp}.csv`;
          mimeType = 'text/csv';
          break;

        case 'txt':
          content = `AI Provider Status Report\nGenerated: ${new Date().toLocaleString()}\n\n`;
          content += statuses.map(s => 
            `${s.name} (${s.id})\n` +
            `Status: ${s.status}\n` +
            `Response Time: ${s.responseTime ? `${s.responseTime}ms` : 'N/A'}\n` +
            `Last Checked: ${s.lastChecked || 'N/A'}\n\n`
          ).join('');
          filename = `ai-status-${timestamp}.txt`;
          mimeType = 'text/plain';
          break;
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

    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const shareStatus = async () => {
    const operationalCount = statuses.filter(s => s.status === 'operational').length;
    const totalCount = statuses.length;
    const healthPercentage = Math.round((operationalCount / totalCount) * 100);

    const shareData = {
      title: 'AI Provider Status Dashboard',
      text: `AI Provider Status: ${operationalCount}/${totalCount} providers operational (${healthPercentage}% healthy)`,
      url: window.location.href
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        alert('Status copied to clipboard!');
      }
    } catch (error) {
      console.error('Share failed:', error);
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        alert('Status copied to clipboard!');
      } catch (clipboardError) {
        console.error('Clipboard failed:', clipboardError);
        alert('Unable to share. Please copy the URL manually.');
      }
    }
  };

  const copyApiUrl = async () => {
    const apiUrl = 'https://us-central1-ai-status-dashboard-dev.cloudfunctions.net/api/status';
    try {
      await navigator.clipboard.writeText(apiUrl);
      alert('API URL copied to clipboard!');
    } catch (error) {
      console.error('Copy failed:', error);
      alert('Unable to copy. Please copy manually: ' + apiUrl);
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        📤 Export Data
      </h3>
      
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          disabled={isExporting}
        >
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
          <option value="txt">Text</option>
        </select>
        <button
          onClick={() => exportData(exportFormat)}
          disabled={isExporting}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors min-h-[44px] flex items-center justify-center gap-2"
        >
          {isExporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
        </button>
      </div>

      {/* Share Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Share Status
        </h4>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={shareStatus}
            className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md transition-colors min-h-[44px] flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            Share Dashboard
          </button>
          <button
            onClick={copyApiUrl}
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-md transition-colors min-h-[44px] flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy API URL
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Share current status or get API endpoint for integrations
        </p>
      </div>

      {/* Quick Stats */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Total Providers:</span>
            <span className="font-medium text-gray-900 dark:text-white ml-2">{statuses.length}</span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Operational:</span>
            <span className="font-medium text-green-600 dark:text-green-400 ml-2">
              {statuses.filter(s => s.status === 'operational').length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
} 