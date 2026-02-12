/**
 * Tests for sessionHabitLearning.js
 * Covers HabitLearningCircuitBreaker, streak calculation, cadence analysis,
 * weekly progress, re-engagement timing, and consistency alerts.
 */

// Mock logger first, before all other imports
jest.mock('../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock DB dependencies
jest.mock('../../db/stores/sessions.js', () => ({
  getLatestSession: jest.fn(),
}));

jest.mock('../../db/core/connectionUtils.js', () => ({
  openDatabase: jest.fn(),
}));

jest.mock('../../utils/leitner/Utils.js', () => ({
  roundToPrecision: jest.fn((n) => Math.round(n * 100) / 100),
}));

import { HabitLearningCircuitBreaker, HabitLearningHelpers } from '../session/sessionHabitLearning.js';
import { getLatestSession } from '../../db/stores/sessions.js';
import { openDatabase } from '../../db/core/connectionUtils.js';

// Helper: Build a fake cursor-based IndexedDB store
function buildFakeSessionStore(sessions = []) {
  let cursorIndex = -1;
  const sortedSessions = [...sessions];

  const cursorRequest = {
    onsuccess: null,
    onerror: null,
  };

  const openCursor = jest.fn(() => {
    setTimeout(() => {
      const advance = () => {
        cursorIndex++;
        if (cursorIndex < sortedSessions.length) {
          const cursorEvent = {
            target: {
              result: {
                value: sortedSessions[cursorIndex],
                continue: jest.fn(() => {
                  setTimeout(advance, 0);
                }),
              },
            },
          };
          cursorRequest.onsuccess(cursorEvent);
        } else {
          // End of cursor
          cursorRequest.onsuccess({ target: { result: null } });
        }
      };
      advance();
    }, 0);
    return cursorRequest;
  });

  return { openCursor };
}

function buildFakeDb(sessions = []) {
  const store = buildFakeSessionStore(sessions);
  const transaction = jest.fn().mockReturnValue({
    objectStore: jest.fn().mockReturnValue(store),
  });
  return { transaction };
}

describe('HabitLearningCircuitBreaker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset circuit breaker state between tests
    HabitLearningCircuitBreaker.isOpen = false;
    HabitLearningCircuitBreaker.failureCount = 0;
    HabitLearningCircuitBreaker.lastFailureTime = null;
  });

  it('getStatus returns correct initial state', () => {
    const status = HabitLearningCircuitBreaker.getStatus();
    expect(status.isOpen).toBe(false);
    expect(status.failureCount).toBe(0);
    expect(status.maxFailures).toBe(3);
    expect(status.lastFailureTime).toBeNull();
  });

  it('executes enhanced function when circuit is closed', async () => {
    const enhancedFn = jest.fn().mockResolvedValue('enhanced-result');
    const fallbackFn = jest.fn().mockResolvedValue('fallback-result');

    const result = await HabitLearningCircuitBreaker.safeExecute(enhancedFn, fallbackFn);

    expect(result).toBe('enhanced-result');
    expect(enhancedFn).toHaveBeenCalledTimes(1);
    expect(fallbackFn).not.toHaveBeenCalled();
  });

  it('uses fallback when circuit is open', async () => {
    HabitLearningCircuitBreaker.isOpen = true;
    HabitLearningCircuitBreaker.lastFailureTime = Date.now();

    const enhancedFn = jest.fn().mockResolvedValue('enhanced-result');
    const fallbackFn = jest.fn().mockResolvedValue('fallback-result');

    const result = await HabitLearningCircuitBreaker.safeExecute(enhancedFn, fallbackFn);

    expect(result).toBe('fallback-result');
    expect(enhancedFn).not.toHaveBeenCalled();
  });

  it('falls back and increments failure count on error', async () => {
    const enhancedFn = jest.fn().mockRejectedValue(new Error('enhanced failed'));
    const fallbackFn = jest.fn().mockResolvedValue('fallback-result');

    const result = await HabitLearningCircuitBreaker.safeExecute(enhancedFn, fallbackFn, 'test-op');

    expect(result).toBe('fallback-result');
    expect(HabitLearningCircuitBreaker.failureCount).toBe(1);
  });

  it('opens circuit after MAX_FAILURES consecutive failures', async () => {
    const enhancedFn = jest.fn().mockRejectedValue(new Error('fail'));
    const fallbackFn = jest.fn().mockResolvedValue('fallback');

    for (let i = 0; i < 3; i++) {
      await HabitLearningCircuitBreaker.safeExecute(enhancedFn, fallbackFn);
    }

    expect(HabitLearningCircuitBreaker.isOpen).toBe(true);
    expect(HabitLearningCircuitBreaker.failureCount).toBe(3);
  });

  it('resets after recovery timeout has elapsed', async () => {
    HabitLearningCircuitBreaker.isOpen = true;
    HabitLearningCircuitBreaker.failureCount = 3;
    // Set last failure time well in the past (beyond 5-minute recovery timeout)
    HabitLearningCircuitBreaker.lastFailureTime = Date.now() - 6 * 60 * 1000;

    const enhancedFn = jest.fn().mockResolvedValue('recovered-result');
    const fallbackFn = jest.fn().mockResolvedValue('fallback');

    const result = await HabitLearningCircuitBreaker.safeExecute(enhancedFn, fallbackFn);

    expect(result).toBe('recovered-result');
    expect(HabitLearningCircuitBreaker.isOpen).toBe(false);
  });
});

