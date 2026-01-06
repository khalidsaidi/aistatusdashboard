import type { NormalizedIncident } from '@/lib/types/ingestion';

export const GOOGLE_AI_KEYWORDS = [
  'vertex ai',
  'ai platform',
  'gemini',
  'ai studio',
  'model garden',
  'generative ai',
];

function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  if (!text) return false;
  return keywords.some((keyword) => text.includes(keyword));
}

function buildKeywordList(custom?: string[]): string[] {
  const base = custom && custom.length ? custom : GOOGLE_AI_KEYWORDS;
  return base.map((keyword) => normalizeText(keyword)).filter(Boolean);
}

export function isGoogleAiIncidentRaw(
  incident: any,
  productCatalog?: Map<string, string>,
  keywords?: string[]
): boolean {
  if (!incident || typeof incident !== 'object') return false;
  const list = buildKeywordList(keywords);
  if (!list.length) return false;

  const pieces: string[] = [];
  pieces.push(incident.service_name, incident.external_desc, incident.summary, incident.description, incident.title);

  const products = Array.isArray(incident.affected_products) ? incident.affected_products : [];
  products.forEach((product: any) => {
    const id = product?.id || product?.title || product?.name;
    const resolved = (id && productCatalog?.get?.(id)) || product?.title || product?.name || id;
    if (resolved) pieces.push(resolved);
  });

  const text = normalizeText(pieces.join(' '));
  return matchesKeywords(text, list);
}

export function filterGoogleCloudRawIncidents(
  incidents: any[],
  productCatalog?: Map<string, string>,
  keywords?: string[]
): any[] {
  if (!Array.isArray(incidents)) return [];
  return incidents.filter((incident) => isGoogleAiIncidentRaw(incident, productCatalog, keywords));
}

export function filterGoogleCloudIncidentsForAi(incidents: NormalizedIncident[], keywords?: string[]): NormalizedIncident[] {
  if (!Array.isArray(incidents)) return [];
  const list = buildKeywordList(keywords);
  if (!list.length) return incidents;

  return incidents.filter((incident) => {
    const pieces: string[] = [];
    pieces.push(incident.title, incident.serviceName, incident.sourceStatus, incident.sourceSeverity);

    const impacted = Array.isArray(incident.impactedComponentNames)
      ? incident.impactedComponentNames
      : Array.isArray(incident.impactedComponents)
        ? incident.impactedComponents
        : [];
    pieces.push(...impacted);

    const text = normalizeText(pieces.join(' '));
    return matchesKeywords(text, list);
  });
}
