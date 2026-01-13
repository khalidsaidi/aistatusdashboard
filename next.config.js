const buildId =
  process.env.APP_BUILD_ID ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_SHA ||
  `build-${Date.now()}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizeServerReact: true,
  },
  outputFileTracingRoot: __dirname,
  typescript: {
    ignoreBuildErrors: false,
  },
  async rewrites() {
    return [
      {
        source: '/discovery/audit',
        destination: '/discovery/audit/index.html',
      },
    ];
  },
  async headers() {
    const commonHeaders = [
      { key: 'X-Discovery-Handler', value: 'static' },
      { key: 'X-Discovery-Build', value: buildId },
      { key: 'X-Discovery-Runtime', value: 'static' },
    ];
    const cacheHeader = { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=600' };

    return [
      {
        source: '/sitemap.xml',
        headers: [
          { key: 'Content-Type', value: 'application/xml; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/rss.xml',
        headers: [
          { key: 'Content-Type', value: 'application/rss+xml; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=60, s-maxage=300' },
          ...commonHeaders,
        ],
      },
      {
        source: '/openapi.yaml',
        headers: [
          { key: 'Content-Type', value: 'application/yaml; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/openapi-3.0.yaml',
        headers: [
          { key: 'Content-Type', value: 'application/yaml; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/docs.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/docs/api.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/docs/citations.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/docs/agent/mcp-quickstart.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/docs/discoverability-audit.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/status.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/providers.md',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          cacheHeader,
          ...commonHeaders,
        ],
      },
      {
        source: '/datasets/incidents.ndjson',
        headers: [
          { key: 'Content-Type', value: 'application/x-ndjson; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=60, s-maxage=300' },
          ...commonHeaders,
        ],
      },
      {
        source: '/datasets/metrics.csv',
        headers: [
          { key: 'Content-Type', value: 'text/csv; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=60, s-maxage=300' },
          ...commonHeaders,
        ],
      },
      {
        source: '/discovery/audit/latest.json',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-store, max-age=0, must-revalidate' },
          ...commonHeaders,
        ],
      },
      {
        source: '/discovery/audit',
        headers: [
          { key: 'Content-Type', value: 'text/html; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=600' },
          ...commonHeaders,
        ],
      },
    ];
  },
  // Skip 404 page generation to avoid Pages Router conflict
  generateBuildId: async () => {
    return buildId;
  },
};

module.exports = nextConfig;
