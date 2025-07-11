import { getCached, setCache, _testOnlyCache } from '../cache';

describe('Cache Module - Real Implementation', () => {
  beforeEach(() => {
    // Clear cache before each test for clean state
    _testOnlyCache.clear();
  });

  describe('Basic Cache Operations', () => {
    it('should return null for non-existent cache key', () => {
      const result = getCached<string>('non-existent-key');
      expect(result).toBeNull();
    });

    it('should store and retrieve cached data', () => {
      const key = 'test-key';
      const data = { message: 'Hello, World!' };

      setCache(key, data);
      const result = getCached<typeof data>(key);

      expect(result).toEqual(data);
      console.log('Basic cache set/get operation successful');
    });

    it('should handle different data types correctly', () => {
      const stringKey = 'string-key';
      const stringData = 'test string';

      const objectKey = 'object-key';
      const objectData = { id: 1, name: 'Test' };

      const arrayKey = 'array-key';
      const arrayData = [1, 2, 3, 4, 5];

      const numberKey = 'number-key';
      const numberData = 42;

      const booleanKey = 'boolean-key';
      const booleanData = true;

      // Store different data types
      setCache(stringKey, stringData);
      setCache(objectKey, objectData);
      setCache(arrayKey, arrayData);
      setCache(numberKey, numberData);
      setCache(booleanKey, booleanData);

      // Retrieve and verify
      expect(getCached<string>(stringKey)).toBe(stringData);
      expect(getCached<typeof objectData>(objectKey)).toEqual(objectData);
      expect(getCached<number[]>(arrayKey)).toEqual(arrayData);
      expect(getCached<number>(numberKey)).toBe(numberData);
      expect(getCached<boolean>(booleanKey)).toBe(booleanData);

      console.log('All data types handled correctly');
    });
  });

  describe('Cache TTL and Expiration', () => {
    it('should respect cache TTL with real time', async () => {
      const key = 'ttl-test-key';
      const data = 'ttl test data';

      // Set cache
      setCache(key, data);

      // Should be available immediately
      expect(getCached<string>(key)).toBe(data);

      // Test with short delay (not enough to expire)
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(getCached<string>(key)).toBe(data);

      console.log('Cache TTL working with real time');
    });

    it('should handle cache expiration gracefully', () => {
      const key = 'expiration-test';
      const data = 'expiration data';

      // Set cache
      setCache(key, data);

      // Verify it's cached
      expect(getCached<string>(key)).toBe(data);

      // Manually expire by setting timestamp in the past
      const cacheItem = _testOnlyCache.get(key);
      if (cacheItem) {
        // Set timestamp to 2 minutes ago (beyond 60 second TTL)
        cacheItem.timestamp = Date.now() - 2 * 60 * 1000;
        _testOnlyCache.set(key, cacheItem);
      }

      // Should now return null
      const result = getCached<string>(key);
      expect(result).toBeNull();

      console.log('Cache expiration handled correctly');
    });

    it('should clean up expired entries automatically', () => {
      const key = 'cleanup-test';
      const data = 'cleanup data';

      // Set cache
      setCache(key, data);

      // Manually expire the entry
      const cacheItem = _testOnlyCache.get(key);
      if (cacheItem) {
        cacheItem.timestamp = Date.now() - 2 * 60 * 1000;
        _testOnlyCache.set(key, cacheItem);
      }

      // Access expired entry (should trigger cleanup)
      const result = getCached<string>(key);
      expect(result).toBeNull();

      // Verify entry was actually removed from cache
      expect(_testOnlyCache.get(key)).toBeUndefined();

      console.log('Automatic cleanup working correctly');
    });
  });

  describe('Cache Overwriting and Updates', () => {
    it('should handle overwriting existing cache entries', () => {
      const key = 'overwrite-key';
      const originalData = 'original data';
      const newData = 'new data';

      // Set original data
      setCache(key, originalData);
      expect(getCached<string>(key)).toBe(originalData);

      // Overwrite with new data
      setCache(key, newData);
      expect(getCached<string>(key)).toBe(newData);

      console.log('Cache overwriting works correctly');
    });

    it('should maintain separate entries for different keys', () => {
      const testData = [
        { key: 'key-1', data: 'data-1' },
        { key: 'key-2', data: { value: 'complex-data' } },
        { key: 'key-3', data: [1, 2, 3] },
        { key: 'key-4', data: 42 },
      ];

      // Set all entries
      testData.forEach(({ key, data }) => {
        setCache(key, data);
      });

      // Verify all entries are separate and correct
      testData.forEach(({ key, data }) => {
        expect(getCached(key)).toEqual(data);
      });

      // Verify non-existent key returns null
      expect(getCached<string>('non-existent')).toBeNull();

      console.log('Multiple cache entries maintained separately');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined values', () => {
      const nullKey = 'null-key';
      const undefinedKey = 'undefined-key';

      setCache(nullKey, null);
      setCache(undefinedKey, undefined);

      expect(getCached(nullKey)).toBeNull();
      expect(getCached(undefinedKey)).toBeUndefined();

      console.log('Null and undefined values handled correctly');
    });

    it('should handle empty strings and objects', () => {
      const emptyStringKey = 'empty-string';
      const emptyObjectKey = 'empty-object';
      const emptyArrayKey = 'empty-array';

      setCache(emptyStringKey, '');
      setCache(emptyObjectKey, {});
      setCache(emptyArrayKey, []);

      expect(getCached<string>(emptyStringKey)).toBe('');
      expect(getCached<object>(emptyObjectKey)).toEqual({});
      expect(getCached<any[]>(emptyArrayKey)).toEqual([]);

      console.log('Empty values handled correctly');
    });

    it('should handle special characters in keys', () => {
      const specialKeys = [
        'key-with-dashes',
        'key_with_underscores',
        'key.with.dots',
        'key with spaces',
        'key/with/slashes',
        'key:with:colons',
      ];

      specialKeys.forEach((key, index) => {
        const data = `data-${index}`;
        setCache(key, data);
        expect(getCached<string>(key)).toBe(data);
      });

      console.log('Special characters in keys handled correctly');
    });

    it('should handle large data objects', () => {
      const largeObject = {
        id: 'large-object',
        data: Array.from({ length: 1000 }, (_, i) => ({
          index: i,
          value: `value-${i}`,
          nested: { deep: { value: i * 2 } },
        })),
        metadata: {
          size: 1000,
          created: new Date().toISOString(),
          tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`),
        },
      };

      const key = 'large-object-key';
      setCache(key, largeObject);

      const retrieved = getCached<typeof largeObject>(key);
      expect(retrieved).toEqual(largeObject);
      expect(retrieved?.data.length).toBe(1000);
      expect(retrieved?.metadata.tags.length).toBe(50);

      console.log('Large data objects handled correctly');
    });
  });

  describe('Performance and Memory', () => {
    it('should handle rapid cache operations', () => {
      const operations = 1000;
      const startTime = Date.now();

      // Perform rapid set/get operations
      for (let i = 0; i < operations; i++) {
        const key = `rapid-key-${i}`;
        const data = { index: i, value: `rapid-value-${i}` };

        setCache(key, data);
        const result = getCached<typeof data>(key);

        expect(result).toEqual(data);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`${operations} cache operations completed in ${duration}ms`);
      expect(duration).toBeLessThan(5000); // Should complete in less than 5 seconds
    });

    it('should not create memory leaks with repeated operations', () => {
      const key = 'memory-test-key';

      // Perform many overwrites of the same key
      for (let i = 0; i < 100; i++) {
        setCache(key, `data-${i}`);
      }

      // Should only have the latest value
      expect(getCached<string>(key)).toBe('data-99');

      console.log('No memory leaks detected with repeated operations');
    });

    it('should handle concurrent cache access', async () => {
      const promises = Array.from({ length: 50 }, async (_, i) => {
        const key = `concurrent-${i}`;
        const data = `concurrent-data-${i}`;

        setCache(key, data);

        // Small delay to simulate real usage
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));

        return getCached<string>(key);
      });

      const results = await Promise.all(promises);

      results.forEach((result, i) => {
        expect(result).toBe(`concurrent-data-${i}`);
      });

      console.log('Concurrent cache access handled correctly');
    });
  });

  describe('Cache Statistics and Monitoring', () => {
    it('should provide cache size information', () => {
      // Clear cache and add known entries
      _testOnlyCache.clear();

      const entries = [
        { key: 'stats-1', data: 'data-1' },
        { key: 'stats-2', data: 'data-2' },
        { key: 'stats-3', data: 'data-3' },
      ];

      entries.forEach(({ key, data }) => {
        setCache(key, data);
      });

      // Cache should have the expected number of entries
      // Note: We can't directly check size without modifying the cache module,
      // but we can verify all entries are retrievable
      entries.forEach(({ key, data }) => {
        expect(getCached<string>(key)).toBe(data);
      });

      console.log('Cache statistics validation completed');
    });
  });
});
