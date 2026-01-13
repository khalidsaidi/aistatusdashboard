import { intelligenceService } from '@/lib/services/intelligence';
import { normalizeIncidentDates } from '@/lib/utils/normalize-dates';

export const dynamic = 'force-dynamic';

export default async function MonthlyProviderScorecards() {
  const incidents = (await intelligenceService.getIncidents({ limit: 20 }))
    .map(normalizeIncidentDates)
    .slice(0, 20);
  return (
    <main className="flex-1">
      <div className="px-4 sm:px-6 py-10 max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Monthly Provider Scorecards</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Provider reliability rollups (incident frequency, degraded minutes, MTTR).
        </p>
        <section className="surface-card p-6 space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Citations</h2>
          <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-300">
            {incidents.map((incident) => (
              <li key={incident.id}>
                <a href={`/incidents/${incident.providerId}:${incident.id}`}>{incident.title}</a>{' '}
                (<a href={`/incidents/${incident.providerId}:${incident.id}/cite`}>cite</a>){' '}
                {incident.rawUrl && <a href={incident.rawUrl}>official</a>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
