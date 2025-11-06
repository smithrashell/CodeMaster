import { useState, useEffect, useRef } from "react";
import { showErrorNotification } from "../utils/errorNotifications";
import ChromeAPIErrorHandler from "../services/ChromeAPIErrorHandler";

// Smart cache with TTL for dashboard performance optimization
const messageCache = new Map();
const pendingRequests = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for real-time balance

// Cache utilities
const getCacheKey = (request) => {
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
};

const _getCachedResponse = (_cacheKey) => {
  // CACHING DISABLED: Unused helper function kept for potential future use
  const cached = messageCache.get(_cacheKey);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    messageCache.delete(_cacheKey);
    return null;
  }

  return cached.data;
};

const _setCachedResponse = (_cacheKey, _data) => {
  // CACHING DISABLED: Unused helper function kept for potential future use
  messageCache.set(_cacheKey, {
    data: _data,
    timestamp: Date.now()
  });

  // Prevent memory leaks - keep only last 50 cache entries
  if (messageCache.size > 50) {
    const firstKey = messageCache.keys().next().value;
    messageCache.delete(firstKey);
  }
};

// Clear cache utility for manual refresh
export const clearChromeMessageCache = (requestType) => {
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
};

// Performance monitoring for dashboard telemetry
const performanceLogger = {
  logTiming: (request, duration, success, retryCount = 0) => {
    const logData = {
      timestamp: new Date().toISOString(),
      requestType: request?.type || 'unknown',
      duration: Math.round(duration),
      success,
      retryCount,
      component: 'useChromeMessage'
    };

    if (success) {
      console.info(`📊 Chrome Message Success:`, logData);
    } else {
      console.warn(`⚠️ Chrome Message Failure:`, logData);
    }

    // Store metrics for analytics (in development mode)
    if (process.env.NODE_ENV === 'development') {
      window.chromeMessageMetrics = window.chromeMessageMetrics || [];
      window.chromeMessageMetrics.push(logData);
      
      // Keep only last 100 entries to prevent memory issues
      if (window.chromeMessageMetrics.length > 100) {
        window.chromeMessageMetrics = window.chromeMessageMetrics.slice(-100);
      }
    }
  },

  logSlowRequest: (request, duration) => {
    console.warn(`🐌 Slow Chrome Message Request (>${duration}ms):`, {
      type: request?.type,
      duration: Math.round(duration),
      request,
      timestamp: new Date().toISOString()
    });
  },

  logFailurePattern: (request, error, retryCount) => {
    console.error(`💥 Chrome Message Pattern Failure:`, {
      type: request?.type,
      error: error.message || error,
      retryCount,
      timestamp: new Date().toISOString(),
      request
    });
  }
};

// Dashboard request types that should never be cached (unused - caching disabled)
const _DASHBOARD_REQUEST_TYPES = [
  'getStatsData',
  'getSessionHistoryData',
  'getTagMasteryData',
  'getLearningProgressData',
  'getProductivityInsightsData',
  'getLearningPathData',
  'getMistakeAnalysisData',
  'getInterviewAnalyticsData',
  'getHintAnalyticsData',
  'getFocusAreasData'
];

// Helper functions for message handling
const handleCacheCheck = () => {
  // CACHING DISABLED: Always bypass cache to prevent stale data bugs
  // IndexedDB is already fast (~1-5ms), caching provides minimal benefit
  return false;
};

const handleRequestDeduplication = async ({ request, setData, setLoading, setError, onSuccess, isMountedRef }) => {
  const cacheKey = getCacheKey(request);
  
  if (pendingRequests.has(cacheKey)) {
    console.info(`⏳ Deduplicating request for ${request?.type}`);
    try {
      const result = await pendingRequests.get(cacheKey);
      if (!isMountedRef.current) return true;
      setData(result);
      setLoading(false);
      setError(null);
      if (onSuccess) onSuccess(result);
      return true;
    } catch (error) {
      return true; // Will be handled by the original request
    }
  }
  
  return false;
};

const handleSuccess = ({ response, request, startTime, currentRetryCount, isMountedRef, setData, setLoading, setIsRetrying, setRetryCount, onSuccess }) => {
  if (!isMountedRef.current) return;

  const duration = performance.now() - startTime;
  performanceLogger.logTiming(request, duration, true, currentRetryCount);

  if (duration > 5000) {
    performanceLogger.logSlowRequest(request, duration);
  }

  // CACHING DISABLED: Don't store responses in cache
  // setCachedResponse(cacheKey, response); // Disabled - cacheKey parameter removed

  setData(response);
  setLoading(false);
  setIsRetrying(false);
  setRetryCount(currentRetryCount);
  if (onSuccess) onSuccess(response);
};

