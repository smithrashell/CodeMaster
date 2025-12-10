/**
 * Unit tests for sessionSummaryHelpers.js
 * Tests pure functions extracted during Issue #214 refactor
 */

// Mock logger first to prevent initialization errors
jest.mock("../../utils/logging/logger.js", () => {
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
  createEmptySessionSummary,
  createAdHocSessionSummary
} from "../session/sessionSummaryHelpers";

// Suppress console output during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  console.log.mockRestore();
  console.error.mockRestore();
});

describe("sessionSummaryHelpers", () => {
  describe("createEmptySessionSummary", () => {
    it("creates summary with correct session_id", () => {
      const result = createEmptySessionSummary("test-session-123");

      expect(result.session_id).toBe("test-session-123");
    });

    it("creates summary with valid completed_at timestamp", () => {
      const before = new Date().toISOString();
      const result = createEmptySessionSummary("test");
      const after = new Date().toISOString();

      expect(result.completed_at).toBeDefined();
      expect(result.completed_at >= before).toBe(true);
      expect(result.completed_at <= after).toBe(true);
    });

    it("creates empty performance object", () => {
      const result = createEmptySessionSummary("test");

      expect(result.performance.accuracy).toBe(0);
      expect(result.performance.avgTime).toBe(0);
      expect(result.performance.strongTags).toEqual([]);
      expect(result.performance.weakTags).toEqual([]);
      expect(result.performance.timingFeedback).toEqual({});
    });

    it("creates empty difficulty breakdown", () => {
      const result = createEmptySessionSummary("test");

      expect(result.performance.easy).toEqual({ attempts: 0, correct: 0, time: 0, avgTime: 0 });
      expect(result.performance.medium).toEqual({ attempts: 0, correct: 0, time: 0, avgTime: 0 });
      expect(result.performance.hard).toEqual({ attempts: 0, correct: 0, time: 0, avgTime: 0 });
    });

    it("creates empty mastery progression", () => {
      const result = createEmptySessionSummary("test");

      expect(result.mastery_progression.deltas).toEqual([]);
      expect(result.mastery_progression.new_masteries).toBe(0);
      expect(result.mastery_progression.decayed_masteries).toBe(0);
    });

    it("creates difficulty analysis with Unknown", () => {
      const result = createEmptySessionSummary("test");

      expect(result.difficulty_analysis.predominantDifficulty).toBe("Unknown");
      expect(result.difficulty_analysis.totalProblems).toBe(0);
    });

    it("creates insights with no attempts message", () => {
      const result = createEmptySessionSummary("test");

      expect(result.insights.message).toBe("No attempts recorded in this session");
    });
  });

  describe("createAdHocSessionSummary", () => {
    it("calculates accuracy from attempts", () => {
      const session = {
        id: "ad-hoc-session",
        attempts: [
          { success: true },
          { success: true },
          { success: false },
          { success: true }
        ]
      };

      const result = createAdHocSessionSummary(session);

      // 3/4 = 0.75
      expect(result.performance.accuracy).toBe(0.75);
    });

    it("calculates average time from attempts", () => {
      const session = {
        id: "ad-hoc-session",
        attempts: [
          { success: true, time_spent: 600 },
          { success: true, time_spent: 900 },
          { success: false, time_spent: 1200 }
        ]
      };

      const result = createAdHocSessionSummary(session);

      // (600 + 900 + 1200) / 3 = 900
      expect(result.performance.avgTime).toBe(900);
    });

    it("rounds average time to integer", () => {
      const session = {
        id: "ad-hoc-session",
        attempts: [
          { success: true, time_spent: 100 },
          { success: true, time_spent: 200 },
          { success: true, time_spent: 333 }
        ]
      };

      const result = createAdHocSessionSummary(session);

      expect(Number.isInteger(result.performance.avgTime)).toBe(true);
    });

    it("handles empty attempts array", () => {
      const session = {
        id: "ad-hoc-session",
        attempts: []
      };

      const result = createAdHocSessionSummary(session);

      expect(result.performance.accuracy).toBe(0);
      expect(result.performance.avgTime).toBe(0);
      expect(result.difficulty_analysis.totalProblems).toBe(0);
    });

    it("handles missing time_spent", () => {
      const session = {
        id: "ad-hoc-session",
        attempts: [
          { success: true },
          { success: false }
        ]
      };

      const result = createAdHocSessionSummary(session);

      expect(result.performance.avgTime).toBe(0);
    });

    it("sets session_id from session", () => {
      const session = {
        id: "unique-session-id",
        attempts: [{ success: true }]
      };

      const result = createAdHocSessionSummary(session);

      expect(result.session_id).toBe("unique-session-id");
    });

    it("sets sessionType to ad_hoc in insights", () => {
      const session = {
        id: "test",
        attempts: [{ success: true }]
      };

      const result = createAdHocSessionSummary(session);

      expect(result.insights.sessionType).toBe("ad_hoc");
    });

    it("generates correct message with singular problem", () => {
      const session = {
        id: "test",
        attempts: [{ success: true }]
      };

      const result = createAdHocSessionSummary(session);

      expect(result.insights.message).toBe("Completed 1 ad-hoc problem with 100% accuracy");
    });

    it("generates correct message with plural problems", () => {
      const session = {
        id: "test",
        attempts: [
          { success: true },
          { success: false },
          { success: true }
        ]
      };

      const result = createAdHocSessionSummary(session);

      // 2/3 = 66.666...% rounds to 67%
      expect(result.insights.message).toBe("Completed 3 ad-hoc problems with 67% accuracy");
    });

    it("sets totalProblems in difficulty_analysis", () => {
      const session = {
        id: "test",
        attempts: [
          { success: true },
          { success: true },
          { success: true }
        ]
      };

      const result = createAdHocSessionSummary(session);

      expect(result.difficulty_analysis.totalProblems).toBe(3);
    });

    it("sets predominantDifficulty to Mixed", () => {
      const session = {
        id: "test",
        attempts: [{ success: true }]
      };

      const result = createAdHocSessionSummary(session);

      expect(result.difficulty_analysis.predominantDifficulty).toBe("Mixed");
    });

    it("creates empty mastery progression for ad-hoc sessions", () => {
      const session = {
        id: "test",
        attempts: [{ success: true }]
      };

      const result = createAdHocSessionSummary(session);

      expect(result.mastery_progression.deltas).toEqual([]);
      expect(result.mastery_progression.new_masteries).toBe(0);
      expect(result.mastery_progression.decayed_masteries).toBe(0);
    });

    it("creates empty difficulty breakdown for ad-hoc sessions", () => {
      const session = {
        id: "test",
        attempts: [{ success: true }]
      };

      const result = createAdHocSessionSummary(session);

      expect(result.performance.easy).toEqual({ attempts: 0, correct: 0, time: 0, avgTime: 0 });
      expect(result.performance.medium).toEqual({ attempts: 0, correct: 0, time: 0, avgTime: 0 });
      expect(result.performance.hard).toEqual({ attempts: 0, correct: 0, time: 0, avgTime: 0 });
    });

    it("has valid completed_at timestamp", () => {
      const before = new Date().toISOString();
      const session = { id: "test", attempts: [] };
      const result = createAdHocSessionSummary(session);
      const after = new Date().toISOString();

      expect(result.completed_at >= before).toBe(true);
      expect(result.completed_at <= after).toBe(true);
    });

    it("rounds accuracy to 2 decimal places", () => {
      const session = {
        id: "test",
        attempts: [
          { success: true },
          { success: true },
          { success: false }
        ]
      };

      const result = createAdHocSessionSummary(session);

      // 2/3 = 0.6666... should round to 0.67
      expect(result.performance.accuracy).toBe(0.67);
    });
  });
});
