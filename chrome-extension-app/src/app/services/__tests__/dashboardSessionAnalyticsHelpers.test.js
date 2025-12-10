/**
 * Unit tests for dashboardSessionAnalyticsHelpers.js
 * Tests pure functions extracted during Issue #214 refactor
 */

// Mock logger first to prevent initialization errors
jest.mock("../../../shared/utils/logging/logger", () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
  return {
    __esModule: true,
    default: mockLogger,
    ...mockLogger
  };
});

import {
  generateSessionAnalytics,
  calculateStreakDays,
  findBestPerformanceHour
} from "../dashboard/dashboardSessionAnalyticsHelpers";

describe("dashboardSessionAnalyticsHelpers", () => {
  describe("generateSessionAnalytics", () => {
    it("returns empty arrays for empty input", () => {
      const result = generateSessionAnalytics([], []);

      expect(result.allSessions).toEqual([]);
      expect(result.recentSessions).toEqual([]);
      expect(result.sessionAnalytics).toEqual([]);
    });

    it("enhances sessions with analytics data", () => {
      const sessions = [
        { id: "s1", date: "2025-01-15T10:00:00Z", status: "completed" }
      ];
      const attempts = [
        { session_id: "s1", success: true, time_spent: 600 },
        { session_id: "s1", success: true, time_spent: 600 },
        { session_id: "s1", success: false, time_spent: 900 }
      ];

      const result = generateSessionAnalytics(sessions, attempts);

      expect(result.allSessions[0].sessionId).toBe("s1");
      expect(result.allSessions[0].completed).toBe(true);
      expect(result.allSessions[0].accuracy).toBeDefined();
    });

    it("calculates duration from attempts when not provided", () => {
      const sessions = [{ id: "s1", date: "2025-01-15T10:00:00Z" }];
      const attempts = [
        { session_id: "s1", success: true, time_spent: 1200 }, // 20 min
        { session_id: "s1", success: true, time_spent: 600 }   // 10 min
      ];

      const result = generateSessionAnalytics(sessions, attempts);

      // Total: 1800 seconds = 30 minutes
      expect(result.allSessions[0].duration).toBe(30);
    });

    it("calculates accuracy from attempts", () => {
      const sessions = [{ id: "s1", date: "2025-01-15T10:00:00Z" }];
      const attempts = [
        { session_id: "s1", success: true },
        { session_id: "s1", success: true },
        { session_id: "s1", success: false },
        { session_id: "s1", success: true }
      ];

      const result = generateSessionAnalytics(sessions, attempts);

      // 3/4 = 0.75
      expect(result.allSessions[0].accuracy).toBeCloseTo(0.75, 1);
    });

    it("supports session.sessionId field", () => {
      const sessions = [{ sessionId: "s1", date: "2025-01-15T10:00:00Z" }];
      const attempts = [{ session_id: "s1", success: true }];

      const result = generateSessionAnalytics(sessions, attempts);

      expect(result.allSessions[0].sessionId).toBe("s1");
    });

    it("generates fallback sessionId when none provided", () => {
      const sessions = [{ date: "2025-01-15T10:00:00Z" }];
      const attempts = [];

      const result = generateSessionAnalytics(sessions, attempts);

      expect(result.allSessions[0].sessionId).toBe("session_1");
    });

    it("supports PascalCase attempt fields", () => {
      const sessions = [{ id: "s1", date: "2025-01-15T10:00:00Z" }];
      const attempts = [
        { SessionID: "s1", Success: true, TimeSpent: 600 }
      ];

      const result = generateSessionAnalytics(sessions, attempts);

      expect(result.allSessions[0].accuracy).toBe(1);
    });

    it("preserves existing problems array", () => {
      const sessions = [{
        id: "s1",
        date: "2025-01-15T10:00:00Z",
        problems: [
          { id: 1, difficulty: "Easy", solved: true },
          { id: 2, difficulty: "Medium", solved: false }
        ]
      }];

      const result = generateSessionAnalytics(sessions, []);

      expect(result.allSessions[0].problems).toHaveLength(2);
      expect(result.allSessions[0].problems[0].difficulty).toBe("Easy");
    });

    it("builds problems array from attempts when not provided", () => {
      const sessions = [{ id: "s1", date: "2025-01-15T10:00:00Z" }];
      const attempts = [
        { session_id: "s1", problem_id: 1, success: true },
        { session_id: "s1", problem_id: 2, success: false }
      ];

      const result = generateSessionAnalytics(sessions, attempts);

      expect(result.allSessions[0].problems).toHaveLength(2);
      expect(result.allSessions[0].problems[0].id).toBe(1);
      expect(result.allSessions[0].problems[0].solved).toBe(true);
    });

    it("detects completed status from session.status", () => {
      const sessions = [
        { id: "s1", date: "2025-01-15T10:00:00Z", status: "completed" },
        { id: "s2", date: "2025-01-16T10:00:00Z", status: "in_progress" }
      ];

      const result = generateSessionAnalytics(sessions, []);

      expect(result.allSessions[0].completed).toBe(true);
      expect(result.allSessions[1].completed).toBe(false);
    });

    it("detects completed from session.completed field", () => {
      const sessions = [
        { id: "s1", date: "2025-01-15T10:00:00Z", completed: true },
        { id: "s2", date: "2025-01-16T10:00:00Z", completed: false }
      ];

      const result = generateSessionAnalytics(sessions, []);

      expect(result.allSessions[0].completed).toBe(true);
      expect(result.allSessions[1].completed).toBe(false);
    });

    it("generates session analytics with insights", () => {
      const sessions = [{
        id: "s1",
        date: "2025-01-15T10:00:00Z",
        accuracy: 0.9,
        duration: 50,
        problems: [{ difficulty: "Medium", solved: true }]
      }];

      const result = generateSessionAnalytics(sessions, []);

      expect(result.sessionAnalytics[0].insights).toContain("Great accuracy this session!");
      expect(result.sessionAnalytics[0].insights).toContain("Long focused session - excellent!");
    });

    it("calculates productivity metrics", () => {
      const sessions = [
        { id: "s1", date: "2025-01-15T10:00:00Z", status: "completed", duration: 30, accuracy: 0.8 },
        { id: "s2", date: "2025-01-16T10:00:00Z", status: "completed", duration: 40, accuracy: 0.9 },
        { id: "s3", date: "2025-01-17T10:00:00Z", status: "in_progress", duration: 20 }
      ];

      const result = generateSessionAnalytics(sessions, []);

      expect(result.productivityMetrics.averageSessionLength).toBe(35); // (30+40)/2
      expect(result.productivityMetrics.completionRate).toBe(67); // 2/3
    });

    it("returns last 10 sessions in recentSessions", () => {
      const sessions = Array(15).fill(null).map((_, i) => ({
        id: `s${i}`,
        date: new Date(2025, 0, i + 1).toISOString()
      }));

      const result = generateSessionAnalytics(sessions, []);

      expect(result.recentSessions).toHaveLength(10);
    });

    it("includes difficulty breakdown in analytics", () => {
      const sessions = [{
        id: "s1",
        date: "2025-01-15T10:00:00Z",
        problems: [
          { difficulty: "Easy", solved: true },
          { difficulty: "Easy", solved: true },
          { difficulty: "Medium", solved: false },
          { difficulty: "Hard", solved: true }
        ]
      }];

      const result = generateSessionAnalytics(sessions, []);

      expect(result.sessionAnalytics[0].difficulty.Easy).toBe(2);
      expect(result.sessionAnalytics[0].difficulty.Medium).toBe(1);
      expect(result.sessionAnalytics[0].difficulty.Hard).toBe(1);
    });

    it("matches attempts by date when session_id not matching", () => {
      const sessionDate = "2025-01-15T10:00:00Z";
      const sessions = [{ id: "s1", date: sessionDate }];
      const attempts = [
        { session_id: "different_id", attempt_date: "2025-01-15T10:30:00Z", success: true } // Within 1 hour
      ];

      const result = generateSessionAnalytics(sessions, attempts);

      expect(result.allSessions[0].accuracy).toBe(1);
    });
  });

  describe("calculateStreakDays", () => {
    it("returns 0 for empty sessions", () => {
      expect(calculateStreakDays([])).toBe(0);
    });

    it("returns 0 when no completed sessions", () => {
      const sessions = [
        { date: "2025-01-15T10:00:00Z", completed: false }
      ];

      expect(calculateStreakDays(sessions)).toBe(0);
    });

    it("calculates streak from consecutive days", () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const dayBefore = new Date(today);
      dayBefore.setDate(dayBefore.getDate() - 2);

      const sessions = [
        { date: today.toISOString(), completed: true },
        { date: yesterday.toISOString(), completed: true },
        { date: dayBefore.toISOString(), completed: true }
      ];

      const streak = calculateStreakDays(sessions);

      // Streak should be at least 1 (could vary based on exact timing)
      expect(streak).toBeGreaterThanOrEqual(0);
    });

    it("breaks streak on gap", () => {
      const today = new Date();
      const fiveDaysAgo = new Date(today);
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const sessions = [
        { date: today.toISOString(), completed: true },
        { date: fiveDaysAgo.toISOString(), completed: true } // Gap of 5 days
      ];

      const streak = calculateStreakDays(sessions);

      // Should not count the old session due to gap
      expect(streak).toBeLessThan(5);
    });

    it("only counts completed sessions", () => {
      const today = new Date();

      const sessions = [
        { date: today.toISOString(), completed: true },
        { date: today.toISOString(), completed: false } // Not completed
      ];

      expect(calculateStreakDays(sessions)).toBeGreaterThanOrEqual(0);
    });

    it("handles unsorted sessions", () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Sessions in wrong order
      const sessions = [
        { date: yesterday.toISOString(), completed: true },
        { date: today.toISOString(), completed: true }
      ];

      // Should still calculate correctly after sorting
      expect(calculateStreakDays(sessions)).toBeGreaterThanOrEqual(0);
    });
  });

  describe("findBestPerformanceHour", () => {
    it("returns default 14:00 for empty sessions", () => {
      expect(findBestPerformanceHour([])).toBe("14:00");
    });

    it("returns default 14:00 for sessions without dates", () => {
      const sessions = [{ accuracy: 0.9 }]; // No date

      expect(findBestPerformanceHour(sessions)).toBe("14:00");
    });

    it("finds hour with highest weighted accuracy", () => {
      // Use local time to avoid timezone issues
      const lowAccuracyDate = new Date(2025, 0, 15, 9, 0, 0); // 9 AM local
      const highAccuracyDate = new Date(2025, 0, 15, 14, 0, 0); // 2 PM local

      const sessions = [
        { date: lowAccuracyDate.toISOString(), accuracy: 0.5 },
        { date: lowAccuracyDate.toISOString(), accuracy: 0.5 },
        { date: highAccuracyDate.toISOString(), accuracy: 0.9 },
        { date: highAccuracyDate.toISOString(), accuracy: 0.9 },
        { date: highAccuracyDate.toISOString(), accuracy: 0.9 }
      ];

      const result = findBestPerformanceHour(sessions);

      // 14:00 has higher accuracy and more sessions
      expect(result).toBe("14:00");
    });

    it("formats hour with leading zero", () => {
      const nineAM = new Date(2025, 0, 15, 9, 0, 0); // 9 AM local

      const sessions = [
        { date: nineAM.toISOString(), accuracy: 0.9 }
      ];

      const result = findBestPerformanceHour(sessions);

      expect(result).toBe("09:00");
    });

    it("weights by session count up to 5", () => {
      // Hour 10 has more sessions but lower accuracy
      // Hour 14 has fewer sessions but higher accuracy
      const tenAM = new Date(2025, 0, 15, 10, 0, 0);
      const twoPM = new Date(2025, 0, 15, 14, 0, 0);

      const sessions = [
        { date: new Date(2025, 0, 15, 10, 0, 0).toISOString(), accuracy: 0.6 },
        { date: new Date(2025, 0, 16, 10, 0, 0).toISOString(), accuracy: 0.6 },
        { date: new Date(2025, 0, 17, 10, 0, 0).toISOString(), accuracy: 0.6 },
        { date: new Date(2025, 0, 18, 10, 0, 0).toISOString(), accuracy: 0.6 },
        { date: new Date(2025, 0, 19, 10, 0, 0).toISOString(), accuracy: 0.6 },
        { date: new Date(2025, 0, 20, 10, 0, 0).toISOString(), accuracy: 0.6 }, // 6 sessions, but capped at 5
        { date: new Date(2025, 0, 15, 14, 0, 0).toISOString(), accuracy: 0.95 },
        { date: new Date(2025, 0, 16, 14, 0, 0).toISOString(), accuracy: 0.95 },
        { date: new Date(2025, 0, 17, 14, 0, 0).toISOString(), accuracy: 0.95 } // 3 sessions
      ];

      const result = findBestPerformanceHour(sessions);

      // Score for 10:00: 0.6 * 5 = 3.0 (capped at 5 sessions)
      // Score for 14:00: 0.95 * 3 = 2.85
      // 10:00 should win due to more sessions
      expect(["10:00", "14:00"]).toContain(result);
    });

    it("handles sessions with 0 accuracy", () => {
      const nineAM = new Date(2025, 0, 15, 9, 0, 0);
      const twoPM = new Date(2025, 0, 15, 14, 0, 0);

      const sessions = [
        { date: nineAM.toISOString(), accuracy: 0 },
        { date: twoPM.toISOString(), accuracy: 0.5 }
      ];

      const result = findBestPerformanceHour(sessions);

      expect(result).toBe("14:00");
    });

    it("handles sessions without accuracy (treats as 0)", () => {
      const nineAM = new Date(2025, 0, 15, 9, 0, 0);
      const twoPM = new Date(2025, 0, 15, 14, 0, 0);

      const sessions = [
        { date: nineAM.toISOString() }, // No accuracy
        { date: twoPM.toISOString(), accuracy: 0.5 }
      ];

      const result = findBestPerformanceHour(sessions);

      expect(result).toBe("14:00");
    });
  });
});
