/**
 * FIREBASE CONFIGURATION VALIDATOR
 *
 * Validates Firebase configuration to prevent hardcoded values,
 * ensure proper environment switching, and detect security issues.
 */

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  environment: 'development' | 'production' | 'test';
  securityIssues: string[];
}

/**
 * Validate Firebase configuration for security and environment correctness
 */
export function validateFirebaseConfig(config: FirebaseConfig): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    environment: (process.env.NODE_ENV as any) || 'development',
    securityIssues: [],
  };

  // 1. Check for placeholder values
  if (
    config.apiKey === 'your_firebase_api_key_here' ||
    config.apiKey === 'YOUR_API_KEY' ||
    config.apiKey === 'placeholder'
  ) {
    result.errors.push('Firebase API key is using placeholder value');
    result.securityIssues.push('Placeholder API key detected');
    result.isValid = false;
  }

  // 2. Check for hardcoded development values in production
  if (result.environment === 'production') {
    if (
      config.projectId.includes('dev') ||
      config.projectId.includes('test') ||
      config.projectId.includes('localhost')
    ) {
      result.errors.push('Production environment using development/test project ID');
      result.isValid = false;
    }

    if (config.authDomain.includes('localhost') || config.authDomain.includes('dev')) {
      result.errors.push('Production environment using development auth domain');
      result.isValid = false;
    }

    if (config.storageBucket.includes('dev') || config.storageBucket.includes('test')) {
      result.errors.push('Production environment using development storage bucket');
      result.isValid = false;
    }
  }

  // 3. Check for development values in production
  if (result.environment === 'development') {
    if (!config.projectId.includes('dev') && !config.projectId.includes('test')) {
      result.warnings.push('Development environment may be using production project ID');
    }
  }

  // 4. Validate API key format
  if (!config.apiKey.match(/^AIza[0-9A-Za-z-_]{35}$/)) {
    result.errors.push('Firebase API key format is invalid');
    result.isValid = false;
  }

  // 5. Validate project ID format
  if (!config.projectId.match(/^[a-z0-9-]{6,30}$/)) {
    result.errors.push('Firebase project ID format is invalid');
    result.isValid = false;
  }

  // 6. Check for missing required fields
  const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'];
  for (const field of requiredFields) {
    if (!config[field as keyof FirebaseConfig]) {
      result.errors.push(`Missing required Firebase config field: ${field}`);
      result.isValid = false;
    }
  }

  // 7. Security checks
  if (config.apiKey.length < 39) {
    result.securityIssues.push('Firebase API key appears to be truncated or invalid');
  }

  // 8. Environment consistency checks
  const projectParts = config.projectId.split('-');
  const authDomainParts = config.authDomain.split('.');

  if (authDomainParts[0] !== config.projectId) {
    result.warnings.push('Auth domain does not match project ID');
  }

  if (config.storageBucket && !config.storageBucket.startsWith(config.projectId)) {
    result.warnings.push('Storage bucket does not match project ID');
  }

  // 9. Check for environment variable usage
  if (typeof window === 'undefined') {
    // Server-side checks
    const envVars = process.env;

    if (!envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      result.warnings.push('Firebase project ID not set via environment variable');
    }

    if (!envVars.NEXT_PUBLIC_FIREBASE_API_KEY) {
      result.warnings.push('Firebase API key not set via environment variable');
    }
  }

  return result;
}

/**
 * Get Firebase configuration with environment-specific validation
 */
export function getValidatedFirebaseConfig(): FirebaseConfig {
  const config: FirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  // Validate the configuration
  const validation = validateFirebaseConfig(config);

  if (!validation.isValid) {
    const errorMessage = `Firebase configuration validation failed:\n${validation.errors.join('\n')}`;

    if (validation.securityIssues.length > 0) {
      console.error('🚨 SECURITY ISSUES DETECTED:', validation.securityIssues);
    }

    throw new Error(errorMessage);
  }

  if (validation.warnings.length > 0) {
    console.warn('⚠️ Firebase configuration warnings:', validation.warnings);
  }

  if (validation.securityIssues.length > 0) {
    console.warn('🔒 Firebase security issues:', validation.securityIssues);
  }

  console.log(`✅ Firebase configuration validated for ${validation.environment} environment`);

  return config;
}

