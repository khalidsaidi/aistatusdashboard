import type { Metadata } from 'next';
import { getIncidentById } from '@/lib/services/public-data';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { incident_id: string } }): Promise<Metadata> {
  return {
    title: `Incident ${params.incident_id}`,
    description: 'Incident detail from AIStatusDashboard.',
    alternates: {
      canonical: `/incidents/${params.incident_id}`,
    },
  };
}

export default async function IncidentDetailPage({ params }: { params: { incident_id: string } }) {
  const incident = await getIncidentById(params.incident_id);

  if (!incident) {
    return (
      <main className="flex-1">
        <div className="px-4 sm:px-6 py-10">
          <div className="max-w-4xl mx-auto surface-card-strong p-8 text-center">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Incident not found</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              The incident ID could not be resolved.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <header className="surface-card-strong p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              {incident.providerId}
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mt-3">
              {incident.title}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">
              Status: {incident.status} | Severity: {incident.severity}
            </p>
          </header>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Timeline</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Started: {incident.startedAt}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Updated: {incident.updatedAt}
            </p>
            {incident.resolvedAt && (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Resolved: {incident.resolvedAt}
              </p>
            )}
          </section>

          <section className="surface-card p-6 space-y-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Updates</h2>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              {incident.updates?.map((update) => (
                <li key={update.id} className="border-l border-slate-200 dark:border-slate-700 pl-4">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">{update.status}</p>
                  <p>{update.body}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{update.createdAt}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
