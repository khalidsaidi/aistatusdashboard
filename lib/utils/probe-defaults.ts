import probeProviders from '@/lib/data/probe_providers.json';

type ProbeDefaults = {
  providerId: string;
  model: string;
  endpoint: string;
  region: string;
  tier: string;
  streaming: boolean;
};

export function getProbeDefaults(providerId: string): ProbeDefaults | null {
  const providers = (probeProviders as { providers?: any[] }).providers || [];
  const entry = providers.find((item) => item.providerId === providerId);
  if (!entry) return null;

  const envModel = entry.modelEnvKey ? process.env[entry.modelEnvKey] : undefined;

  return {
    providerId: entry.providerId,
    model: envModel || entry.model,
    endpoint: entry.endpoint,
    region: entry.region,
    tier: entry.tier || 'unknown',
    streaming: Boolean(entry.streaming),
  };
}

export function getProbeDefaultsMap(): Record<string, ProbeDefaults> {
  const providers = (probeProviders as { providers?: any[] }).providers || [];
  return providers.reduce<Record<string, ProbeDefaults>>((acc, entry) => {
    const envModel = entry.modelEnvKey ? process.env[entry.modelEnvKey] : undefined;
    acc[entry.providerId] = {
      providerId: entry.providerId,
      model: envModel || entry.model,
      endpoint: entry.endpoint,
      region: entry.region,
      tier: entry.tier || 'unknown',
      streaming: Boolean(entry.streaming),
    };
    return acc;
  }, {});
}
