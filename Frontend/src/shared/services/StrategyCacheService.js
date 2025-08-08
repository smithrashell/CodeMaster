/**
 * StrategyCacheService - High-performance caching layer for strategy system
 * 
 * Features:
 * - In-memory LRU cache with TTL-based expiration
 * - Request deduplication for concurrent calls
 * - Intelligent invalidation and preloading
 * - Performance monitoring and metrics
 */

class StrategyCacheService {
  constructor() {
    this.cache = new Map();
    this.ongoingRequests = new Map();
    this.performanceMetrics = {
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      averageQueryTime: 0,
      memoryUsage: 0
    };
    
    // Cache configuration
    this.config = {
      maxSize: 100, // Maximum number of cached strategies
      ttl: 5 * 60 * 1000, // 5 minutes TTL
      cleanupInterval: 2 * 60 * 1000, // Cleanup every 2 minutes
      timeout: 5000 // 5 second timeout for operations
    };

    // Start automatic cleanup
    this.startCleanupTimer();
    
    // eslint-disable-next-line no-console
    console.log('🚀 StrategyCacheService initialized with LRU cache');
  }

  /**
   * Get strategy data with caching and deduplication
   * @param {string} cacheKey - Unique cache key
   * @param {Function} fetchFunction - Function to fetch data if not cached
   * @param {number} timeout - Custom timeout in ms
   * @returns {Promise<any>} Cached or fetched data
   */
  async getCachedData(cacheKey, fetchFunction, timeout = this.config.timeout) {
    const startTime = performance.now();
    this.performanceMetrics.totalRequests++;

    try {
      // Check cache first
      const cached = this.getCacheEntry(cacheKey);
      if (cached && !this.isExpired(cached)) {
        this.performanceMetrics.cacheHits++;
        this.updateAccessTime(cacheKey);
        // eslint-disable-next-line no-console
        console.log(`💰 Cache hit for key: ${cacheKey}`);
        return cached.data;
      }

      // Check for ongoing request to prevent duplicates
      if (this.ongoingRequests.has(cacheKey)) {
        // eslint-disable-next-line no-console
        console.log(`🔄 Deduplicating request for key: ${cacheKey}`);
        return await this.ongoingRequests.get(cacheKey);
      }

      // Create new request with timeout
      const requestPromise = this.executeWithTimeout(fetchFunction, timeout);
      this.ongoingRequests.set(cacheKey, requestPromise);

      try {
        const data = await requestPromise;
        
        // Cache successful result
        this.setCacheEntry(cacheKey, data);
        this.performanceMetrics.cacheMisses++;
        
        // eslint-disable-next-line no-console
        console.log(`💾 Cached new data for key: ${cacheKey}`);
        return data;
      } finally {
        // Clean up ongoing request
        this.ongoingRequests.delete(cacheKey);
        
        // Update metrics
        const queryTime = performance.now() - startTime;
        this.updatePerformanceMetrics(queryTime);
      }
    } catch (error) {
      // Return stale cache data if available on error
      const staleCache = this.getCacheEntry(cacheKey);
      if (staleCache) {
        console.warn(`⚠️ Returning stale cache for ${cacheKey} due to error:`, error);
        return staleCache.data;
      }
      
      console.error(`❌ Cache miss and fetch failed for ${cacheKey}:`, error);
      throw error;
    }
  }

