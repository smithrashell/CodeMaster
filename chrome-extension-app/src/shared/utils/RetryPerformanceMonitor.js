/**
 * Retry Performance Monitor
 *
 * Monitors performance impact of retry mechanisms and provides
 * optimization recommendations and performance metrics.
 */

import indexedDBRetry from "../services/storage/IndexedDBRetryService.js";

export class RetryPerformanceMonitor {
  constructor() {
    this.metrics = new Map(); // operationName -> metrics
    this.globalStats = {
      totalOperations: 0,
      totalRetries: 0,
      totalTimeouts: 0,
      totalCancellations: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      averageLatency: 0,
      retryOverhead: 0,
    };

    this.isEnabled = true;
    this.maxMetricsHistory = 1000; // Keep metrics for last 1000 operations
  }

  /**
   * Start monitoring an operation
   * @param {string} operationName - Name of the operation
   * @param {Object} options - Operation options
   * @returns {Object} Performance context for tracking
   */
  startOperation(operationName, options = {}) {
    if (!this.isEnabled) return null;

    const startTime = performance.now();
    const context = {
      operationName,
      startTime,
      options,
      attempts: 0,
      retryTime: 0,
      hasRetries: false,
      wasTimeout: false,
      wasCancelled: false,
      endTime: null,
      totalTime: null,
      result: null,
      error: null,
    };

    return context;
  }

  /**
   * Record retry attempt
   * @param {Object} context - Performance context
   * @param {number} attemptNumber - Current attempt number
   * @param {Error} error - Error that caused retry
   */
  recordRetryAttempt(context, attemptNumber, error = null) {
    if (!context || !this.isEnabled) return;

    context.attempts = attemptNumber;
    context.hasRetries = attemptNumber > 1;

    if (error?.message.includes("timeout")) {
      context.wasTimeout = true;
    }

    if (error?.message.includes("cancelled")) {
      context.wasCancelled = true;
    }

    this.globalStats.totalRetries++;

    if (context.wasTimeout) {
      this.globalStats.totalTimeouts++;
    }

    if (context.wasCancelled) {
      this.globalStats.totalCancellations++;
    }
  }

  /**
   * End monitoring an operation
   * @param {Object} context - Performance context
   * @param {any} result - Operation result
   * @param {Error} error - Operation error if failed
   */
  endOperation(context, result = null, error = null) {
    if (!context || !this.isEnabled) return;

    context.endTime = performance.now();
    context.totalTime = context.endTime - context.startTime;
    context.result = result;
    context.error = error;

    this.globalStats.totalOperations++;

    if (error) {
      this.globalStats.totalFailures++;
    } else {
      this.globalStats.totalSuccesses++;
    }

    // Update average latency
    this.globalStats.averageLatency =
      (this.globalStats.averageLatency *
        (this.globalStats.totalOperations - 1) +
        context.totalTime) /
      this.globalStats.totalOperations;

    // Calculate retry overhead
    if (context.hasRetries) {
      this.globalStats.retryOverhead += context.totalTime;
    }

    // Store operation metrics
    this.storeOperationMetrics(context);
  }

