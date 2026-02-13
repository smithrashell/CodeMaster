/**
 * Tests for sessionHabitLearning.js (221 lines, 55% coverage - needs more)
 * Covers HabitLearningCircuitBreaker and HabitLearningHelpers
 */

jest.mock('../../../db/stores/sessions.js', () => ({
  getLatestSession: jest.fn(),
}));

jest.mock('../../../db/core/connectionUtils.js', () => ({
  openDatabase: jest.fn(),
}));

jest.mock('../../../utils/leitner/Utils.js', () => ({
  roundToPrecision: jest.fn((v) => Math.round(v * 100) / 100),
}));

import { HabitLearningCircuitBreaker, HabitLearningHelpers } from '../sessionHabitLearning.js';
import { getLatestSession } from '../../../db/stores/sessions.js';
import { openDatabase } from '../../../db/core/connectionUtils.js';

describe('HabitLearningCircuitBreaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset static state
    HabitLearningCircuitBreaker.isOpen = false;
    HabitLearningCircuitBreaker.failureCount = 0;
    HabitLearningCircuitBreaker.lastFailureTime = null;
  });

  describe('safeExecute', () => {
    it('executes enhanced function when circuit is closed', async () => {
      const enhanced = jest.fn().mockResolvedValue('enhanced result');
      const fallback = jest.fn().mockResolvedValue('fallback result');

      const result = await HabitLearningCircuitBreaker.safeExecute(enhanced, fallback);
      expect(result).toBe('enhanced result');
      expect(fallback).not.toHaveBeenCalled();
    });

    it('uses fallback when circuit is open', async () => {
      HabitLearningCircuitBreaker.isOpen = true;
      HabitLearningCircuitBreaker.lastFailureTime = Date.now();

      const enhanced = jest.fn();
      const fallback = jest.fn().mockResolvedValue('fallback result');

      const result = await HabitLearningCircuitBreaker.safeExecute(enhanced, fallback);
      expect(result).toBe('fallback result');
      expect(enhanced).not.toHaveBeenCalled();
    });

    it('resets circuit after recovery timeout', async () => {
      HabitLearningCircuitBreaker.isOpen = true;
      HabitLearningCircuitBreaker.lastFailureTime = Date.now() - (6 * 60 * 1000); // 6 minutes ago

      const enhanced = jest.fn().mockResolvedValue('recovered');
      const fallback = jest.fn();

      const result = await HabitLearningCircuitBreaker.safeExecute(enhanced, fallback);
      expect(result).toBe('recovered');
      expect(HabitLearningCircuitBreaker.isOpen).toBe(false);
      expect(HabitLearningCircuitBreaker.failureCount).toBe(0);
    });

    it('falls back on enhanced function error and increments failure count', async () => {
      const enhanced = jest.fn().mockRejectedValue(new Error('fail'));
      const fallback = jest.fn().mockResolvedValue('fallback');

      const result = await HabitLearningCircuitBreaker.safeExecute(enhanced, fallback);
      expect(result).toBe('fallback');
      expect(HabitLearningCircuitBreaker.failureCount).toBe(1);
      expect(HabitLearningCircuitBreaker.lastFailureTime).toBeTruthy();
    });

    it('opens circuit after MAX_FAILURES failures', async () => {
      const enhanced = jest.fn().mockRejectedValue(new Error('fail'));
      const fallback = jest.fn().mockResolvedValue('fallback');

      for (let i = 0; i < 3; i++) {
        await HabitLearningCircuitBreaker.safeExecute(enhanced, fallback);
      }

      expect(HabitLearningCircuitBreaker.isOpen).toBe(true);
      expect(HabitLearningCircuitBreaker.failureCount).toBe(3);
    });

    it('handles enhanced function timeout', async () => {
      jest.useFakeTimers();
      const neverResolves = () => new Promise(() => {}); // never resolves
      const fallback = jest.fn().mockResolvedValue('timeout fallback');

      const promise = HabitLearningCircuitBreaker.safeExecute(neverResolves, fallback);
      jest.advanceTimersByTime(6000);

      const result = await promise;
      expect(result).toBe('timeout fallback');
      jest.useRealTimers();
    });
  });

  describe('getStatus', () => {
    it('returns current circuit breaker status', () => {
      HabitLearningCircuitBreaker.failureCount = 2;
      HabitLearningCircuitBreaker.isOpen = false;

      const status = HabitLearningCircuitBreaker.getStatus();
      expect(status).toEqual({
        isOpen: false,
        failureCount: 2,
        maxFailures: 3,
        lastFailureTime: null,
      });
    });
  });
});

