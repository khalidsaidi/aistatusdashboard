const REGION_ALIASES: Record<string, string> = {
  'us-east': 'us-east',
  'us-east1': 'us-east',
  'us-east-1': 'us-east',
  'us-east-2': 'us-east',
  'us-west': 'us-west',
  'us-west1': 'us-west',
  'us-west-1': 'us-west',
  'us-west2': 'us-west',
  'us-west-2': 'us-west',
  'eu-west': 'eu-west',
  'eu-west1': 'eu-west',
  'eu-west-1': 'eu-west',
  'europe-west1': 'eu-west',
  'europe-west2': 'eu-west',
  'europe-west3': 'eu-west',
};

export function normalizeProbeRegion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return REGION_ALIASES[key] || null;
}