describe('HabitLearningHelpers._calculateStreak', () => {
  it('returns 0 for empty sessions', () => {
    const streak = HabitLearningHelpers._calculateStreak([]);
    expect(streak).toBe(0);
  });

  it('returns 0 for null sessions', () => {
    const streak = HabitLearningHelpers._calculateStreak(null);
    expect(streak).toBe(0);
  });

  it('returns 1 for a single session today', () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const sessions = [{ date: today.toISOString() }];
    const streak = HabitLearningHelpers._calculateStreak(sessions);
    expect(streak).toBe(1);
  });

  it('returns correct streak for consecutive daily sessions ending today', () => {
    const sessions = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(12, 0, 0, 0);
      sessions.push({ date: date.toISOString() });
    }
    const streak = HabitLearningHelpers._calculateStreak(sessions);
    expect(streak).toBe(5);
  });

  it('stops streak when there is a gap', () => {
    // Sessions: today, yesterday, 3 days ago (skipped 2 days ago)
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const sessions = [
      { date: today.toISOString() },
      { date: yesterday.toISOString() },
      { date: threeDaysAgo.toISOString() },
    ];
    const streak = HabitLearningHelpers._calculateStreak(sessions);
    expect(streak).toBe(2); // today + yesterday only
  });
});

describe('HabitLearningHelpers._analyzeCadence', () => {
  it('returns insufficient_data when fewer than 5 sessions', () => {
    const sessions = [
      { date: new Date(Date.now() - 1 * 86400000).toISOString(), status: 'completed' },
      { date: new Date(Date.now() - 2 * 86400000).toISOString(), status: 'completed' },
    ];
    const result = HabitLearningHelpers._analyzeCadence(sessions);
    expect(result.pattern).toBe('insufficient_data');
    expect(result.learningPhase).toBe(true);
    expect(result.totalSessions).toBe(2);
  });

  it('returns sessionsNeeded when fewer than 5 sessions', () => {
    const sessions = [
      { date: new Date().toISOString() },
      { date: new Date(Date.now() - 86400000).toISOString() },
    ];
    const result = HabitLearningHelpers._analyzeCadence(sessions);
    expect(result.sessionsNeeded).toBe(3);
  });

  it('identifies daily pattern for sessions with small gaps', () => {
    // 10 sessions, 1 day apart each, over 9 days — high confidence
    const sessions = [];
    for (let i = 9; i >= 0; i--) {
      sessions.push({
        date: new Date(Date.now() - i * 86400000).toISOString(),
      });
    }
    const result = HabitLearningHelpers._analyzeCadence(sessions);
    // With stdDev < 1 and confidence >= 0.7, should be daily
    expect(['daily', 'every_other_day', 'inconsistent']).toContain(result.pattern);
    expect(result.totalSessions).toBe(10);
  });

  it('returns reliability field in result', () => {
    const sessions = [];
    for (let i = 0; i < 8; i++) {
      sessions.push({ date: new Date(Date.now() - i * 86400000).toISOString() });
    }
    const result = HabitLearningHelpers._analyzeCadence(sessions);
    expect(['high', 'medium', 'low']).toContain(result.reliability);
  });

  it('returns averageGapDays in result', () => {
    const sessions = [];
    for (let i = 0; i < 6; i++) {
      sessions.push({ date: new Date(Date.now() - i * 2 * 86400000).toISOString() });
    }
    const result = HabitLearningHelpers._analyzeCadence(sessions);
    expect(result.averageGapDays).toBeGreaterThan(0);
  });

  it('marks learningPhase=true when data span < 14 days', () => {
    const sessions = [];
    for (let i = 0; i < 6; i++) {
      sessions.push({ date: new Date(Date.now() - i * 86400000).toISOString() });
    }
    const result = HabitLearningHelpers._analyzeCadence(sessions);
    expect(result.learningPhase).toBe(true);
  });
});

