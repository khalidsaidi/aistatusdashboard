import {
  validateProviderStatus,
  validateStatusResult,
  validateProviderConfig,
  validateProviderConfigs,
  ProviderStatusSchema,
  StatusResultSchema,
  ProviderConfigSchema,
} from '../validation';

describe('Validation Functions - Real Data Tests', () => {
  // =============================================================================
  // PROVIDER STATUS VALIDATION TESTS
  // =============================================================================

  describe('validateProviderStatus', () => {
    test('should validate operational status', () => {
      const result = validateProviderStatus('operational');
      expect(result).toBe('operational');
    });

    test('should validate degraded status', () => {
      const result = validateProviderStatus('degraded');
      expect(result).toBe('degraded');
    });

    test('should validate down status', () => {
      const result = validateProviderStatus('down');
      expect(result).toBe('down');
    });

    test('should validate unknown status', () => {
      const result = validateProviderStatus('unknown');
      expect(result).toBe('unknown');
    });

    test('should reject invalid status with descriptive error', () => {
      expect(() => validateProviderStatus('invalid')).toThrow(
        'Invalid provider status: Status must be one of: operational, degraded, down, unknown. Received: "invalid"'
      );
    });

    test('should reject null with descriptive error', () => {
      expect(() => validateProviderStatus(null)).toThrow(
        'Invalid provider status: Status must be one of: operational, degraded, down, unknown. Received: null'
      );
    });

    test('should reject number with descriptive error', () => {
      expect(() => validateProviderStatus(123)).toThrow(
        'Invalid provider status: Status must be one of: operational, degraded, down, unknown. Received: 123'
      );
    });
  });

  // =============================================================================
  // STATUS RESULT VALIDATION TESTS
  // =============================================================================

  describe('validateStatusResult', () => {
    test('should validate complete OpenAI status result', () => {
      const openaiStatus = {
        id: 'openai',
        name: 'OpenAI',
        status: 'operational' as const,
        responseTime: 45,
        lastChecked: '2025-01-07T12:00:00.000Z',
        statusPageUrl: 'https://status.openai.com',
        details: 'All systems operational',
      };

      const result = validateStatusResult(openaiStatus);
      expect(result).toEqual(openaiStatus);
    });

    test('should validate Anthropic status with error', () => {
      const anthropicStatus = {
        id: 'anthropic',
        name: 'Anthropic',
        status: 'degraded' as const,
        responseTime: 120,
        lastChecked: '2025-01-07T12:05:00.000Z',
        error: 'Elevated response times detected',
        statusPageUrl: 'https://status.anthropic.com',
      };

      const result = validateStatusResult(anthropicStatus);
      expect(result).toEqual(anthropicStatus);
    });

    test('should validate minimal status result', () => {
      const minimalStatus = {
        id: 'test',
        name: 'Test Provider',
        status: 'unknown' as const,
        responseTime: 0,
        lastChecked: '2025-01-07T12:00:00.000Z',
        statusPageUrl: 'https://example.com',
      };

      const result = validateStatusResult(minimalStatus);
      expect(result).toEqual(minimalStatus);
    });

    test('should reject status with negative response time', () => {
      const invalidStatus = {
        id: 'test',
        name: 'Test',
        status: 'operational',
        responseTime: -5,
        lastChecked: '2025-01-07T12:00:00.000Z',
        statusPageUrl: 'https://example.com',
      };

      expect(() => validateStatusResult(invalidStatus)).toThrow(
        'Invalid status result: responseTime: Response time must be non-negative'
      );
    });

    test('should reject status with invalid date', () => {
      const invalidStatus = {
        id: 'test',
        name: 'Test',
        status: 'operational',
        responseTime: 50,
        lastChecked: 'invalid-date',
        statusPageUrl: 'https://example.com',
      };

      expect(() => validateStatusResult(invalidStatus)).toThrow(
        'Invalid status result: lastChecked: Must be valid ISO 8601 date'
      );
    });

    test('should reject status with invalid URL', () => {
      const invalidStatus = {
        id: 'test',
        name: 'Test',
        status: 'operational',
        responseTime: 50,
        lastChecked: '2025-01-07T12:00:00.000Z',
        statusPageUrl: 'not-a-url',
      };

      expect(() => validateStatusResult(invalidStatus)).toThrow(
        'Invalid status result: statusPageUrl: Status page URL must be valid'
      );
    });

    test('should reject status with empty error string', () => {
      const invalidStatus = {
        id: 'test',
        name: 'Test',
        status: 'operational',
        responseTime: 50,
        lastChecked: '2025-01-07T12:00:00.000Z',
        statusPageUrl: 'https://example.com',
        error: '',
      };

      expect(() => validateStatusResult(invalidStatus)).toThrow(
        'Invalid status result: error: String must contain at least 1 character(s)'
      );
    });
  });

  // =============================================================================
  // PROVIDER CONFIG VALIDATION TESTS
  // =============================================================================

  describe('validateProviderConfig', () => {
    test('should validate complete OpenAI provider config', () => {
      const openaiConfig = {
        id: 'openai',
        name: 'OpenAI',
        category: 'LLM' as const,
        statusApi: {
          url: 'https://status.openai.com/api/v2/status.json',
          format: 'statuspage_v2' as const,
          timeout: 10000,
        },
        statusPageUrl: 'https://status.openai.com',
        enabled: true,
        priority: 1,
      };

      const result = validateProviderConfig(openaiConfig);
      expect(result).toEqual(openaiConfig);
    });

    test('should validate provider config with fallback URLs', () => {
      const metaConfig = {
        id: 'meta',
        name: 'Meta AI',
        category: 'LLM' as const,
        statusApi: {
          url: 'https://ai.meta.com',
          format: 'connectivity_check' as const,
          timeout: 5000,
          fallbackUrls: ['https://llama.meta.com', 'https://www.meta.ai'],
        },
        statusPageUrl: 'https://ai.meta.com',
        enabled: true,
        priority: 9,
      };

      const result = validateProviderConfig(metaConfig);
      expect(result).toEqual(metaConfig);
    });

    test('should reject config with invalid category', () => {
      const invalidConfig = {
        id: 'test',
        name: 'Test',
        category: 'INVALID_CATEGORY',
        statusApi: {
          url: 'https://example.com',
          format: 'statuspage_v2',
          timeout: 1000,
        },
        statusPageUrl: 'https://example.com',
        enabled: true,
        priority: 1,
      };

      expect(() => validateProviderConfig(invalidConfig)).toThrow(
        'Invalid provider config: category: Category must be one of: LLM, ML_Platform, Cloud_AI, Hardware_AI, Search_AI'
      );
    });

    test('should reject config with zero timeout', () => {
      const invalidConfig = {
        id: 'test',
        name: 'Test',
        category: 'LLM',
        statusApi: {
          url: 'https://example.com',
          format: 'statuspage_v2',
          timeout: 0,
        },
        statusPageUrl: 'https://example.com',
        enabled: true,
        priority: 1,
      };

      expect(() => validateProviderConfig(invalidConfig)).toThrow(
        'Invalid provider config: statusApi.timeout: Timeout must be greater than 0'
      );
    });

    test('should reject config with invalid fallback URL', () => {
      const invalidConfig = {
        id: 'test',
        name: 'Test',
        category: 'LLM',
        statusApi: {
          url: 'https://example.com',
          format: 'connectivity_check',
          timeout: 1000,
          fallbackUrls: ['not-a-url'],
        },
        statusPageUrl: 'https://example.com',
        enabled: true,
        priority: 1,
      };

      expect(() => validateProviderConfig(invalidConfig)).toThrow(
        'Invalid provider config: statusApi.fallbackUrls.0: Fallback URLs must be valid'
      );
    });
  });

  // =============================================================================
  // PROVIDER CONFIGS ARRAY VALIDATION TESTS
  // =============================================================================

  describe('validateProviderConfigs', () => {
    test('should validate array of real provider configs', () => {
      const configs = [
        {
          id: 'openai',
          name: 'OpenAI',
          category: 'LLM' as const,
          statusApi: {
            url: 'https://status.openai.com/api/v2/status.json',
            format: 'statuspage_v2' as const,
            timeout: 10000,
          },
          statusPageUrl: 'https://status.openai.com',
          enabled: true,
          priority: 1,
        },
        {
          id: 'anthropic',
          name: 'Anthropic',
          category: 'LLM' as const,
          statusApi: {
            url: 'https://status.anthropic.com/api/v2/summary.json',
            format: 'statuspage_v2' as const,
            timeout: 10000,
          },
          statusPageUrl: 'https://status.anthropic.com',
          enabled: true,
          priority: 2,
        },
      ];

      const result = validateProviderConfigs(configs);
      expect(result).toEqual(configs);
      expect(result).toHaveLength(2);
    });

    test('should reject array with duplicate IDs', () => {
      const configs = [
        {
          id: 'duplicate',
          name: 'First',
          category: 'LLM' as const,
          statusApi: {
            url: 'https://example1.com',
            format: 'statuspage_v2' as const,
            timeout: 1000,
          },
          statusPageUrl: 'https://example1.com',
          enabled: true,
          priority: 1,
        },
        {
          id: 'duplicate',
          name: 'Second',
          category: 'LLM' as const,
          statusApi: {
            url: 'https://example2.com',
            format: 'statuspage_v2' as const,
            timeout: 1000,
          },
          statusPageUrl: 'https://example2.com',
          enabled: true,
          priority: 2,
        },
      ];

      expect(() => validateProviderConfigs(configs)).toThrow(
        'Provider config at index 1: Duplicate provider ID: duplicate'
      );
    });

    test('should reject non-array input', () => {
      expect(() => validateProviderConfigs('not-an-array')).toThrow(
        'Provider configs must be an array. Received: string'
      );
    });

    test('should provide index information for invalid configs', () => {
      const configs = [
        {
          id: 'valid',
          name: 'Valid',
          category: 'LLM' as const,
          statusApi: {
            url: 'https://example.com',
            format: 'statuspage_v2' as const,
            timeout: 1000,
          },
          statusPageUrl: 'https://example.com',
          enabled: true,
          priority: 1,
        },
        {
          id: 'invalid',
          name: 'Invalid',
          category: 'WRONG_CATEGORY',
          statusApi: {
            url: 'https://example.com',
            format: 'statuspage_v2',
            timeout: 1000,
          },
          statusPageUrl: 'https://example.com',
          enabled: true,
          priority: 2,
        },
      ];

      expect(() => validateProviderConfigs(configs)).toThrow('Provider config at index 1:');
    });
  });

  // =============================================================================
  // SCHEMA DIRECT VALIDATION TESTS
  // =============================================================================

  describe('Schema Direct Validation', () => {
    test('ProviderStatusSchema should validate all valid statuses', () => {
      expect(ProviderStatusSchema.parse('operational')).toBe('operational');
      expect(ProviderStatusSchema.parse('degraded')).toBe('degraded');
      expect(ProviderStatusSchema.parse('down')).toBe('down');
      expect(ProviderStatusSchema.parse('unknown')).toBe('unknown');
    });

    test('StatusResultSchema should validate real OpenAI response structure', () => {
      const realOpenAIStructure = {
        id: 'openai',
        name: 'OpenAI',
        status: 'operational' as const,
        responseTime: 67,
        lastChecked: '2025-01-07T15:30:45.123Z',
        statusPageUrl: 'https://status.openai.com',
        details: 'All Systems Operational',
      };

      const result = StatusResultSchema.parse(realOpenAIStructure);
      expect(result).toEqual(realOpenAIStructure);
    });

    test('ProviderConfigSchema should validate real configuration from JSON', () => {
      const realConfigStructure = {
        id: 'huggingface',
        name: 'HuggingFace',
        category: 'ML_Platform' as const,
        statusApi: {
          url: 'https://status.huggingface.co/api/v2/summary.json',
          format: 'statuspage_v2_or_html' as const,
          timeout: 10000,
        },
        statusPageUrl: 'https://status.huggingface.co',
        enabled: true,
        priority: 3,
      };

      const result = ProviderConfigSchema.parse(realConfigStructure);
      expect(result).toEqual(realConfigStructure);
    });
  });
});
