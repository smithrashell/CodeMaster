/**
 * Unit tests for PerformanceMonitorHelpers.js
 * Tests pure helper functions for performance monitoring:
 * - sanitizeProps, estimateResultSize
 * - recordLongTask, recordLayoutShift
 * - getSystemHealth, getQueryStatsByOperation
 * - getCriticalOperationSummary, getRenderPerformanceSummary
 * - checkPerformanceAlerts, isTestEnvironment
 * - getDefaultMetrics, getDefaultThresholds
 *
 * NOTE: PerformanceMonitor.js singleton is globally mocked in test/setup.js.
 * We test the pure helpers from PerformanceMonitorHelpers.js directly.
 */

// Mock logger first, before all other imports
jest.mock('../../logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import {
  sanitizeProps,
  estimateResultSize,
  recordLongTask,
  recordLayoutShift,
  getSystemHealth,
  getQueryStatsByOperation,
  getCriticalOperationSummary,
  checkPerformanceAlerts,
  isTestEnvironment,
  getDefaultMetrics,
  getDefaultThresholds,
  getDefaultCriticalOperations,
} from '../PerformanceMonitorHelpers.js';

describe('PerformanceMonitorHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // sanitizeProps
  // -----------------------------------------------------------------------
  describe('sanitizeProps', () => {
    it('replaces functions with "[Function]"', () => {
      const result = sanitizeProps({ onClick: () => {} });
      expect(result.onClick).toBe('[Function]');
    });

    it('replaces objects with "[Object]"', () => {
      const result = sanitizeProps({ data: { key: 'value' } });
      expect(result.data).toBe('[Object]');
    });

    it('truncates long strings to 50 chars + "..."', () => {
      const longStr = 'a'.repeat(100);
      const result = sanitizeProps({ str: longStr });
      expect(result.str).toHaveLength(53); // 50 + '...'
      expect(result.str.endsWith('...')).toBe(true);
    });

    it('keeps short strings as-is', () => {
      const result = sanitizeProps({ name: 'short' });
      expect(result.name).toBe('short');
    });

    it('keeps numbers as-is', () => {
      const result = sanitizeProps({ count: 42 });
      expect(result.count).toBe(42);
    });
  });

  // -----------------------------------------------------------------------
  // estimateResultSize
  // -----------------------------------------------------------------------
  describe('estimateResultSize', () => {
    it('returns array length for arrays', () => {
      expect(estimateResultSize([1, 2, 3])).toBe(3);
    });

    it('returns key count for objects', () => {
      expect(estimateResultSize({ a: 1, b: 2 })).toBe(2);
    });

    it('returns string length for strings', () => {
      expect(estimateResultSize('hello')).toBe(5);
    });

    it('returns 1 for primitives', () => {
      expect(estimateResultSize(42)).toBe(1);
      expect(estimateResultSize(true)).toBe(1);
    });

    it('returns 0 for empty array', () => {
      expect(estimateResultSize([])).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // recordLongTask
  // -----------------------------------------------------------------------
  describe('recordLongTask', () => {
    it('pushes a LONG_TASK alert to metrics', () => {
      const metrics = { alerts: [] };
      const entry = { duration: 500, startTime: 100, name: 'task' };

      recordLongTask(entry, metrics);

      expect(metrics.alerts).toHaveLength(1);
      expect(metrics.alerts[0]).toMatchObject({
        type: 'LONG_TASK',
        severity: 'warning',
        data: expect.objectContaining({ duration: 500 }),
      });
    });

    it('sets severity to error for tasks > 1000ms', () => {
      const metrics = { alerts: [] };
      const entry = { duration: 1500, startTime: 0, name: 'long' };

      recordLongTask(entry, metrics);

      expect(metrics.alerts[0].severity).toBe('error');
    });
  });

  // -----------------------------------------------------------------------
  // recordLayoutShift
  // -----------------------------------------------------------------------
  describe('recordLayoutShift', () => {
    it('pushes a LAYOUT_SHIFT alert for value > 0.1', () => {
      const metrics = { alerts: [] };
      const entry = { value: 0.15, hadRecentInput: false };

      recordLayoutShift(entry, metrics);

      expect(metrics.alerts).toHaveLength(1);
      expect(metrics.alerts[0].type).toBe('LAYOUT_SHIFT');
    });

    it('does not push alert for value <= 0.1', () => {
      const metrics = { alerts: [] };
      recordLayoutShift({ value: 0.05 }, metrics);
      expect(metrics.alerts).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // getSystemHealth
  // -----------------------------------------------------------------------
  describe('getSystemHealth', () => {
    it('returns "good" for healthy metrics', () => {
      const metrics = {
        alerts: [],
        systemMetrics: {
          errorRate: 0,
          criticalErrorRate: 0,
          averageQueryTime: 100,
          averageCriticalTime: 200,
          renderPerformance: 50,
        },
      };

      expect(getSystemHealth(metrics)).toBe('good');
    });

    it('returns "critical" for high error rate', () => {
      const metrics = {
        alerts: [],
        systemMetrics: {
          errorRate: 20,
          criticalErrorRate: 0,
          averageQueryTime: 100,
          averageCriticalTime: 200,
          renderPerformance: 50,
        },
      };

      expect(getSystemHealth(metrics)).toBe('critical');
    });

    it('returns "warning" for moderate error rate', () => {
      const metrics = {
        alerts: [],
        systemMetrics: {
          errorRate: 4,
          criticalErrorRate: 0,
          averageQueryTime: 100,
          averageCriticalTime: 200,
          renderPerformance: 50,
        },
      };

      expect(getSystemHealth(metrics)).toBe('warning');
    });
  });

  // -----------------------------------------------------------------------
  // getQueryStatsByOperation
  // -----------------------------------------------------------------------
  describe('getQueryStatsByOperation', () => {
    it('returns stats keyed by operation name', () => {
      const queries = [
        { operation: 'fetchProblems', duration: 100, success: true },
        { operation: 'fetchProblems', duration: 200, success: true },
        { operation: 'saveSession', duration: 50, success: false },
      ];

      const stats = getQueryStatsByOperation(queries);

      expect(stats.fetchProblems).toBeDefined();
      expect(stats.fetchProblems.count).toBe(2);
      expect(stats.fetchProblems.averageTime).toBe(150);
      expect(stats.saveSession.errors).toBe(1);
    });

    it('returns empty object for no queries', () => {
      expect(getQueryStatsByOperation([])).toEqual({});
    });
  });

  // -----------------------------------------------------------------------
  // getCriticalOperationSummary
  // -----------------------------------------------------------------------
  describe('getCriticalOperationSummary', () => {
    it('returns zero totals for empty input', () => {
      const summary = getCriticalOperationSummary([]);
      expect(summary).toMatchObject({
        totalOperations: 0,
        averageTime: 0,
        successRate: 100,
        failures: [],
      });
    });

    it('calculates averageTime and successRate correctly', () => {
      const now = Date.now();
      const ops = [
        { operation: 'op1', duration: 100, success: true, timestamp: now },
        { operation: 'op2', duration: 200, success: false, timestamp: now, error: 'failed' },
      ];

      const summary = getCriticalOperationSummary(ops);

      expect(summary.totalOperations).toBe(2);
      expect(summary.averageTime).toBe(150);
      expect(summary.successRate).toBe(50);
      expect(summary.failures).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // checkPerformanceAlerts
  // -----------------------------------------------------------------------
  describe('checkPerformanceAlerts', () => {
    const thresholds = {
      slowQueryTime: 100,
      criticalOperationTime: 200,
      errorRateThreshold: 5,
    };

    it('returns SLOW_QUERY alert for slow query', () => {
      const metrics = {
        systemMetrics: { errorRate: 0, criticalErrorRate: 0, averageQueryTime: 50, averageCriticalTime: 0 },
      };
      const queryMetric = { operation: 'slow_op', duration: 500, success: true, isCritical: false };

      const alerts = checkPerformanceAlerts(queryMetric, metrics, thresholds);

      expect(alerts.some((a) => a.type === 'SLOW_QUERY')).toBe(true);
    });

    it('returns CRITICAL_OPERATION_FAILED for failed critical op', () => {
      const metrics = {
        systemMetrics: { errorRate: 0, criticalErrorRate: 0, averageQueryTime: 50, averageCriticalTime: 0 },
      };
      const queryMetric = { operation: 'critical_op', duration: 50, success: false, isCritical: true };

      const alerts = checkPerformanceAlerts(queryMetric, metrics, thresholds);

      expect(alerts.some((a) => a.type === 'CRITICAL_OPERATION_FAILED')).toBe(true);
    });

    it('returns no alerts for fast successful query', () => {
      const metrics = {
        systemMetrics: { errorRate: 0, criticalErrorRate: 0, averageQueryTime: 50, averageCriticalTime: 0 },
      };
      const queryMetric = { operation: 'fast_op', duration: 10, success: true, isCritical: false };

      const alerts = checkPerformanceAlerts(queryMetric, metrics, thresholds);

      expect(alerts.filter((a) => a.type === 'SLOW_QUERY' || a.type === 'CRITICAL_OPERATION_FAILED')).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // getDefaultMetrics / getDefaultThresholds / getDefaultCriticalOperations
  // -----------------------------------------------------------------------
  describe('getDefaultMetrics', () => {
    it('returns expected structure', () => {
      const metrics = getDefaultMetrics();

      expect(metrics).toMatchObject({
        queries: [],
        alerts: [],
        criticalOperations: [],
        componentRenders: [],
        systemMetrics: expect.any(Object),
      });
    });
  });

  describe('getDefaultThresholds', () => {
    it('returns thresholds with expected keys', () => {
      const thresholds = getDefaultThresholds(false);

      expect(thresholds).toMatchObject({
        slowQueryTime: expect.any(Number),
        criticalOperationTime: expect.any(Number),
        highMemoryUsage: expect.any(Number),
        errorRateThreshold: expect.any(Number),
      });
    });

    it('multiplies thresholds by 3x in test mode', () => {
      const prod = getDefaultThresholds(false);
      const test = getDefaultThresholds(true);

      expect(test.slowQueryTime).toBe(prod.slowQueryTime * 3);
    });
  });

  describe('getDefaultCriticalOperations', () => {
    it('returns a Set containing expected operations', () => {
      const ops = getDefaultCriticalOperations();

      expect(ops).toBeInstanceOf(Set);
      expect(ops.has('db_query')).toBe(true);
      expect(ops.has('session_creation')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // isTestEnvironment
  // -----------------------------------------------------------------------
  describe('isTestEnvironment', () => {
    it('returns true in Jest test environment', () => {
      // In Jest, process.env.NODE_ENV is 'test' or JEST_WORKER_ID is set
      const result = isTestEnvironment();
      expect(result).toBe(true);
    });
  });
});