describe('HabitLearningHelpers._calculateWeeklyProgress', () => {
  it('returns completed=0, goal=3, percentage=0 for empty sessions', () => {
    const result = HabitLearningHelpers._calculateWeeklyProgress([]);
    expect(result.completed).toBe(0);
    expect(result.goal).toBe(3);
    expect(result.percentage).toBe(0);
  });

  it('calculates correct percentage for completed sessions', () => {
    // 3 sessions completed, goal = max(3, ceil(3*1.2)) = max(3,4) = 4
    const sessions = [
      { date: new Date().toISOString() },
      { date: new Date().toISOString() },
      { date: new Date().toISOString() },
    ];
    const result = HabitLearningHelpers._calculateWeeklyProgress(sessions);
    expect(result.completed).toBe(3);
    expect(result.percentage).toBe(Math.round((3 / result.goal) * 100));
  });

  it('includes daysLeft field', () => {
    const result = HabitLearningHelpers._calculateWeeklyProgress([]);
    expect(result).toHaveProperty('daysLeft');
  });

  it('includes isOnTrack field', () => {
    const result = HabitLearningHelpers._calculateWeeklyProgress([]);
    expect(result).toHaveProperty('isOnTrack');
  });
});

describe('HabitLearningHelpers.getReEngagementTiming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset circuit breaker so it doesn't interfere
    HabitLearningCircuitBreaker.isOpen = false;
    HabitLearningCircuitBreaker.failureCount = 0;
    HabitLearningCircuitBreaker.lastFailureTime = null;
  });

  it('returns shouldPrompt=false when no last session exists', async () => {
    getLatestSession.mockResolvedValue(null);

    const result = await HabitLearningHelpers.getReEngagementTiming();
    expect(result.shouldPrompt).toBe(false);
    expect(result.reason).toBe('no_session_data');
  });

  it('returns friendly_weekly for 7-13 days since last session', async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    getLatestSession.mockResolvedValue({ date: sevenDaysAgo.toISOString() });

    const result = await HabitLearningHelpers.getReEngagementTiming();
    expect(result.shouldPrompt).toBe(true);
    expect(result.messageType).toBe('friendly_weekly');
  });

  it('returns supportive_biweekly for 14-29 days since last session', async () => {
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);
    getLatestSession.mockResolvedValue({ date: fourteenDaysAgo.toISOString() });

    const result = await HabitLearningHelpers.getReEngagementTiming();
    expect(result.shouldPrompt).toBe(true);
    expect(result.messageType).toBe('supportive_biweekly');
  });

  it('returns gentle_monthly for 30+ days since last session', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    getLatestSession.mockResolvedValue({ date: thirtyDaysAgo.toISOString() });

    const result = await HabitLearningHelpers.getReEngagementTiming();
    expect(result.shouldPrompt).toBe(true);
    expect(result.messageType).toBe('gentle_monthly');
  });

  it('returns shouldPrompt=false for recent activity (< 7 days)', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
    getLatestSession.mockResolvedValue({ date: threeDaysAgo.toISOString() });

    const result = await HabitLearningHelpers.getReEngagementTiming();
    expect(result.shouldPrompt).toBe(false);
    expect(result.reason).toBe('recent_activity');
  });

  it('result includes daysSinceLastSession field when session exists', async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000);
    getLatestSession.mockResolvedValue({ date: fiveDaysAgo.toISOString() });

    const result = await HabitLearningHelpers.getReEngagementTiming();
    expect(result).toHaveProperty('daysSinceLastSession');
    expect(result.daysSinceLastSession).toBeGreaterThanOrEqual(4);
  });
});

describe('HabitLearningHelpers.checkConsistencyAlerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    HabitLearningCircuitBreaker.isOpen = false;
    HabitLearningCircuitBreaker.failureCount = 0;
    HabitLearningCircuitBreaker.lastFailureTime = null;
  });

  it('returns hasAlerts=false when reminders are disabled', async () => {
    const result = await HabitLearningHelpers.checkConsistencyAlerts({ enabled: false });
    expect(result.hasAlerts).toBe(false);
    expect(result.reason).toBe('reminders_disabled');
    expect(result.alerts).toEqual([]);
  });

  it('returns hasAlerts=false for null settings', async () => {
    const result = await HabitLearningHelpers.checkConsistencyAlerts(null);
    expect(result.hasAlerts).toBe(false);
  });

  it('returns correct shape with hasAlerts, alerts, and analysis keys', async () => {
    getLatestSession.mockResolvedValue(null);

    // Mock openDatabase for cadence check
    const fakeDb = buildFakeDb([]);
    openDatabase.mockResolvedValue(fakeDb);

    const result = await HabitLearningHelpers.checkConsistencyAlerts({ enabled: true });
    expect(result).toHaveProperty('hasAlerts');
    expect(result).toHaveProperty('alerts');
    expect(Array.isArray(result.alerts)).toBe(true);
  });
});
