import { useState, useEffect, useRef } from "react";
import { showErrorNotification } from "../utils/errorNotifications";
import ChromeAPIErrorHandler from "../services/ChromeAPIErrorHandler";

/**
 * Enhanced Chrome extension message communication hook with retry mechanisms
 * and comprehensive error handling for production-ready Chrome extension development.
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
    maxRetries = 3,
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
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Enhanced message sending with retry logic using ChromeAPIErrorHandler
  const sendMessage = async (currentRetryCount = 0) => {
    if (!isMountedRef.current) return;

    setLoading(true);
    setError(null);
    setIsRetrying(currentRetryCount > 0);

    try {
      // Use the ChromeAPIErrorHandler for robust message sending
      const response = await ChromeAPIErrorHandler.sendMessageWithRetry(
        request,
        {
          maxRetries: maxRetries - currentRetryCount,
          retryDelay,
          timeout,
          showNotifications: false, // We'll handle notifications here
        }
      );

      if (!isMountedRef.current) return;

      // Success case
      setData(response);
      setLoading(false);
      setIsRetrying(false);
      setRetryCount(currentRetryCount);
      if (onSuccess) onSuccess(response);
    } catch (error) {
      if (!isMountedRef.current) return;

      const errorMessage = error.message || "Unknown Chrome extension error";

      // Final failure after all retries
      setLoading(false);
      setIsRetrying(false);
      setError(errorMessage);
      setRetryCount(maxRetries);

      // Show user notification for critical errors
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
                  timestamp: new Date().toISOString(),
                });
              },
            },
          ],
        });
      }

      if (onError) onError(errorMessage);
    }
  };

  // Manual retry function
  const retry = () => {
    setRetryCount(0);
    sendMessage();
  };

  useEffect(() => {
    if (!immediate || !request) return;
    sendMessage();
  }, deps);

  return {
    data,
    loading,
    error,
    retry,
    isRetrying,
    retryCount,
  };
};

export default useChromeMessage;
