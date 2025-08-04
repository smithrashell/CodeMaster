import { useState, useEffect } from 'react';

/**
 * Simple hook for Chrome extension message communication
 * Replaces the most common pattern: useEffect + chrome.runtime.sendMessage
 * 
 * @param {Object} request - The message to send to background script
 * @param {Array} deps - Dependencies array (like useEffect deps)
 * @param {Object} options - Optional configuration
 * @returns {Object} { data, loading, error }
 */
export const useChromeMessage = (request, deps = [], options = {}) => {
  const { immediate = true, onSuccess, onError } = options;
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!immediate || !request) return;

    setLoading(true);
    setError(null);

    chrome.runtime.sendMessage(request, (response) => {
      setLoading(false);

      // Check for Chrome runtime errors first
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message;
        setError(errorMsg);
        if (onError) onError(errorMsg);
        return;
      }

      // Check for response errors
      if (response && response.error) {
        setError(response.error);
        if (onError) onError(response.error);
        return;
      }

      // Success case
      setData(response);
      if (onSuccess) onSuccess(response);
    });
  }, deps);

  return { data, loading, error };
};

export default useChromeMessage;