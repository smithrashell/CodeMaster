/**
 * Tests for CrashReporter
 *
 * Covers: initialize, determineSeverity, collectCrashData,
 * handleJavaScriptError, handlePromiseRejection, handleReactError,
 * reportCrash, getCrashPatterns, getCrashStatistics,
 * reportCriticalIssue, getMemoryInfo, getPerformanceSnapshot,
 * getRecentUserActions, setupReactErrorHandling, monitorExtensionHealth.
 */

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
    sessionId: 'test-session-123',
  },
}));

jest.mock('../ErrorReportService.js', () => ({
  ErrorReportService: {
    storeErrorReport: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../chrome/userActionTracker.js', () => ({
  UserActionTracker: {
    trackError: jest.fn().mockResolvedValue(undefined),
    getUserActions: jest.fn().mockResolvedValue([]),
    sessionStart: Date.now() - 60000,
  },
}));

jest.mock('../../../utils/performance/PerformanceMonitor.js', () => ({
  __esModule: true,
  default: {
    getPerformanceSummary: jest.fn(() => ({
      systemMetrics: { averageQueryTime: 100 },
      recentAlerts: [],
    })),
    getSystemHealth: jest.fn(() => 'healthy'),
  },
}));

import { CrashReporter } from '../crashReporter.js';
import { ErrorReportService } from '../ErrorReportService.js';
import { UserActionTracker } from '../../chrome/userActionTracker.js';
import logger from '../../../utils/logging/logger.js';

describe('CrashReporter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset static state
    CrashReporter.isInitialized = false;
    CrashReporter.crashCount = 0;
    CrashReporter.lastCrashTime = null;
    CrashReporter.recentErrors = [];
  });

  // ========================================================================
  // SEVERITY constants
  // ========================================================================
  describe('SEVERITY constants', () => {
    it('should have correct severity levels', () => {
      expect(CrashReporter.SEVERITY.LOW).toBe('low');
      expect(CrashReporter.SEVERITY.MEDIUM).toBe('medium');
      expect(CrashReporter.SEVERITY.HIGH).toBe('high');
      expect(CrashReporter.SEVERITY.CRITICAL).toBe('critical');
    });
  });

  // ========================================================================
  // determineSeverity
  // ========================================================================
  describe('determineSeverity', () => {
    it('should return CRITICAL for ReferenceError', () => {
      const error = new ReferenceError('x is not defined');
      expect(CrashReporter.determineSeverity(error)).toBe('critical');
    });

    it('should return CRITICAL for TypeError with "Cannot read property"', () => {
      const error = new TypeError("Cannot read property 'foo' of undefined");
      expect(CrashReporter.determineSeverity(error)).toBe('critical');
    });

    it('should return CRITICAL for errors in background.js', () => {
      const error = new Error('Something failed');
      expect(
        CrashReporter.determineSeverity(error, { filename: '/background.js' })
      ).toBe('critical');
    });

    it('should return HIGH for TypeError without "Cannot read property"', () => {
      const error = new TypeError('null is not a function');
      expect(CrashReporter.determineSeverity(error)).toBe('high');
    });

    it('should return HIGH for RangeError', () => {
      const error = new RangeError('Maximum call stack size exceeded');
      expect(CrashReporter.determineSeverity(error)).toBe('high');
    });

    it('should return HIGH for IndexedDB errors', () => {
      const error = new Error('IndexedDB transaction failed');
      expect(CrashReporter.determineSeverity(error)).toBe('high');
    });

    it('should return HIGH for Extension context errors', () => {
      const error = new Error('Extension context invalidated');
      expect(CrashReporter.determineSeverity(error)).toBe('high');
    });

    it('should return MEDIUM for generic Error', () => {
      const error = new Error('Something went wrong');
      expect(CrashReporter.determineSeverity(error)).toBe('medium');
    });

    it('should return MEDIUM for SyntaxError', () => {
      const error = new SyntaxError('Unexpected token');
      expect(CrashReporter.determineSeverity(error)).toBe('medium');
    });

    it('should return LOW for unknown error types', () => {
      const error = { name: 'CustomError', message: 'custom' };
      expect(CrashReporter.determineSeverity(error)).toBe('low');
    });
  });

  // ========================================================================
  // getMemoryInfo
  // ========================================================================
  describe('getMemoryInfo', () => {
    it('should return memory info when performance.memory is available', () => {
      const originalMemory = performance.memory;
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 1000,
          totalJSHeapSize: 2000,
          jsHeapSizeLimit: 3000,
        },
        configurable: true,
      });

      const info = CrashReporter.getMemoryInfo();
      expect(info).toEqual({
        usedJSHeapSize: 1000,
        totalJSHeapSize: 2000,
        jsHeapSizeLimit: 3000,
      });

      if (originalMemory) {
        Object.defineProperty(performance, 'memory', { value: originalMemory, configurable: true });
      } else {
        delete performance.memory;
      }
    });

    it('should return null when performance.memory is not available', () => {
      const originalMemory = performance.memory;
      Object.defineProperty(performance, 'memory', { value: undefined, configurable: true });

      const info = CrashReporter.getMemoryInfo();
      expect(info).toBeNull();

      if (originalMemory) {
        Object.defineProperty(performance, 'memory', { value: originalMemory, configurable: true });
      }
    });
  });

  // ========================================================================
  // getPerformanceSnapshot
  // ========================================================================
  describe('getPerformanceSnapshot', () => {
    it('should return performance metrics object', () => {
      const snapshot = CrashReporter.getPerformanceSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot).toHaveProperty('systemMetrics');
      expect(snapshot).toHaveProperty('health');
    });
  });

  // ========================================================================
  // getRecentUserActions
  // ========================================================================
  describe('getRecentUserActions', () => {
    it('should return mapped user actions', async () => {
      UserActionTracker.getUserActions.mockResolvedValueOnce([
        { action: 'click', category: 'nav', timestamp: '2024-01-01', context: {} },
      ]);

      const actions = await CrashReporter.getRecentUserActions();
      expect(actions).toHaveLength(1);
      expect(actions[0]).toEqual({
        action: 'click',
        category: 'nav',
        timestamp: '2024-01-01',
        context: {},
      });
    });

    it('should return empty array when getUserActions fails', async () => {
      UserActionTracker.getUserActions.mockRejectedValueOnce(new Error('fail'));

      const actions = await CrashReporter.getRecentUserActions();
      expect(actions).toEqual([]);
    });
  });

  // ========================================================================
  // collectCrashData
  // ========================================================================
  describe('collectCrashData', () => {
    it('should return comprehensive crash data object', async () => {
      const error = new Error('Test error');
      const context = { filename: 'test.js' };

      const data = await CrashReporter.collectCrashData(error, context, 'high');

      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('crashId');
      expect(data.crashId).toMatch(/^crash_/);
      expect(data.severity).toBe('high');
      expect(data.error.name).toBe('Error');
      expect(data.error.message).toBe('Test error');
      expect(data.context).toEqual(context);
      expect(data.environment).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.system).toBeDefined();
    });

    it('should increment crashCount', async () => {
      expect(CrashReporter.crashCount).toBe(0);

      await CrashReporter.collectCrashData(new Error('e1'), {}, 'low');
      expect(CrashReporter.crashCount).toBe(1);

      await CrashReporter.collectCrashData(new Error('e2'), {}, 'low');
      expect(CrashReporter.crashCount).toBe(2);
    });

    it('should track lastCrashTime', async () => {
      expect(CrashReporter.lastCrashTime).toBeNull();

      await CrashReporter.collectCrashData(new Error('e'), {}, 'low');
      expect(CrashReporter.lastCrashTime).toBeDefined();
      expect(typeof CrashReporter.lastCrashTime).toBe('number');
    });

    it('should include timeSinceLastCrash when there was a previous crash', async () => {
      await CrashReporter.collectCrashData(new Error('e1'), {}, 'low');
      const data = await CrashReporter.collectCrashData(new Error('e2'), {}, 'low');

      expect(data.system.timeSinceLastCrash).toBeDefined();
      expect(data.system.timeSinceLastCrash).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================================================
  // reportCrash
  // ========================================================================
  describe('reportCrash', () => {
    it('should store error report via ErrorReportService', async () => {
      const crashData = {
        crashId: 'crash_123',
        error: { message: 'test', stack: 'stack' },
        context: {},
        severity: 'high',
        timestamp: new Date().toISOString(),
        user: {},
      };

      await CrashReporter.reportCrash('javascript_error', crashData);

      expect(ErrorReportService.storeErrorReport).toHaveBeenCalledWith(
        expect.objectContaining({
          errorId: 'crash_123',
          errorType: 'javascript_error',
          severity: 'high',
        })
      );
    });

    it('should add to recentErrors list', async () => {
      const crashData = {
        crashId: 'crash_456',
        error: { message: 'test error', stack: '' },
        context: {},
        severity: 'medium',
        timestamp: new Date().toISOString(),
        user: {},
      };

      await CrashReporter.reportCrash('test_type', crashData);

      expect(CrashReporter.recentErrors).toHaveLength(1);
      expect(CrashReporter.recentErrors[0].type).toBe('test_type');
      expect(CrashReporter.recentErrors[0].message).toBe('test error');
    });

    it('should keep only last 10 errors', async () => {
      for (let i = 0; i < 15; i++) {
        await CrashReporter.reportCrash('type', {
          crashId: `crash_${i}`,
          error: { message: `error ${i}`, stack: '' },
          context: {},
          severity: 'low',
          timestamp: new Date().toISOString(),
          user: {},
        });
      }

      expect(CrashReporter.recentErrors).toHaveLength(10);
      // Should keep the last 10
      expect(CrashReporter.recentErrors[0].message).toBe('error 5');
    });

    it('should throw when ErrorReportService fails', async () => {
      ErrorReportService.storeErrorReport.mockRejectedValueOnce(new Error('storage fail'));

      await expect(
        CrashReporter.reportCrash('type', {
          crashId: 'crash_err',
          error: { message: 'x', stack: '' },
          context: {},
          severity: 'low',
          timestamp: new Date().toISOString(),
          user: {},
        })
      ).rejects.toThrow('storage fail');
    });
  });

  // ========================================================================
  // handleJavaScriptError
  // ========================================================================
  describe('handleJavaScriptError', () => {
    it('should track error, report crash, and log', async () => {
      const error = new Error('JS error');
      const context = { filename: 'app.js', lineno: 42 };

      const result = await CrashReporter.handleJavaScriptError(error, context);

      expect(UserActionTracker.trackError).toHaveBeenCalledWith(error, expect.any(Object));
      expect(ErrorReportService.storeErrorReport).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.error.message).toBe('JS error');
    });

    it('should use logger.fatal for CRITICAL severity errors', async () => {
      const error = new ReferenceError('x is not defined');

      await CrashReporter.handleJavaScriptError(error, {});

      expect(logger.fatal).toHaveBeenCalledWith(
        'JavaScript error occurred',
        expect.any(Object),
        error
      );
    });

    it('should use logger.error for non-CRITICAL errors', async () => {
      const error = new Error('Non-critical');

      await CrashReporter.handleJavaScriptError(error, {});

      expect(logger.error).toHaveBeenCalledWith(
        'JavaScript error occurred',
        expect.any(Object),
        error
      );
    });

    it('should not throw when reporting fails', async () => {
      ErrorReportService.storeErrorReport.mockRejectedValueOnce(new Error('fail'));

      // Should not throw
      const result = await CrashReporter.handleJavaScriptError(new Error('e'), {});
      expect(result).toBeUndefined(); // returns undefined from catch
    });
  });

  // ========================================================================
  // handlePromiseRejection
  // ========================================================================
  describe('handlePromiseRejection', () => {
    it('should handle Error reason', async () => {
      const reason = new Error('Promise failed');

      const result = await CrashReporter.handlePromiseRejection(reason, {});

      expect(result.error.message).toBe('Promise failed');
      expect(result.severity).toBe('medium');
      expect(logger.error).toHaveBeenCalledWith(
        'Unhandled promise rejection',
        expect.objectContaining({ reason: 'Error: Promise failed' }),
        reason
      );
    });

    it('should wrap non-Error reason in Error', async () => {
      const reason = 'string rejection';

      const result = await CrashReporter.handlePromiseRejection(reason, {});

      expect(result.error.message).toBe('string rejection');
    });

    it('should not throw when reporting fails', async () => {
      ErrorReportService.storeErrorReport.mockRejectedValueOnce(new Error('fail'));

      const result = await CrashReporter.handlePromiseRejection(new Error('e'), {});
      expect(result).toBeUndefined();
    });
  });

  // ========================================================================
  // handleReactError
  // ========================================================================
  describe('handleReactError', () => {
    it('should handle React component errors with HIGH severity', async () => {
      const error = new Error('React render failed');
      const errorInfo = {
        componentStack: 'in App > in Router',
        errorBoundary: 'AppBoundary',
      };

      const result = await CrashReporter.handleReactError(error, errorInfo);

      expect(result.severity).toBe('high');
      expect(result.context.type).toBe('react_error');
      expect(result.context.componentStack).toBe('in App > in Router');
      expect(logger.fatal).toHaveBeenCalled();
    });

    it('should not throw when reporting fails', async () => {
      ErrorReportService.storeErrorReport.mockRejectedValueOnce(new Error('fail'));

      const result = await CrashReporter.handleReactError(
        new Error('e'),
        { componentStack: '', errorBoundary: '' }
      );
      expect(result).toBeUndefined();
    });
  });

  // ========================================================================
  // setupReactErrorHandling
  // ========================================================================
  describe('setupReactErrorHandling', () => {
    it('should set window.reportReactError function', () => {
      CrashReporter.setupReactErrorHandling();
      expect(typeof window.reportReactError).toBe('function');
    });
  });

  // ========================================================================
  // getCrashPatterns
  // ========================================================================
  describe('getCrashPatterns', () => {
    it('should return empty patterns when no errors exist', () => {
      const patterns = CrashReporter.getCrashPatterns();
      expect(patterns.rapidCrashes).toBe(0);
      expect(patterns.repeatingErrors).toEqual({});
      expect(patterns.highSeverityCrashes).toBe(0);
    });

    it('should count rapid crashes from last 5 minutes', () => {
      CrashReporter.recentErrors = [
        { message: 'err1', severity: 'low', timestamp: new Date().toISOString() },
        { message: 'err2', severity: 'low', timestamp: new Date().toISOString() },
        { message: 'err3', severity: 'high', timestamp: new Date().toISOString() },
      ];

      const patterns = CrashReporter.getCrashPatterns();
      expect(patterns.rapidCrashes).toBe(3);
      expect(patterns.highSeverityCrashes).toBe(1);
    });

    it('should count repeating error messages', () => {
      CrashReporter.recentErrors = [
        { message: 'Same error', severity: 'low', timestamp: new Date().toISOString() },
        { message: 'Same error', severity: 'low', timestamp: new Date().toISOString() },
        { message: 'Different error', severity: 'low', timestamp: new Date().toISOString() },
      ];

      const patterns = CrashReporter.getCrashPatterns();
      expect(patterns.repeatingErrors['Same error']).toBe(2);
      expect(patterns.repeatingErrors['Different error']).toBe(1);
    });

    it('should count high and critical severity crashes', () => {
      CrashReporter.recentErrors = [
        { message: 'e1', severity: 'critical', timestamp: new Date().toISOString() },
        { message: 'e2', severity: 'high', timestamp: new Date().toISOString() },
        { message: 'e3', severity: 'medium', timestamp: new Date().toISOString() },
        { message: 'e4', severity: 'low', timestamp: new Date().toISOString() },
      ];

      const patterns = CrashReporter.getCrashPatterns();
      expect(patterns.highSeverityCrashes).toBe(2);
    });

    it('should not count old crashes as rapid', () => {
      const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
      CrashReporter.recentErrors = [
        { message: 'old error', severity: 'low', timestamp: oldTimestamp },
      ];

      const patterns = CrashReporter.getCrashPatterns();
      expect(patterns.rapidCrashes).toBe(0);
    });
  });

  // ========================================================================
  // getCrashStatistics
  // ========================================================================
  describe('getCrashStatistics', () => {
    it('should return crash statistics with all fields', () => {
      const stats = CrashReporter.getCrashStatistics();
      expect(stats).toHaveProperty('totalCrashes');
      expect(stats).toHaveProperty('lastCrashTime');
      expect(stats).toHaveProperty('recentErrors');
      expect(stats).toHaveProperty('patterns');
      expect(stats).toHaveProperty('isHealthy');
    });

    it('should report healthy when crashCount < 5 and recentErrors < 3', () => {
      CrashReporter.crashCount = 2;
      CrashReporter.recentErrors = [{ message: 'e' }];

      const stats = CrashReporter.getCrashStatistics();
      expect(stats.isHealthy).toBe(true);
    });

    it('should report unhealthy when crashCount >= 5', () => {
      CrashReporter.crashCount = 5;
      CrashReporter.recentErrors = [];

      const stats = CrashReporter.getCrashStatistics();
      expect(stats.isHealthy).toBe(false);
    });

    it('should report unhealthy when recentErrors >= 3', () => {
      CrashReporter.crashCount = 0;
      CrashReporter.recentErrors = [
        { message: 'e1' },
        { message: 'e2' },
        { message: 'e3' },
      ];

      const stats = CrashReporter.getCrashStatistics();
      expect(stats.isHealthy).toBe(false);
    });
  });

  // ========================================================================
  // reportCriticalIssue
  // ========================================================================
  describe('reportCriticalIssue', () => {
    it('should create a CriticalIssue error and handle it', async () => {
      await CrashReporter.reportCriticalIssue('Database corruption detected', {
        store: 'problems',
      });

      expect(UserActionTracker.trackError).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'CriticalIssue',
          message: 'Database corruption detected',
        }),
        expect.any(Object)
      );
    });
  });

  // ========================================================================
  // initialize
  // ========================================================================
  describe('initialize', () => {
    it('should set isInitialized to true', () => {
      CrashReporter.initialize();
      expect(CrashReporter.isInitialized).toBe(true);
    });

    it('should not reinitialize when already initialized', () => {
      CrashReporter.initialize();
      const addListenerCount = window.addEventListener.mock?.calls?.length || 0;

      CrashReporter.initialize();
      // Should not add more listeners
      const afterCount = window.addEventListener.mock?.calls?.length || 0;
      // The count should be the same since it returns early
      expect(afterCount).toBe(addListenerCount);
    });

    it('should log initialization', () => {
      CrashReporter.initialize();
      expect(logger.info).toHaveBeenCalledWith(
        'Crash reporting initialized',
        expect.objectContaining({ section: 'crash_reporter' })
      );
    });
  });
});