/**
 * Check if current environment matches expected Firebase project
 */
export function validateEnvironmentConsistency(): {
  isConsistent: boolean;
  expectedProject: string;
  actualProject: string;
  environment: string;
} {
  const environment = process.env.NODE_ENV || 'development';
  const actualProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';

  let expectedProject = '';

  switch (environment) {
    case 'production':
      expectedProject = process.env.DEFAULT_FIREBASE_PROJECT_ID || 'ai-status-dashboard';
      break;
    case 'development':
      expectedProject =
        process.env.DEFAULT_FIREBASE_DEV_PROJECT_ID ||
        process.env.FIREBASE_PROJECT_ID ||
        'demo-project';
      break;
    case 'test':
      expectedProject = 'ai-status-dashboard-test';
      break;
    default:
      expectedProject = 'unknown';
  }

  const isConsistent = actualProject === expectedProject || expectedProject === 'unknown';

  return {
    isConsistent,
    expectedProject,
    actualProject,
    environment,
  };
}

/**
 * Generate environment-specific Firebase configuration
 */
export function generateFirebaseConfig(
  environment: 'development' | 'production' | 'test'
): Partial<FirebaseConfig> {
  const baseConfig = {
    development: {
      projectId:
        process.env.DEFAULT_FIREBASE_DEV_PROJECT_ID ||
        process.env.FIREBASE_PROJECT_ID ||
        'demo-project',
      authDomain: `${process.env.DEFAULT_FIREBASE_DEV_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'demo-project'}.firebaseapp.com`,
      storageBucket: `${process.env.DEFAULT_FIREBASE_DEV_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'demo-project'}.firebasestorage.app`,
    },
    production: {
      projectId: process.env.DEFAULT_FIREBASE_PROJECT_ID || 'ai-status-dashboard',
      authDomain: `${process.env.DEFAULT_FIREBASE_PROJECT_ID || 'ai-status-dashboard'}.firebaseapp.com`,
      storageBucket: `${process.env.DEFAULT_FIREBASE_PROJECT_ID || 'ai-status-dashboard'}.firebasestorage.app`,
    },
    test: {
      projectId: 'ai-status-dashboard-test',
      authDomain: 'ai-status-dashboard-test.firebaseapp.com',
      storageBucket: 'ai-status-dashboard-test.firebasestorage.app',
    },
  };

  return baseConfig[environment];
}

/**
 * Audit Firebase configuration for security issues
 */
export function auditFirebaseConfig(): {
  passed: boolean;
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    recommendation: string;
  }>;
} {
  const issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    recommendation: string;
  }> = [];

  // Check environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      issues.push({
        severity: 'high',
        message: `Missing environment variable: ${envVar}`,
        recommendation: `Set ${envVar} in your environment configuration`,
      });
    }
  }

  // Check for hardcoded values in code
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (apiKey && (apiKey.includes('your_') || apiKey.includes('placeholder'))) {
    issues.push({
      severity: 'critical',
      message: 'Firebase API key appears to be a placeholder',
      recommendation: 'Replace with actual Firebase API key from Firebase Console',
    });
  }

  // Check project ID consistency
  const consistency = validateEnvironmentConsistency();
  if (!consistency.isConsistent) {
    issues.push({
      severity: 'medium',
      message: `Project ID mismatch: expected ${consistency.expectedProject}, got ${consistency.actualProject}`,
      recommendation: 'Ensure project ID matches the intended environment',
    });
  }

  return {
    passed: issues.filter((i) => i.severity === 'high' || i.severity === 'critical').length === 0,
    issues,
  };
}
