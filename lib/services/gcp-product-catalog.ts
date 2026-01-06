const CATALOG_URL = 'https://status.cloud.google.com/products.json';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type CatalogEntry = { id: string; title: string };

let cache: { fetchedAt: number; map: Map<string, string> } | null = null;

export async function getGcpProductCatalog(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.map;
  }

  try {
    const response = await fetch(CATALOG_URL, {
      headers: { 'User-Agent': 'AI-Status-Dashboard/1.0' },
      cache: 'no-store',
    });
    if (!response.ok) {
      return cache?.map || new Map();
    }

    const data = await response.json().catch(() => null);
    const entries: CatalogEntry[] = Array.isArray(data?.products) ? data.products : [];
    const map = new Map<string, string>();
    entries.forEach((entry) => {
      if (entry?.id && entry?.title) {
        map.set(entry.id, entry.title);
      }
    });

    cache = { fetchedAt: Date.now(), map };
    return map;
  } catch {
    return cache?.map || new Map();
  }
}
