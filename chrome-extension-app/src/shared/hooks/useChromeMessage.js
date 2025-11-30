import { useState, useEffect, useRef } from "react";
import { showErrorNotification } from "../utils/logging/errorNotifications.js";
import ChromeAPIErrorHandler from "../services/chrome/ChromeAPIErrorHandler";

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

// Helper functions for message handling
const handleSuccess = ({ response, request, startTime, currentRetryCount, isMountedRef, setData, setLoading, setIsRetrying, setRetryCount, onSuccess }) => {
  if (!isMountedRef.current) return;

  const duration = performance.now() - startTime;
  performanceLogger.logTiming(request, duration, true, currentRetryCount);

  if (duration > 5000) {
    performanceLogger.logSlowRequest(request, duration);
  }

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

  // Enhanced message sending with retry logic
  const sendMessage = async (currentRetryCount = 0) => {
    if (!isMountedRef.current) return;

    setLoading(true);
    setError(null);
    setIsRetrying(currentRetryCount > 0);

    const startTime = performance.now();

    try {
      const response = await ChromeAPIErrorHandler.sendMessageWithRetry(
        request,
        {
          maxRetries: maxRetries - currentRetryCount,
          retryDelay,
          timeout,
          showNotifications: false,
        }
      );

      handleSuccess({ response, request, startTime, currentRetryCount, isMountedRef, setData, setLoading, setIsRetrying, setRetryCount, onSuccess });
    } catch (error) {
      handleError({ error, request, startTime, maxRetries, showNotifications, isMountedRef, setLoading, setIsRetrying, setError, setRetryCount, onError, retry });
    }
  };

  // Manual retry function
  const retry = () => {
    setRetryCount(0);
    sendMessage(0);
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
