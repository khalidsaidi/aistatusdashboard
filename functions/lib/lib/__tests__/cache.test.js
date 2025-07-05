"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cache_1 = require("../cache");
describe('Cache Module', () => {
    beforeEach(() => {
        // Clear cache before each test by creating a new instance
        jest.clearAllMocks();
    });
    it('should return null for non-existent cache key', () => {
        // Act
        const result = (0, cache_1.getCached)('non-existent-key');
        // Assert
        expect(result).toBeNull();
    });
    it('should store and retrieve cached data', () => {
        // Arrange
        const key = 'test-key';
        const data = { message: 'Hello, World!' };
        // Act
        (0, cache_1.setCache)(key, data);
        const result = (0, cache_1.getCached)(key);
        // Assert
        expect(result).toEqual(data);
    });
    it('should return different data types correctly', () => {
        // Arrange
        const stringKey = 'string-key';
        const stringData = 'test string';
        const objectKey = 'object-key';
        const objectData = { id: 1, name: 'Test' };
        const arrayKey = 'array-key';
        const arrayData = [1, 2, 3, 4, 5];
        // Act
        (0, cache_1.setCache)(stringKey, stringData);
        (0, cache_1.setCache)(objectKey, objectData);
        (0, cache_1.setCache)(arrayKey, arrayData);
        // Assert
        expect((0, cache_1.getCached)(stringKey)).toBe(stringData);
        expect((0, cache_1.getCached)(objectKey)).toEqual(objectData);
        expect((0, cache_1.getCached)(arrayKey)).toEqual(arrayData);
    });
    it('should return null for expired cache entries', async () => {
        // Arrange
        const key = 'expired-key';
        const data = 'expired data';
        // Mock Date.now to control time
        const originalNow = Date.now;
        const baseTime = 1000000;
        Date.now = jest.fn(() => baseTime);
        // Act - Set cache
        (0, cache_1.setCache)(key, data);
        // Fast-forward time beyond TTL (60 seconds)
        Date.now = jest.fn(() => baseTime + 61000);
        const result = (0, cache_1.getCached)(key);
        // Assert
        expect(result).toBeNull();
        // Cleanup
        Date.now = originalNow;
    });
    it('should clean up expired entries when accessed', async () => {
        // Arrange
        const key = 'cleanup-key';
        const data = 'cleanup data';
        const originalNow = Date.now;
        const baseTime = 1000000;
        Date.now = jest.fn(() => baseTime);
        // Act - Set cache
        (0, cache_1.setCache)(key, data);
        // Verify it's cached
        expect((0, cache_1.getCached)(key)).toBe(data);
        // Fast-forward time beyond TTL
        Date.now = jest.fn(() => baseTime + 61000);
        // Access expired entry (should clean up)
        const result = (0, cache_1.getCached)(key);
        // Fast-forward back to original time
        Date.now = jest.fn(() => baseTime);
        // Try to access again (should still be null)
        const secondResult = (0, cache_1.getCached)(key);
        // Assert
        expect(result).toBeNull();
        expect(secondResult).toBeNull();
        // Cleanup
        Date.now = originalNow;
    });
    it('should handle overwriting existing cache entries', () => {
        // Arrange
        const key = 'overwrite-key';
        const originalData = 'original data';
        const newData = 'new data';
        // Act
        (0, cache_1.setCache)(key, originalData);
        const originalResult = (0, cache_1.getCached)(key);
        (0, cache_1.setCache)(key, newData);
        const newResult = (0, cache_1.getCached)(key);
        // Assert
        expect(originalResult).toBe(originalData);
        expect(newResult).toBe(newData);
    });
    it('should maintain separate entries for different keys', () => {
        // Arrange
        const key1 = 'key-1';
        const data1 = 'data-1';
        const key2 = 'key-2';
        const data2 = 'data-2';
        // Act
        (0, cache_1.setCache)(key1, data1);
        (0, cache_1.setCache)(key2, data2);
        // Assert
        expect((0, cache_1.getCached)(key1)).toBe(data1);
        expect((0, cache_1.getCached)(key2)).toBe(data2);
        expect((0, cache_1.getCached)('key-3')).toBeNull();
    });
});
//# sourceMappingURL=cache.test.js.map