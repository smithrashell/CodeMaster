/**
 * Tests for the REAL PerformanceMonitor class (not helpers).
 *
 * PerformanceMonitor.js is globally mocked in test/setup.js (0% coverage).
 * This file unmocks it so the real singleton constructor and methods execute.
 */

// Unmock so we get the real module (overrides the global mock in setup.js)
jest.unmock('../PerformanceMonitor.js');

// Logger is still globally mocked via setup.js — that's fine.

// Import the real default export (the singleton instance)
import performanceMonitor from '../PerformanceMonitor.js';

describe('PerformanceMonitor (real)', () => {
  beforeEach(() => {
    // Reset metrics between tests so they don't bleed
    performanceMonitor.reset();
  });

  // -------------------------------------------------------------------
  // Constructor / initialization
  // -------------------------------------------------------------------
  describe('initialization', () => {
    it('exports a singleton object with expected methods', () => {
      expect(performanceMonitor).toBeDefined();
      expect(typeof performanceMonitor.startQuery).toBe('function');
      expect(typeof performanceMonitor.endQuery).toBe('function');
      expect(typeof performanceMonitor.startComponentRender).toBe('function');
      expect(typeof performanceMonitor.wrapDbOperation).toBe('function');
      expect(typeof performanceMonitor.wrapAsyncOperation).toBe('function');
      expect(typeof performanceMonitor.reset).toBe('function');
      expect(typeof performanceMonitor.exportMetrics).toBe('function');
      expect(typeof performanceMonitor.generateReport).toBe('function');
    });

    it('has default metrics with empty arrays', () => {
      expect(performanceMonitor.metrics.queries).toEqual([]);
      expect(performanceMonitor.metrics.componentRenders).toEqual([]);
      expect(performanceMonitor.metrics.alerts).toEqual([]);
      expect(performanceMonitor.metrics.criticalOperations).toEqual([]);
    });

    it('has thresholds set', () => {
      expect(performanceMonitor.thresholds).toBeDefined();
      expect(typeof performanceMonitor.thresholds.slowQueryTime).toBe('number');
      expect(typeof performanceMonitor.thresholds.criticalOperationTime).toBe('number');
    });

    it('has criticalOperations as a Set', () => {
      expect(performanceMonitor.criticalOperations).toBeInstanceOf(Set);
    });
  });

  // -------------------------------------------------------------------
  // startQuery / endQuery
  // -------------------------------------------------------------------
  describe('startQuery / endQuery', () => {
    it('startQuery returns a context object with id, operation, startTime', () => {
      const ctx = performanceMonitor.startQuery('test_op', { foo: 'bar' });
      expect(ctx.id).toMatch(/^test_op_/);
      expect(ctx.operation).toBe('test_op');
      expect(typeof ctx.startTime).toBe('number');
      expect(ctx.metadata).toEqual({ foo: 'bar' });
    });

    it('endQuery records the metric and returns it', () => {
      const ctx = performanceMonitor.startQuery('my_operation');
      const metric = performanceMonitor.endQuery(ctx, true, 5);

      expect(metric.operation).toBe('my_operation');
      expect(metric.success).toBe(true);
      expect(metric.resultSize).toBe(5);
      expect(typeof metric.duration).toBe('number');
      expect(metric.error).toBeNull();

      // Should be recorded in metrics
      expect(performanceMonitor.metrics.queries).toHaveLength(1);
      expect(performanceMonitor.metrics.queries[0].id).toBe(ctx.id);
    });

    it('endQuery records failures with error message', () => {
      const ctx = performanceMonitor.startQuery('failing_op');
      const metric = performanceMonitor.endQuery(ctx, false, 0, new Error('db timeout'));

      expect(metric.success).toBe(false);
      expect(metric.error).toBe('db timeout');
    });

    it('endQuery tracks critical operations separately', () => {
      performanceMonitor.criticalOperations.add('critical_op');
      const ctx = performanceMonitor.startQuery('critical_op');
      const metric = performanceMonitor.endQuery(ctx, true, 1);

      expect(metric.isCritical).toBe(true);
      expect(performanceMonitor.metrics.criticalOperations.length).toBeGreaterThan(0);
      expect(performanceMonitor.metrics.systemMetrics.criticalOperationCount).toBeGreaterThan(0);
    });

    it('endQuery trims metrics.queries when exceeding maxMetricsHistory', () => {
      const max = performanceMonitor.thresholds.maxMetricsHistory;
      // Fill beyond max
      for (let i = 0; i < max + 10; i++) {
        const ctx = performanceMonitor.startQuery(`op_${i}`);
        performanceMonitor.endQuery(ctx, true, 0);
      }
      expect(performanceMonitor.metrics.queries.length).toBeLessThanOrEqual(max);
    });
  });

  // -------------------------------------------------------------------
  // updateSystemMetrics
  // -------------------------------------------------------------------
  describe('updateSystemMetrics', () => {
    it('calculates averageQueryTime and totalQueries', () => {
      // Record a few queries
      for (let i = 0; i < 5; i++) {
        const ctx = performanceMonitor.startQuery(`op_${i}`);
        performanceMonitor.endQuery(ctx, true, 1);
      }
      expect(performanceMonitor.metrics.systemMetrics.totalQueries).toBe(5);
      expect(typeof performanceMonitor.metrics.systemMetrics.averageQueryTime).toBe('number');
    });

    it('tracks error rate from recent queries', () => {
      // 2 successes, 1 failure
      for (let i = 0; i < 2; i++) {
        const ctx = performanceMonitor.startQuery('ok');
        performanceMonitor.endQuery(ctx, true);
      }
      const ctx = performanceMonitor.startQuery('fail');
      performanceMonitor.endQuery(ctx, false, 0, new Error('err'));

      // 1 out of 3 = 33.33% error rate
      expect(performanceMonitor.metrics.systemMetrics.errorRate).toBeCloseTo(33.33, 0);
    });
  });

  // -------------------------------------------------------------------
  // startComponentRender
  // -------------------------------------------------------------------
  describe('startComponentRender', () => {
    it('returns a function that records render metric', () => {
      const endRender = performanceMonitor.startComponentRender('MyComponent', { id: 123 });
      expect(typeof endRender).toBe('function');

      const metric = endRender(true);
      expect(metric.component).toBe('MyComponent');
      expect(metric.success).toBe(true);
      expect(typeof metric.duration).toBe('number');
      expect(performanceMonitor.metrics.componentRenders).toHaveLength(1);
    });

    it('records error on failed render', () => {
      const endRender = performanceMonitor.startComponentRender('BrokenComponent');
      const metric = endRender(false, new Error('render crash'));
      expect(metric.success).toBe(false);
      expect(metric.error).toBe('render crash');
    });

    it('trims componentRenders at 500', () => {
      for (let i = 0; i < 510; i++) {
        const end = performanceMonitor.startComponentRender(`Comp_${i}`);
        end(true);
      }
      expect(performanceMonitor.metrics.componentRenders.length).toBeLessThanOrEqual(500);
    });
  });

  // -------------------------------------------------------------------
  // wrapDbOperation
  // -------------------------------------------------------------------
  describe('wrapDbOperation', () => {
    it('wraps an async function and records query metrics on success', async () => {
      const mockOp = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const wrapped = performanceMonitor.wrapDbOperation(mockOp, 'fetchProblems');

      const result = await wrapped('arg1', 'arg2');
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
      expect(mockOp).toHaveBeenCalledWith('arg1', 'arg2');
      expect(performanceMonitor.metrics.queries.length).toBeGreaterThan(0);
      expect(performanceMonitor.metrics.queries[0].operation).toBe('db_fetchProblems');
    });

    it('wraps an async function and records query metrics on failure', async () => {
      const mockOp = jest.fn().mockRejectedValue(new Error('db error'));
      const wrapped = performanceMonitor.wrapDbOperation(mockOp, 'brokenQuery');

      await expect(wrapped()).rejects.toThrow('db error');
      const lastQuery = performanceMonitor.metrics.queries.at(-1);
      expect(lastQuery.success).toBe(false);
      expect(lastQuery.error).toBe('db error');
    });
  });

  // -------------------------------------------------------------------
  // wrapAsyncOperation
  // -------------------------------------------------------------------
  describe('wrapAsyncOperation', () => {
    it('wraps a generic async operation', async () => {
      const mockOp = jest.fn().mockResolvedValue('result');
      const wrapped = performanceMonitor.wrapAsyncOperation(mockOp, 'fetchData');

      const result = await wrapped();
      expect(result).toBe('result');
      expect(performanceMonitor.metrics.queries.at(-1).operation).toBe('fetchData');
    });

    it('marks operation as critical when flag is set', async () => {
      const mockOp = jest.fn().mockResolvedValue(42);
      const wrapped = performanceMonitor.wrapAsyncOperation(mockOp, 'criticalFetch', true);

      await wrapped();
      expect(performanceMonitor.criticalOperations.has('criticalFetch')).toBe(true);
      expect(performanceMonitor.metrics.queries.at(-1).isCritical).toBe(true);
    });

    it('records error on failure', async () => {
      const mockOp = jest.fn().mockRejectedValue(new Error('timeout'));
      const wrapped = performanceMonitor.wrapAsyncOperation(mockOp, 'failOp');

      await expect(wrapped()).rejects.toThrow('timeout');
    });
  });

  // -------------------------------------------------------------------
  // recordMemoryUsage
  // -------------------------------------------------------------------
  describe('recordMemoryUsage', () => {
    it('records memory usage in system metrics', () => {
      performanceMonitor.recordMemoryUsage(1024 * 1024, 'test');
      expect(performanceMonitor.metrics.systemMetrics.memoryUsage).toBe(1024 * 1024);
    });

    it('raises alert when memory exceeds threshold', () => {
      const highMemory = performanceMonitor.thresholds.highMemoryUsage + 1;
      performanceMonitor.recordMemoryUsage(highMemory, 'leak-source');
      const alert = performanceMonitor.metrics.alerts.find(a => a.type === 'HIGH_MEMORY_USAGE');
      expect(alert).toBeDefined();
      expect(alert.data.source).toBe('leak-source');
    });
  });

  // -------------------------------------------------------------------
  // Summary / report methods
  // -------------------------------------------------------------------
  describe('summaries and reports', () => {
    it('getPerformanceSummary returns an object', () => {
      const summary = performanceMonitor.getPerformanceSummary();
      expect(summary).toBeDefined();
      expect(typeof summary).toBe('object');
    });

    it('getSystemHealth returns an object', () => {
      const health = performanceMonitor.getSystemHealth();
      expect(health).toBeDefined();
    });

    it('getQueryStatsByOperation returns stats', () => {
      const ctx = performanceMonitor.startQuery('test_op');
      performanceMonitor.endQuery(ctx, true, 1);

      const stats = performanceMonitor.getQueryStatsByOperation();
      expect(stats).toBeDefined();
    });

    it('getCriticalOperationSummary returns summary', () => {
      const summary = performanceMonitor.getCriticalOperationSummary();
      expect(summary).toBeDefined();
    });

    it('getRenderPerformanceSummary returns summary', () => {
      const summary = performanceMonitor.getRenderPerformanceSummary();
      expect(summary).toBeDefined();
    });

    it('exportMetrics includes all sections', () => {
      const exported = performanceMonitor.exportMetrics();
      expect(exported.summaries).toBeDefined();
      expect(exported.thresholds).toBeDefined();
      expect(typeof exported.uptime).toBe('number');
      expect(exported.exportTime).toBeDefined();
      expect(exported.health).toBeDefined();
    });

    it('generateReport returns a string', () => {
      const report = performanceMonitor.generateReport();
      expect(typeof report).toBe('string');
    });
  });

  // -------------------------------------------------------------------
  // reset
  // -------------------------------------------------------------------
  describe('reset', () => {
    it('clears all metrics and resets startTime', () => {
      // Add some data
      const ctx = performanceMonitor.startQuery('op');
      performanceMonitor.endQuery(ctx, true);
      expect(performanceMonitor.metrics.queries.length).toBeGreaterThan(0);

      performanceMonitor.reset();
      expect(performanceMonitor.metrics.queries).toEqual([]);
      expect(performanceMonitor.metrics.componentRenders).toEqual([]);
      expect(performanceMonitor.metrics.alerts).toEqual([]);
    });
  });

  // -------------------------------------------------------------------
  // checkPerformanceAlerts
  // -------------------------------------------------------------------
  describe('checkPerformanceAlerts', () => {
    it('trims alerts to 200', () => {
      for (let i = 0; i < 210; i++) {
        performanceMonitor.metrics.alerts.push({
          type: 'TEST',
          message: `alert ${i}`,
          severity: 'warning',
          timestamp: Date.now(),
        });
      }
      // Trigger the trim via endQuery
      const ctx = performanceMonitor.startQuery('trigger');
      performanceMonitor.endQuery(ctx, true);
      expect(performanceMonitor.metrics.alerts.length).toBeLessThanOrEqual(201);
    });
  });

  // -------------------------------------------------------------------
  // updateRenderPerformance
  // -------------------------------------------------------------------
  describe('updateRenderPerformance', () => {
    it('calculates average render time from recent renders', () => {
      for (let i = 0; i < 5; i++) {
        const end = performanceMonitor.startComponentRender(`Comp${i}`);
        end(true);
      }
      expect(typeof performanceMonitor.metrics.systemMetrics.renderPerformance).toBe('number');
    });
  });
});
