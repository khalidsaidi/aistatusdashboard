import { AppConfig } from './app.config.base';
import { DEV_CONFIG } from './app.config.development';
import { PROD_CONFIG } from './app.config.production';

function getEnvironmentConfig(): AppConfig {
  // Use NEXT_PUBLIC_ENVIRONMENT to distinguish between dev and prod
  // NODE_ENV is always 'production' in Next.js builds
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'development';
  
  switch (environment) {
    case 'production':
    case 'prod':
      return PROD_CONFIG;
    case 'development':
    case 'dev':
    case 'local':
    default:
      return DEV_CONFIG;
  }
}

export const APP_CONFIG = getEnvironmentConfig();
export type { AppConfig } from './app.config.base'; 