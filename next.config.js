/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use export mode in production builds
  ...(process.env.NODE_ENV === 'production' && process.env.NEXT_EXPORT === 'true' ? {
    output: 'export',
    trailingSlash: true,
    images: {
      unoptimized: true,
    },
  } : {}),
  
  // Environment-specific configuration
  assetPrefix: process.env.NODE_ENV === 'production' 
    ? (process.env.NEXT_PUBLIC_ASSET_PREFIX || '') 
    : '',
  
  // Build optimization
  experimental: {
    optimizeCss: true,
    optimizeServerReact: true,
    serverComponentsExternalPackages: ['firebase-admin']
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

  env: {
    // CRITICAL FIX: Use environment variables instead of hardcoded values
    NEXT_PUBLIC_API_URL: process.env.NODE_ENV === 'development' 
      ? `https://${process.env.FIREBASE_FUNCTIONS_REGION || 'us-central1'}-${process.env.DEFAULT_FIREBASE_DEV_PROJECT_ID || process.env.FIREBASE_PROJECT_ID}.cloudfunctions.net/api`
      : process.env.NEXT_PUBLIC_API_URL,
    
    // CRITICAL FIX: Remove hardcoded dev backend usage
    NEXT_PUBLIC_USE_DEV_BACKEND: process.env.NODE_ENV === 'development' ? 'true' : 'false',
    
    // Pass through Firebase configuration validation
    NEXT_PUBLIC_FIREBASE_CONFIG_VALIDATED: 'true'
  },

  // CRITICAL FIX: Don't ignore errors in production
  eslint: {
    ignoreDuringBuilds: process.env.NODE_ENV === 'development', // Only ignore in development
  },

  typescript: {
    ignoreBuildErrors: process.env.NODE_ENV === 'development', // Only ignore in development
  },
  
  // Simplified build configuration - validation handled at runtime
  async rewrites() {
    return [];
  }
};

module.exports = nextConfig; 