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
              Use MCP or REST APIs to fetch status summaries, incidents, metrics, and fallback plans.
            </p>
          </header>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Quick links</h2>
            <div className="flex flex-wrap gap-3">
              <a href="/mcp" className="cta-secondary text-xs">MCP endpoint</a>
              <a href="/openapi.json" className="cta-secondary text-xs">OpenAPI JSON</a>
              <a href="/.well-known/ai-plugin.json" className="cta-secondary text-xs">AI Plugin</a>
              <Link href="/docs/agent/mcp-quickstart" className="cta-secondary text-xs">
                MCP quickstart
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
