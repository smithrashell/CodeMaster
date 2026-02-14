/**
 * AlertingService comprehensive tests.
 *
 * AlertingService is an in-memory, static-class monitoring system.
 * It does not use IndexedDB directly but depends on PerformanceMonitor,
 * ErrorReportService, UserActionTracker, and localStorage.
 * All external dependencies are mocked so we can exercise every public
 * method in isolation.
 */

// ---------------------------------------------------------------------------
// 1. Mocks (hoisted before imports)
// ---------------------------------------------------------------------------
jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock('../../../utils/performance/PerformanceMonitor.js', () => ({
  __esModule: true,
  default: {
    getPerformanceSummary: jest.fn(() => ({
      systemMetrics: { averageQueryTime: 100, errorRate: 0 },
      health: 'good',
    })),
    recordMemoryUsage: jest.fn(),
  },
}));

jest.mock('../ErrorReportService.js', () => ({
  ErrorReportService: {
    getErrorReports: jest.fn(async () => []),
  },
}));

jest.mock('../../chrome/userActionTracker.js', () => ({
  UserActionTracker: {
    trackAction: jest.fn(),
    CATEGORIES: { SYSTEM_INTERACTION: 'system_interaction' },
  },
}));

jest.mock('../AlertingServiceHelpers.js', () => ({
  triggerStreakAlert: jest.fn(),
  triggerCadenceAlert: jest.fn(),
  triggerWeeklyGoalAlert: jest.fn(),
  triggerReEngagementAlert: jest.fn(),
  routeToSession: jest.fn(),
  routeToProgress: jest.fn(),
  routeToDashboard: jest.fn(),
  fallbackRoute: jest.fn(),
  sendStreakAlert: jest.fn(),
  sendCadenceNudge: jest.fn(),
  sendWeeklyGoalReminder: jest.fn(),
  sendReEngagementPrompt: jest.fn(),
  sendFocusAreaReminder: jest.fn(),
  snoozeAlert: jest.fn(),
  isAlertSnoozed: jest.fn(() => false),
  createDismissHandler: jest.fn((type) => (alert) => alert.type !== type),
  getAlertStatistics: jest.fn(() => ({
    total24h: 0,
    bySeverity: {},
    byType: {},
    recentAlerts: [],
  })),
}));

// ---------------------------------------------------------------------------
// 2. Imports
// ---------------------------------------------------------------------------
import { AlertingService } from '../alertingService.js';
import logger from '../../../utils/logging/logger.js';
import performanceMonitor from '../../../utils/performance/PerformanceMonitor.js';
import { ErrorReportService } from '../ErrorReportService.js';
import { UserActionTracker } from '../../chrome/userActionTracker.js';
import {
  triggerStreakAlert as triggerStreakAlertHelper,
  triggerCadenceAlert as triggerCadenceAlertHelper,
  triggerWeeklyGoalAlert as triggerWeeklyGoalAlertHelper,
  triggerReEngagementAlert as triggerReEngagementAlertHelper,
  createDismissHandler,
} from '../AlertingServiceHelpers.js';

