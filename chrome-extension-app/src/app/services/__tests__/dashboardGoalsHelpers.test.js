/**
 * Unit tests for dashboardGoalsHelpers.js
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

// Mock database calls
jest.mock("../../../shared/db/stores/sessions", () => ({
  getAllSessions: jest.fn()
}));

jest.mock("../../../shared/db/stores/attempts", () => ({
  getAllAttempts: jest.fn()
}));

import { generateGoalsData, getLearningEfficiencyData } from "../dashboard/dashboardGoalsHelpers";
import { getAllSessions } from "../../../shared/db/stores/sessions";
import { getAllAttempts } from "../../../shared/db/stores/attempts";

// Suppress console output during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  console.log.mockRestore();
  console.warn.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("dashboardGoalsHelpers", () => {
  describe("generateGoalsData", () => {
    it("generates default goals structure with no input", async () => {
      const result = await generateGoalsData({});

      expect(result).toHaveProperty("learningPlan");
      expect(result.learningPlan).toHaveProperty("cadence");
      expect(result.learningPlan).toHaveProperty("focus");
      expect(result.learningPlan).toHaveProperty("guardrails");
      expect(result.learningPlan).toHaveProperty("outcomeTrends");
    });

    it("uses default focus areas when none provided", async () => {
      const result = await generateGoalsData({});

      // Default focus areas from getInitialFocusAreas
      expect(result.learningPlan.focus.primaryTags).toEqual([
        "array",
        "hash table",
        "string",
        "dynamic programming",
        "tree"
      ]);
    });

    it("uses provided focus areas", async () => {
      const result = await generateGoalsData({
        focusAreas: ["graph", "backtracking"]
      });

      expect(result.learningPlan.focus.primaryTags).toContain("graph");
    });

    it("populates cadence from settings", async () => {
      const result = await generateGoalsData({
        settings: {
          sessionsPerWeek: 3,
          sessionLength: 10,
          flexibleSchedule: false
        }
      });

      expect(result.learningPlan.cadence.sessionsPerWeek).toBe(3);
      expect(result.learningPlan.cadence.sessionLength).toBe(10);
      expect(result.learningPlan.cadence.flexibleSchedule).toBe(false);
    });

    it("populates guardrails from settings", async () => {
      const result = await generateGoalsData({
        settings: {
          numberofNewProblemsPerSession: 6
        }
      });

      expect(result.learningPlan.guardrails.maxNewProblems).toBe(6);
      expect(result.learningPlan.guardrails.minReviewRatio).toBe(30);
      expect(result.learningPlan.guardrails.difficultyCapEnabled).toBe(true);
    });

    it("populates focus decision data when provided", async () => {
      const result = await generateGoalsData({
        focusDecision: {
          activeFocusTags: ["array", "string"],
          algorithmReasoning: "Testing reasoning",
          onboarding: true,
          performanceLevel: "beginner"
        }
      });

      expect(result.learningPlan.focus.activeFocusTags).toEqual(["array", "string"]);
      expect(result.learningPlan.focus.algorithmReasoning).toBe("Testing reasoning");
      expect(result.learningPlan.focus.onboarding).toBe(true);
      expect(result.learningPlan.focus.performanceLevel).toBe("beginner");
    });

    it("calculates outcome trends from provided attempts and sessions", async () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

      const result = await generateGoalsData({
        allAttempts: [
          { problem_id: 1, success: true, attempt_date: recentDate },
          { problem_id: 2, success: true, attempt_date: recentDate },
          { problem_id: 3, success: false, attempt_date: recentDate },
          { problem_id: 4, success: true, attempt_date: recentDate }
        ],
        allSessions: [{ id: 1, date: recentDate }]
      });

      // 3/4 = 75% accuracy
      expect(result.learningPlan.outcomeTrends.weeklyAccuracy.value).toBe(75);
      expect(result.learningPlan.outcomeTrends.problemsPerWeek).toBeDefined();
    });

    it("returns fallback outcome trends when no attempts provided", async () => {
      const result = await generateGoalsData({
        allAttempts: [],
        allSessions: []
      });

      expect(result.learningPlan.outcomeTrends.weeklyAccuracy.value).toBe(0);
      expect(result.learningPlan.outcomeTrends.weeklyAccuracy.status).toBe("behind");
    });

    it("calculates fallback target based on settings", async () => {
      const result = await generateGoalsData({
        allAttempts: [],
        allSessions: [],
        settings: {
          sessionsPerWeek: 3,
          sessionLength: 8
        }
      });

      // 3 sessions * 8 problems = 24
      expect(result.learningPlan.outcomeTrends.problemsPerWeek.target).toBe(24);
    });

    it("uses auto session length for fallback target calculation", async () => {
      const result = await generateGoalsData({
        allAttempts: [],
        allSessions: [],
        settings: {
          sessionsPerWeek: 2,
          sessionLength: "auto"
        }
      });

      // 2 sessions * 12 (auto max) = 24
      expect(result.learningPlan.outcomeTrends.problemsPerWeek.target).toBe(24);
    });

    it("populates user and system focus areas separately", async () => {
      const result = await generateGoalsData({
        userFocusAreas: ["array", "string"],
        systemFocusTags: ["tree", "graph"]
      });

      expect(result.learningPlan.focus.userFocusAreas).toEqual(["array", "string"]);
      expect(result.learningPlan.focus.systemFocusTags).toEqual(["tree", "graph"]);
    });

    it("includes difficulty distribution in focus section", async () => {
      const result = await generateGoalsData({
        settings: {
          difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
          reviewRatio: 50
        }
      });

      expect(result.learningPlan.focus.difficultyDistribution).toEqual({ easy: 30, medium: 50, hard: 20 });
      expect(result.learningPlan.focus.reviewRatio).toBe(50);
    });

    it("passes hint data to outcome trends calculation", async () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

      const result = await generateGoalsData({
        allAttempts: [
          { problem_id: 1, success: true, attempt_date: recentDate },
          { problem_id: 2, success: true, attempt_date: recentDate }
        ],
        allSessions: [{ id: 1, date: recentDate }],
        hintsUsed: { total: 4 }
      });

      // 4 hints / 2 attempts = 2.0
      expect(result.learningPlan.outcomeTrends.hintEfficiency.value).toBe(2.0);
    });
  });

  describe("getLearningEfficiencyData", () => {
    it("returns empty data when no completed sessions", async () => {
      getAllSessions.mockResolvedValue([]);
      getAllAttempts.mockResolvedValue([]);

      const result = await getLearningEfficiencyData();

      expect(result.hasData).toBe(false);
      expect(result.chartData).toEqual([]);
      expect(result.message).toBe('Complete some sessions to see your learning efficiency trends');
    });

    it("returns empty data when sessions have no date", async () => {
      getAllSessions.mockResolvedValue([
        { id: 1, status: 'completed' } // No date
      ]);
      getAllAttempts.mockResolvedValue([]);

      const result = await getLearningEfficiencyData();

      expect(result.hasData).toBe(false);
    });

    it("filters to only completed sessions", async () => {
      getAllSessions.mockResolvedValue([
        { id: 1, status: 'completed', date: '2025-01-15T10:00:00Z' },
        { id: 2, status: 'in_progress', date: '2025-01-16T10:00:00Z' },
        { id: 3, status: 'abandoned', date: '2025-01-17T10:00:00Z' }
      ]);
      getAllAttempts.mockResolvedValue([]);

      const result = await getLearningEfficiencyData();

      expect(result.hasData).toBe(true);
      expect(result.chartData.length).toBe(1);
    });

    it("calculates efficiency from success rate and time", async () => {
      getAllSessions.mockResolvedValue([
        { id: 's1', status: 'completed', date: '2025-01-15T10:00:00Z', session_length: 5 }
      ]);
      getAllAttempts.mockResolvedValue([
        { session_id: 's1', success: true, time_spent: 300 },  // 5 min
        { session_id: 's1', success: true, time_spent: 300 },
        { session_id: 's1', success: false, time_spent: 600 },
        { session_id: 's1', success: true, time_spent: 300 }
      ]);

      const result = await getLearningEfficiencyData();

      expect(result.hasData).toBe(true);
      expect(result.chartData[0].efficiency).toBeGreaterThan(0);
      expect(result.chartData[0].efficiency).toBeLessThanOrEqual(100);
    });

    it("calculates retention from review problem performance", async () => {
      getAllSessions.mockResolvedValue([
        { id: 's1', status: 'completed', date: '2025-01-15T10:00:00Z' }
      ]);
      getAllAttempts.mockResolvedValue([
        { session_id: 's1', success: true, box_level: 2 },  // Review problem
        { session_id: 's1', success: true, box_level: 3 },  // Review problem
        { session_id: 's1', success: false, box_level: 2 }, // Review problem
        { session_id: 's1', success: true, box_level: 0 }   // New problem (not counted for retention)
      ]);

      const result = await getLearningEfficiencyData();

      // 2/3 review success = 67%
      expect(result.chartData[0].retention).toBe(67);
    });

    it("falls back to success rate when no review problems", async () => {
      getAllSessions.mockResolvedValue([
        { id: 's1', status: 'completed', date: '2025-01-15T10:00:00Z' }
      ]);
      getAllAttempts.mockResolvedValue([
        { session_id: 's1', success: true, box_level: 0 },
        { session_id: 's1', success: true, box_level: 0 }
      ]);

      const result = await getLearningEfficiencyData();

      // 100% success rate used as retention
      expect(result.chartData[0].retention).toBe(100);
    });

    it("calculates momentum with completion rate and bonus", async () => {
      getAllSessions.mockResolvedValue([
        { id: 's1', status: 'completed', date: '2025-01-15T10:00:00Z', session_length: 4 },
        { id: 's2', status: 'completed', date: '2025-01-16T10:00:00Z', session_length: 4 }
      ]);
      getAllAttempts.mockResolvedValue([
        // Session 1: 2/4 success = 50%
        { session_id: 's1', success: true },
        { session_id: 's1', success: true },
        { session_id: 's1', success: false },
        { session_id: 's1', success: false },
        // Session 2: 3/4 success = 75% (improved)
        { session_id: 's2', success: true },
        { session_id: 's2', success: true },
        { session_id: 's2', success: true },
        { session_id: 's2', success: false }
      ]);

      const result = await getLearningEfficiencyData();

      // Second session should have momentum bonus for improving
      expect(result.chartData[1].momentum).toBeGreaterThan(result.chartData[0].momentum);
    });

    it("limits to last 10 sessions", async () => {
      const sessions = Array(15).fill(null).map((_, i) => ({
        id: `s${i}`,
        status: 'completed',
        date: new Date(2025, 0, i + 1).toISOString()
      }));

      getAllSessions.mockResolvedValue(sessions);
      getAllAttempts.mockResolvedValue([]);

      const result = await getLearningEfficiencyData();

      expect(result.chartData.length).toBe(10);
      expect(result.totalSessions).toBe(10);
    });

    it("sorts sessions by date ascending", async () => {
      getAllSessions.mockResolvedValue([
        { id: 's3', status: 'completed', date: '2025-01-17T10:00:00Z' },
        { id: 's1', status: 'completed', date: '2025-01-15T10:00:00Z' },
        { id: 's2', status: 'completed', date: '2025-01-16T10:00:00Z' }
      ]);
      getAllAttempts.mockResolvedValue([]);

      const result = await getLearningEfficiencyData();

      expect(result.chartData[0].sessionId).toBe('s1');
      expect(result.chartData[1].sessionId).toBe('s2');
      expect(result.chartData[2].sessionId).toBe('s3');
    });

    it("calculates averages across all sessions", async () => {
      getAllSessions.mockResolvedValue([
        { id: 's1', status: 'completed', date: '2025-01-15T10:00:00Z', session_length: 2 },
        { id: 's2', status: 'completed', date: '2025-01-16T10:00:00Z', session_length: 2 }
      ]);
      getAllAttempts.mockResolvedValue([
        { session_id: 's1', success: true, time_spent: 60 },
        { session_id: 's1', success: true, time_spent: 60 },
        { session_id: 's2', success: true, time_spent: 60 },
        { session_id: 's2', success: false, time_spent: 60 }
      ]);

      const result = await getLearningEfficiencyData();

      expect(result.averages).toBeDefined();
      expect(result.averages.efficiency).toBeGreaterThan(0);
      expect(result.averages.retention).toBeGreaterThan(0);
      expect(result.averages.momentum).toBeGreaterThan(0);
    });

    it("labels sessions sequentially", async () => {
      getAllSessions.mockResolvedValue([
        { id: 's1', status: 'completed', date: '2025-01-15T10:00:00Z' },
        { id: 's2', status: 'completed', date: '2025-01-16T10:00:00Z' }
      ]);
      getAllAttempts.mockResolvedValue([]);

      const result = await getLearningEfficiencyData();

      expect(result.chartData[0].session).toBe('S1');
      expect(result.chartData[1].session).toBe('S2');
    });

    it("includes formatted date in chart data", async () => {
      getAllSessions.mockResolvedValue([
        { id: 's1', status: 'completed', date: '2025-01-15T10:00:00Z' }
      ]);
      getAllAttempts.mockResolvedValue([]);

      const result = await getLearningEfficiencyData();

      expect(result.chartData[0].date).toBeDefined();
      expect(typeof result.chartData[0].date).toBe('string');
    });

    it("tracks problems solved and total in chart data", async () => {
      getAllSessions.mockResolvedValue([
        { id: 's1', status: 'completed', date: '2025-01-15T10:00:00Z' }
      ]);
      getAllAttempts.mockResolvedValue([
        { session_id: 's1', success: true },
        { session_id: 's1', success: true },
        { session_id: 's1', success: false }
      ]);

      const result = await getLearningEfficiencyData();

      expect(result.chartData[0].problemsSolved).toBe(2);
      expect(result.chartData[0].totalProblems).toBe(3);
    });

    it("clamps metrics between 0 and 100", async () => {
      getAllSessions.mockResolvedValue([
        { id: 's1', status: 'completed', date: '2025-01-15T10:00:00Z', session_length: 1 }
      ]);
      getAllAttempts.mockResolvedValue([
        // 100% success with very fast time could theoretically exceed 100
        { session_id: 's1', success: true, time_spent: 1 }
      ]);

      const result = await getLearningEfficiencyData();

      expect(result.chartData[0].efficiency).toBeLessThanOrEqual(100);
      expect(result.chartData[0].efficiency).toBeGreaterThanOrEqual(0);
      expect(result.chartData[0].retention).toBeLessThanOrEqual(100);
      expect(result.chartData[0].momentum).toBeLessThanOrEqual(100);
    });

    it("handles database errors gracefully", async () => {
      getAllSessions.mockRejectedValue(new Error("Database error"));

      const result = await getLearningEfficiencyData();

      expect(result.hasData).toBe(false);
      expect(result.message).toBe('Error loading efficiency data');
    });
  });
});
