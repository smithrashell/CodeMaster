/**
 * Retry Diagnostics and Emergency Fixes
 *
 * Provides diagnostic tools and emergency adjustments for retry mechanisms
 * when they're preventing normal operation.
 */

import indexedDBRetry from "./IndexedDBRetryService.js";
import chromeMessaging from "../../content/services/chromeMessagingService.js";

export class RetryDiagnostics {
  constructor() {
    this.emergencyMode = false;
    this.diagnostics = {
      lastFailures: [],
      performanceData: new Map(),
      networkHistory: [],
    };
  }

  /**
   * Run comprehensive diagnostics
   */
  async runDiagnostics() {
    const results = {
      timestamp: Date.now(),
      retryService: this.diagnoseRetryService(),
      messaging: await this.diagnoseMessaging(),
      network: this.diagnoseNetwork(),
      recommendations: [],
    };

    // Generate recommendations
    if (results.retryService.circuitBreakerOpen) {
      results.recommendations.push({
        severity: "critical",
        action: "reset_circuit_breaker",
        message: "Circuit breaker is preventing all operations",
      });
    }

    if (results.messaging.averageLatency > 3000) {
      results.recommendations.push({
        severity: "high",
        action: "increase_timeouts",
        message: "Messaging latency is very high, increase timeouts",
      });
    }

    if (results.network.isOffline) {
      results.recommendations.push({
        severity: "critical",
        action: "network_issue",
        message: "Network connectivity issues detected",
      });
    }

    return results;
  }

  /**
   * Diagnose retry service health
   */
  diagnoseRetryService() {
    const stats = indexedDBRetry.getStatistics();

    return {
      circuitBreakerOpen: stats.circuitBreaker.isOpen,
      failures: stats.circuitBreaker.failures,
      activeRequests: stats.activeRequests,
      networkStatus: stats.networkStatus,
      isHealthy:
        !stats.circuitBreaker.isOpen && stats.circuitBreaker.failures < 3,
    };
  }

  /**
   * Diagnose Chrome messaging
   */
  async diagnoseMessaging() {
    const stats = chromeMessaging.getCacheStats();

    // Test messaging latency
    const testStart = Date.now();
    try {
      await chromeMessaging.sendMessage(
        { type: "ping" },
        {
          timeout: 5000,
          retries: 1,
        }
      );
      const latency = Date.now() - testStart;

      return {
        cacheStats: stats,
        latency,
        averageLatency: latency, // Single test for now
        isWorking: true,
      };
    } catch (error) {
      return {
        cacheStats: stats,
        latency: -1,
        averageLatency: -1,
        isWorking: false,
        error: error.message,
      };
    }
  }

  /**
   * Diagnose network conditions
   */
  diagnoseNetwork() {
    return {
      isOffline: !navigator.onLine,
      connectionType: navigator.connection?.effectiveType || "unknown",
      downlink: navigator.connection?.downlink || 0,
    };
  }

  /**
   * Apply emergency fixes based on current conditions
   */
  async applyEmergencyFixes() {
    const diagnostics = await this.runDiagnostics();
    const fixes = [];

    // Fix 1: Reset circuit breaker if it's preventing operations
    if (diagnostics.retryService.circuitBreakerOpen) {
      indexedDBRetry.resetCircuitBreaker();
      fixes.push("Circuit breaker reset");
    }

    // Fix 2: Clear messaging cache if it's stale
    if (
      diagnostics.messaging.cacheStats.expired >
      diagnostics.messaging.cacheStats.valid
    ) {
      chromeMessaging.clearCache();
      fixes.push("Messaging cache cleared");
    }

    // Fix 3: Increase timeouts if latency is high
    if (diagnostics.messaging.averageLatency > 3000) {
      indexedDBRetry.defaultTimeout = 10000; // Increase to 10s
      indexedDBRetry.bulkTimeout = 30000; // Increase to 30s
      fixes.push("Timeouts increased due to high latency");
    }

    // Fix 4: Reduce retry attempts if they're causing more harm
    if (diagnostics.retryService.failures > 10) {
      indexedDBRetry.maxRetries = 1; // Reduce to just 1 retry
      fixes.push("Retry attempts reduced to prevent cascade failures");
    }

    return {
      fixes,
      emergencyMode: fixes.length > 0,
    };
  }

  /**
   * Enable emergency mode - bypass retries for critical operations
   */
  enableEmergencyMode() {
    this.emergencyMode = true;

    // Reduce retry attempts
    indexedDBRetry.maxRetries = 1;

    // Increase timeouts significantly
    indexedDBRetry.defaultTimeout = 15000; // 15s
    indexedDBRetry.quickTimeout = 5000; // 5s
    indexedDBRetry.bulkTimeout = 60000; // 60s

    // Reset circuit breaker
    indexedDBRetry.resetCircuitBreaker();

    console.warn(
      "🚨 EMERGENCY MODE ENABLED: Retry mechanisms adjusted for critical operations"
    );
  }

  /**
   * Disable emergency mode - restore normal retry behavior
   */
  disableEmergencyMode() {
    this.emergencyMode = false;

    // Restore normal settings
    indexedDBRetry.maxRetries = 4;
    indexedDBRetry.defaultTimeout = 5000;
    indexedDBRetry.quickTimeout = 1000;
    indexedDBRetry.bulkTimeout = 15000;

    console.log("✅ Emergency mode disabled - normal retry behavior restored");
  }

  /**
   * Test if strategy retrieval is working
   */
  async testStrategyRetrieval() {
    const testTags = ["array", "hash table", "string"];
    const results = [];

    for (const tag of testTags) {
      const start = Date.now();
      try {
        const response = await chromeMessaging.sendMessage(
          { type: "getStrategyForTag", tag },
          {
            timeout: this.emergencyMode ? 15000 : 5000,
            retries: this.emergencyMode ? 1 : 3,
            cacheable: true,
            cacheKey: `strategy_test_${tag}`,
          }
        );

        results.push({
          tag,
          success: true,
          latency: Date.now() - start,
          hasData: !!response,
        });
      } catch (error) {
        results.push({
          tag,
          success: false,
          latency: Date.now() - start,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get emergency bypass function for critical operations
   */
  getEmergencyBypass() {
    return {
      // Bypass retry logic for critical operations
      executeDirectly: async (operation) => {
        try {
          return await operation();
        } catch (error) {
          console.warn("Emergency bypass failed:", error);
          throw error;
        }
      },

      // Use only fallback data
      useFallbackOnly: true,
    };
  }
}

// Export singleton instance
export const retryDiagnostics = new RetryDiagnostics();

/**
 * Quick emergency fix function for immediate use
 */
export async function emergencyFix() {
  console.log("🚨 Running emergency fixes...");

  const diagnostics = await retryDiagnostics.runDiagnostics();
  const fixes = await retryDiagnostics.applyEmergencyFixes();

  console.log("Emergency diagnostics:", diagnostics);
  console.log("Applied fixes:", fixes);

  // Test if strategy retrieval is working now
  const testResults = await retryDiagnostics.testStrategyRetrieval();
  console.log("Strategy retrieval test:", testResults);

  return {
    diagnostics,
    fixes,
    testResults,
  };
}

export default retryDiagnostics;