// ---------------------------------------------------------------------------
// 3. Helpers
// ---------------------------------------------------------------------------
function resetService() {
  AlertingService.isActive = false;
  AlertingService.alertQueue = [];
  AlertingService.alertChannels = [];
  AlertingService.lastAlerts = {};
  AlertingService.thresholds = {
    errorRate: 10,
    crashRate: 5,
    performanceDegraded: 2000,
    memoryUsage: 100 * 1024 * 1024,
    userInactivity: 30 * 60 * 1000,
    rapidErrors: 5,
  };
  AlertingService.suppressionPeriod = 5 * 60 * 1000;

  // Clear localStorage mocks
  try { localStorage.clear(); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// 4. Test suite
// ---------------------------------------------------------------------------
describe('AlertingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    resetService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // initialize
  // -----------------------------------------------------------------------
  describe('initialize()', () => {
    it('should set isActive to true on first call', () => {
      AlertingService.initialize();
      expect(AlertingService.isActive).toBe(true);
    });

    it('should not re-initialize if already active', () => {
      AlertingService.initialize();
      const channelCount = AlertingService.alertChannels.length;
      AlertingService.initialize();
      // Channels should not double
      expect(AlertingService.alertChannels.length).toBe(channelCount);
    });

    it('should merge custom thresholds with defaults', () => {
      AlertingService.initialize({ thresholds: { errorRate: 25 } });
      expect(AlertingService.thresholds.errorRate).toBe(25);
      // Other defaults remain
      expect(AlertingService.thresholds.crashRate).toBe(5);
    });

    it('should log initialization', () => {
      AlertingService.initialize();
      expect(logger.info).toHaveBeenCalledWith(
        'Alerting service initialized',
        expect.objectContaining({ section: 'alerting' }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // addAlertChannel / removeAlertChannel
  // -----------------------------------------------------------------------
  describe('addAlertChannel()', () => {
    it('should add a channel to the list', () => {
      const channel = { name: 'test', handler: jest.fn() };
      AlertingService.addAlertChannel(channel);
      expect(AlertingService.alertChannels).toContainEqual(channel);
    });

    it('should throw if name is missing', () => {
      expect(() => AlertingService.addAlertChannel({ handler: jest.fn() }))
        .toThrow('Alert channel must have name and handler');
    });

    it('should throw if handler is missing', () => {
      expect(() => AlertingService.addAlertChannel({ name: 'bad' }))
        .toThrow('Alert channel must have name and handler');
    });
  });

  describe('removeAlertChannel()', () => {
    it('should remove an existing channel by name', () => {
      AlertingService.addAlertChannel({ name: 'removeme', handler: jest.fn() });
      expect(AlertingService.alertChannels.length).toBe(1);

      AlertingService.removeAlertChannel('removeme');
      expect(AlertingService.alertChannels.length).toBe(0);
    });

    it('should do nothing when removing a non-existent channel', () => {
      AlertingService.addAlertChannel({ name: 'keep', handler: jest.fn() });
      AlertingService.removeAlertChannel('ghost');
      expect(AlertingService.alertChannels.length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // queueAlert & suppression
  // -----------------------------------------------------------------------
  describe('queueAlert()', () => {
    it('should add an alert to the queue', () => {
      AlertingService.queueAlert({
        type: 'test_alert',
        severity: 'warning',
        title: 'Test',
        message: 'msg',
      });
      expect(AlertingService.alertQueue.length).toBe(1);
      expect(AlertingService.alertQueue[0].type).toBe('test_alert');
    });

    it('should enrich the alert with id, timestamp, and environment', () => {
      AlertingService.queueAlert({
        type: 'enriched',
        severity: 'info',
        title: 'Enrichment',
        message: 'check fields',
      });
      const alert = AlertingService.alertQueue[0];
      expect(alert.id).toMatch(/^alert_/);
      expect(alert.timestamp).toBeDefined();
      expect(alert.environment).toBeDefined();
    });

    it('should suppress duplicate alerts within the suppression period', () => {
      const alertDef = { type: 'dup', severity: 'error', title: 'Dup', message: 'm' };

      AlertingService.queueAlert(alertDef);
      AlertingService.queueAlert(alertDef); // same type+severity, should be suppressed

      expect(AlertingService.alertQueue.length).toBe(1);
    });

    it('should allow same alert after suppression period expires', () => {
      const alertDef = { type: 'timed', severity: 'error', title: 'T', message: 'm' };

      AlertingService.queueAlert(alertDef);
      expect(AlertingService.alertQueue.length).toBe(1);

      // Advance past the suppression period
      jest.advanceTimersByTime(AlertingService.suppressionPeriod + 1000);

      AlertingService.queueAlert(alertDef);
      expect(AlertingService.alertQueue.length).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // processAlertQueue
  // -----------------------------------------------------------------------
  describe('processAlertQueue()', () => {
    it('should do nothing when queue is empty', () => {
      AlertingService.processAlertQueue();
      expect(AlertingService.alertQueue).toEqual([]);
    });

    it('should send all queued alerts and clear the queue', () => {
      const handler = jest.fn();
      AlertingService.addAlertChannel({ name: 'spy', handler });

      AlertingService.alertQueue = [
        { id: '1', type: 'a', severity: 'info', title: 'A', message: 'a' },
        { id: '2', type: 'b', severity: 'error', title: 'B', message: 'b' },
      ];

      AlertingService.processAlertQueue();

      expect(handler).toHaveBeenCalledTimes(2);
      expect(AlertingService.alertQueue).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // sendAlert
  // -----------------------------------------------------------------------
  describe('sendAlert()', () => {
    it('should invoke all channel handlers', () => {
      const h1 = jest.fn();
      const h2 = jest.fn();
      AlertingService.addAlertChannel({ name: 'c1', handler: h1 });
      AlertingService.addAlertChannel({ name: 'c2', handler: h2 });

      const alert = { type: 'x', severity: 'info', title: 'X', message: 'msg' };
      AlertingService.sendAlert(alert);

      expect(h1).toHaveBeenCalledWith(alert);
      expect(h2).toHaveBeenCalledWith(alert);
    });

    it('should track the alert via UserActionTracker', () => {
      AlertingService.addAlertChannel({ name: 'noop', handler: jest.fn() });
      AlertingService.sendAlert({
        type: 'tracked',
        severity: 'warning',
        title: 'Tracked',
        message: 'msg',
      });

      expect(UserActionTracker.trackAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'alert_triggered',
          context: expect.objectContaining({ alertType: 'tracked' }),
        }),
      );
    });

    it('should not throw if a channel handler throws', () => {
      const badHandler = jest.fn(() => { throw new Error('boom'); });
      AlertingService.addAlertChannel({ name: 'bad', handler: badHandler });

      expect(() =>
        AlertingService.sendAlert({ type: 'safe', severity: 'info', title: 'S', message: '' }),
      ).not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getAlertEmoji
  // -----------------------------------------------------------------------
  describe('getAlertEmoji()', () => {
    it.each([
      ['info', String.fromCodePoint(0x2139, 0xFE0F)],
      ['warning', String.fromCodePoint(0x26A0, 0xFE0F)],
      ['critical', String.fromCodePoint(0x1F6A8)],
    ])('should return correct emoji for severity "%s"', (severity, expected) => {
      expect(AlertingService.getAlertEmoji(severity)).toBe(expected);
    });

    it('should return default emoji for unknown severity', () => {
      const result = AlertingService.getAlertEmoji('unknown');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  // -----------------------------------------------------------------------
  // triggerAlert (manual)
  // -----------------------------------------------------------------------
  describe('triggerAlert()', () => {
    it('should queue an alert with manual_ prefix on type', () => {
      AlertingService.triggerAlert('deploy', 'new deploy', 'warning', { v: '2.0' });

      expect(AlertingService.alertQueue.length).toBe(1);
      const alert = AlertingService.alertQueue[0];
      expect(alert.type).toBe('manual_deploy');
      expect(alert.severity).toBe('warning');
      expect(alert.title).toBe('Manual Alert: deploy');
      expect(alert.message).toBe('new deploy');
      expect(alert.data).toEqual({ v: '2.0' });
    });

    it('should default severity to info', () => {
      AlertingService.triggerAlert('test', 'msg');
      expect(AlertingService.alertQueue[0].severity).toBe('info');
    });
  });

  // -----------------------------------------------------------------------
  // updateThresholds
  // -----------------------------------------------------------------------
  describe('updateThresholds()', () => {
    it('should merge new thresholds with existing ones', () => {
      AlertingService.updateThresholds({ errorRate: 50, crashRate: 20 });
      expect(AlertingService.thresholds.errorRate).toBe(50);
      expect(AlertingService.thresholds.crashRate).toBe(20);
      // Unchanged threshold remains
      expect(AlertingService.thresholds.performanceDegraded).toBe(2000);
    });

    it('should log the update', () => {
      AlertingService.updateThresholds({ errorRate: 1 });
      expect(logger.info).toHaveBeenCalledWith(
        'Alert thresholds updated',
        expect.objectContaining({ section: 'alerting' }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // setActive
  // -----------------------------------------------------------------------
  describe('setActive()', () => {
    it('should set isActive to the given value', () => {
      AlertingService.setActive(true);
      expect(AlertingService.isActive).toBe(true);
      AlertingService.setActive(false);
      expect(AlertingService.isActive).toBe(false);
    });

    it('should log the state change', () => {
      AlertingService.setActive(true);
      expect(logger.info).toHaveBeenCalledWith(
        'Alerting enabled',
        expect.objectContaining({ section: 'alerting' }),
      );
      AlertingService.setActive(false);
      expect(logger.info).toHaveBeenCalledWith(
        'Alerting disabled',
        expect.objectContaining({ section: 'alerting' }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // clearAlerts
  // -----------------------------------------------------------------------
  describe('clearAlerts()', () => {
    it('should empty the alert queue and lastAlerts', () => {
      AlertingService.alertQueue = [{ type: 'x' }];
      AlertingService.lastAlerts = { x_info: Date.now() };

      AlertingService.clearAlerts();

      expect(AlertingService.alertQueue).toEqual([]);
      expect(AlertingService.lastAlerts).toEqual({});
    });

    it('should remove alerts from localStorage', () => {
      localStorage.setItem('codemaster_alerts', JSON.stringify([{ type: 'old' }]));
      AlertingService.clearAlerts();
      expect(localStorage.getItem('codemaster_alerts')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // checkPerformanceHealth
  // -----------------------------------------------------------------------
  describe('checkPerformanceHealth()', () => {
    it('should not queue alerts when metrics are healthy', () => {
      performanceMonitor.getPerformanceSummary.mockReturnValue({
        systemMetrics: { averageQueryTime: 100, errorRate: 0 },
        health: 'good',
      });
      AlertingService.checkPerformanceHealth();
      expect(AlertingService.alertQueue.length).toBe(0);
    });

    it('should queue performance_degraded alert when query time exceeds threshold', () => {
      performanceMonitor.getPerformanceSummary.mockReturnValue({
        systemMetrics: { averageQueryTime: 3000, errorRate: 0 },
        health: 'good',
      });
      AlertingService.checkPerformanceHealth();
      const alert = AlertingService.alertQueue.find((a) => a.type === 'performance_degraded');
      expect(alert).toBeDefined();
      expect(alert.severity).toBe('warning');
    });

    it('should queue high_error_rate alert when error rate exceeds threshold', () => {
      performanceMonitor.getPerformanceSummary.mockReturnValue({
        systemMetrics: { averageQueryTime: 100, errorRate: 15 },
        health: 'good',
      });
      AlertingService.checkPerformanceHealth();
      const alert = AlertingService.alertQueue.find((a) => a.type === 'high_error_rate');
      expect(alert).toBeDefined();
      expect(alert.severity).toBe('error');
    });

    it('should queue system_health_critical when health is critical', () => {
      performanceMonitor.getPerformanceSummary.mockReturnValue({
        systemMetrics: { averageQueryTime: 100, errorRate: 0 },
        health: 'critical',
      });
      AlertingService.checkPerformanceHealth();
      const alert = AlertingService.alertQueue.find((a) => a.type === 'system_health_critical');
      expect(alert).toBeDefined();
      expect(alert.severity).toBe('critical');
    });

    it('should not throw when getPerformanceSummary throws', () => {
      performanceMonitor.getPerformanceSummary.mockImplementation(() => {
        throw new Error('monitor down');
      });
      expect(() => AlertingService.checkPerformanceHealth()).not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // checkErrorPatterns
  // -----------------------------------------------------------------------
  describe('checkErrorPatterns()', () => {
    it('should not queue alerts when there are few recent errors', async () => {
      ErrorReportService.getErrorReports.mockResolvedValue([
        { message: 'oops' },
      ]);
      await AlertingService.checkErrorPatterns();
      expect(AlertingService.alertQueue.length).toBe(0);
    });

    it('should queue rapid_errors when error count exceeds threshold', async () => {
      const errors = Array.from({ length: 8 }, (_, i) => ({
        message: `error-${i}`,
      }));
      ErrorReportService.getErrorReports.mockResolvedValue(errors);

      await AlertingService.checkErrorPatterns();

      const alert = AlertingService.alertQueue.find((a) => a.type === 'rapid_errors');
      expect(alert).toBeDefined();
      expect(alert.data.errorCount).toBe(8);
    });

    it('should queue repeating_errors when same message appears 3+ times', async () => {
      const errors = [
        { message: 'Same error keeps happening over and over again here' },
        { message: 'Same error keeps happening over and over again here' },
        { message: 'Same error keeps happening over and over again here' },
      ];
      ErrorReportService.getErrorReports.mockResolvedValue(errors);

      await AlertingService.checkErrorPatterns();

      const alert = AlertingService.alertQueue.find((a) => a.type === 'repeating_errors');
      expect(alert).toBeDefined();
      expect(alert.severity).toBe('warning');
    });

    it('should not throw when getErrorReports rejects', async () => {
      ErrorReportService.getErrorReports.mockRejectedValue(new Error('db error'));
      await expect(AlertingService.checkErrorPatterns()).resolves.not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // checkCrashPatterns
  // -----------------------------------------------------------------------
  describe('checkCrashPatterns()', () => {
    it('should do nothing when CrashReporter is not on window', () => {
      delete window.CrashReporter;
      AlertingService.checkCrashPatterns();
      expect(AlertingService.alertQueue.length).toBe(0);
    });

    it('should queue high_crash_rate when crashes exceed threshold', () => {
      window.CrashReporter = {
        getCrashStatistics: jest.fn(() => ({
          totalCrashes: 10,
          isHealthy: true,
        })),
      };

      AlertingService.checkCrashPatterns();

      const alert = AlertingService.alertQueue.find((a) => a.type === 'high_crash_rate');
      expect(alert).toBeDefined();
      expect(alert.severity).toBe('critical');

      delete window.CrashReporter;
    });

    it('should queue system_instability when not healthy', () => {
      window.CrashReporter = {
        getCrashStatistics: jest.fn(() => ({
          totalCrashes: 1,
          isHealthy: false,
        })),
      };

      AlertingService.checkCrashPatterns();

      const alert = AlertingService.alertQueue.find((a) => a.type === 'system_instability');
      expect(alert).toBeDefined();

      delete window.CrashReporter;
    });
  });

  // -----------------------------------------------------------------------
  // checkResourceUsage
  // -----------------------------------------------------------------------
  describe('checkResourceUsage()', () => {
    it('should queue high_memory_usage when heap exceeds threshold', () => {
      Object.defineProperty(performance, 'memory', {
        configurable: true,
        get: () => ({ usedJSHeapSize: 200 * 1024 * 1024 }),
      });

      AlertingService.checkResourceUsage();

      const alert = AlertingService.alertQueue.find((a) => a.type === 'high_memory_usage');
      expect(alert).toBeDefined();
      expect(alert.severity).toBe('warning');

      // Cleanup
      Object.defineProperty(performance, 'memory', {
        configurable: true,
        get: () => undefined,
      });
    });

    it('should record memory usage via performanceMonitor', () => {
      Object.defineProperty(performance, 'memory', {
        configurable: true,
        get: () => ({ usedJSHeapSize: 5000 }),
      });

      AlertingService.checkResourceUsage();

      expect(performanceMonitor.recordMemoryUsage).toHaveBeenCalledWith(
        5000,
        'alerting_check',
      );

      Object.defineProperty(performance, 'memory', {
        configurable: true,
        get: () => undefined,
      });
    });
  });

  // -----------------------------------------------------------------------
  // Consistency alert wrappers
  // -----------------------------------------------------------------------
  describe('consistency alert wrappers', () => {
    it('triggerStreakAlert should delegate to helper', () => {
      AlertingService.triggerStreakAlert(10, 2);
      expect(triggerStreakAlertHelper).toHaveBeenCalledWith(
        expect.any(Function), // queueAlert bound
        expect.any(Function), // routeToSession
        expect.any(Function), // snoozeAlert bound
        10,
        2,
      );
    });

    it('triggerCadenceAlert should delegate to helper', () => {
      AlertingService.triggerCadenceAlert(3, 5);
      expect(triggerCadenceAlertHelper).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        3,
        5,
      );
    });

    it('triggerWeeklyGoalAlert should delegate to helper', () => {
      AlertingService.triggerWeeklyGoalAlert(2, 5, 3, true);
      expect(triggerWeeklyGoalAlertHelper).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        { completed: 2, goal: 5, daysLeft: 3, isMidWeek: true },
      );
    });

    it('triggerReEngagementAlert should delegate to helper', () => {
      AlertingService.triggerReEngagementAlert(7, 'friendly_weekly');
      expect(triggerReEngagementAlertHelper).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        7,
        'friendly_weekly',
      );
    });
  });

  // -----------------------------------------------------------------------
  // handleConsistencyAlerts
  // -----------------------------------------------------------------------
  describe('handleConsistencyAlerts()', () => {
    it('should do nothing with null or empty array', () => {
      AlertingService.handleConsistencyAlerts(null);
      AlertingService.handleConsistencyAlerts([]);
      expect(triggerStreakAlertHelper).not.toHaveBeenCalled();
    });

    it('should route streak_alert to triggerStreakAlert', () => {
      AlertingService.handleConsistencyAlerts([
        { type: 'streak_alert', data: { currentStreak: 5, daysSince: 1 } },
      ]);
      expect(triggerStreakAlertHelper).toHaveBeenCalled();
    });

    it('should route cadence_nudge to triggerCadenceAlert', () => {
      AlertingService.handleConsistencyAlerts([
        { type: 'cadence_nudge', data: { typicalGap: 2, actualGap: 4 } },
      ]);
      expect(triggerCadenceAlertHelper).toHaveBeenCalled();
    });

    it('should route weekly_goal to triggerWeeklyGoalAlert', () => {
      AlertingService.handleConsistencyAlerts([
        { type: 'weekly_goal', data: { completed: 1, goal: 5, daysLeft: 4, isMidWeek: true } },
      ]);
      expect(triggerWeeklyGoalAlertHelper).toHaveBeenCalled();
    });

    it('should route re_engagement to triggerReEngagementAlert', () => {
      AlertingService.handleConsistencyAlerts([
        { type: 're_engagement', data: { daysSinceLastSession: 10, messageType: 'supportive_biweekly' } },
      ]);
      expect(triggerReEngagementAlertHelper).toHaveBeenCalled();
    });

    it('should log warning for unknown alert type', () => {
      AlertingService.handleConsistencyAlerts([
        { type: 'unknown_type', data: {} },
      ]);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown consistency alert type'),
      );
    });
  });

  // -----------------------------------------------------------------------
  // dismissAlert
  // -----------------------------------------------------------------------
  describe('dismissAlert()', () => {
    it('should filter out alerts of the given type from the queue', () => {
      AlertingService.alertQueue = [
        { type: 'keep', message: 'stay' },
        { type: 'remove_me', message: 'go' },
        { type: 'keep', message: 'also stay' },
      ];

      AlertingService.dismissAlert('remove_me');

      expect(AlertingService.alertQueue.length).toBe(2);
      expect(AlertingService.alertQueue.every((a) => a.type === 'keep')).toBe(true);
    });

    it('should call createDismissHandler with the correct type', () => {
      AlertingService.alertQueue = [];
      AlertingService.dismissAlert('test_type');
      expect(createDismissHandler).toHaveBeenCalledWith('test_type');
    });
  });

  // -----------------------------------------------------------------------
  // setupDefaultChannels (tested indirectly through initialize)
  // -----------------------------------------------------------------------
  describe('setupDefaultChannels()', () => {
    it('should add console and localStorage channels at minimum', () => {
      AlertingService.setupDefaultChannels();

      const names = AlertingService.alertChannels.map((c) => c.name);
      expect(names).toContain('console');
      expect(names).toContain('localStorage');
    });

    it('console channel handler should call logger.error', () => {
      AlertingService.setupDefaultChannels();
      const consoleChannel = AlertingService.alertChannels.find((c) => c.name === 'console');

      consoleChannel.handler({ severity: 'error', title: 'Test' });
      expect(logger.error).toHaveBeenCalled();
    });

    it('localStorage channel handler should store alerts', () => {
      AlertingService.setupDefaultChannels();
      const lsChannel = AlertingService.alertChannels.find((c) => c.name === 'localStorage');

      lsChannel.handler({ severity: 'info', title: 'LS Test', timestamp: new Date().toISOString() });

      const stored = JSON.parse(localStorage.getItem('codemaster_alerts'));
      expect(stored.length).toBe(1);
      expect(stored[0].title).toBe('LS Test');
    });

    it('localStorage channel should keep only last 20 alerts', () => {
      AlertingService.setupDefaultChannels();
      const lsChannel = AlertingService.alertChannels.find((c) => c.name === 'localStorage');

      // Store 25 alerts
      for (let i = 0; i < 25; i++) {
        lsChannel.handler({ severity: 'info', title: `Alert ${i}` });
      }

      const stored = JSON.parse(localStorage.getItem('codemaster_alerts'));
      expect(stored.length).toBe(20);
      // Should keep the last 20 (indices 5-24)
      expect(stored[0].title).toBe('Alert 5');
    });
  });
});
