import { getDb } from '@/lib/db/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { NormalizedIncident } from '@/lib/types/ingestion';

export async function upsertIncident(incident: NormalizedIncident) {
  const db = getDb();
  const docId = `${incident.providerId}:${incident.id}`;
  await db.collection('incidents').doc(docId).set(
    {
      ...incident,
      startedAt: Timestamp.fromDate(new Date(incident.startedAt)),
      updatedAt: Timestamp.fromDate(new Date(incident.updatedAt)),
      resolvedAt: incident.resolvedAt ? Timestamp.fromDate(new Date(incident.resolvedAt)) : null,
      ingestedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
