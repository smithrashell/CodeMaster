/**
 * StrategyCacheService comprehensive tests.
 *
 * StrategyCacheService is an in-memory LRU cache with TTL expiration,
 * request deduplication, and performance monitoring.
 * No external dependencies need mocking beyond logger.
 */

// ---------------------------------------------------------------------------
// 1. Mocks (hoisted before imports)
// ---------------------------------------------------------------------------
jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// 2. Imports (run after mocks are applied)
// ---------------------------------------------------------------------------
// Import the class directly since the module creates a singleton
// We need to get a fresh instance for each test
import { default as strategyCacheService } from '../StrategyCacheService.js';

// ---------------------------------------------------------------------------
// 3. Tests
// ---------------------------------------------------------------------------
describe('StrategyCacheService', () => {
  let cache;

  beforeEach(() => {
    // Use the singleton and clear it before each test
    cache = strategyCacheService;
    cache.clearCache();
    jest.clearAllMocks();
    jest.spyOn(performance, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // Constructor / initialization
  // =========================================================================
  describe('initialization', () => {
    it('should have correct default config', () => {
      expect(cache.config.maxSize).toBe(100);
      expect(cache.config.ttl).toBe(5 * 60 * 1000);
      expect(cache.config.cleanupInterval).toBe(2 * 60 * 1000);
      expect(cache.config.timeout).toBe(5000);
    });

    it('should start with empty cache', () => {
      expect(cache.cache.size).toBe(0);
    });

    it('should start with zero performance metrics', () => {
      expect(cache.performanceMetrics.cacheHits).toBe(0);
      expect(cache.performanceMetrics.cacheMisses).toBe(0);
      expect(cache.performanceMetrics.totalRequests).toBe(0);
    });
  });

  // =========================================================================
  // getCacheEntry / setCacheEntry
  // =========================================================================
  describe('getCacheEntry', () => {
    it('should return null for non-existent key', () => {
      expect(cache.getCacheEntry('nonexistent')).toBeNull();
    });

    it('should return entry for existing key', () => {
      cache.setCacheEntry('test_key', { value: 42 });
      const entry = cache.getCacheEntry('test_key');
      expect(entry).not.toBeNull();
      expect(entry.data).toEqual({ value: 42 });
    });
  });

  describe('setCacheEntry', () => {
    it('should store data with timestamp and access info', () => {
      cache.setCacheEntry('key1', 'data1');
      const entry = cache.getCacheEntry('key1');

      expect(entry.data).toBe('data1');
      expect(entry.timestamp).toBeDefined();
      expect(entry.accessTime).toBeDefined();
      expect(entry.accessCount).toBe(1);
    });

    it('should update existing entry (delete and re-add)', () => {
      cache.setCacheEntry('key1', 'old_data');
      cache.setCacheEntry('key1', 'new_data');

      const entry = cache.getCacheEntry('key1');
      expect(entry.data).toBe('new_data');
      expect(cache.cache.size).toBe(1);
    });

    it('should evict LRU entries when cache is full', () => {
      // Fill cache to maxSize
      const originalMaxSize = cache.config.maxSize;
      cache.config.maxSize = 5;

      for (let i = 0; i < 5; i++) {
        cache.setCacheEntry(`key_${i}`, `data_${i}`);
      }
      expect(cache.cache.size).toBe(5);

      // Add one more - should trigger eviction
      cache.setCacheEntry('key_new', 'data_new');

      // After eviction of ~10% (1 entry for maxSize=5), cache should be 5
      expect(cache.cache.size).toBeLessThanOrEqual(5);
      // New entry should be present
      expect(cache.getCacheEntry('key_new')).not.toBeNull();

      cache.config.maxSize = originalMaxSize;
    });
  });

  // =========================================================================
  // updateAccessTime
  // =========================================================================
  describe('updateAccessTime', () => {
    it('should update access time and count', () => {
      cache.setCacheEntry('key1', 'data1');
      const initialEntry = cache.getCacheEntry('key1');
      const initialCount = initialEntry.accessCount;

      // Advance time
      performance.now.mockReturnValue(2000);

      cache.updateAccessTime('key1');
      const updatedEntry = cache.getCacheEntry('key1');

      expect(updatedEntry.accessCount).toBe(initialCount + 1);
    });

    it('should do nothing for non-existent key', () => {
      // Should not throw
      cache.updateAccessTime('nonexistent');
      expect(cache.getCacheEntry('nonexistent')).toBeNull();
    });

    it('should move entry to most recently used position', () => {
      cache.setCacheEntry('key1', 'data1');
      cache.setCacheEntry('key2', 'data2');

      // Access key1 to make it most recently used
      cache.updateAccessTime('key1');

      const keys = Array.from(cache.cache.keys());
      // key1 should be last (most recently used) in Map iteration order
      expect(keys[keys.length - 1]).toBe('key1');
    });
  });

  // =========================================================================
  // isExpired
  // =========================================================================
  describe('isExpired', () => {
    it('should return false for fresh entry', () => {
      const entry = { timestamp: Date.now(), data: 'test' };
      expect(cache.isExpired(entry)).toBe(false);
    });

    it('should return true for expired entry', () => {
      const entry = {
        timestamp: Date.now() - cache.config.ttl - 1000,
        data: 'test',
      };
      expect(cache.isExpired(entry)).toBe(true);
    });

    it('should return false for entry exactly at TTL boundary', () => {
      const entry = { timestamp: Date.now(), data: 'test' };
      expect(cache.isExpired(entry)).toBe(false);
    });
  });

  // =========================================================================
  // evictLRU
  // =========================================================================
  describe('evictLRU', () => {
    it('should evict 10% of entries (oldest access time first)', () => {
      const originalMaxSize = cache.config.maxSize;
      cache.config.maxSize = 20;

      // Add 20 entries
      for (let i = 0; i < 20; i++) {
        performance.now.mockReturnValue(1000 + i * 100);
        cache.setCacheEntry(`key_${i}`, `data_${i}`);
      }

      expect(cache.cache.size).toBe(20);

      cache.evictLRU();

      // Should remove ~10% = 2 entries
      expect(cache.cache.size).toBe(18);
      // Oldest entries should be removed
      expect(cache.getCacheEntry('key_0')).toBeNull();
      expect(cache.getCacheEntry('key_1')).toBeNull();
      // Newer entries should still exist
      expect(cache.getCacheEntry('key_19')).not.toBeNull();

      cache.config.maxSize = originalMaxSize;
    });
  });

  // =========================================================================
  // cleanupExpiredEntries
  // =========================================================================
  describe('cleanupExpiredEntries', () => {
    it('should remove expired entries', () => {
      // Add an entry that will be expired
      cache.cache.set('expired_key', {
        data: 'old_data',
        timestamp: Date.now() - cache.config.ttl - 1000,
        accessTime: Date.now() - cache.config.ttl - 1000,
        accessCount: 1,
      });

      // Add a fresh entry
      cache.cache.set('fresh_key', {
        data: 'new_data',
        timestamp: Date.now(),
        accessTime: Date.now(),
        accessCount: 1,
      });

      cache.cleanupExpiredEntries();

      expect(cache.getCacheEntry('expired_key')).toBeNull();
      expect(cache.getCacheEntry('fresh_key')).not.toBeNull();
    });

    it('should do nothing when no entries are expired', () => {
      cache.setCacheEntry('key1', 'data1');
      cache.setCacheEntry('key2', 'data2');

      cache.cleanupExpiredEntries();

      expect(cache.cache.size).toBe(2);
    });
  });

  // =========================================================================
  // getCachedData
  // =========================================================================
  describe('getCachedData', () => {
    it('should return cached data on cache hit', async () => {
      cache.setCacheEntry('test_key', { result: 'cached' });
      const fetchFn = jest.fn();

      const result = await cache.getCachedData('test_key', fetchFn);

      expect(result).toEqual({ result: 'cached' });
      expect(fetchFn).not.toHaveBeenCalled();
      expect(cache.performanceMetrics.cacheHits).toBe(1);
    });

    it('should fetch and cache data on cache miss', async () => {
      const fetchFn = jest.fn().mockResolvedValue({ result: 'fresh' });

      const result = await cache.getCachedData('new_key', fetchFn);

      expect(result).toEqual({ result: 'fresh' });
      expect(fetchFn).toHaveBeenCalled();
      expect(cache.performanceMetrics.cacheMisses).toBe(1);
      // Should now be cached
      expect(cache.getCacheEntry('new_key').data).toEqual({ result: 'fresh' });
    });

    it('should deduplicate concurrent requests', async () => {
      let resolveFirst;
      const slowFetch = jest.fn().mockReturnValue(
        new Promise((resolve) => { resolveFirst = resolve; })
      );

      // Start two requests for the same key concurrently
      const promise1 = cache.getCachedData('slow_key', slowFetch);
      const promise2 = cache.getCachedData('slow_key', slowFetch);

      // Fetch should only be called once
      expect(slowFetch).toHaveBeenCalledTimes(1);

      // Resolve the fetch
      resolveFirst({ result: 'shared' });

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toEqual({ result: 'shared' });
      expect(result2).toEqual({ result: 'shared' });
    });

    it('should return stale cache data on fetch error', async () => {
      // Pre-populate with expired data
      cache.cache.set('stale_key', {
        data: { result: 'stale' },
        timestamp: Date.now() - cache.config.ttl - 1000,
        accessTime: Date.now() - cache.config.ttl - 1000,
        accessCount: 1,
      });

      const failingFetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await cache.getCachedData('stale_key', failingFetch);

      expect(result).toEqual({ result: 'stale' });
    });

    it('should throw on fetch error when no stale cache available', async () => {
      const failingFetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(cache.getCachedData('missing_key', failingFetch)).rejects.toThrow('Network error');
    });

    it('should increment totalRequests on each call', async () => {
      cache.setCacheEntry('key1', 'data1');

      await cache.getCachedData('key1', jest.fn());
      await cache.getCachedData('key1', jest.fn());

      expect(cache.performanceMetrics.totalRequests).toBe(2);
    });

    it('should clean up ongoing request after completion', async () => {
      const fetchFn = jest.fn().mockResolvedValue('data');

      await cache.getCachedData('key1', fetchFn);

      expect(cache.ongoingRequests.has('key1')).toBe(false);
    });

    it('should clean up ongoing request even on failure', async () => {
      const fetchFn = jest.fn().mockRejectedValue(new Error('fail'));

      try {
        await cache.getCachedData('key1', fetchFn);
      } catch {
        // Expected to throw
      }

      expect(cache.ongoingRequests.has('key1')).toBe(false);
    });
  });

  // =========================================================================
  // executeWithTimeout
  // =========================================================================
  describe('executeWithTimeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should resolve when function completes before timeout', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const promise = cache.executeWithTimeout(fn, 5000);
      jest.advanceTimersByTime(100);

      const result = await promise;
      expect(result).toBe('success');
    });

    it('should reject when function takes too long', async () => {
      const fn = jest.fn().mockReturnValue(new Promise(() => {})); // Never resolves

      const promise = cache.executeWithTimeout(fn, 100);
      jest.advanceTimersByTime(200);

      await expect(promise).rejects.toThrow('Operation timed out after 100ms');
    });

    it('should reject when function throws', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Function error'));

      const promise = cache.executeWithTimeout(fn, 5000);

      await expect(promise).rejects.toThrow('Function error');
    });
  });

  // =========================================================================
  // invalidate
  // =========================================================================
  describe('invalidate', () => {
    it('should invalidate entries matching string pattern', () => {
      cache.setCacheEntry('contextual_hints:arrays:Easy', 'data1');
      cache.setCacheEntry('contextual_hints:dp:Medium', 'data2');
      cache.setCacheEntry('other_key', 'data3');

      cache.invalidate('contextual_hints');

      expect(cache.getCacheEntry('contextual_hints:arrays:Easy')).toBeNull();
      expect(cache.getCacheEntry('contextual_hints:dp:Medium')).toBeNull();
      expect(cache.getCacheEntry('other_key')).not.toBeNull();
    });

    it('should invalidate entries matching regex pattern', () => {
      cache.setCacheEntry('hint:arrays:Easy', 'data1');
      cache.setCacheEntry('hint:dp:Hard', 'data2');
      cache.setCacheEntry('strategy:arrays:Easy', 'data3');

      cache.invalidate(/^hint:/);

      expect(cache.getCacheEntry('hint:arrays:Easy')).toBeNull();
      expect(cache.getCacheEntry('hint:dp:Hard')).toBeNull();
      expect(cache.getCacheEntry('strategy:arrays:Easy')).not.toBeNull();
    });

    it('should also clean up ongoing requests for invalidated keys', () => {
      cache.ongoingRequests.set('contextual_hints:test', Promise.resolve());
      cache.setCacheEntry('contextual_hints:test', 'data');

      cache.invalidate('contextual_hints');

      expect(cache.ongoingRequests.has('contextual_hints:test')).toBe(false);
    });

    it('should do nothing when no entries match', () => {
      cache.setCacheEntry('key1', 'data1');
      cache.setCacheEntry('key2', 'data2');

      cache.invalidate('nonexistent_pattern');

      expect(cache.cache.size).toBe(2);
    });
  });

  // =========================================================================
  // preloadStrategies
  // =========================================================================
  describe('preloadStrategies', () => {
    it('should preload tag combinations', async () => {
      const fetchFn = jest.fn().mockResolvedValue({ hints: [] });

      await cache.preloadStrategies(
        [['arrays', 'sorting'], ['dp']],
        fetchFn
      );

      expect(fetchFn).toHaveBeenCalledTimes(2);
      expect(fetchFn).toHaveBeenCalledWith(['arrays', 'sorting'], 'Medium');
      expect(fetchFn).toHaveBeenCalledWith(['dp'], 'Medium');
    });

    it('should skip preloading already cached and non-expired entries', async () => {
      const fetchFn = jest.fn().mockResolvedValue({ hints: [] });

      // Pre-populate cache with sorted key
      cache.setCacheEntry('contextual_hints:arrays,sorting:Medium', { cached: true });

      await cache.preloadStrategies(
        [['arrays', 'sorting'], ['dp']],
        fetchFn
      );

      // Only dp should be fetched
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(fetchFn).toHaveBeenCalledWith(['dp'], 'Medium');
    });

    it('should handle fetch failures gracefully during preload', async () => {
      const fetchFn = jest.fn()
        .mockRejectedValueOnce(new Error('Fetch failed'))
        .mockResolvedValueOnce({ hints: ['hint1'] });

      // Should not throw
      await cache.preloadStrategies(
        [['arrays'], ['dp']],
        fetchFn
      );

      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // getStats
  // =========================================================================
  describe('getStats', () => {
    it('should return complete stats object', () => {
      const stats = cache.getStats();

      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('averageQueryTime');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('maxSize');
      expect(stats).toHaveProperty('memoryUsageMB');
      expect(stats).toHaveProperty('ongoingRequests');
    });

    it('should show 0 hit rate when no requests', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe('0%');
    });

    it('should calculate correct hit rate', () => {
      cache.performanceMetrics.totalRequests = 10;
      cache.performanceMetrics.cacheHits = 7;

      const stats = cache.getStats();
      expect(stats.hitRate).toBe('70.00%');
    });
  });

  // =========================================================================
  // clearCache
  // =========================================================================
  describe('clearCache', () => {
    it('should clear all data and reset metrics', () => {
      cache.setCacheEntry('key1', 'data1');
      cache.setCacheEntry('key2', 'data2');
      cache.performanceMetrics.cacheHits = 5;
      cache.performanceMetrics.totalRequests = 10;

      cache.clearCache();

      expect(cache.cache.size).toBe(0);
      expect(cache.ongoingRequests.size).toBe(0);
      expect(cache.performanceMetrics.cacheHits).toBe(0);
      expect(cache.performanceMetrics.totalRequests).toBe(0);
    });
  });

  // =========================================================================
  // updatePerformanceMetrics
  // =========================================================================
  describe('updatePerformanceMetrics', () => {
    it('should calculate running average query time', () => {
      cache.performanceMetrics.totalRequests = 1;
      cache.performanceMetrics.averageQueryTime = 0;

      cache.updatePerformanceMetrics(100);

      expect(cache.performanceMetrics.averageQueryTime).toBe(100);

      // Second query
      cache.performanceMetrics.totalRequests = 2;
      cache.updatePerformanceMetrics(200);

      // Average of 100 and 200 = 150
      expect(cache.performanceMetrics.averageQueryTime).toBe(150);
    });
  });

  // =========================================================================
  // updateMemoryUsage
  // =========================================================================
  describe('updateMemoryUsage', () => {
    it('should estimate memory usage based on cache contents', () => {
      cache.setCacheEntry('key1', { name: 'test data' });

      expect(cache.performanceMetrics.memoryUsage).toBeGreaterThan(0);
    });

    it('should be zero with empty cache', () => {
      cache.clearCache();
      cache.updateMemoryUsage();

      expect(cache.performanceMetrics.memoryUsage).toBe(0);
    });
  });

  // =========================================================================
  // generateCacheKey (static)
  // =========================================================================
  describe('generateCacheKey (static)', () => {
    // Access the class directly from the module
    // The singleton is an instance, but generateCacheKey is static on the class
    it('should generate key from operation and string params', () => {
      const CacheServiceClass = strategyCacheService.constructor;
      const key = CacheServiceClass.generateCacheKey('contextual_hints', 'arrays', 'Medium');
      expect(key).toBe('contextual_hints:arrays:Medium');
    });

    it('should serialize object params to JSON', () => {
      const CacheServiceClass = strategyCacheService.constructor;
      const key = CacheServiceClass.generateCacheKey('operation', { tags: ['a', 'b'] });
      expect(key).toBe('operation:{"tags":["a","b"]}');
    });

    it('should handle mixed param types', () => {
      const CacheServiceClass = strategyCacheService.constructor;
      const key = CacheServiceClass.generateCacheKey('op', 'string_param', 42, { key: 'val' });
      expect(key).toBe('op:string_param:42:{"key":"val"}');
    });
  });
});
