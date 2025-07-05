/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  
  // Environment-specific configuration
  assetPrefix: process.env.NODE_ENV === 'production' 
    ? (process.env.NEXT_PUBLIC_ASSET_PREFIX || '') 
    : '',
  
  // Build optimization
  experimental: {
    optimizeCss: true,
    optimizeServerReact: true,
  },
  
  // Webpack configuration for better error handling
  webpack: (config, { dev, isServer }) => {
    // Add source maps in development
    if (dev) {
      config.devtool = 'eval-source-map';
    }
    
    // Handle potential build errors gracefully
    config.stats = {
      errorDetails: true,
      warnings: true,
    };
    
    return config;
  },
};

module.exports = nextConfig; 