export default function Footer() {
  return (
    <footer
      role="contentinfo"
      className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 mt-auto"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Reference Only Disclaimer */}
        <div className="text-center mb-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            ⚠️ For Reference Only
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            This dashboard is provided for informational and reference purposes only. We assume no
            responsibility for accuracy, completeness, or any decisions made based on this
            information.
          </p>
        </div>

        {/* Trademark Attribution */}
        <div className="text-center mb-6">
          <p className="text-xs text-gray-500 dark:text-gray-500">
            All trademarks and logos are the property of their respective owners and are used here
            for identification purposes only. No endorsement or partnership is implied.
          </p>
        </div>

        {/* Removal Clause */}
        <div className="text-center mb-6">
          <p className="text-xs text-gray-500 dark:text-gray-500">
            If you are a rights holder and want your trademark removed, please{' '}
            <a
              href="mailto:legal@yourdomain.com?subject=Trademark%20Removal%20Request"
              className="text-blue-600 dark:text-blue-400 hover:underline py-1 px-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              contact us
            </a>{' '}
            and we&apos;ll comply within 24 hours.
          </p>
        </div>

        {/* Copyright and System Links */}
        <div className="text-center border-t border-gray-200 dark:border-gray-700 pt-6 mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            © 2025 AI Status Dashboard. Real-time AI Provider Monitoring since 2025
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            <a
              href="/api/health"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              System Health
            </a>
            {' • '}
            <a
              href="/api/status"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              JSON API
            </a>
          </p>
        </div>

        {/* Technical Info */}
        <div className="text-center">
          <p className="text-xs text-gray-400 dark:text-gray-600">
            Built with Next.js • Respects robots.txt and rate limits •{' '}
            <a
              href="https://github.com/khalidsaidi/aistatusdashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors inline-flex items-center gap-1"
              title="View source code on GitHub"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Open Source
            </a>
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
            Status checks are performed using official APIs and public status pages
          </p>
        </div>
      </div>
    </footer>
  );
}
