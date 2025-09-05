import { useState, useRef, useCallback } from "react";
import ChromeAPIErrorHandler from "../services/ChromeAPIErrorHandler";

/**
 * Specialized hook for handling Chrome extension message retry logic
 * with exponential backoff and performance monitoring
 */
export const useChromeRetry = (options = {}) => {
  const {
    maxRetries = 2,
    retryDelay = 1000,
    timeout = 10000,
    showNotifications: _showNotifications = false,
  } = options;

  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  // Cleanup function
  const cleanup = useCallback(() => {
    const currentRetryTimeout = retryTimeoutRef.current;
    if (currentRetryTimeout) {
      clearTimeout(currentRetryTimeout);
    }
  }, []);

  // Enhanced message sending with retry logic
  const sendWithRetry = useCallback(async (request, pendingRequests, cacheKey) => {
    if (!isMountedRef.current) return;

    setIsRetrying(retryCount > 0);
    
    // Create promise for request deduplication
    const requestPromise = ChromeAPIErrorHandler.sendMessageWithRetry(
      request,
      {
        maxRetries: maxRetries - retryCount,
        retryDelay,
        timeout,
        showNotifications: false, // We'll handle notifications in parent
      }
    );
    
    if (pendingRequests && cacheKey) {
      pendingRequests.set(cacheKey, requestPromise);
    }

    try {
      const response = await requestPromise;
      
      // Clean up pending request
      if (pendingRequests && cacheKey) {
        pendingRequests.delete(cacheKey);
      }

      if (!isMountedRef.current) return response;

      // Success case
      setIsRetrying(false);
      setRetryCount(0);
      return response;
    } catch (error) {
      // Clean up pending request
      if (pendingRequests && cacheKey) {
        pendingRequests.delete(cacheKey);
      }
      
      if (!isMountedRef.current) return;

      // Final failure after all retries
      setIsRetrying(false);
      setRetryCount(maxRetries);
      throw error;
    }
  }, [maxRetries, retryDelay, timeout, retryCount]);

  // Manual retry function
  const resetRetryState = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  return {
    isRetrying,
    retryCount,
    sendWithRetry,
    resetRetryState,
    cleanup,
    isMountedRef,
  };
};

export default useChromeRetry;