  /**
   * Execute function with timeout
   * @param {Function} fn - Function to execute
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<any>} Promise that resolves or rejects with timeout
   */
  executeWithTimeout(fn, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeout}ms`));
      }, timeout);

      fn().then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      }).catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Get cache entry
   * @param {string} key - Cache key
   * @returns {Object|null} Cache entry or null
   */
  getCacheEntry(key) {
    return this.cache.get(key) || null;
  }

  /**
   * Set cache entry with LRU eviction
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   */
  setCacheEntry(key, data) {
    const entry = {
      data,
      timestamp: Date.now(),
      accessTime: Date.now(),
      accessCount: 1
    };

    // Remove existing entry to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Check size limit and evict LRU entries
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    // Add new entry (most recently used)
    this.cache.set(key, entry);
    this.updateMemoryUsage();
  }

  /**
   * Update access time for cache entry
   * @param {string} key - Cache key
   */
  updateAccessTime(key) {
    const entry = this.cache.get(key);
    if (entry) {
      entry.accessTime = Date.now();
      entry.accessCount++;
      
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, entry);
    }
  }

  /**
   * Check if cache entry is expired
   * @param {Object} entry - Cache entry
   * @returns {boolean} True if expired
   */
  isExpired(entry) {
    return Date.now() - entry.timestamp > this.config.ttl;
  }

  /**
   * Evict least recently used entries
   */
  evictLRU() {
    const entriesToRemove = Math.ceil(this.config.maxSize * 0.1); // Remove 10%
    const entries = Array.from(this.cache.entries());
    
    // Sort by access time (oldest first)
    entries.sort(([,a], [,b]) => a.accessTime - b.accessTime);
    
    for (let i = 0; i < entriesToRemove && entries.length > 0; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      // eslint-disable-next-line no-console
      console.log(`🗑️ Evicted LRU cache entry: ${key}`);
    }
    
    this.updateMemoryUsage();
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpiredEntries() {
    const now = Date.now();
    let cleanupCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.ttl) {
        this.cache.delete(key);
        cleanupCount++;
      }
    }

    if (cleanupCount > 0) {
      // eslint-disable-next-line no-console
      console.log(`🧹 Cleaned up ${cleanupCount} expired cache entries`);
      this.updateMemoryUsage();
    }
  }

  /**
   * Start automatic cleanup timer
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval);
  }

  /**
   * Update performance metrics
   * @param {number} queryTime - Query time in milliseconds
   */
  updatePerformanceMetrics(queryTime) {
    const { totalRequests, averageQueryTime } = this.performanceMetrics;
    this.performanceMetrics.averageQueryTime = 
      (averageQueryTime * (totalRequests - 1) + queryTime) / totalRequests;
  }

  /**
   * Update memory usage estimate
   */
  updateMemoryUsage() {
    // Rough estimate of memory usage
    let totalSize = 0;
    for (const [key, entry] of this.cache.entries()) {
      totalSize += key.length * 2; // String overhead
      totalSize += JSON.stringify(entry.data).length * 2; // Data size estimate
      totalSize += 64; // Object overhead
    }
    this.performanceMetrics.memoryUsage = totalSize;
  }

  /**
   * Invalidate cache entries by pattern
   * @param {string|RegExp} pattern - Pattern to match keys for invalidation
   */
  invalidate(pattern) {
    const keysToDelete = [];
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.ongoingRequests.delete(key);
    });

    if (keysToDelete.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`🗑️ Invalidated ${keysToDelete.length} cache entries matching: ${pattern}`);
      this.updateMemoryUsage();
    }
  }

  /**
   * Preload common tag combinations
   * @param {Array<string[]>} tagCombinations - Array of tag arrays to preload
   * @param {Function} fetchFunction - Function to fetch strategy data
   */
  async preloadStrategies(tagCombinations, fetchFunction) {
    // eslint-disable-next-line no-console
    console.log(`🔄 Preloading ${tagCombinations.length} tag combinations...`);
    
    const preloadPromises = tagCombinations.map(async (tags) => {
      const cacheKey = `contextual_hints:${tags.sort().join(',')}:Medium`;
      
      // Only preload if not already cached
      const cached = this.getCacheEntry(cacheKey);
      if (!cached || this.isExpired(cached)) {
        try {
          await this.getCachedData(cacheKey, () => fetchFunction(tags, 'Medium'));
        } catch (error) {
          console.warn(`⚠️ Failed to preload strategies for ${tags.join(', ')}:`, error);
        }
      }
    });

    await Promise.allSettled(preloadPromises);
    // eslint-disable-next-line no-console
    console.log(`✅ Preloading completed for ${tagCombinations.length} combinations`);
  }

  /**
   * Get cache statistics
   * @returns {Object} Performance and cache statistics
   */
  getStats() {
    const hitRate = this.performanceMetrics.totalRequests > 0 
      ? (this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests * 100).toFixed(2)
      : 0;

    return {
      ...this.performanceMetrics,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size,
      maxSize: this.config.maxSize,
      memoryUsageMB: (this.performanceMetrics.memoryUsage / 1024 / 1024).toFixed(2),
      ongoingRequests: this.ongoingRequests.size
    };
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
    this.ongoingRequests.clear();
    this.performanceMetrics = {
      cacheHits: 0,
      cacheMisses: 0,
      totalRequests: 0,
      averageQueryTime: 0,
      memoryUsage: 0
    };
    // eslint-disable-next-line no-console
    console.log('🗑️ Cache cleared completely');
  }

  /**
   * Generate cache key for strategy operations
   * @param {string} operation - Operation type
   * @param {...any} params - Operation parameters
   * @returns {string} Generated cache key
   */
  static generateCacheKey(operation, ...params) {
    const key = params
      .map(p => typeof p === 'object' ? JSON.stringify(p) : String(p))
      .join(':');
    return `${operation}:${key}`;
  }
}

// Create singleton instance
const strategyCacheService = new StrategyCacheService();

export default strategyCacheService;