describe('HabitLearningHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset circuit breaker for each test
    HabitLearningCircuitBreaker.isOpen = false;
    HabitLearningCircuitBreaker.failureCount = 0;
    HabitLearningCircuitBreaker.lastFailureTime = null;
  });

  // -------------------------------------------------------------------
  // _calculateStreak
  // -------------------------------------------------------------------
  describe('_calculateStreak', () => {
    it('returns 0 for empty sessions', () => {
      expect(HabitLearningHelpers._calculateStreak([])).toBe(0);
      expect(HabitLearningHelpers._calculateStreak(null)).toBe(0);
    });

    it('counts consecutive days from today', () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const sessions = [
        { date: today.toISOString() },
        { date: yesterday.toISOString() },
      ];
      const streak = HabitLearningHelpers._calculateStreak(sessions);
      expect(streak).toBe(2);
    });

    it('breaks streak on gap day', () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const sessions = [
        { date: today.toISOString() },
        { date: threeDaysAgo.toISOString() },
      ];
      const streak = HabitLearningHelpers._calculateStreak(sessions);
      expect(streak).toBe(1);
    });
  });

  // -------------------------------------------------------------------
  // _analyzeCadence
  // -------------------------------------------------------------------
  describe('_analyzeCadence', () => {
    it('returns insufficient_data for fewer than 5 sessions', () => {
      const result = HabitLearningHelpers._analyzeCadence([
        { date: '2024-01-01' },
        { date: '2024-01-02' },
      ]);
      expect(result.pattern).toBe('insufficient_data');
      expect(result.reliability).toBe('low');
      expect(result.learningPhase).toBe(true);
      expect(result.sessionsNeeded).toBe(3);
    });

    it('returns insufficient_data for null sessions', () => {
      const result = HabitLearningHelpers._analyzeCadence(null);
      expect(result.pattern).toBe('insufficient_data');
    });

    it('analyzes daily pattern with consistent sessions', () => {
      const sessions = [];
      for (let i = 0; i < 15; i++) {
        const date = new Date(2024, 0, 1 + i);
        sessions.push({ date: date.toISOString() });
      }
      const result = HabitLearningHelpers._analyzeCadence(sessions);
      expect(result.totalSessions).toBe(15);
      expect(result.averageGapDays).toBeCloseTo(1, 0);
      expect(['daily', 'every_other_day']).toContain(result.pattern);
    });

    it('handles sessions with large gaps (> 14 days filtered out)', () => {
      const sessions = [
        { date: '2024-01-01' },
        { date: '2024-01-02' },
        { date: '2024-01-03' },
        { date: '2024-01-04' },
        { date: '2024-02-01' }, // 28-day gap - filtered
      ];
      const result = HabitLearningHelpers._analyzeCadence(sessions);
      expect(result.totalSessions).toBe(5);
    });

    it('returns insufficient_data when all gaps are >= 14 days', () => {
      const sessions = [
        { date: '2024-01-01' },
        { date: '2024-02-01' },
        { date: '2024-03-01' },
        { date: '2024-04-01' },
        { date: '2024-05-01' },
      ];
      const result = HabitLearningHelpers._analyzeCadence(sessions);
      expect(result.pattern).toBe('insufficient_data');
    });
  });

  // -------------------------------------------------------------------
  // _calculateWeeklyProgress
  // -------------------------------------------------------------------
  describe('_calculateWeeklyProgress', () => {
    it('calculates progress for empty sessions', () => {
      const result = HabitLearningHelpers._calculateWeeklyProgress([]);
      expect(result.completed).toBe(0);
      expect(result.goal).toBe(3);
      expect(result.percentage).toBe(0);
    });

    it('calculates progress for sessions completed', () => {
      const sessions = [{ id: 1 }, { id: 2 }];
      const result = HabitLearningHelpers._calculateWeeklyProgress(sessions);
      expect(result.completed).toBe(2);
      expect(result.goal).toBe(3); // max(3, ceil(2*1.2)) = max(3, 3) = 3
      expect(result.percentage).toBe(67); // Math.round(2/3 * 100)
    });

    it('scales goal with session count', () => {
      const sessions = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
      const result = HabitLearningHelpers._calculateWeeklyProgress(sessions);
      expect(result.completed).toBe(5);
      expect(result.goal).toBe(6); // max(3, ceil(5*1.2)) = max(3, 6) = 6
    });
  });

  // -------------------------------------------------------------------
  // _addCadenceNudgeIfNeeded
  // -------------------------------------------------------------------
  describe('_addCadenceNudgeIfNeeded', () => {
    it('adds nudge when conditions are met', () => {
      const alerts = [];
      const cadence = {
        averageGapDays: 2,
        reliability: 'high',
        confidenceScore: 0.7,
        pattern: 'every_other_day',
      };
      HabitLearningHelpers._addCadenceNudgeIfNeeded(alerts, cadence, 3, 2.5);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('cadence_nudge');
      expect(alerts[0].priority).toBe('medium');
    });

    it('skips nudge when reliability is low', () => {
      const alerts = [];
      const cadence = { averageGapDays: 2, reliability: 'low', confidenceScore: 0.7, pattern: 'daily' };
      HabitLearningHelpers._addCadenceNudgeIfNeeded(alerts, cadence, 3, 2.5);
      expect(alerts).toHaveLength(0);
    });

    it('skips nudge when confidence is below 0.5', () => {
      const alerts = [];
      const cadence = { averageGapDays: 2, reliability: 'high', confidenceScore: 0.3, pattern: 'daily' };
      HabitLearningHelpers._addCadenceNudgeIfNeeded(alerts, cadence, 3, 2.5);
      expect(alerts).toHaveLength(0);
    });

    it('skips nudge when days since is below threshold', () => {
      const alerts = [];
      const cadence = { averageGapDays: 2, reliability: 'high', confidenceScore: 0.7, pattern: 'daily' };
      HabitLearningHelpers._addCadenceNudgeIfNeeded(alerts, cadence, 1, 2.5);
      expect(alerts).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------
  // _addReEngagementAlert
  // -------------------------------------------------------------------
  describe('_addReEngagementAlert', () => {
    it('adds friendly weekly message', () => {
      const alerts = [];
      HabitLearningHelpers._addReEngagementAlert(alerts, {
        messageType: 'friendly_weekly',
        daysSinceLastSession: 8,
      });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('re_engagement');
      expect(alerts[0].priority).toBe('low');
      expect(alerts[0].data.messageType).toBe('friendly_weekly');
    });

    it('adds supportive biweekly message', () => {
      const alerts = [];
      HabitLearningHelpers._addReEngagementAlert(alerts, {
        messageType: 'supportive_biweekly',
        daysSinceLastSession: 16,
      });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].data.messageType).toBe('supportive_biweekly');
    });

    it('adds gentle monthly message', () => {
      const alerts = [];
      HabitLearningHelpers._addReEngagementAlert(alerts, {
        messageType: 'gentle_monthly',
        daysSinceLastSession: 35,
      });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].data.messageType).toBe('gentle_monthly');
    });
  });

  // -------------------------------------------------------------------
  // getReEngagementTiming
  // -------------------------------------------------------------------
  describe('getReEngagementTiming', () => {
    it('returns no prompt when no session data', async () => {
      getLatestSession.mockResolvedValue(null);

      const result = await HabitLearningHelpers.getReEngagementTiming();
      expect(result.shouldPrompt).toBe(false);
      expect(result.reason).toBe('no_session_data');
    });

    it('returns no prompt for recent activity', async () => {
      getLatestSession.mockResolvedValue({
        date: new Date().toISOString(),
      });

      const result = await HabitLearningHelpers.getReEngagementTiming();
      expect(result.shouldPrompt).toBe(false);
      expect(result.reason).toBe('recent_activity');
    });

    it('returns friendly_weekly for 7+ days absence', async () => {
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
      getLatestSession.mockResolvedValue({ date: eightDaysAgo.toISOString() });

      const result = await HabitLearningHelpers.getReEngagementTiming();
      expect(result.shouldPrompt).toBe(true);
      expect(result.messageType).toBe('friendly_weekly');
    });

    it('returns supportive_biweekly for 14+ days absence', async () => {
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      getLatestSession.mockResolvedValue({ date: fifteenDaysAgo.toISOString() });

      const result = await HabitLearningHelpers.getReEngagementTiming();
      expect(result.shouldPrompt).toBe(true);
      expect(result.messageType).toBe('supportive_biweekly');
    });

    it('returns gentle_monthly for 30+ days absence', async () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
      getLatestSession.mockResolvedValue({ date: thirtyOneDaysAgo.toISOString() });

      const result = await HabitLearningHelpers.getReEngagementTiming();
      expect(result.shouldPrompt).toBe(true);
      expect(result.messageType).toBe('gentle_monthly');
    });

    it('returns error state on exception', async () => {
      getLatestSession.mockRejectedValue(new Error('DB fail'));

      const result = await HabitLearningHelpers.getReEngagementTiming();
      expect(result.shouldPrompt).toBe(false);
      expect(result.reason).toBe('error');
    });
  });

  // -------------------------------------------------------------------
  // checkConsistencyAlerts
  // -------------------------------------------------------------------
  describe('checkConsistencyAlerts', () => {
    it('returns no alerts when reminders are disabled', async () => {
      const result = await HabitLearningHelpers.checkConsistencyAlerts({ enabled: false });
      expect(result.hasAlerts).toBe(false);
      expect(result.reason).toBe('reminders_disabled');
    });

    it('returns no alerts when reminderSettings is null', async () => {
      const result = await HabitLearningHelpers.checkConsistencyAlerts(null);
      expect(result.hasAlerts).toBe(false);
      expect(result.reason).toBe('reminders_disabled');
    });

    it('handles errors gracefully', async () => {
      // Mock to cause an error
      jest.spyOn(HabitLearningHelpers, 'getStreakRiskTiming').mockRejectedValue(new Error('fail'));

      const result = await HabitLearningHelpers.checkConsistencyAlerts({
        enabled: true,
        streakAlerts: true,
        cadenceNudges: false,
        weeklyGoals: false,
        reEngagement: false,
      });
      expect(result.hasAlerts).toBe(false);
      expect(result.reason).toBe('check_failed');

      HabitLearningHelpers.getStreakRiskTiming.mockRestore();
    });
  });

  // -------------------------------------------------------------------
  // _addWeeklyGoalAlertIfNeeded
  // -------------------------------------------------------------------
  describe('_addWeeklyGoalAlertIfNeeded', () => {
    it('skips when cadence data is insufficient', () => {
      const alerts = [];
      const weeklyProgress = { completed: 1, goal: 5, percentage: 20, daysLeft: 3 };
      const cadence = { learningPhase: true, totalSessions: 2 };
      HabitLearningHelpers._addWeeklyGoalAlertIfNeeded(alerts, weeklyProgress, cadence);
      expect(alerts).toHaveLength(0);
    });

    it('skips when not enough total sessions', () => {
      const alerts = [];
      const weeklyProgress = { completed: 1, goal: 5, percentage: 20, daysLeft: 3 };
      const cadence = { learningPhase: false, totalSessions: 1 };
      HabitLearningHelpers._addWeeklyGoalAlertIfNeeded(alerts, weeklyProgress, cadence);
      expect(alerts).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------
  // getStreakRiskTiming
  // -------------------------------------------------------------------
  describe('getStreakRiskTiming', () => {
    it('returns no alert when no current streak', async () => {
      jest.spyOn(HabitLearningHelpers, 'getCurrentStreak').mockResolvedValue(0);
      jest.spyOn(HabitLearningHelpers, 'getTypicalCadence').mockResolvedValue({
        averageGapDays: 2,
        pattern: 'daily',
        reliability: 'low',
        totalSessions: 0,
        learningPhase: true,
        fallbackMode: true,
      });

      const result = await HabitLearningHelpers.getStreakRiskTiming();
      expect(result.shouldAlert).toBe(false);
      expect(result.reason).toBe('no_current_streak');

      HabitLearningHelpers.getCurrentStreak.mockRestore();
      HabitLearningHelpers.getTypicalCadence.mockRestore();
    });

    it('returns no alert when no session data', async () => {
      jest.spyOn(HabitLearningHelpers, 'getCurrentStreak').mockResolvedValue(5);
      jest.spyOn(HabitLearningHelpers, 'getTypicalCadence').mockResolvedValue({ averageGapDays: 2 });
      getLatestSession.mockResolvedValue(null);

      const result = await HabitLearningHelpers.getStreakRiskTiming();
      expect(result.shouldAlert).toBe(false);
      expect(result.reason).toBe('no_session_data');

      HabitLearningHelpers.getCurrentStreak.mockRestore();
      HabitLearningHelpers.getTypicalCadence.mockRestore();
    });

    it('returns alert when streak is at risk', async () => {
      jest.spyOn(HabitLearningHelpers, 'getCurrentStreak').mockResolvedValue(5);
      jest.spyOn(HabitLearningHelpers, 'getTypicalCadence').mockResolvedValue({ averageGapDays: 1 });

      const fourDaysAgo = new Date();
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
      getLatestSession.mockResolvedValue({ date: fourDaysAgo.toISOString() });

      const result = await HabitLearningHelpers.getStreakRiskTiming();
      expect(result.shouldAlert).toBe(true);
      expect(result.reason).toBe('streak_at_risk');
      expect(result.currentStreak).toBe(5);

      HabitLearningHelpers.getCurrentStreak.mockRestore();
      HabitLearningHelpers.getTypicalCadence.mockRestore();
    });

    it('returns error state on exception', async () => {
      jest.spyOn(HabitLearningHelpers, 'getCurrentStreak').mockRejectedValue(new Error('fail'));

      const result = await HabitLearningHelpers.getStreakRiskTiming();
      expect(result.shouldAlert).toBe(false);
      expect(result.reason).toBe('error');

      HabitLearningHelpers.getCurrentStreak.mockRestore();
    });
  });
});
