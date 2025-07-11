/**
 * Provider Management - Simplified Version
 * Loads providers from JSON configuration and provides unified API
 */

import type { UnifiedProvider } from './types';
import { getConfig } from './config-secure';
import providersConfig from '../config/providers.json';

// =============================================================================
// PROVIDER LOADING
// =============================================================================

/**
 * Load all providers from configuration
 */
function getAllProviders(): UnifiedProvider[] {
  return providersConfig.providers as UnifiedProvider[];
}

/**
 * Get enabled providers only
 */
function getEnabledProviders(): UnifiedProvider[] {
  return getAllProviders().filter((provider: UnifiedProvider) => provider.enabled);
}

/**
 * Get provider by ID
 */
function getProviderById(id: string): UnifiedProvider | undefined {
  return getAllProviders().find((provider: UnifiedProvider) => provider.id === id);
}

// =============================================================================
// EXPORTED FUNCTIONS
// =============================================================================

/**
 * Get all enabled providers
 */
export function getProviders(): UnifiedProvider[] {
  return getEnabledProviders();
}

/**
 * Get provider by ID
 */
export function getProvider(id: string): UnifiedProvider | undefined {
  return getProviderById(id);
}

/**
 * Get all providers (including disabled)
 */
export function getAllProvidersList(): UnifiedProvider[] {
  return getAllProviders();
}

/**
 * Get providers by category
 */
export function getProvidersByCategory(category: string): UnifiedProvider[] {
  return getEnabledProviders().filter(
    (provider: UnifiedProvider) => provider.category === category
  );
}

/**
 * Get provider categories
 */
export function getProviderCategories(): string[] {
  const categories = new Set<string>();
  getEnabledProviders().forEach((provider: UnifiedProvider) => {
    categories.add(provider.category);
  });
  return Array.from(categories).sort();
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const providers = getAllProviders();

  if (providers.length === 0) {
    errors.push('No providers configured');
  }

  providers.forEach((provider: UnifiedProvider) => {
    if (!provider.id) {
      errors.push('Provider missing ID');
    }
    if (!provider.name) {
      errors.push(`Provider ${provider.id} missing name`);
    }
    if (!provider.statusUrl) {
      errors.push(`Provider ${provider.id} missing statusUrl`);
    }
    if (!provider.statusPageUrl) {
      errors.push(`Provider ${provider.id} missing statusPageUrl`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// LEGACY COMPATIBILITY
// =============================================================================

/**
 * Legacy export - backwards compatibility
 */
export const PROVIDERS = getEnabledProviders().map((provider: UnifiedProvider) => ({
  ...provider,
  // Ensure all required fields are present
  timeout: provider.timeout || 10000,
  enabled: provider.enabled !== false,
  priority: provider.priority || 999,
}));

/**
 * Provider statistics
 */
export function getProviderStats() {
  const all = getAllProviders();
  const enabled = getEnabledProviders();
  const categories = getProviderCategories();

  return {
    total: all.length,
    enabled: enabled.length,
    disabled: all.length - enabled.length,
    categories: categories.length,
    categoriesBreakdown: categories.reduce((acc: Record<string, number>, category: string) => {
      acc[category] = getProvidersByCategory(category).length;
      return acc;
    }, {}),
  };
}
