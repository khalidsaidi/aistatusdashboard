/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizeServerReact: true,
  },
  outputFileTracingRoot: __dirname,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Skip 404 page generation to avoid Pages Router conflict
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
};

module.exports = nextConfig;
