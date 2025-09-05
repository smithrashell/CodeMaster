# Emergency Fix for Strategy System Failures

## Immediate Problem

The retry mechanisms are correctly detecting failures but the timeouts are too aggressive for current network/system conditions, causing the extension to fail to retrieve strategy data.

## Quick Fixes

### Option 1: Emergency Console Commands (Immediate)

Open browser console and run these commands to fix the extension immediately:

```javascript
// Import the emergency diagnostics
import("/src/shared/services/RetryDiagnostics.js").then(({ emergencyFix }) => {
  emergencyFix().then((results) => {
    console.log("Emergency fix applied:", results);
  });
});
```

Or manually apply fixes:

```javascript
// Reset circuit breaker
if (window.strategyService && window.strategyService.messaging) {
  window.strategyService.messaging.getRetryService().resetCircuitBreaker();
  console.log("Circuit breaker reset");
}

// Clear caches
if (window.strategyService && window.strategyService.cache) {
  window.strategyService.cache.clearCache();
  console.log("Strategy cache cleared");
}

// Increase timeouts for current session
if (window.chromeMessaging) {
  window.chromeMessaging.defaultTimeout = 10000; // 10 seconds
  console.log("Timeouts increased");
}
```

### Option 2: Code Fix (Recommended)

Update the timeout values in the strategy service to be more generous:

**File: `src/content/services/strategyService.js`**

Find lines around 140-144 and change:

```javascript
// FROM:
timeout: 1500, // Shorter timeout for faster fallback

// TO:
timeout: 8000, // More generous timeout for reliability
```

### Option 3: Disable Retry Logic Temporarily

If the retry system is causing more problems than it solves, temporarily bypass it:

**File: `src/shared/services/IndexedDBRetryService.js`**

Add this at the top of the `executeWithRetry` method:

```javascript
executeWithRetry(operation, options = {}) {
  // EMERGENCY: Skip retry logic and execute directly
  if (process.env.NODE_ENV === 'development') {
    return operation();
  }
  // ... rest of method
}
```

## Root Cause Analysis

The issues appear to be:

1. **Timeout values too aggressive** for current network conditions (1500ms)
2. **Circuit breaker triggering too early** (5 failures threshold may be too low)
3. **Chrome messaging may have higher latency** than expected
4. **Strategy data queries taking 6+ seconds** consistently

## Longer Term Solutions

1. **Adaptive timeout adjustment** based on network conditions
2. **Fallback strategy improvements** to ensure extension works even when database fails
3. **Background strategy pre-loading** to reduce real-time query needs
4. **Progressive timeout increases** (start with short timeout, increase on retry)

## Testing the Fix

After applying any fix, test with:

```javascript
// Test strategy retrieval
StrategyService.debug.quickTest().then((result) => {
  console.log("Strategy test result:", result);
});

// Check retry service health
console.log(
  "Retry service stats:",
  StrategyService.getRetryService().getStatistics()
);
```

## Monitoring

Keep browser console open to monitor:

- Strategy retrieval times
- Retry attempt counts
- Circuit breaker status
- Network connectivity issues

The extension should work much better with increased timeouts and reset circuit breaker.
