import { getCached, setCache } from '../cache';

describe('Cache Module', () => {
  beforeEach(() => {
    // Clear cache before each test by creating a new instance
    jest.clearAllMocks();
  });

  it('should return null for non-existent cache key', () => {
    // Act
    const result = getCached<string>('non-existent-key');

    // Assert
    expect(result).toBeNull();
  });

  it('should store and retrieve cached data', () => {
    // Arrange
    const key = 'test-key';
    const data = { message: 'Hello, World!' };

    // Act
    setCache(key, data);
    const result = getCached<typeof data>(key);

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
    setCache(stringKey, stringData);
    setCache(objectKey, objectData);
    setCache(arrayKey, arrayData);

    // Assert
    expect(getCached<string>(stringKey)).toBe(stringData);
    expect(getCached<typeof objectData>(objectKey)).toEqual(objectData);
    expect(getCached<number[]>(arrayKey)).toEqual(arrayData);
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
    setCache(key, data);
    
    // Fast-forward time beyond TTL (60 seconds)
    Date.now = jest.fn(() => baseTime + 61000);
    
    const result = getCached<string>(key);

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
    setCache(key, data);
    
    // Verify it's cached
    expect(getCached<string>(key)).toBe(data);
    
    // Fast-forward time beyond TTL
    Date.now = jest.fn(() => baseTime + 61000);
    
    // Access expired entry (should clean up)
    const result = getCached<string>(key);
    
    // Fast-forward back to original time
    Date.now = jest.fn(() => baseTime);
    
    // Try to access again (should still be null)
    const secondResult = getCached<string>(key);

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
    setCache(key, originalData);
    const originalResult = getCached<string>(key);
    
    setCache(key, newData);
    const newResult = getCached<string>(key);

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
    setCache(key1, data1);
    setCache(key2, data2);

    // Assert
    expect(getCached<string>(key1)).toBe(data1);
    expect(getCached<string>(key2)).toBe(data2);
    expect(getCached<string>('key-3')).toBeNull();
  });
}); 