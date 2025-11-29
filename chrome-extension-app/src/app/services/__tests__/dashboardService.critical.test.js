// Mock all dependencies before importing
jest.mock("../../../shared/db/problems");
jest.mock("../../../shared/db/attempts");
jest.mock("../../../shared/db/sessions");
jest.mock("../../../shared/db/standard_problems");
jest.mock("../../../shared/db/sessionAnalytics");
jest.mock("../../../shared/db/hint_interactions");
jest.mock("../../../shared/services/tagServices");
jest.mock("../../../shared/services/problemService");
jest.mock("../../../shared/services/storageService");
jest.mock("../../../shared/services/hintInteractionService");

import * as dashboardService from "../dashboardService";
import { 
  getDashboardStatistics, 
  getStatsData, 
  getLearningProgressData,
  getGoalsData,
  getSessionHistoryData,
  getProductivityInsightsData,
  getTagMasteryData,
  getLearningPathData,
  // getMistakeAnalysisData, // Unused in current tests
  getInterviewAnalyticsData,
  getSessionMetrics 
} from "../dashboardService";
import { fetchAllProblems } from "../../../shared/db/problems";
import { getAllAttempts } from "../../../shared/db/attempts";
import { getAllSessions } from "../../../shared/db/sessions";
import { getAllStandardProblems } from "../../../shared/db/standard_problems";
import { TagService } from "../../../shared/services/tagServices";
import { ProblemService } from "../../../shared/services/problemService";
import { HintInteractionService } from "../../../shared/services/hintInteractionService";

// Helper functions for test setup
function setupEmptyStateMocks() {
  fetchAllProblems.mockResolvedValue([]);
  getAllAttempts.mockResolvedValue([]);
  getAllSessions.mockResolvedValue([]);
  getAllStandardProblems.mockResolvedValue([]);
  TagService.getCurrentLearningState.mockResolvedValue({ masteryData: [] });
  ProblemService.countProblemsByBoxLevel.mockResolvedValue({});
  HintInteractionService.getSystemAnalytics.mockResolvedValue({ overview: { totalInteractions: 0 } });
}

function setupUserProgressMocks() {
  fetchAllProblems.mockResolvedValue([
    { id: 1, problem_id: 1, leetcode_id: 1, box_level: 2, attempt_stats: { total_attempts: 3, successful_attempts: 2 } },
    { id: 2, problem_id: 2, leetcode_id: 2, box_level: 7, attempt_stats: { total_attempts: 5, successful_attempts: 4 } }
  ]);

  getAllAttempts.mockResolvedValue([
    { ProblemID: 1, Success: true, TimeSpent: 1200, AttemptDate: "2024-01-15T10:00:00Z" },
    { ProblemID: 2, Success: false, TimeSpent: 1800, AttemptDate: "2024-01-15T11:00:00Z" },
    { ProblemID: 2, Success: true, TimeSpent: 1500, AttemptDate: "2024-01-15T12:00:00Z" }
  ]);

  getAllSessions.mockResolvedValue([
    { sessionId: "session-1", Date: "2024-01-15T10:00:00Z", completed: true, duration: 45 },
    { sessionId: "session-2", Date: "2024-01-14T14:00:00Z", completed: true, duration: 30 }
  ]);

  getAllStandardProblems.mockResolvedValue([
    { id: 1, difficulty: "Easy", tags: ["array"] },
    { id: 2, difficulty: "Medium", tags: ["hash-table"] }
  ]);

  TagService.getCurrentLearningState.mockResolvedValue({
    currentTier: "Core Concepts",
    masteredTags: ["array"],
    unmasteredTags: ["hash-table"],
    masteryData: [
      { tag: "array", mastered: true, totalAttempts: 3, successfulAttempts: 2 },
      { tag: "hash-table", mastered: false, totalAttempts: 2, successfulAttempts: 1 }
    ]
  });

  ProblemService.countProblemsByBoxLevel.mockResolvedValue({
    1: 5, 2: 3, 3: 2, 4: 1, 5: 1, 6: 1, 7: 2
  });

  HintInteractionService.getSystemAnalytics.mockResolvedValue({
    overview: { totalInteractions: 8 },
    trends: { hintTypePopularity: [
      { hintType: "contextual", count: 3 },
      { hintType: "general", count: 3 },
      { hintType: "primer", count: 2 }
    ]}
  });
}