const handleError = ({ error, request, startTime, maxRetries, showNotifications, isMountedRef, setLoading, setIsRetrying, setError, setRetryCount, onError, retry }) => {
  if (!isMountedRef.current) return;
  
  const duration = performance.now() - startTime;
  const errorMessage = error.message || "Unknown Chrome extension error";
  
  performanceLogger.logTiming(request, duration, false, maxRetries);
  performanceLogger.logFailurePattern(request, error, maxRetries);
  
  setLoading(false);
  setIsRetrying(false);
  setError(errorMessage);
  setRetryCount(maxRetries);
  
  if (showNotifications) {
    showErrorNotification(errorMessage, {
      title: "Chrome Extension Error",
      message: `Failed to communicate with extension: ${errorMessage}`,
      context: "useChromeMessage",
      actions: [
        {
          label: "Retry",
          primary: true,
          onClick: () => retry(),
        },
        {
          label: "Report Issue",
          onClick: () => {
            ChromeAPIErrorHandler.showErrorReportDialog({
              message: request,
              error: errorMessage,
              attempts: maxRetries,
              duration: Math.round(duration),
              timestamp: new Date().toISOString(),
            });
          },
        },
      ],
    });
  }
  
  if (onError) onError(errorMessage);
};

/**
 * Enhanced Chrome extension message communication hook with retry mechanisms,
 * comprehensive error handling, and performance telemetry for production-ready 
 * Chrome extension development.
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Request timing and failure logging for dashboard telemetry
 * - Graceful UI fallbacks for slow/empty data
 * - Performance monitoring with slow request detection
 * - Development mode metrics collection (window.chromeMessageMetrics)
 *
 * @param {Object} request - The message to send to background script
 * @param {Array} deps - Dependencies array (like useEffect deps)
 * @param {Object} options - Optional configuration
 * @param {boolean} options.immediate - Whether to send message immediately (default: true)
 * @param {Function} options.onSuccess - Success callback
 * @param {Function} options.onError - Error callback
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.retryDelay - Initial retry delay in ms (default: 1000)
 * @param {number} options.timeout - Request timeout in ms (default: 10000)
 * @param {boolean} options.showNotifications - Show user notifications on error (default: true)
 * @returns {Object} { data, loading, error, retry, isRetrying, retryCount }
 */
export const useChromeMessage = (request, deps = [], options = {}) => {
  const {
    immediate = true,
    onSuccess,
    onError,
    maxRetries = 2, // Reduced from 3 to match content script pattern
    retryDelay = 1000,
    timeout = 10000,
    showNotifications = true,
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const timeoutRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  // Cleanup function to prevent memory leaks
  useEffect(() => {
    // Capture ref values at effect setup time
    const timeoutRef_current = timeoutRef;
    const retryTimeoutRef_current = retryTimeoutRef;
    
    return () => {
      isMountedRef.current = false;
      
      if (timeoutRef_current.current) {
        clearTimeout(timeoutRef_current.current);
      }
      if (retryTimeoutRef_current.current) {
        clearTimeout(retryTimeoutRef_current.current);
      }
    };
  }, []);

  // Enhanced message sending with retry logic, caching, and deduplication
  const sendMessage = async (currentRetryCount = 0, bypassCache = false) => {
    if (!isMountedRef.current) return;

    // Check cache first
    if (handleCacheCheck({ request, bypassCache, setData, setLoading, setError, onSuccess })) {
      return;
    }
    
    // Handle request deduplication
    if (await handleRequestDeduplication({ request, setData, setLoading, setError, onSuccess, isMountedRef })) {
      return;
    }

    setLoading(true);
    setError(null);
    setIsRetrying(currentRetryCount > 0);

    const startTime = performance.now();
    const cacheKey = getCacheKey(request);
    
    const requestPromise = ChromeAPIErrorHandler.sendMessageWithRetry(
      request,
      {
        maxRetries: maxRetries - currentRetryCount,
        retryDelay,
        timeout,
        showNotifications: false,
      }
    );
    
    pendingRequests.set(cacheKey, requestPromise);

    try {
      const response = await requestPromise;
      pendingRequests.delete(cacheKey);

      handleSuccess({ response, request, startTime, currentRetryCount, isMountedRef, setData, setLoading, setIsRetrying, setRetryCount, onSuccess });
    } catch (error) {
      pendingRequests.delete(cacheKey);
      handleError({ error, request, startTime, maxRetries, showNotifications, isMountedRef, setLoading, setIsRetrying, setError, setRetryCount, onError, retry });
    }
  };

  // Manual retry function with cache bypass
  const retry = () => {
    setRetryCount(0);
    // Clear cache for this specific request type on manual retry
    clearChromeMessageCache(request?.type);
    sendMessage(0, true); // Bypass cache on manual retry
  };
  
  // Refetch function for external use (e.g., refresh button)
  const refetch = () => {
    retry();
  };

  useEffect(() => {
    if (!immediate || !request) return;
    sendMessage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return {
    data,
    loading,
    error,
    retry,
    refetch,
    isRetrying,
    retryCount,
  };
};

export default useChromeMessage;