  /**
   * Store metrics for specific operation
   * @param {Object} context - Performance context
   */
  storeOperationMetrics(context) {
    const { operationName } = context;

    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, {
        operationName,
        totalCalls: 0,
        totalTime: 0,
        totalRetries: 0,
        successCount: 0,
        failureCount: 0,
        timeoutCount: 0,
        cancellationCount: 0,
        averageLatency: 0,
        minLatency: Infinity,
        maxLatency: 0,
        p95Latency: 0,
        retryRate: 0,
        successRate: 0,
        recentSamples: [],
      });
    }

    const metrics = this.metrics.get(operationName);

    metrics.totalCalls++;
    metrics.totalTime += context.totalTime;

    if (context.hasRetries) {
      metrics.totalRetries += context.attempts - 1;
    }

    if (context.error) {
      metrics.failureCount++;
    } else {
      metrics.successCount++;
    }

    if (context.wasTimeout) {
      metrics.timeoutCount++;
    }

    if (context.wasCancelled) {
      metrics.cancellationCount++;
    }

    // Update latency statistics
    metrics.averageLatency = metrics.totalTime / metrics.totalCalls;
    metrics.minLatency = Math.min(metrics.minLatency, context.totalTime);
    metrics.maxLatency = Math.max(metrics.maxLatency, context.totalTime);

    // Update rates
    metrics.retryRate = (metrics.totalRetries / metrics.totalCalls) * 100;
    metrics.successRate = (metrics.successCount / metrics.totalCalls) * 100;

    // Store recent samples for percentile calculations
    metrics.recentSamples.push(context.totalTime);
    if (metrics.recentSamples.length > 100) {
      metrics.recentSamples.shift(); // Keep only last 100 samples
    }

    // Calculate P95 latency
    if (metrics.recentSamples.length >= 10) {
      const sorted = [...metrics.recentSamples].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      metrics.p95Latency = sorted[p95Index];
    }

    // Limit metrics history
    if (this.metrics.size > this.maxMetricsHistory) {
      const firstKey = this.metrics.keys().next().value;
      this.metrics.delete(firstKey);
    }
  }

  /**
   * Get performance statistics for all operations
   * @returns {Object} Performance statistics
   */
  getPerformanceStats() {
    const operationStats = Array.from(this.metrics.values()).map((metrics) => ({
      ...metrics,
      recentSamples: undefined, // Don't include raw samples in output
    }));

    return {
      global: {
        ...this.globalStats,
        retryRate:
          this.globalStats.totalOperations > 0
            ? (this.globalStats.totalRetries /
                this.globalStats.totalOperations) *
              100
            : 0,
        successRate:
          this.globalStats.totalOperations > 0
            ? (this.globalStats.totalSuccesses /
                this.globalStats.totalOperations) *
              100
            : 0,
        timeoutRate:
          this.globalStats.totalOperations > 0
            ? (this.globalStats.totalTimeouts /
                this.globalStats.totalOperations) *
              100
            : 0,
        cancellationRate:
          this.globalStats.totalOperations > 0
            ? (this.globalStats.totalCancellations /
                this.globalStats.totalOperations) *
              100
            : 0,
      },
      operations: operationStats,
      retryService: indexedDBRetry.getStatistics(),
    };
  }

  /**
   * Get performance recommendations based on current metrics
   * @returns {Array} Array of performance recommendations
   */
  getRecommendations() {
    const recommendations = [];
    const stats = this.getPerformanceStats();

    // Global recommendations
    if (stats.global.retryRate > 20) {
      recommendations.push({
        severity: "high",
        type: "retry_rate",
        message: `High retry rate (${stats.global.retryRate.toFixed(
          1
        )}%) indicates potential database issues`,
        suggestion:
          "Check IndexedDB health, consider increasing operation timeouts, or investigate network connectivity",
      });
    }

    if (stats.global.timeoutRate > 10) {
      recommendations.push({
        severity: "medium",
        type: "timeout_rate",
        message: `High timeout rate (${stats.global.timeoutRate.toFixed(
          1
        )}%) suggests operations are taking too long`,
        suggestion:
          "Consider increasing default timeouts or optimizing database queries",
      });
    }

    if (stats.global.averageLatency > 1000) {
      recommendations.push({
        severity: "medium",
        type: "latency",
        message: `Average latency is high (${stats.global.averageLatency.toFixed(
          0
        )}ms)`,
        suggestion:
          "Profile slow operations and consider database optimization or caching",
      });
    }

    // Operation-specific recommendations
    stats.operations.forEach((op) => {
      if (op.retryRate > 25) {
        recommendations.push({
          severity: "high",
          type: "operation_retry_rate",
          operation: op.operationName,
          message: `Operation "${
            op.operationName
          }" has high retry rate (${op.retryRate.toFixed(1)}%)`,
          suggestion: "Investigate specific issues with this operation type",
        });
      }

      if (op.p95Latency > 2000) {
        recommendations.push({
          severity: "medium",
          type: "operation_latency",
          operation: op.operationName,
          message: `Operation "${
            op.operationName
          }" has high P95 latency (${op.p95Latency.toFixed(0)}ms)`,
          suggestion:
            "Consider optimizing this specific operation or increasing its timeout",
        });
      }

      if (op.successRate < 90) {
        recommendations.push({
          severity: "high",
          type: "operation_success_rate",
          operation: op.operationName,
          message: `Operation "${
            op.operationName
          }" has low success rate (${op.successRate.toFixed(1)}%)`,
          suggestion:
            "This operation is failing frequently and needs investigation",
        });
      }
    });

    // Circuit breaker recommendations
    if (stats.retryService.circuitBreaker.failures > 0) {
      recommendations.push({
        severity: "warning",
        type: "circuit_breaker",
        message: `Circuit breaker has ${stats.retryService.circuitBreaker.failures} recent failures`,
        suggestion:
          "Monitor database health and consider investigating underlying issues",
      });
    }

    return recommendations.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, warning: 1, low: 0 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Generate performance report
   * @returns {Object} Comprehensive performance report
   */
  generateReport() {
    const stats = this.getPerformanceStats();
    const recommendations = this.getRecommendations();

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalOperations: stats.global.totalOperations,
        averageLatency: Math.round(stats.global.averageLatency),
        successRate: Math.round(stats.global.successRate * 10) / 10,
        retryRate: Math.round(stats.global.retryRate * 10) / 10,
        healthScore: this.calculateHealthScore(stats),
      },
      statistics: stats,
      recommendations,
      topOperations: this.getTopOperationsByMetric(
        stats.operations,
        "totalCalls",
        10
      ),
      slowestOperations: this.getTopOperationsByMetric(
        stats.operations,
        "p95Latency",
        5
      ),
      leastReliableOperations: this.getTopOperationsByMetric(
        stats.operations,
        "successRate",
        5,
        true
      ),
    };
  }

  /**
   * Calculate overall health score (0-100)
   * @param {Object} stats - Performance statistics
   * @returns {number} Health score
   */
  calculateHealthScore(stats) {
    let score = 100;

    // Deduct for high retry rate
    if (stats.global.retryRate > 10) {
      score -= Math.min(30, stats.global.retryRate * 1.5);
    }

    // Deduct for low success rate
    if (stats.global.successRate < 95) {
      score -= (95 - stats.global.successRate) * 2;
    }

    // Deduct for high timeout rate
    if (stats.global.timeoutRate > 5) {
      score -= Math.min(20, stats.global.timeoutRate * 2);
    }

    // Deduct for circuit breaker issues
    if (stats.retryService.circuitBreaker.failures > 0) {
      score -= Math.min(15, stats.retryService.circuitBreaker.failures * 3);
    }

    return Math.max(0, Math.round(score));
  }

  /**
   * Get top operations by specific metric
   * @param {Array} operations - Operations array
   * @param {string} metric - Metric to sort by
   * @param {number} limit - Number of results to return
   * @param {boolean} ascending - Sort ascending (for success rate)
   * @returns {Array} Top operations
   */
  getTopOperationsByMetric(operations, metric, limit = 5, ascending = false) {
    return operations
      .filter((op) => op.totalCalls > 0)
      .sort((a, b) =>
        ascending ? a[metric] - b[metric] : b[metric] - a[metric]
      )
      .slice(0, limit)
      .map((op) => ({
        operationName: op.operationName,
        [metric]: op[metric],
        totalCalls: op.totalCalls,
        successRate: Math.round(op.successRate * 10) / 10,
      }));
  }

  /**
   * Reset all performance metrics
   */
  reset() {
    this.metrics.clear();
    this.globalStats = {
      totalOperations: 0,
      totalRetries: 0,
      totalTimeouts: 0,
      totalCancellations: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      averageLatency: 0,
      retryOverhead: 0,
    };
  }

  /**
   * Enable or disable performance monitoring
   * @param {boolean} enabled - Whether to enable monitoring
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  /**
   * Export metrics for external analysis
   * @returns {Object} Exportable metrics data
   */
  exportMetrics() {
    return {
      timestamp: new Date().toISOString(),
      globalStats: this.globalStats,
      operationMetrics: Array.from(this.metrics.values()),
      retryServiceStats: indexedDBRetry.getStatistics(),
    };
  }

  /**
   * Import previously exported metrics
   * @param {Object} data - Previously exported metrics data
   */
  importMetrics(data) {
    if (data.globalStats) {
      this.globalStats = { ...this.globalStats, ...data.globalStats };
    }

    if (data.operationMetrics) {
      data.operationMetrics.forEach((metrics) => {
        this.metrics.set(metrics.operationName, {
          ...metrics,
          recentSamples: metrics.recentSamples || [],
        });
      });
    }
  }
}

// Export singleton instance
export const retryPerformanceMonitor = new RetryPerformanceMonitor();

/**
 * Performance monitoring decorator for functions
 * @param {string} operationName - Name for monitoring
 * @param {Function} fn - Function to wrap
 * @returns {Function} Wrapped function with monitoring
 */
export function withRetryMonitoring(operationName, fn) {
  return async function (...args) {
    const context = retryPerformanceMonitor.startOperation(operationName);

    try {
      const result = await fn.apply(this, args);
      retryPerformanceMonitor.endOperation(context, result);
      return result;
    } catch (error) {
      retryPerformanceMonitor.endOperation(context, null, error);
      throw error;
    }
  };
}

export default retryPerformanceMonitor;