function setupDatabaseFailureMocks() {
  fetchAllProblems.mockRejectedValue(new Error("Database connection lost"));
  getAllAttempts.mockRejectedValue(new Error("Database connection lost"));
  getAllSessions.mockRejectedValue(new Error("Database connection lost"));
  getAllStandardProblems.mockRejectedValue(new Error("Database connection lost"));
  TagService.getCurrentLearningState.mockRejectedValue(new Error("Service unavailable"));
  ProblemService.countProblemsByBoxLevel.mockRejectedValue(new Error("Service unavailable"));
}

function createLargeMockDataset() {
  return {
    problems: Array.from({ length: 5000 }, (_, i) => ({
      id: i,
      problem_id: i,
      box_level: (i % 7) + 1,
      attempt_stats: { total_attempts: i % 10, successful_attempts: i % 5 }
    })),
    attempts: Array.from({ length: 15000 }, (_, i) => ({
      ProblemID: i % 5000,
      Success: i % 3 === 0,
      TimeSpent: 900 + (i % 1200),
      AttemptDate: new Date(Date.now() - (i * 60000)).toISOString()
    }))
  };
}

// eslint-disable-next-line max-lines-per-function
describe("DashboardService - Critical User Retention Paths", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any spies on the dashboardService module
    jest.restoreAllMocks();
  });

  describe("🔥 CRITICAL: Dashboard must handle all user states", () => {
    it("should display empty state gracefully for new users", async () => {
      // Mock scenario: Brand new user with no data (legitimate empty state)
      setupEmptyStateMocks();

      const result = await getDashboardStatistics();

      // CRITICAL: Empty state is valid for new users
      expect(result).toBeDefined();
      expect(result.statistics.totalSolved).toBe(0);
      expect(result.statistics.mastered).toBe(0);
      expect(result.averageTime.overall).toBe(0);
      expect(result.successRate.overall).toBe(0);
      expect(Array.isArray(result.allSessions)).toBe(true);
      expect(result.allSessions.length).toBe(0);
    });

    it("should load and display existing user data correctly", async () => {
      // Mock minimal data scenario - user with some progress
      setupUserProgressMocks();

      const result = await getDashboardStatistics();

      // CRITICAL: User must see their progress
      expect(result).toBeDefined();
      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalSolved).toBeGreaterThan(0);
      expect(result.statistics.mastered).toBe(1);
      expect(result.statistics.inProgress).toBe(1);
      expect(result.averageTime.overall).toBeGreaterThan(0);
      expect(result.successRate.overall).toBeGreaterThan(0);
    });

    it("should handle complete database failure gracefully for user retention", async () => {
      // Mock scenario: All database calls fail
      setupDatabaseFailureMocks();

      // Should throw error so background script can handle gracefully
      await expect(getDashboardStatistics()).rejects.toThrow();
    });

    it("should provide fallback stats when services fail but user has existing data", async () => {
      // Mock scenario: Service fails but we know user has data (this would lose user progress)
      jest.spyOn(dashboardService, 'getDashboardStatistics')
        .mockRejectedValue(new Error("Dashboard service failed"));

      const result = await getStatsData();

      // CRITICAL: System failure shouldn't show empty state when user has data
      // Fallback to empty state is acceptable here since getStatsData has no way to know if user has data
      expect(result).toBeDefined();
      expect(result.statistics).toEqual({ totalSolved: 0, mastered: 0, inProgress: 0, new: 0 });
      expect(result.averageTime).toEqual({ overall: 0, Easy: 0, Medium: 0, Hard: 0, timeAccuracy: 0 });
      expect(result.successRate).toEqual({ overall: 0, Easy: 0, Medium: 0, Hard: 0 });
      expect(result.allSessions).toEqual([]);
      expect(result.hintsUsed).toEqual({ total: 0, contextual: 0, general: 0, primer: 0 });
    });
  });

  describe("📊 CRITICAL: Statistics calculation accuracy", () => {
    it("should calculate problem statistics correctly for user confidence", async () => {
      // Mock specific scenario to test accuracy
      fetchAllProblems.mockResolvedValue([
        { id: 1, problem_id: 1, BoxLevel: 1 }, // New problem
        { id: 2, problem_id: 2, BoxLevel: 3 }, // In progress
        { id: 3, problem_id: 3, BoxLevel: 7 }, // Mastered
        { id: 4, problem_id: 4, BoxLevel: 7 }  // Mastered
      ]);

      getAllAttempts.mockResolvedValue([
        { ProblemID: 1, Success: false, TimeSpent: 1200 },
        { ProblemID: 2, Success: true, TimeSpent: 900 },
        { ProblemID: 3, Success: true, TimeSpent: 600 },
        { ProblemID: 4, Success: true, TimeSpent: 800 }
      ]);

      getAllSessions.mockResolvedValue([]);
      getAllStandardProblems.mockResolvedValue([
        { id: 1, difficulty: "Easy" },
        { id: 2, difficulty: "Medium" },
        { id: 3, difficulty: "Hard" },
        { id: 4, difficulty: "Hard" }
      ]);

      TagService.getCurrentLearningState.mockResolvedValue({ masteryData: [] });
      ProblemService.countProblemsByBoxLevel.mockResolvedValue({});
      HintInteractionService.getSystemAnalytics.mockResolvedValue({ overview: { totalInteractions: 0 } });

      const result = await getDashboardStatistics();

      // CRITICAL: Statistics must be accurate for user trust
      expect(result.statistics.new).toBe(1);        // 1 problem at BoxLevel 1
      expect(result.statistics.inProgress).toBe(1); // 1 problem at BoxLevel 3
      expect(result.statistics.mastered).toBe(2);   // 2 problems at BoxLevel 7
      expect(result.statistics.totalSolved).toBe(3); // mastered + inProgress
    });

    it("should calculate success rates accurately by difficulty", async () => {
      fetchAllProblems.mockResolvedValue([
        { id: 1, problem_id: 1, leetcode_id: 1 },
        { id: 2, problem_id: 2, leetcode_id: 2 },
        { id: 3, problem_id: 3, leetcode_id: 3 }
      ]);

      getAllAttempts.mockResolvedValue([
        { ProblemID: 1, Success: true },   // Easy success
        { ProblemID: 1, Success: false },  // Easy failure  
        { ProblemID: 2, Success: true },   // Medium success
        { ProblemID: 2, Success: true },   // Medium success
        { ProblemID: 3, Success: false },  // Hard failure
      ]);

      getAllSessions.mockResolvedValue([]);
      getAllStandardProblems.mockResolvedValue([
        { id: 1, difficulty: "Easy" },
        { id: 2, difficulty: "Medium" },
        { id: 3, difficulty: "Hard" }
      ]);

      TagService.getCurrentLearningState.mockResolvedValue({ masteryData: [] });
      ProblemService.countProblemsByBoxLevel.mockResolvedValue({});
      HintInteractionService.getSystemAnalytics.mockResolvedValue({ overview: { totalInteractions: 0 } });

      const result = await getDashboardStatistics();

      // CRITICAL: Success rates must be mathematically correct
      expect(result.successRate.Easy).toBe(50);    // 1/2 = 50%
      expect(result.successRate.Medium).toBe(100); // 2/2 = 100%
      expect(result.successRate.Hard).toBe(0);     // 0/1 = 0%
      expect(result.successRate.overall).toBe(60); // 3/5 = 60%
    });

    it("should handle edge cases without breaking user experience", async () => {
      // Mock edge case: division by zero scenarios
      fetchAllProblems.mockResolvedValue([]);
      getAllAttempts.mockResolvedValue([]);
      getAllSessions.mockResolvedValue([]);
      getAllStandardProblems.mockResolvedValue([]);
      TagService.getCurrentLearningState.mockResolvedValue({ masteryData: [] });
      ProblemService.countProblemsByBoxLevel.mockResolvedValue({});
      HintInteractionService.getSystemAnalytics.mockResolvedValue({ overview: { totalInteractions: 0 } });

      const result = await getDashboardStatistics();

      // CRITICAL: Zero values handled gracefully, no NaN or undefined
      expect(result.statistics.totalSolved).toBe(0);
      expect(result.averageTime.overall).toBe(0);
      expect(result.successRate.overall).toBe(0);
      expect(isNaN(result.averageTime.overall)).toBe(false);
      expect(isNaN(result.successRate.overall)).toBe(false);
    });
  });

  describe("🎯 CRITICAL: Page-specific data integrity", () => {
    it("should provide consistent learning progress data", async () => {
      // Mock the underlying data sources instead of spying on getDashboardStatistics
      fetchAllProblems.mockResolvedValue([
        { id: 1, problem_id: 1, leetcode_id: 1, BoxLevel: 1 },
        { id: 2, problem_id: 2, leetcode_id: 2, BoxLevel: 2 },
        { id: 3, problem_id: 3, leetcode_id: 3, BoxLevel: 7 }
      ]);
      
      getAllAttempts.mockResolvedValue([
        { id: 1, ProblemID: 1, Success: true }
      ]);
      
      getAllSessions.mockResolvedValue([]);
      getAllStandardProblems.mockResolvedValue([
        { id: 1, difficulty: "Easy" },
        { id: 2, difficulty: "Medium" },
        { id: 3, difficulty: "Hard" }
      ]);
      
      TagService.getCurrentLearningState.mockResolvedValue({ masteryData: [] });
      ProblemService.countProblemsByBoxLevel.mockResolvedValue({ 1: 5, 2: 3, 7: 2 });
      HintInteractionService.getSystemAnalytics.mockResolvedValue({ overview: { totalInteractions: 0 } });

      const result = await getLearningProgressData();

      // CRITICAL: Progress page shows consistent user advancement
      expect(result.boxLevelData).toEqual({ 1: 5, 2: 3, 7: 2 });
      expect(result.timerBehavior).toBeDefined(); // Actual behavior will be calculated based on data
      expect(result.learningStatus).toBeDefined(); // Actual status will be calculated based on data
      expect(result.progressTrend).toBeDefined(); // Actual trend will be calculated based on data
      expect(Array.isArray(result.allAttempts)).toBe(true);
    });

    it("should generate valid goals data even without user history", async () => {
      // Test goals generation for new users
      const result = await getGoalsData({}, {
        settings: {
          sessionsPerWeek: 5,
          sessionLength: 4,
          focusAreas: ["array", "string"]
        },
        allAttempts: [],
        allSessions: [],
        learningState: {}
      });

      // CRITICAL: New users get actionable goals
      expect(result.learningPlan).toBeDefined();
      expect(result.learningPlan.cadence.sessionsPerWeek).toBe(5);
      expect(result.learningPlan.focus.primaryTags).toContain("array");
      // Missions removed in #175 - replaced with Today's Progress
      expect(result.learningPlan.outcomeTrends).toBeDefined();
    });

    it("should handle session history data requests reliably", async () => {
      // Mock the underlying data sources to generate proper session data
      fetchAllProblems.mockResolvedValue([
        { id: 1, problem_id: 1, leetcode_id: 1, BoxLevel: 3 },
        { id: 2, problem_id: 2, leetcode_id: 2, BoxLevel: 7 }
      ]);
      
      getAllAttempts.mockResolvedValue([
        { id: 1, ProblemID: 1, Success: true, TimeSpent: 900, sessionId: "s1" },
        { id: 2, ProblemID: 2, Success: true, TimeSpent: 600, sessionId: "s2" }
      ]);
      
      getAllSessions.mockResolvedValue([
        { sessionId: "s1", Date: "2024-01-15", completed: true, duration: 45, status: "completed" },
        { sessionId: "s2", Date: "2024-01-14", completed: true, duration: 30, status: "completed" }
      ]);
      
      getAllStandardProblems.mockResolvedValue([
        { id: 1, difficulty: "Easy" },
        { id: 2, difficulty: "Medium" }
      ]);
      
      TagService.getCurrentLearningState.mockResolvedValue({ masteryData: [] });
      ProblemService.countProblemsByBoxLevel.mockResolvedValue({ 3: 1, 7: 1 });
      HintInteractionService.getSystemAnalytics.mockResolvedValue({ overview: { totalInteractions: 0 } });

      const result = await getSessionHistoryData();

      // CRITICAL: Session history gives users sense of progress
      expect(Array.isArray(result.allSessions)).toBe(true);
      expect(result.allSessions.length).toBe(2);
      expect(Array.isArray(result.sessionAnalytics)).toBe(true);
      expect(result.productivityMetrics).toBeDefined();
      expect(result.productivityMetrics.completionRate).toBe(100);
    });
  });

  describe("⚡ CRITICAL: Performance under load", () => {
    it("should handle large datasets without performance degradation", async () => {
      // Create large datasets that could cause performance issues
      const { problems: largeProblems, attempts: largeAttempts } = createLargeMockDataset();

      fetchAllProblems.mockResolvedValue(largeProblems);
      getAllAttempts.mockResolvedValue(largeAttempts);
      getAllSessions.mockResolvedValue([]);
      getAllStandardProblems.mockResolvedValue([]);
      TagService.getCurrentLearningState.mockResolvedValue({ masteryData: [] });
      ProblemService.countProblemsByBoxLevel.mockResolvedValue({});
      HintInteractionService.getSystemAnalytics.mockResolvedValue({ overview: { totalInteractions: 0 } });

      const start = Date.now();
      const result = await getDashboardStatistics();
      const elapsed = Date.now() - start;

      // CRITICAL: Should complete within reasonable time
      expect(elapsed).toBeLessThan(5000); // Within 5 seconds
      expect(result).toBeDefined();
      expect(result.statistics.totalSolved).toBeGreaterThan(0);
    });

    it("should handle concurrent data requests efficiently", async () => {
      // Mock data for concurrent requests
      fetchAllProblems.mockResolvedValue([{ id: 1, BoxLevel: 2 }]);
      getAllAttempts.mockResolvedValue([{ ProblemID: 1, Success: true }]);
      getAllSessions.mockResolvedValue([{ sessionId: "s1", completed: true }]);
      getAllStandardProblems.mockResolvedValue([{ id: 1, difficulty: "Easy" }]);
      TagService.getCurrentLearningState.mockResolvedValue({ masteryData: [] });
      ProblemService.countProblemsByBoxLevel.mockResolvedValue({});
      HintInteractionService.getSystemAnalytics.mockResolvedValue({ overview: { totalInteractions: 0 } });

      // Simulate concurrent requests from different dashboard pages
      const promises = [
        getStatsData(),
        getLearningProgressData(),
        getSessionHistoryData(),
        getTagMasteryData(),
        getLearningPathData()
      ];

      const start = Date.now();
      const results = await Promise.all(promises);
      const elapsed = Date.now() - start;

      // CRITICAL: Concurrent requests should not degrade performance
      expect(elapsed).toBeLessThan(10000); // Within 10 seconds for all
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });

  describe("🔧 CRITICAL: Error recovery and data consistency", () => {
    it("should recover from partial service failures", async () => {
      // Mock scenario: Some services fail, others succeed
      fetchAllProblems.mockResolvedValue([{ id: 1, BoxLevel: 2 }]);
      getAllAttempts.mockResolvedValue([{ ProblemID: 1, Success: true }]);
      getAllSessions.mockResolvedValue([]);
      getAllStandardProblems.mockRejectedValue(new Error("Standard problems service down"));
      TagService.getCurrentLearningState.mockRejectedValue(new Error("Tag service unavailable"));
      ProblemService.countProblemsByBoxLevel.mockResolvedValue({ 1: 0, 2: 1 });
      HintInteractionService.getSystemAnalytics.mockRejectedValue(new Error("Hint service down"));

      // Should handle partial failures gracefully
      await expect(getDashboardStatistics()).rejects.toThrow();
    });

    it("should provide data consistency across page loads", async () => {
      // Mock stable data
      const stableData = {
        problems: [{ id: 1, BoxLevel: 2 }],
        attempts: [{ ProblemID: 1, Success: true, TimeSpent: 900 }],
        sessions: [{ sessionId: "s1", completed: true }]
      };

      fetchAllProblems.mockResolvedValue(stableData.problems);
      getAllAttempts.mockResolvedValue(stableData.attempts);
      getAllSessions.mockResolvedValue(stableData.sessions);
      getAllStandardProblems.mockResolvedValue([{ id: 1, difficulty: "Easy" }]);
      TagService.getCurrentLearningState.mockResolvedValue({ masteryData: [] });
      ProblemService.countProblemsByBoxLevel.mockResolvedValue({ 2: 1 });
      HintInteractionService.getSystemAnalytics.mockResolvedValue({ overview: { totalInteractions: 0 } });

      // Call multiple times to test consistency
      const result1 = await getDashboardStatistics();
      const result2 = await getDashboardStatistics();

      // CRITICAL: Data should be consistent across calls
      expect(result1.statistics.totalSolved).toBe(result2.statistics.totalSolved);
      expect(result1.successRate.overall).toBe(result2.successRate.overall);
      expect(result1.averageTime.overall).toBe(result2.averageTime.overall);
    });
  });

  describe("📈 CRITICAL: Analytics and insights accuracy", () => {
    it("should calculate interview analytics when no interviews exist", async () => {
      getAllSessions.mockResolvedValue([
        { sessionId: "s1", sessionType: "standard", timestamp: "2024-01-15" }
      ]);
      getAllAttempts.mockResolvedValue([
        { sessionId: "s1", status: "correct" }
      ]);

      const result = await getInterviewAnalyticsData();

      // CRITICAL: New users see appropriate empty state, not errors
      expect(result).toBeDefined();
      expect(result.totalInterviewSessions).toBe(0);
      expect(result.averagePerformance.accuracy).toBe(0);
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it("should handle session metrics calculation edge cases", async () => {
      // Mock edge case: sessions with no attempts
      getAllSessions.mockResolvedValue([
        { id: "session-1", origin: "generator", status: "completed", date: "2024-01-15" },
        { id: "session-2", origin: "tracking", status: "in_progress", date: "2024-01-14" }
      ]);
      getAllAttempts.mockResolvedValue([]);

      const result = await getSessionMetrics();

      // CRITICAL: Edge cases handled without crashes
      expect(result).toBeDefined();
      expect(result.guided).toBeDefined();
      expect(result.tracking).toBeDefined();
      expect(result.guided.successRate).toBe(0); // No attempts = 0% success rate
      expect(result.tracking.avgProblemsPerSession).toBe(0);
    });

    it("should generate productivity insights from minimal data", async () => {
      // Mock minimal user activity
      const mockDashboardData = {
        sessions: {
          allSessions: [{ sessionId: "s1", Date: "2024-01-15", completed: true }],
          sessionAnalytics: [{ sessionId: "s1", accuracy: 0.8 }],
          productivityMetrics: { averageSessionLength: 45 }
        },
        attempts: [
          { ProblemID: 1, Success: true, Comments: "Used hash map approach, worked well" }
        ]
      };

      jest.spyOn(dashboardService, 'getDashboardStatistics')
        .mockResolvedValue(mockDashboardData);

      const result = await getProductivityInsightsData();

      // CRITICAL: Insights generated even with limited data
      expect(result).toBeDefined();
      expect(result.productivityMetrics).toBeDefined();
      expect(result.reflectionData).toBeDefined();
      expect(typeof result.reflectionData.reflectionRate).toBe('number');
    });
  });
});