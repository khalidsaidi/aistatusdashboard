import type { Metadata } from 'next';
import Link from 'next/link';
import { providerService } from '@/lib/services/providers';

export const metadata: Metadata = {
  title: 'AI Provider Status Pages',
  description: 'Browse status pages for leading AI providers with incident history and uptime signals.',
  alternates: {
    canonical: '/providers',
  },
};

export default function ProvidersPage() {
  const providers = providerService.getProviders();
  const categories = providerService.getCategories();

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Providers
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              AI provider status pages
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Explore dedicated status pages for every AI provider we track, including incidents, maintenance
              windows, and real-time availability signals.
            </p>
          </header>

          <div className="grid gap-6">
            {categories.map((category) => {
              const group = providers.filter((provider) => provider.category === category);
              if (!group.length) return null;
              return (
                <section key={category} className="surface-card p-6">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{category}</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.map((provider) => (
                      <Link
                        key={provider.id}
                        href={`/provider/${provider.id}`}
                        className="rounded-xl border border-slate-200/70 dark:border-slate-700/70 p-4 hover:border-slate-400/80 hover:shadow-sm transition"
                      >
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {provider.displayName || provider.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {provider.name} status history, incidents, and uptime signals.
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
