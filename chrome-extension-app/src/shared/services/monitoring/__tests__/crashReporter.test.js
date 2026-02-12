/**
 * Unit tests for CrashReporter
 * Tests severity determination, crash data collection, pattern detection,
 * statistics, and queue management.
 */

// Mock logger first, before all other imports
jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
    sessionId: 'test-session-id',
  },
}));

jest.mock('../ErrorReportService.js', () => ({
  ErrorReportService: {
    storeErrorReport: jest.fn().mockResolvedValue('stored'),
  },
}));

jest.mock('../../chrome/userActionTracker.js', () => ({
  UserActionTracker: {
    trackError: jest.fn().mockResolvedValue(undefined),
    getUserActions: jest.fn().mockResolvedValue([]),
    sessionStart: Date.now(),
  },
}));

jest.mock('../../../utils/performance/PerformanceMonitor.js', () => ({
  __esModule: true,
  default: {
    getPerformanceSummary: jest.fn().mockReturnValue({
      systemMetrics: {},
      recentAlerts: [],
    }),
    getSystemHealth: jest.fn().mockReturnValue('good'),
  },
}));

import { CrashReporter } from '../crashReporter.js';
import { ErrorReportService } from '../ErrorReportService.js';

describe('CrashReporter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset static state between tests
    CrashReporter.isInitialized = false;
    CrashReporter.crashCount = 0;
    CrashReporter.lastCrashTime = null;
    CrashReporter.recentErrors = [];
  });

  // -----------------------------------------------------------------------
  // SEVERITY
  // -----------------------------------------------------------------------
  describe('determineSeverity', () => {
    it('returns CRITICAL for ReferenceError', () => {
      const error = new ReferenceError('foo is not defined');
      const severity = CrashReporter.determineSeverity(error, {});
      expect(severity).toBe(CrashReporter.SEVERITY.CRITICAL);
    });

    it('returns CRITICAL when filename includes background.js', () => {
      const error = new Error('some error');
      const severity = CrashReporter.determineSeverity(error, { filename: '/background.js' });
      expect(severity).toBe(CrashReporter.SEVERITY.CRITICAL);
    });

    it('returns HIGH for TypeError', () => {
      const error = new TypeError('bad type');
      const severity = CrashReporter.determineSeverity(error, {});
      expect(severity).toBe(CrashReporter.SEVERITY.HIGH);
    });

    it('returns HIGH for IndexedDB errors', () => {
      const error = new Error('IndexedDB quota exceeded');
      const severity = CrashReporter.determineSeverity(error, {});
      expect(severity).toBe(CrashReporter.SEVERITY.HIGH);
    });

    it('returns MEDIUM for generic Error', () => {
      const error = new Error('something went wrong');
      const severity = CrashReporter.determineSeverity(error, {});
      expect(severity).toBe(CrashReporter.SEVERITY.MEDIUM);
    });

    it('returns LOW for unknown error type', () => {
      const error = { name: 'CustomError', message: 'custom', stack: '' };
      const severity = CrashReporter.determineSeverity(error, {});
      expect(severity).toBe(CrashReporter.SEVERITY.LOW);
    });
  });

  // -----------------------------------------------------------------------
  // getCrashStatistics
  // -----------------------------------------------------------------------
  describe('getCrashStatistics', () => {
    it('returns correct shape with zero crashes', () => {
      const stats = CrashReporter.getCrashStatistics();

      expect(stats).toMatchObject({
        totalCrashes: 0,
        lastCrashTime: null,
        recentErrors: 0,
        patterns: expect.any(Object),
        isHealthy: true,
      });
    });

    it('isHealthy is false when crash count >= 5', () => {
      CrashReporter.crashCount = 5;
      const stats = CrashReporter.getCrashStatistics();
      expect(stats.isHealthy).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // getCrashPatterns
  // -----------------------------------------------------------------------
  describe('getCrashPatterns', () => {
    it('returns correct shape', () => {
      const patterns = CrashReporter.getCrashPatterns();

      expect(patterns).toMatchObject({
        rapidCrashes: expect.any(Number),
        repeatingErrors: expect.any(Object),
        highSeverityCrashes: expect.any(Number),
      });
    });

    it('counts high severity crashes correctly', () => {
      CrashReporter.recentErrors = [
        { type: 'js', severity: 'critical', timestamp: new Date().toISOString(), message: 'err1' },
        { type: 'js', severity: 'high', timestamp: new Date().toISOString(), message: 'err2' },
        { type: 'js', severity: 'low', timestamp: new Date().toISOString(), message: 'err3' },
      ];

      const patterns = CrashReporter.getCrashPatterns();

      expect(patterns.highSeverityCrashes).toBe(2);
    });

    it('detects rapid crashes (within last 5 minutes)', () => {
      const now = new Date().toISOString();
      CrashReporter.recentErrors = [
        { type: 'js', severity: 'medium', timestamp: now, message: 'a' },
        { type: 'js', severity: 'medium', timestamp: now, message: 'b' },
      ];

      const patterns = CrashReporter.getCrashPatterns();

      expect(patterns.rapidCrashes).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // reportCrash
  // -----------------------------------------------------------------------
  describe('reportCrash', () => {
    it('stores crash and appends to recentErrors', async () => {
      const crashData = {
        crashId: 'crash_123',
        error: { message: 'test error', stack: 'stack', name: 'Error' },
        context: {},
        user: {},
        severity: 'medium',
        timestamp: new Date().toISOString(),
      };

      await CrashReporter.reportCrash('javascript_error', crashData);

      expect(ErrorReportService.storeErrorReport).toHaveBeenCalledTimes(1);
      expect(CrashReporter.recentErrors).toHaveLength(1);
    });

    it('keeps only last 10 errors in recentErrors', async () => {
      // Pre-fill with 10 errors
      CrashReporter.recentErrors = Array.from({ length: 10 }, (_, i) => ({
        type: 'js',
        severity: 'low',
        timestamp: new Date().toISOString(),
        message: `err${i}`,
      }));

      const crashData = {
        crashId: 'crash_new',
        error: { message: 'new error', stack: '', name: 'Error' },
        context: {},
        user: {},
        severity: 'low',
        timestamp: new Date().toISOString(),
      };

      await CrashReporter.reportCrash('javascript_error', crashData);

      expect(CrashReporter.recentErrors).toHaveLength(10);
    });
  });

  // -----------------------------------------------------------------------
  // SEVERITY constant shape
  // -----------------------------------------------------------------------
  describe('SEVERITY constants', () => {
    it('has all expected severity levels', () => {
      expect(CrashReporter.SEVERITY).toMatchObject({
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        CRITICAL: 'critical',
      });
    });
  });
});
