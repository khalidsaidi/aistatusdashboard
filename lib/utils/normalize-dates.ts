import type { NormalizedIncident, NormalizedMaintenance } from '@/lib/types/ingestion';

export function toIsoString(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  if (typeof value._seconds === 'number') return new Date(value._seconds * 1000).toISOString();
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return undefined;
}

export function normalizeIncidentDates(incident: NormalizedIncident): NormalizedIncident {
  const startedAt = toIsoString(incident.startedAt) || new Date().toISOString();
  const updatedAt = toIsoString(incident.updatedAt) || startedAt;
  const resolvedAt = toIsoString(incident.resolvedAt);
  const updates = Array.isArray(incident.updates)
    ? incident.updates.map((update) => ({
        ...update,
        createdAt: toIsoString(update.createdAt) || updatedAt,
      }))
    : [];

  return {
    ...incident,
    startedAt,
    updatedAt,
    resolvedAt,
    updates,
  };
}

export function normalizeMaintenanceDates(maintenance: NormalizedMaintenance): NormalizedMaintenance {
  const scheduledFor = toIsoString(maintenance.scheduledFor) || new Date().toISOString();
  const updatedAt = toIsoString(maintenance.updatedAt) || scheduledFor;
  const completedAt = toIsoString(maintenance.completedAt);
  const updates = Array.isArray(maintenance.updates)
    ? maintenance.updates.map((update) => ({
        ...update,
        createdAt: toIsoString(update.createdAt) || updatedAt,
      }))
    : [];

  return {
    ...maintenance,
    scheduledFor,
    updatedAt,
    completedAt,
    updates,
  };
}
