import type { Metadata } from 'next';
import Link from 'next/link';
import McpCallout from '../components/McpCallout';

export const metadata: Metadata = {
  title: 'AI Integration',
  description: 'One landing page for AI agents to discover MCP and OpenAPI endpoints.',
  alternates: {
    canonical: '/ai',
  },
};

export default function AiLandingPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'AI Status Dashboard',
    applicationCategory: 'WebApplication',
    operatingSystem: 'Web',
    url: 'https://aistatusdashboard.com/ai',
    description:
      'AI reliability control plane: status, incidents, metrics, and fallback policy generation across AI providers.',
    offers: { '@type': 'Offer', price: '0' },
    sameAs: [
      'https://github.com/aistatusdashboard/aistatusdashboard',
      'https://modelcontextprotocol.io/registry/aistatusdashboard',
    ],
  };

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-8">
          <McpCallout />

          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              One URL for AIs
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              AI discoverability hub
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              AI reliability control plane: status, incidents, metrics, and fallback policy generation across major AI providers.
            </p>
          </header>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Quick links</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/mcp" className="cta-secondary text-xs">MCP endpoint</a>
              <a href="/llms.txt" className="cta-secondary text-xs">llms.txt</a>
              <a href="/llms-full.txt" className="cta-secondary text-xs">llms-full.txt</a>
              <a href="/openapi.json" className="cta-secondary text-xs">OpenAPI JSON</a>
              <a href="/.well-known/openapi.json" className="cta-secondary text-xs">Well-known OpenAPI</a>
              <a href="/.well-known/ai-plugin.json" className="cta-secondary text-xs">AI Plugin</a>
              <Link href="/docs/agent/mcp-quickstart" className="cta-secondary text-xs">
                MCP quickstart
              </Link>
              <a href="https://modelcontextprotocol.io/registry/aistatusdashboard" className="cta-secondary text-xs">
                MCP Registry
              </a>
              <a href="https://github.com/aistatusdashboard/aistatusdashboard" className="cta-secondary text-xs">
                GitHub repo
              </a>
              <a href="/reports/weekly-ai-reliability" className="cta-secondary text-xs">
                Weekly reliability report
              </a>
              <a href="/reports/monthly-provider-scorecards" className="cta-secondary text-xs">
                Monthly provider scorecards
              </a>
            </div>
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Copy-paste examples</h2>
            <div className="grid gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Status summary (curl)</p>
                <pre className="text-xs text-slate-800 dark:text-slate-100 overflow-auto">
{`curl https://aistatusdashboard.com/api/public/v1/status/summary`}
                </pre>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Incidents search (curl)</p>
                <pre className="text-xs text-slate-800 dark:text-slate-100 overflow-auto">
{`curl "https://aistatusdashboard.com/api/public/v1/incidents?provider=openai&limit=5"`}
                </pre>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">MCP connection</p>
                <pre className="text-xs text-slate-800 dark:text-slate-100 overflow-auto">
{`Endpoint: https://aistatusdashboard.com/mcp
Tools: status_summary, search_incidents, list_providers`}
                </pre>
              </div>
            </div>
          </section>

          <noscript>
            <div className="surface-card p-4">
              <p>
                Key endpoints: /api/public/v1/status/summary, /api/public/v1/incidents, /openapi.json, /llms.txt
              </p>
            </div>
          </noscript>

          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </div>
      </div>
    </main>
  );
}
