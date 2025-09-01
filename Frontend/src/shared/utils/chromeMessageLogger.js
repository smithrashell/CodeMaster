/**
 * Performance monitoring utilities for Chrome message operations
 * Provides telemetry logging for dashboard performance optimization
 */

const chromeMessageLogger = {
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
      // Only log failures if they're not retries (reduce noise)
      if (retryCount === 0) {
        console.warn(`⚠️ Chrome Message Failure:`, logData);
      }
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
    // Only log pattern failures after all retries are exhausted
    if (retryCount >= 2) {
      console.error(`💥 Chrome Message Pattern Failure:`, {
        type: request?.type,
        error: error.message || error,
        retryCount,
        timestamp: new Date().toISOString(),
        request
      });
    }
  }
};

export default chromeMessageLogger;