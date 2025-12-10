/**
 * Unit tests for dashboardCoreHelpers.js
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
  getInitialFocusAreas,
  createDashboardProblemMappings,
  applyFiltering,
  calculateCoreStatistics,
  calculateDerivedMetrics,
  calculateProgressMetrics,
  calculateStrategySuccessRate,
  validateSession,
  constructDashboardData
} from "../dashboard/dashboardCoreHelpers";

describe("dashboardCoreHelpers", () => {
  describe("getInitialFocusAreas", () => {
    it("returns provided focus areas when array is not empty", () => {
      const focusAreas = ["array", "string", "tree"];
      expect(getInitialFocusAreas(focusAreas)).toEqual(focusAreas);
    });

    it("returns default focus areas when provided array is empty", () => {
      const result = getInitialFocusAreas([]);
      expect(result).toEqual([
        "array",
        "hash table",
        "string",
        "dynamic programming",
        "tree"
      ]);
    });

    it("returns default focus areas when provided is null", () => {
      const result = getInitialFocusAreas(null);
      expect(result).toEqual([
        "array",
        "hash table",
        "string",
        "dynamic programming",
        "tree"
      ]);
    });

    it("returns default focus areas when provided is undefined", () => {
      const result = getInitialFocusAreas(undefined);
      expect(result).toEqual([
        "array",
        "hash table",
        "string",
        "dynamic programming",
        "tree"
      ]);
    });
  });

  describe("createDashboardProblemMappings", () => {
    const mockProblems = [
      { problem_id: "p1", leetcode_id: 1 },
      { problem_id: "p2", leetcode_id: 2 },
      { problem_id: "p3", leetcode_id: 999 } // No matching standard problem
    ];

    const mockStandardProblems = [
      { id: 1, tags: ["array", "hash table"], difficulty: "Easy" },
      { id: 2, tags: ["linked list"], difficulty: "Medium" }
    ];

    it("creates standardProblemsMap as a plain object", () => {
      const { standardProblemsMap } = createDashboardProblemMappings(mockProblems, mockStandardProblems);

      expect(typeof standardProblemsMap).toBe("object");
      expect(standardProblemsMap[1]).toEqual(mockStandardProblems[0]);
      expect(standardProblemsMap[2]).toEqual(mockStandardProblems[1]);
    });

    it("creates problemTagsMap with tags from standard problems", () => {
      const { problemTagsMap } = createDashboardProblemMappings(mockProblems, mockStandardProblems);

      expect(problemTagsMap.get("p1")).toEqual(["array", "hash table"]);
      expect(problemTagsMap.get("p2")).toEqual(["linked list"]);
      expect(problemTagsMap.has("p3")).toBe(false); // No matching standard problem
    });

    it("creates problemDifficultyMap with difficulty from standard problems", () => {
      const { problemDifficultyMap } = createDashboardProblemMappings(mockProblems, mockStandardProblems);

      expect(problemDifficultyMap["p1"]).toBe("Easy");
      expect(problemDifficultyMap["p2"]).toBe("Medium");
      expect(problemDifficultyMap["p3"]).toBeUndefined();
    });

    it("handles empty arrays", () => {
      const { standardProblemsMap, problemTagsMap, problemDifficultyMap } =
        createDashboardProblemMappings([], []);

      expect(Object.keys(standardProblemsMap)).toHaveLength(0);
      expect(problemTagsMap.size).toBe(0);
      expect(Object.keys(problemDifficultyMap)).toHaveLength(0);
    });

    it("handles standard problems with missing tags", () => {
      const problemsWithMissingTags = [{ id: 1, difficulty: "Easy" }];
      const problems = [{ problem_id: "p1", leetcode_id: 1 }];

      const { problemTagsMap } = createDashboardProblemMappings(problems, problemsWithMissingTags);

      expect(problemTagsMap.get("p1")).toEqual([]);
    });
  });

  describe("applyFiltering", () => {
    const mockProblems = [
      { problem_id: "p1" },
      { problem_id: "p2" },
      { problem_id: "p3" }
    ];

    const mockAttempts = [
      { problem_id: "p1", attempt_date: "2025-01-15T10:00:00Z" },
      { problem_id: "p2", attempt_date: "2025-01-20T10:00:00Z" },
      { problem_id: "p3", attempt_date: "2025-02-01T10:00:00Z" }
    ];

    const mockSessions = [
      { id: "s1", date: "2025-01-15T10:00:00Z" },
      { id: "s2", date: "2025-01-20T10:00:00Z" },
      { id: "s3", date: "2025-02-01T10:00:00Z" }
    ];

    const problemTagsMap = new Map([
      ["p1", ["array", "hash table"]],
      ["p2", ["linked list"]],
      ["p3", ["array", "tree"]]
    ]);

    it("returns all data when no filters applied", () => {
      const result = applyFiltering({
        allProblems: mockProblems,
        allAttempts: mockAttempts,
        allSessions: mockSessions,
        problemTagsMap,
        focusAreaFilter: null,
        dateRange: null
      });

      expect(result.filteredProblems).toHaveLength(3);
      expect(result.filteredAttempts).toHaveLength(3);
      expect(result.filteredSessions).toHaveLength(3);
    });

    it("filters by focus area tags (case-insensitive)", () => {
      const result = applyFiltering({
        allProblems: mockProblems,
        allAttempts: mockAttempts,
        allSessions: mockSessions,
        problemTagsMap,
        focusAreaFilter: ["Array"], // uppercase
        dateRange: null
      });

      expect(result.filteredProblems).toHaveLength(2); // p1 and p3 have "array"
      expect(result.filteredProblems.map(p => p.problem_id)).toEqual(["p1", "p3"]);
    });

    it("filters by date range", () => {
      const result = applyFiltering({
        allProblems: mockProblems,
        allAttempts: mockAttempts,
        allSessions: mockSessions,
        problemTagsMap,
        focusAreaFilter: null,
        dateRange: {
          startDate: "2025-01-10",
          endDate: "2025-01-25"
        }
      });

      expect(result.filteredAttempts).toHaveLength(2); // Jan 15 and Jan 20
      expect(result.filteredSessions).toHaveLength(2);
    });

    it("applies both filters together", () => {
      const result = applyFiltering({
        allProblems: mockProblems,
        allAttempts: mockAttempts,
        allSessions: mockSessions,
        problemTagsMap,
        focusAreaFilter: ["array"],
        dateRange: {
          startDate: "2025-01-01",
          endDate: "2025-01-31"
        }
      });

      // Focus filter: p1, p3 have array tag
      // Date filter on attempts: Jan 15 (p1) is in range, Feb 1 (p3) is not
      expect(result.filteredProblems).toHaveLength(2);
      expect(result.filteredAttempts).toHaveLength(1);
    });

    it("handles empty focus area filter array", () => {
      const result = applyFiltering({
        allProblems: mockProblems,
        allAttempts: mockAttempts,
        allSessions: mockSessions,
        problemTagsMap,
        focusAreaFilter: [],
        dateRange: null
      });

      expect(result.filteredProblems).toHaveLength(3);
    });

    it("supports PascalCase attempt fields", () => {
      const pascalAttempts = [
        { ProblemID: "p1", AttemptDate: "2025-01-15T10:00:00Z" }
      ];

      const result = applyFiltering({
        allProblems: mockProblems,
        allAttempts: pascalAttempts,
        allSessions: mockSessions,
        problemTagsMap,
        focusAreaFilter: ["array"],
        dateRange: null
      });

      expect(result.filteredAttempts).toHaveLength(1);
    });
  });

  describe("calculateCoreStatistics", () => {
    it("categorizes problems by box level correctly", () => {
      const problems = [
        { problem_id: "p1", box_level: 1 },  // new
        { problem_id: "p2", box_level: 3 },  // in progress
        { problem_id: "p3", box_level: 7 },  // mastered
        { problem_id: "p4", box_level: 5 },  // in progress
        { problem_id: "p5", box_level: 7 }   // mastered
      ];

      const { statistics } = calculateCoreStatistics(problems, [], {});

      expect(statistics.new).toBe(1);
      expect(statistics.inProgress).toBe(2);
      expect(statistics.mastered).toBe(2);
      expect(statistics.totalSolved).toBe(4); // mastered + inProgress
    });

    it("supports PascalCase BoxLevel field", () => {
      const problems = [
        { problem_id: "p1", BoxLevel: 1 },
        { problem_id: "p2", BoxLevel: 7 }
      ];

      const { statistics } = calculateCoreStatistics(problems, [], {});

      expect(statistics.new).toBe(1);
      expect(statistics.mastered).toBe(1);
    });

    it("defaults to box level 1 when missing", () => {
      const problems = [{ problem_id: "p1" }]; // no box_level

      const { statistics } = calculateCoreStatistics(problems, [], {});

      expect(statistics.new).toBe(1);
    });

    it("calculates time statistics by difficulty", () => {
      const attempts = [
        { problem_id: "p1", time_spent: 600, success: true },  // 10 min Easy
        { problem_id: "p2", time_spent: 1200, success: false } // 20 min Medium
      ];

      const difficultyMap = {
        "p1": "Easy",
        "p2": "Medium"
      };

      const { timeStats } = calculateCoreStatistics([], attempts, difficultyMap);

      expect(timeStats.overall.totalTime).toBe(1800);
      expect(timeStats.overall.count).toBe(2);
      expect(timeStats.Easy.totalTime).toBe(600);
      expect(timeStats.Easy.count).toBe(1);
      expect(timeStats.Medium.totalTime).toBe(1200);
      expect(timeStats.Medium.count).toBe(1);
    });

    it("calculates success statistics by difficulty", () => {
      const attempts = [
        { problem_id: "p1", time_spent: 600, success: true },
        { problem_id: "p2", time_spent: 1200, success: false },
        { problem_id: "p3", time_spent: 900, success: true }
      ];

      const difficultyMap = {
        "p1": "Easy",
        "p2": "Medium",
        "p3": "Easy"
      };

      const { successStats } = calculateCoreStatistics([], attempts, difficultyMap);

      expect(successStats.overall.successful).toBe(2);
      expect(successStats.overall.total).toBe(3);
      expect(successStats.Easy.successful).toBe(2);
      expect(successStats.Easy.total).toBe(2);
      expect(successStats.Medium.successful).toBe(0);
      expect(successStats.Medium.total).toBe(1);
    });

    it("supports PascalCase attempt fields", () => {
      const attempts = [
        { ProblemID: "p1", TimeSpent: 600, Success: true }
      ];

      const difficultyMap = { "p1": "Easy" };

      const { timeStats, successStats } = calculateCoreStatistics([], attempts, difficultyMap);

      expect(timeStats.Easy.totalTime).toBe(600);
      expect(successStats.Easy.successful).toBe(1);
    });

    it("handles empty arrays", () => {
      const { statistics, timeStats, successStats } = calculateCoreStatistics([], [], {});

      expect(statistics.totalSolved).toBe(0);
      expect(timeStats.overall.count).toBe(0);
      expect(successStats.overall.total).toBe(0);
    });
  });

  describe("calculateDerivedMetrics", () => {
    it("calculates average time in minutes with one decimal", () => {
      const timeStats = {
        overall: { totalTime: 3600, count: 4 }, // 900s avg = 15 min
        Easy: { totalTime: 600, count: 2 },     // 300s avg = 5 min
        Medium: { totalTime: 1800, count: 2 },  // 900s avg = 15 min
        Hard: { totalTime: 0, count: 0 }
      };

      const successStats = {
        overall: { successful: 3, total: 4 },
        Easy: { successful: 2, total: 2 },
        Medium: { successful: 1, total: 2 },
        Hard: { successful: 0, total: 0 }
      };

      const { averageTime, successRate } = calculateDerivedMetrics(timeStats, successStats);

      expect(averageTime.overall).toBe(15);
      expect(averageTime.Easy).toBe(5);
      expect(averageTime.Medium).toBe(15);
      expect(averageTime.Hard).toBe(0);
    });

    it("calculates success rate as integer percentage", () => {
      const timeStats = {
        overall: { totalTime: 0, count: 0 },
        Easy: { totalTime: 0, count: 0 },
        Medium: { totalTime: 0, count: 0 },
        Hard: { totalTime: 0, count: 0 }
      };

      const successStats = {
        overall: { successful: 3, total: 4 },   // 75%
        Easy: { successful: 2, total: 2 },      // 100%
        Medium: { successful: 1, total: 3 },    // 33%
        Hard: { successful: 0, total: 1 }       // 0%
      };

      const { successRate } = calculateDerivedMetrics(timeStats, successStats);

      expect(successRate.overall).toBe(75);
      expect(successRate.Easy).toBe(100);
      expect(successRate.Medium).toBe(33);
      expect(successRate.Hard).toBe(0);
    });

    it("returns 0 for empty data", () => {
      const timeStats = {
        overall: { totalTime: 0, count: 0 },
        Easy: { totalTime: 0, count: 0 },
        Medium: { totalTime: 0, count: 0 },
        Hard: { totalTime: 0, count: 0 }
      };

      const successStats = {
        overall: { successful: 0, total: 0 },
        Easy: { successful: 0, total: 0 },
        Medium: { successful: 0, total: 0 },
        Hard: { successful: 0, total: 0 }
      };

      const { averageTime, successRate } = calculateDerivedMetrics(timeStats, successStats);

      expect(averageTime.overall).toBe(0);
      expect(successRate.overall).toBe(0);
    });
  });

  describe("calculateProgressMetrics", () => {
    it("returns counts of attempts and sessions", () => {
      const attempts = [{}, {}, {}];
      const sessions = [{}, {}];

      const result = calculateProgressMetrics(attempts, sessions, {});

      expect(result.totalAttempts).toBe(3);
      expect(result.totalSessions).toBe(2);
    });

    it("handles empty arrays", () => {
      const result = calculateProgressMetrics([], [], {});

      expect(result.totalAttempts).toBe(0);
      expect(result.totalSessions).toBe(0);
    });
  });

  describe("calculateStrategySuccessRate", () => {
    it("calculates success rate for guided sessions", () => {
      const sessions = [
        { id: "s1", session_type: "standard" },
        { id: "s2", session_type: "interview-like" },
        { id: "s3", session_type: "free-practice" } // not guided
      ];

      const attempts = [
        { session_id: "s1", success: true },
        { session_id: "s1", success: true },
        { session_id: "s2", success: false },
        { session_id: "s3", success: true } // not counted
      ];

      const result = calculateStrategySuccessRate(sessions, attempts);

      // 2 successful out of 3 guided attempts = 67%
      expect(result).toBe(67);
    });

    it("returns number not object (Issue #214 bug fix)", () => {
      const sessions = [{ id: "s1", session_type: "standard" }];
      const attempts = [{ session_id: "s1", success: true }];

      const result = calculateStrategySuccessRate(sessions, attempts);

      expect(typeof result).toBe("number");
      expect(result).toBe(100);
    });

    it("supports PascalCase Success and SessionID fields", () => {
      const sessions = [{ id: "s1", session_type: "standard" }];
      const attempts = [
        { SessionID: "s1", Success: true },
        { SessionID: "s1", Success: false }
      ];

      const result = calculateStrategySuccessRate(sessions, attempts);

      expect(result).toBe(50);
    });

    it("includes full-interview session type", () => {
      const sessions = [{ id: "s1", session_type: "full-interview" }];
      const attempts = [{ session_id: "s1", success: true }];

      const result = calculateStrategySuccessRate(sessions, attempts);

      expect(result).toBe(100);
    });

    it("returns 0 when no guided sessions", () => {
      const sessions = [{ id: "s1", session_type: "free-practice" }];
      const attempts = [{ session_id: "s1", success: true }];

      const result = calculateStrategySuccessRate(sessions, attempts);

      expect(result).toBe(0);
    });

    it("returns 0 when no attempts", () => {
      const sessions = [{ id: "s1", session_type: "standard" }];

      const result = calculateStrategySuccessRate(sessions, []);

      expect(result).toBe(0);
    });

    it("handles empty arrays", () => {
      const result = calculateStrategySuccessRate([], []);

      expect(result).toBe(0);
    });
  });

  describe("validateSession", () => {
    it("returns error object for null session", () => {
      const result = validateSession(null);

      expect(result).toEqual({
        nextReviewTime: "No active session",
        nextReviewCount: 0
      });
    });

    it("returns error object for undefined session", () => {
      const result = validateSession(undefined);

      expect(result).toEqual({
        nextReviewTime: "No active session",
        nextReviewCount: 0
      });
    });

    it("returns error object for non-object session", () => {
      const result = validateSession("not an object");

      expect(result).toEqual({
        nextReviewTime: "Invalid session type",
        nextReviewCount: 0
      });
    });

    it("returns null for valid session object", () => {
      const result = validateSession({ id: "session1", problems: [] });

      expect(result).toBeNull();
    });
  });

  describe("constructDashboardData", () => {
    it("constructs flattened dashboard data structure", () => {
      const input = {
        statistics: { totalSolved: 10 },
        averageTime: { overall: 15 },
        successRate: { overall: 75 },
        timerBehavior: "normal",
        timerPercentage: 80,
        learningStatus: "active",
        progressTrend: "improving",
        progressPercentage: 50,
        strategySuccessRate: 70,
        nextReviewTime: "Today",
        nextReviewCount: 5,
        sessionAnalytics: {},
        masteryData: {},
        goalsData: {},
        learningEfficiencyData: {},
        hintsUsed: 3,
        filteredProblems: [{ id: 1 }],
        filteredAttempts: [{ id: 1 }],
        filteredSessions: [{ id: 1 }],
        allProblems: [{ id: 1 }, { id: 2 }],
        allAttempts: [{ id: 1 }, { id: 2 }],
        allSessions: [{ id: 1 }, { id: 2 }],
        learningState: { tier: 1 },
        boxLevelData: { 1: 5 },
        standardProblemsMap: { 1: { id: 1 } },
        focusAreaFilter: ["array"],
        dateRange: { startDate: "2025-01-01" }
      };

      const result = constructDashboardData(input);

      // Check flattened properties
      expect(result.statistics).toEqual({ totalSolved: 10 });
      expect(result.averageTime).toEqual({ overall: 15 });
      expect(result.successRate).toEqual({ overall: 75 });
      expect(result.strategySuccessRate).toBe(70);
      expect(result.hintsUsed).toBe(3);

      // Check nested structure exists
      expect(result.nested.statistics.statistics).toEqual({ totalSolved: 10 });
      expect(result.nested.progress.boxLevelData).toEqual({ 1: 5 });

      // Check filter metadata
      expect(result.filters.appliedFilters.hasFocusAreaFilter).toBe(true);
      expect(result.filters.appliedFilters.hasDateFilter).toBe(true);
      expect(result.filters.originalCounts.problems).toBe(2);
      expect(result.filters.filteredCounts.problems).toBe(1);
    });

    it("handles missing optional data with defaults", () => {
      const input = {
        statistics: {},
        averageTime: {},
        successRate: {},
        filteredProblems: [],
        filteredAttempts: [],
        filteredSessions: [],
        allProblems: [],
        allAttempts: [],
        allSessions: [],
        focusAreaFilter: null,
        dateRange: null
      };

      const result = constructDashboardData(input);

      expect(result.boxLevelData).toEqual({});
      expect(result.learningState).toEqual({});
      expect(result.standardProblemsMap).toEqual({});
      // hasFocusAreaFilter is falsy (null when focusAreaFilter is null)
      expect(result.filters.appliedFilters.hasFocusAreaFilter).toBeFalsy();
      expect(result.filters.appliedFilters.hasDateFilter).toBe(false);
    });
  });
});
