import { useCallback } from "react";

// Smart cache with TTL for dashboard performance optimization
const messageCache = new Map();
const pendingRequests = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for real-time balance

/**
 * Specialized hook for Chrome message caching and deduplication
 */
export const useChromeCache = () => {
  // Cache utilities
  const getCacheKey = useCallback((request) => {
    return JSON.stringify({
      type: request?.type,
      options: request?.options,
      // Include other relevant properties for cache key
      ...Object.fromEntries(
        Object.entries(request || {}).filter(([key]) => 
          !['timestamp', 'id'].includes(key)
        )
      )
    });
  }, []);

  const getCachedResponse = useCallback((cacheKey) => {
    const cached = messageCache.get(cacheKey);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > CACHE_TTL) {
      messageCache.delete(cacheKey);
      return null;
    }
    
    return cached.data;
  }, []);

  const setCachedResponse = useCallback((cacheKey, data) => {
    messageCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    // Prevent memory leaks - keep only last 50 cache entries
    if (messageCache.size > 50) {
      const firstKey = messageCache.keys().next().value;
      messageCache.delete(firstKey);
    }
  }, []);

  // Clear cache utility for manual refresh
  const clearCache = useCallback((requestType) => {
    if (requestType) {
      // Clear specific request type caches
      for (const [key, _value] of messageCache.entries()) {
        if (key.includes(`"type":"${requestType}"`)) {
          messageCache.delete(key);
        }
      }
    } else {
      // Clear all cache
      messageCache.clear();
    }
  }, []);

  // Request deduplication management
  const checkPendingRequest = useCallback(async (cacheKey) => {
    if (pendingRequests.has(cacheKey)) {
      console.info(`⏳ Deduplicating request`);
      const result = await pendingRequests.get(cacheKey);
      return result;
    }
    return null;
  }, []);

  return {
    getCacheKey,
    getCachedResponse,
    setCachedResponse,
    clearCache,
    checkPendingRequest,
    pendingRequests,
  };
};

export { messageCache, pendingRequests };
export default useChromeCache;