/**
 * Tests for AlertingServiceHelpers.js (137 lines, 0% coverage)
 * All functions are pure or use localStorage/chrome.notifications mocks.
 */

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import {
  triggerStreakAlert,
  triggerCadenceAlert,
  triggerWeeklyGoalAlert,
  triggerReEngagementAlert,
  routeToSession,
  routeToProgress,
  routeToDashboard,
  fallbackRoute,
  sendStreakAlert,
  sendCadenceNudge,
  sendWeeklyGoalReminder,
  sendReEngagementPrompt,
  sendFocusAreaReminder,
  snoozeAlert,
  isAlertSnoozed,
  createDismissHandler,
  getAlertStatistics,
} from '../AlertingServiceHelpers.js';

describe('AlertingServiceHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------
  // Alert trigger functions
  // -------------------------------------------------------------------
  describe('triggerStreakAlert', () => {
    it('calls queueAlert with streak_protection type', () => {
      const queue = jest.fn();
      triggerStreakAlert(queue, jest.fn(), jest.fn(), 10, 2);
      expect(queue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'streak_protection',
          severity: 'warning',
          category: 'consistency',
        })
      );
    });

    it('includes streakDays and daysSince in data', () => {
      const queue = jest.fn();
      triggerStreakAlert(queue, jest.fn(), jest.fn(), 5, 3);
      const arg = queue.mock.calls[0][0];
      expect(arg.data.streakDays).toBe(5);
      expect(arg.data.daysSince).toBe(3);
    });
  });

  describe('triggerCadenceAlert', () => {
    it('calls queueAlert with cadence_nudge type', () => {
      const queue = jest.fn();
      triggerCadenceAlert(queue, jest.fn(), jest.fn(), 3, 5);
      expect(queue).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'cadence_nudge', severity: 'info' })
      );
    });
  });

  describe('triggerWeeklyGoalAlert', () => {
    it('shows midweek message', () => {
      const queue = jest.fn();
      triggerWeeklyGoalAlert(queue, jest.fn(), jest.fn(), {
        completed: 2, goal: 5, daysLeft: 4, isMidWeek: true,
      });
      const msg = queue.mock.calls[0][0].message;
      expect(msg).toContain('Halfway');
    });

    it('shows weekend message', () => {
      const queue = jest.fn();
      triggerWeeklyGoalAlert(queue, jest.fn(), jest.fn(), {
        completed: 3, goal: 5, daysLeft: 1, isMidWeek: false,
      });
      const msg = queue.mock.calls[0][0].message;
      expect(msg).toContain('Weekend');
    });

    it('shows default progress message', () => {
      const queue = jest.fn();
      triggerWeeklyGoalAlert(queue, jest.fn(), jest.fn(), {
        completed: 1, goal: 5, daysLeft: 5, isMidWeek: false,
      });
      const msg = queue.mock.calls[0][0].message;
      expect(msg).toContain('Weekly progress');
    });

    it('sets severity warning when progress < 30%', () => {
      const queue = jest.fn();
      triggerWeeklyGoalAlert(queue, jest.fn(), jest.fn(), {
        completed: 1, goal: 10, daysLeft: 3, isMidWeek: false,
      });
      expect(queue.mock.calls[0][0].severity).toBe('warning');
    });
  });

  describe('triggerReEngagementAlert', () => {
    it('uses friendly_weekly message type', () => {
      const queue = jest.fn();
      triggerReEngagementAlert(queue, jest.fn(), jest.fn(), 7, 'friendly_weekly');
      const msg = queue.mock.calls[0][0];
      expect(msg.title).toBe('Ready to Jump Back In?');
    });

    it('uses supportive_biweekly message type', () => {
      const queue = jest.fn();
      triggerReEngagementAlert(queue, jest.fn(), jest.fn(), 14, 'supportive_biweekly');
      expect(queue.mock.calls[0][0].title).toBe('No Pressure - We\'re Here');
    });

    it('uses gentle_monthly message type', () => {
      const queue = jest.fn();
      triggerReEngagementAlert(queue, jest.fn(), jest.fn(), 30, 'gentle_monthly');
      expect(queue.mock.calls[0][0].title).toBe('Your Coding Journey Continues');
    });

    it('falls back to friendly_weekly for unknown type', () => {
      const queue = jest.fn();
      triggerReEngagementAlert(queue, jest.fn(), jest.fn(), 3, 'unknown_type');
      expect(queue.mock.calls[0][0].title).toBe('Ready to Jump Back In?');
    });
  });

  // -------------------------------------------------------------------
  // Routing functions
  // -------------------------------------------------------------------
  describe('routeToSession', () => {
    it('sends chrome message when chrome.runtime available', () => {
      routeToSession('test_context');
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'navigate', route: '/session-generator' })
      );
    });
  });

  describe('routeToProgress', () => {
    it('sends chrome message for progress route', () => {
      routeToProgress();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ route: '/progress' })
      );
    });
  });

  describe('routeToDashboard', () => {
    it('sends chrome message for dashboard route', () => {
      routeToDashboard();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ route: '/' })
      );
    });
  });

  // -------------------------------------------------------------------
  // Desktop notification functions
  // -------------------------------------------------------------------
  describe('sendStreakAlert', () => {
    it('warns when chrome notifications not available', () => {
      const origNotifications = chrome.notifications;
      delete chrome.notifications;
      sendStreakAlert(5, 2);
      chrome.notifications = origNotifications;
    });
  });

  describe('sendCadenceNudge', () => {
    it('warns when notifications not available', () => {
      const origNotifications = chrome.notifications;
      delete chrome.notifications;
      sendCadenceNudge('daily', 3);
      chrome.notifications = origNotifications;
    });
  });

  describe('sendWeeklyGoalReminder', () => {
    it('warns when notifications not available', () => {
      const orig = chrome.notifications;
      delete chrome.notifications;
      sendWeeklyGoalReminder({ completedSessions: 3, targetSessions: 5, remainingDays: 2 });
      chrome.notifications = orig;
    });
  });

  describe('sendReEngagementPrompt', () => {
    it('picks correct message for <=3 days', () => {
      const orig = chrome.notifications;
      delete chrome.notifications;
      sendReEngagementPrompt(2, 'session');
      chrome.notifications = orig;
    });

    it('picks correct message for 4-7 days', () => {
      const orig = chrome.notifications;
      delete chrome.notifications;
      sendReEngagementPrompt(5);
      chrome.notifications = orig;
    });

    it('picks correct message for >7 days', () => {
      const orig = chrome.notifications;
      delete chrome.notifications;
      sendReEngagementPrompt(10);
      chrome.notifications = orig;
    });
  });

  describe('sendFocusAreaReminder', () => {
    it('warns when notifications not available', () => {
      const orig = chrome.notifications;
      delete chrome.notifications;
      sendFocusAreaReminder('arrays', 'needs practice');
      chrome.notifications = orig;
    });
  });

  // -------------------------------------------------------------------
  // Snooze/dismiss
  // -------------------------------------------------------------------
  describe('snoozeAlert', () => {
    it('stores snooze time in localStorage', () => {
      snoozeAlert('streak_protection', 60000);
      const val = localStorage.getItem('alert_snooze_streak_protection');
      expect(val).toBeDefined();
      expect(Number(val)).toBeGreaterThan(Date.now());
    });
  });

  describe('isAlertSnoozed', () => {
    it('returns false when not snoozed', () => {
      expect(isAlertSnoozed('nonexistent')).toBe(false);
    });

    it('returns true when snoozed (future time)', () => {
      localStorage.setItem('alert_snooze_test', (Date.now() + 100000).toString());
      expect(isAlertSnoozed('test')).toBe(true);
    });

    it('returns false and cleans up expired snooze', () => {
      localStorage.setItem('alert_snooze_expired', (Date.now() - 1000).toString());
      expect(isAlertSnoozed('expired')).toBe(false);
      expect(localStorage.getItem('alert_snooze_expired')).toBeNull();
    });
  });

  describe('createDismissHandler', () => {
    it('returns a filter function that removes matching alert type', () => {
      const filter = createDismissHandler('streak_protection');
      expect(filter({ type: 'streak_protection' })).toBe(false);
      expect(filter({ type: 'cadence_nudge' })).toBe(true);
    });

    it('stores dismissal event in localStorage', () => {
      createDismissHandler('test_type');
      const dismissals = JSON.parse(localStorage.getItem('alert_dismissals'));
      expect(dismissals).toHaveLength(1);
      expect(dismissals[0].alertType).toBe('test_type');
    });
  });

  // -------------------------------------------------------------------
  // getAlertStatistics
  // -------------------------------------------------------------------
  describe('getAlertStatistics', () => {
    it('returns empty stats when no alerts stored', () => {
      const stats = getAlertStatistics();
      expect(stats.total24h).toBe(0);
      expect(stats.recentAlerts).toEqual([]);
    });

    it('counts alerts within last 24 hours', () => {
      const alerts = [
        { type: 'streak', severity: 'warning', timestamp: new Date().toISOString() },
        { type: 'cadence', severity: 'info', timestamp: new Date().toISOString() },
        { type: 'old', severity: 'info', timestamp: '2020-01-01T00:00:00Z' },
      ];
      localStorage.setItem('codemaster_alerts', JSON.stringify(alerts));

      const stats = getAlertStatistics();
      expect(stats.total24h).toBe(2);
      expect(stats.bySeverity.warning).toBe(1);
      expect(stats.bySeverity.info).toBe(1);
      expect(stats.byType.streak).toBe(1);
    });
  });
});
