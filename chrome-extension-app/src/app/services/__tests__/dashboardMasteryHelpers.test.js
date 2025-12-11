/**
 * Unit tests for dashboardMasteryHelpers.js
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
  buildDynamicTagRelationships,
  calculateOutcomeTrends,
  calculateProgressTrend
} from "../dashboard/dashboardMasteryHelpers";

// Suppress console output during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  console.log.mockRestore();
  console.warn.mockRestore();
});

describe("dashboardMasteryHelpers", () => {
  describe("buildDynamicTagRelationships", () => {
    it("builds relationships from problems with multiple tags", () => {
      const problems = [
        { leetcode_id: 1, title: "Two Sum", tags: ["array", "hash table"], difficulty: "Easy" },
        { leetcode_id: 2, title: "Three Sum", tags: ["array", "two pointers"], difficulty: "Medium" }
      ];

      const attempts = [
        { leetcode_id: 1, success: true },
        { leetcode_id: 2, success: false }
      ];

      const result = buildDynamicTagRelationships(attempts, problems);

      // Should create relationships for tag pairs
      expect(Object.keys(result).length).toBeGreaterThan(0);

      // Check array:hash table relationship
      const arrayHashKey = "array:hash table";
      expect(result[arrayHashKey]).toBeDefined();
      expect(result[arrayHashKey].strength).toBe(1);
      expect(result[arrayHashKey].successCount).toBe(1);
      expect(result[arrayHashKey].successRate).toBe(100);
    });

    it("normalizes tag names to lowercase", () => {
      const problems = [
        { leetcode_id: 1, tags: ["Array", "Hash Table"], difficulty: "Easy" }
      ];

      const attempts = [{ leetcode_id: 1, success: true }];

      const result = buildDynamicTagRelationships(attempts, problems);

      // Keys should be lowercase
      const keys = Object.keys(result);
      expect(keys.every(k => k === k.toLowerCase())).toBe(true);
    });

    it("sorts tag pairs alphabetically for consistent keys", () => {
      const problems = [
        { leetcode_id: 1, tags: ["zebra", "apple"], difficulty: "Easy" }
      ];

      const attempts = [{ leetcode_id: 1, success: true }];

      const result = buildDynamicTagRelationships(attempts, problems);

      // Should use "apple:zebra" not "zebra:apple"
      expect(result["apple:zebra"]).toBeDefined();
      expect(result["zebra:apple"]).toBeUndefined();
    });

    it("accumulates strength from multiple attempts", () => {
      const problems = [
        { leetcode_id: 1, tags: ["array", "hash table"], difficulty: "Easy" }
      ];

      const attempts = [
        { leetcode_id: 1, success: true },
        { leetcode_id: 1, success: true },
        { leetcode_id: 1, success: false }
      ];

      const result = buildDynamicTagRelationships(attempts, problems);

      const relationship = result["array:hash table"];
      expect(relationship.strength).toBe(3);
      expect(relationship.successCount).toBe(2);
      expect(relationship.successRate).toBe(67); // 2/3 rounded
    });

    it("skips problems with only one tag", () => {
      const problems = [
        { leetcode_id: 1, tags: ["array"], difficulty: "Easy" }
      ];

      const attempts = [{ leetcode_id: 1, success: true }];

      const result = buildDynamicTagRelationships(attempts, problems);

      expect(Object.keys(result).length).toBe(0);
    });

    it("skips attempts without matching problems", () => {
      const problems = [
        { leetcode_id: 1, tags: ["array", "hash table"], difficulty: "Easy" }
      ];

      const attempts = [
        { leetcode_id: 999, success: true } // No matching problem
      ];

      const result = buildDynamicTagRelationships(attempts, problems);

      expect(Object.keys(result).length).toBe(0);
    });

    it("stores up to 3 sample problems per relationship", () => {
      const problems = [
        { id: 1, leetcode_id: 1, title: "Problem 1", tags: ["array", "hash table"], difficulty: "Easy" },
        { id: 2, leetcode_id: 2, title: "Problem 2", tags: ["array", "hash table"], difficulty: "Medium" },
        { id: 3, leetcode_id: 3, title: "Problem 3", tags: ["array", "hash table"], difficulty: "Hard" },
        { id: 4, leetcode_id: 4, title: "Problem 4", tags: ["array", "hash table"], difficulty: "Easy" }
      ];

      const attempts = [
        { leetcode_id: 1, success: true },
        { leetcode_id: 2, success: false },
        { leetcode_id: 3, success: true },
        { leetcode_id: 4, success: true }
      ];

      const result = buildDynamicTagRelationships(attempts, problems);

      const relationship = result["array:hash table"];
      expect(relationship.problems.length).toBe(3); // Max 3 samples
    });

    it("handles empty arrays", () => {
      const result = buildDynamicTagRelationships([], []);

      expect(Object.keys(result).length).toBe(0);
    });

    it("supports PascalCase attempt fields", () => {
      const problems = [
        { leetcode_id: 1, tags: ["array", "hash table"], difficulty: "Easy" }
      ];

      const attempts = [
        { ProblemID: 1, success: true }
      ];

      const result = buildDynamicTagRelationships(attempts, problems);

      expect(Object.keys(result).length).toBeGreaterThan(0);
    });

    it("supports problem_id field in attempts", () => {
      const problems = [
        { leetcode_id: 1, tags: ["array", "hash table"], difficulty: "Easy" }
      ];

      const attempts = [
        { problem_id: 1, success: true }
      ];

      const result = buildDynamicTagRelationships(attempts, problems);

      expect(Object.keys(result).length).toBeGreaterThan(0);
    });
  });

  describe("calculateProgressTrend", () => {
    it("returns insufficient data for less than 10 attempts", () => {
      const attempts = Array(9).fill({ success: true, attempt_date: "2025-01-01" });

      const result = calculateProgressTrend(attempts);

      expect(result.trend).toBe("Insufficient Data");
      expect(result.percentage).toBe(0);
    });

    it("returns insufficient data for null attempts", () => {
      const result = calculateProgressTrend(null);

      expect(result.trend).toBe("Insufficient Data");
    });

    it("returns insufficient data for undefined attempts", () => {
      const result = calculateProgressTrend(undefined);

      expect(result.trend).toBe("Insufficient Data");
    });

    it("detects Rapidly Improving trend (>15% improvement)", () => {
      // Older attempts: 20% success (2/10)
      // Newer attempts: 80% success (8/10)
      const attempts = [
        ...Array(8).fill(null).map((_, i) => ({ success: false, attempt_date: `2025-01-0${i + 1}` })),
        ...Array(2).fill(null).map((_, i) => ({ success: true, attempt_date: `2025-01-0${i + 9}` })),
        ...Array(2).fill(null).map((_, i) => ({ success: false, attempt_date: `2025-01-1${i + 1}` })),
        ...Array(8).fill(null).map((_, i) => ({ success: true, attempt_date: `2025-01-1${i + 3}` }))
      ];

      const result = calculateProgressTrend(attempts);

      expect(result.trend).toBe("Rapidly Improving");
    });

    it("detects Improving trend (5-15% improvement)", () => {
      // Older attempts: 50% success
      // Newer attempts: 60% success
      const attempts = [
        ...Array(5).fill(null).map((_, i) => ({ success: true, attempt_date: `2025-01-0${i + 1}` })),
        ...Array(5).fill(null).map((_, i) => ({ success: false, attempt_date: `2025-01-0${i + 6}` })),
        ...Array(6).fill(null).map((_, i) => ({ success: true, attempt_date: `2025-01-1${i + 1}` })),
        ...Array(4).fill(null).map((_, i) => ({ success: false, attempt_date: `2025-01-1${i + 7}` }))
      ];

      const result = calculateProgressTrend(attempts);

      expect(result.trend).toBe("Improving");
    });

    it("detects Stable trend (-5% to +5%)", () => {
      // Both halves at 50% success
      const attempts = Array(20).fill(null).map((_, i) => ({
        success: i % 2 === 0,
        attempt_date: `2025-01-${String(i + 1).padStart(2, '0')}`
      }));

      const result = calculateProgressTrend(attempts);

      expect(result.trend).toBe("Stable");
    });

    it("detects Declining trend (<-15%)", () => {
      // Older: 80% success, Newer: 20% success
      const attempts = [
        ...Array(8).fill(null).map((_, i) => ({ success: true, attempt_date: `2025-01-0${i + 1}` })),
        ...Array(2).fill(null).map((_, i) => ({ success: false, attempt_date: `2025-01-0${i + 9}` })),
        ...Array(2).fill(null).map((_, i) => ({ success: true, attempt_date: `2025-01-1${i + 1}` })),
        ...Array(8).fill(null).map((_, i) => ({ success: false, attempt_date: `2025-01-1${i + 3}` }))
      ];

      const result = calculateProgressTrend(attempts);

      expect(result.trend).toBe("Declining");
    });

    it("calculates percentage from newer half success rate", () => {
      // Newer half: 7/10 = 70%
      const attempts = [
        ...Array(10).fill(null).map((_, i) => ({ success: i % 2 === 0, attempt_date: `2025-01-0${i + 1}` })),
        ...Array(7).fill(null).map((_, i) => ({ success: true, attempt_date: `2025-01-1${i + 1}` })),
        ...Array(3).fill(null).map((_, i) => ({ success: false, attempt_date: `2025-01-1${i + 8}` }))
      ];

      const result = calculateProgressTrend(attempts);

      expect(result.percentage).toBe(70);
    });

    it("supports PascalCase Success and AttemptDate fields", () => {
      const attempts = Array(20).fill(null).map((_, i) => ({
        Success: i >= 10, // Newer half all success
        AttemptDate: `2025-01-${String(i + 1).padStart(2, '0')}`
      }));

      const result = calculateProgressTrend(attempts);

      expect(result.trend).toBe("Rapidly Improving");
      expect(result.percentage).toBe(100);
    });

    it("uses only last 40 attempts for calculation", () => {
      // Create 50 attempts, only last 40 should be used
      const attempts = Array(50).fill(null).map((_, i) => ({
        success: i >= 30, // Success only in last 20
        attempt_date: `2025-01-${String(i + 1).padStart(2, '0')}`
      }));

      const result = calculateProgressTrend(attempts);

      // Should show improvement since newer half (last 20 of 40) are successful
      expect(["Improving", "Rapidly Improving"]).toContain(result.trend);
    });
  });

  describe("calculateOutcomeTrends", () => {
    const now = new Date();
    const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const oldDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    it("calculates weekly accuracy from recent attempts", () => {
      const attempts = [
        { problem_id: 1, success: true, attempt_date: recentDate },
        { problem_id: 2, success: true, attempt_date: recentDate },
        { problem_id: 3, success: false, attempt_date: recentDate },
        { problem_id: 4, success: true, attempt_date: recentDate },
        { problem_id: 5, success: false, attempt_date: oldDate } // Older than a week, excluded
      ];

      const result = calculateOutcomeTrends(attempts, [], {});

      // 3/4 = 75%
      expect(result.weeklyAccuracy.value).toBe(75);
      expect(result.weeklyAccuracy.status).toBe("excellent");
    });

    it("excludes attempts older than one week", () => {
      const attempts = [
        { problem_id: 1, success: false, attempt_date: oldDate },
        { problem_id: 2, success: false, attempt_date: oldDate }
      ];

      const result = calculateOutcomeTrends(attempts, [], {});

      expect(result.weeklyAccuracy.value).toBe(0);
    });

    it("calculates unique problems per week", () => {
      const attempts = [
        { problem_id: 1, success: true, attempt_date: recentDate },
        { problem_id: 1, success: false, attempt_date: recentDate }, // Same problem
        { problem_id: 2, success: true, attempt_date: recentDate },
        { problem_id: 3, success: true, attempt_date: recentDate }
      ];

      const result = calculateOutcomeTrends(attempts, [], {});

      expect(result.problemsPerWeek.value).toBe(3); // 3 unique problems
    });

    it("uses user settings for weekly target calculation", () => {
      const attempts = [
        { problem_id: 1, success: true, attempt_date: recentDate },
        { problem_id: 2, success: true, attempt_date: recentDate }
      ];

      const userSettings = {
        sessionsPerWeek: 3,
        sessionLength: 10
      };

      const result = calculateOutcomeTrends(attempts, [], userSettings);

      expect(result.problemsPerWeek.target).toBe(30); // 3 * 10
    });

    it("handles auto session length with default max", () => {
      const attempts = [];

      const userSettings = {
        sessionsPerWeek: 2,
        sessionLength: "auto"
      };

      const result = calculateOutcomeTrends(attempts, [], userSettings);

      expect(result.problemsPerWeek.target).toBe(24); // 2 * 12 (auto max)
    });

    it("calculates hint efficiency from provided hints", () => {
      const attempts = [
        { problem_id: 1, success: true, attempt_date: recentDate },
        { problem_id: 2, success: true, attempt_date: recentDate }
      ];

      const providedHints = { total: 4 };

      const result = calculateOutcomeTrends(attempts, [], {}, providedHints);

      expect(result.hintEfficiency.value).toBe(2.0); // 4 hints / 2 attempts
    });

    it("estimates hint efficiency when no hints provided", () => {
      const attempts = [
        { problem_id: 1, success: true, attempt_date: recentDate },
        { problem_id: 2, success: true, attempt_date: recentDate },
        { problem_id: 3, success: true, attempt_date: recentDate },
        { problem_id: 4, success: true, attempt_date: recentDate }
      ];

      const result = calculateOutcomeTrends(attempts, [], {}, null);

      // 100% success rate -> low hint usage estimated (1.5)
      expect(result.hintEfficiency.value).toBe(1.5);
    });

    it("assigns correct status levels for weekly accuracy", () => {
      // Excellent: >= 75%
      const excellentAttempts = Array(4).fill(null).map((_, i) => ({
        problem_id: i,
        success: true,
        attempt_date: recentDate
      }));
      expect(calculateOutcomeTrends(excellentAttempts, [], {}).weeklyAccuracy.status).toBe("excellent");

      // On track: 65-74%
      const onTrackAttempts = [
        ...Array(7).fill(null).map((_, i) => ({ problem_id: i, success: true, attempt_date: recentDate })),
        ...Array(3).fill(null).map((_, i) => ({ problem_id: i + 7, success: false, attempt_date: recentDate }))
      ];
      expect(calculateOutcomeTrends(onTrackAttempts, [], {}).weeklyAccuracy.status).toBe("on_track");

      // Behind: < 65%
      const behindAttempts = [
        { problem_id: 1, success: true, attempt_date: recentDate },
        { problem_id: 2, success: false, attempt_date: recentDate },
        { problem_id: 3, success: false, attempt_date: recentDate }
      ];
      expect(calculateOutcomeTrends(behindAttempts, [], {}).weeklyAccuracy.status).toBe("behind");
    });

    it("assigns learning velocity based on progress trend", () => {
      // Create enough attempts for trend calculation (>= 10)
      const improvingAttempts = [
        ...Array(10).fill(null).map((_, i) => ({
          problem_id: i,
          success: false,
          attempt_date: new Date(now.getTime() - (20 - i) * 24 * 60 * 60 * 1000).toISOString()
        })),
        ...Array(10).fill(null).map((_, i) => ({
          problem_id: i + 10,
          success: true,
          attempt_date: recentDate
        }))
      ];

      const result = calculateOutcomeTrends(improvingAttempts, [], {});

      expect(["Accelerating", "Progressive", "Steady"]).toContain(result.learningVelocity.value);
    });

    it("supports PascalCase attempt fields", () => {
      const attempts = [
        { ProblemID: 1, Success: true, AttemptDate: recentDate },
        { ProblemID: 2, Success: false, AttemptDate: recentDate }
      ];

      const result = calculateOutcomeTrends(attempts, [], {});

      expect(result.weeklyAccuracy.value).toBe(50);
    });

    it("handles empty attempts array", () => {
      const result = calculateOutcomeTrends([], [], {});

      expect(result.weeklyAccuracy.value).toBe(0);
      expect(result.problemsPerWeek.value).toBe(0);
    });

    it("skips attempts with missing dates", () => {
      const attempts = [
        { problem_id: 1, success: true }, // No date
        { problem_id: 2, success: true, attempt_date: recentDate }
      ];

      const result = calculateOutcomeTrends(attempts, [], {});

      expect(result.weeklyAccuracy.value).toBe(100); // Only counts the one with date
    });

    it("skips attempts with invalid dates", () => {
      const attempts = [
        { problem_id: 1, success: true, attempt_date: "invalid-date" },
        { problem_id: 2, success: true, attempt_date: recentDate }
      ];

      const result = calculateOutcomeTrends(attempts, [], {});

      expect(result.weeklyAccuracy.value).toBe(100); // Only counts valid date
    });
  });
});
