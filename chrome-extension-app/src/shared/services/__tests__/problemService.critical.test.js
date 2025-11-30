// Mock all dependencies before importing
jest.mock("../../db/entities/problems");
jest.mock("../../db/entities/standard_problems");
jest.mock("../../db/entities/sessions");
jest.mock("../../db/entities/tag_mastery");
jest.mock("../attempts/attemptsService");
jest.mock("../schedule/scheduleService", () => ({
  ScheduleService: {
    getDailyReviewSchedule: jest.fn(),
  },
}));
jest.mock("../storage/storageService", () => ({
  StorageService: {
    getSettings: jest.fn(),
    getSessionState: jest.fn(),
  },
}));
jest.mock("../../../content/services/problemReasoningService", () => ({
  ProblemReasoningService: {
    generateSessionReasons: jest.fn(),
  },
}));
jest.mock("../session/interviewService", () => ({
  InterviewService: {
    createInterviewSession: jest.fn(),
    getInterviewConfig: jest.fn(),
  },
}));
jest.mock("uuid", () => ({ v4: () => "test-uuid-123" }));

import { ProblemService } from "../problem/problemService";
import * as problemsDb from "../../db/entities/problems";
import * as standardProblems from "../../db/entities/standard_problems";
import { buildAdaptiveSessionSettings } from "../../db/entities/sessions";
import { AttemptsService } from "../attempts/attemptsService";
import { ScheduleService } from "../schedule/scheduleService";
import { StorageService } from "../storage/storageService";
import { InterviewService } from "../session/interviewService";

// eslint-disable-next-line max-lines-per-function
describe("ProblemService - Critical User Retention Paths", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("🔥 CRITICAL: Problem availability handling", () => {
    it("should return empty array when legitimately no problems exist", async () => {
      // Mock scenario: Brand new user, no problems in system yet (valid empty state)
      buildAdaptiveSessionSettings.mockResolvedValue({
        sessionLength: 5,
        numberOfNewProblems: 3,
        currentAllowedTags: ["array"],
        currentDifficultyCap: "Medium",
        userFocusAreas: [],
        isOnboarding: false
      });

      problemsDb.fetchAllProblems.mockResolvedValue([]);
      problemsDb.fetchAdditionalProblems.mockResolvedValue([]);
      StorageService.getSettings.mockResolvedValue({ reviewRatio: 40 });
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);

      const problems = await ProblemService.createSession();

      // CRITICAL: Empty state is valid for new users with no problems
      expect(Array.isArray(problems)).toBe(true);
      expect(problems.length).toBe(0);
    });

    it("should provide problems when database has them available", async () => {
      // Mock scenario: Adaptive settings succeed but no problems initially available
      buildAdaptiveSessionSettings.mockResolvedValue({
        sessionLength: 5,
        numberOfNewProblems: 3,
        currentAllowedTags: ["array"],
        currentDifficultyCap: "Medium",
        userFocusAreas: [],
        isOnboarding: false
      });

      // Mock empty initial fetch but fallback problems available
      problemsDb.fetchAllProblems.mockResolvedValue([]);
      problemsDb.fetchAdditionalProblems.mockResolvedValue([
        { id: 1, leetcode_id: 1, title: "Fallback Problem", difficulty: "Easy", tags: ["Array"], slug: "fallback-problem" }
      ]);

      StorageService.getSettings.mockResolvedValue({ reviewRatio: 40 });
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);

      const problems = await ProblemService.createSession();

      // CRITICAL: Users must get problems even if algorithms fail
      expect(Array.isArray(problems)).toBe(true);
      expect(problems.length).toBeGreaterThan(0);
      expect(problems[0]).toHaveProperty('title');
    });

    it("should handle complete database failure gracefully", async () => {
      // Mock scenario: All database operations fail
      buildAdaptiveSessionSettings.mockRejectedValue(new Error("Database timeout"));
      problemsDb.fetchAllProblems.mockRejectedValue(new Error("Connection failed"));
      problemsDb.fetchAdditionalProblems.mockRejectedValue(new Error("No connection"));
      StorageService.getSettings.mockRejectedValue(new Error("Storage corrupted"));

      // Should gracefully handle complete failure
      await expect(ProblemService.createSession()).rejects.toThrow();
    });

    it("should distinguish between system failure and legitimate empty state", async () => {
      // Mock scenario: System works but legitimately no problems match criteria
      buildAdaptiveSessionSettings.mockResolvedValue({
        sessionLength: 5,
        numberOfNewProblems: 3,
        currentAllowedTags: ["very-rare-tag"],
        currentDifficultyCap: "Medium",
        userFocusAreas: [],
        isOnboarding: false
      });

      // System works but no problems match the rare tag criteria
      problemsDb.fetchAllProblems.mockResolvedValue([]);
      problemsDb.fetchAdditionalProblems.mockResolvedValue([]);
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);
      StorageService.getSettings.mockResolvedValue({ reviewRatio: 40 });

      const problems = await ProblemService.createSession();

      // CRITICAL: Empty result is valid when no problems match user criteria
      expect(Array.isArray(problems)).toBe(true);
      expect(problems.length).toBe(0);
    });
  });

  describe("🎯 CRITICAL: Problem loading is reliable", () => {
    it("should find problems in standard store when not in user database", async () => {
      const mockStandardProblem = {
        id: 1,
        title: "Two Sum",
        difficulty: "Easy",
        slug: "two-sum"
      };

      // Mock: Problem exists in standard store but not in user problems
      standardProblems.getProblemFromStandardProblems.mockResolvedValue(mockStandardProblem);
      problemsDb.checkDatabaseForProblem.mockResolvedValue(null);

      const result = await ProblemService.getProblemByDescription("Two Sum", "two-sum");

      // CRITICAL: Users can access problems even if not in their personal database
      expect(result.problem).toBeDefined();
      expect(result.problem.title).toBe("Two Sum");
      expect(result.found).toBe(false); // Not in user database, but available
    });

    it("should prioritize user database problems over standard problems", async () => {
      const standardProblem = {
        id: 1,
        title: "Two Sum",
        difficulty: "Easy"
      };

      const userProblem = {
        leetcode_id: 1,
        title: "Two Sum",
        difficulty: "Easy",
        attempts: 3,
        box_level: 2,
        lastAttempted: "2024-01-15",
        tags: []
      };

      // Mock: Problem exists in both stores
      standardProblems.getProblemFromStandardProblems.mockResolvedValue(standardProblem);
      problemsDb.checkDatabaseForProblem.mockResolvedValue(userProblem);

      const result = await ProblemService.getProblemByDescription("Two Sum", "two-sum");

      // CRITICAL: User progress data takes priority
      expect(result.problem).toMatchObject({
        id: 1,
        leetcode_id: 1,
        title: "Two Sum",
        difficulty: "Easy",
        attempts: 3,
        boxLevel: 2,
        lastAttempted: "2024-01-15",
        tags: []
      });
      expect(result.found).toBe(true);
      expect(result.problem.attempts).toBe(3); // User-specific data preserved
    });

    it("should handle corrupted problem data gracefully", async () => {
      const corruptedProblem = {
        id: "not-a-number",
        title: null,
        difficulty: undefined,
        attempts: "corrupted",
        boxLevel: { invalid: "data" }
      };

      standardProblems.getProblemFromStandardProblems.mockResolvedValue(null);
      problemsDb.checkDatabaseForProblem.mockResolvedValue(corruptedProblem);

      const result = await ProblemService.getProblemByDescription("Corrupted", "corrupted");

      // CRITICAL: Handles corruption without crashing
      expect(result).toEqual({ problem: null, found: false });
    });
  });

  describe("📈 CRITICAL: User progress tracking never fails", () => {
    it("should add attempts for existing problems", async () => {
      const existingProblem = {
        id: 1,
        title: "Two Sum",
        attempts: 2,
        boxLevel: 1
      };

      const contentScriptData = {
        leetcode_id: 1,
        title: "Two Sum",
        date: "2024-01-15T10:00:00Z",
        success: true,
        timeSpent: 900,
        difficulty: "Easy",
        comments: "Used hash map approach"
      };

      problemsDb.checkDatabaseForProblem.mockResolvedValue(existingProblem);
      AttemptsService.addAttempt.mockResolvedValue({
        message: "Attempt recorded successfully",
        sessionId: "test-session-123"
      });

      const result = await ProblemService.addOrUpdateProblem(contentScriptData);

      // CRITICAL: User progress is recorded
      expect(AttemptsService.addAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          problem_id: 1,
          success: true,
          time_spent: 900,
          attempt_date: "2024-01-15T10:00:00Z"
        }),
        existingProblem
      );
      expect(result.message).toContain("successfully");
    });

    it("should create new problems when not in database", async () => {
      const newProblemData = {
        leetcode_id: 999,
        title: "New Problem",
        date: "2024-01-15T10:00:00Z",
        success: true,
        timeSpent: 1200,
        difficulty: "Medium"
      };

      problemsDb.checkDatabaseForProblem.mockResolvedValue(null);
      problemsDb.addProblem.mockResolvedValue({
        success: true,
        problem: newProblemData
      });

      const result = await ProblemService.addOrUpdateProblem(newProblemData);

      // CRITICAL: New problems are tracked from first attempt
      expect(problemsDb.addProblem).toHaveBeenCalledWith(newProblemData);
      expect(result.success).toBe(true);
    });

    it("should handle attempt recording failures gracefully", async () => {
      const existingProblem = { id: 1, title: "Two Sum" };
      const contentScriptData = {
        leetcode_id: 1,
        success: true,
        timeSpent: 900
      };

      problemsDb.checkDatabaseForProblem.mockResolvedValue(existingProblem);
      AttemptsService.addAttempt.mockRejectedValue(new Error("Database connection failed"));

      // Should throw error so user knows attempt wasn't recorded
      await expect(ProblemService.addOrUpdateProblem(contentScriptData))
        .rejects.toThrow("Database connection failed");
    });
  });

  describe("🧠 CRITICAL: Interview mode reliability", () => {
    it("should create interview sessions successfully", async () => {
      const mockInterviewConfig = {
        sessionLength: 3,
        selectionCriteria: {
          allowedTags: ["array", "hash-table"],
          masteredTags: ["array"],
          nearMasteryTags: ["hash-table"],
          problemMix: { mastered: 0.5, nearMastery: 0.3, challenging: 0.2 }
        },
        config: { timeLimit: 45, hintsAllowed: 2 },
        interviewMetrics: { baselineScore: 75 },
        createdAt: "2024-01-15T10:00:00Z"
      };

      const mockProblems = [
        { id: 1, title: "Two Sum", tags: ["array", "hash-table"], difficulty: "Easy", slug: "two-sum" },
        { id: 2, title: "Valid Parentheses", tags: ["stack", "string"], difficulty: "Easy", slug: "valid-parentheses" },
        { id: 3, title: "Best Time to Buy Stock", tags: ["array", "dynamic-programming"], difficulty: "Easy", slug: "best-time-to-buy-stock" }
      ];

      InterviewService.createInterviewSession.mockResolvedValue(mockInterviewConfig);
      problemsDb.fetchAllProblems.mockResolvedValue(mockProblems);

      const result = await ProblemService.createInterviewSession("interview-like");

      // CRITICAL: Interview sessions must work for serious practice
      expect(result).toBeDefined();
      expect(result.session_type).toBe("interview-like");
      expect(Array.isArray(result.problems)).toBe(true);
      expect(result.problems.length).toBeGreaterThan(0);
      expect(result.interviewConfig).toBeDefined();
    });

    it("should fallback to standard session if interview creation fails", async () => {
      InterviewService.createInterviewSession.mockRejectedValue(new Error("Interview service unavailable"));
      
      // Mock fallback to standard session
      buildAdaptiveSessionSettings.mockResolvedValue({
        sessionLength: 5,
        numberOfNewProblems: 3,
        currentAllowedTags: ["array"],
        currentDifficultyCap: "Medium",
        userFocusAreas: [],
        isOnboarding: false
      });

      problemsDb.fetchAllProblems.mockResolvedValue([
        { id: 1, leetcode_id: 1, title: "Fallback Problem", difficulty: "Easy", tags: ["Array"], slug: "fallback-problem" }
      ]);
      problemsDb.fetchAdditionalProblems.mockResolvedValue([]);
      StorageService.getSettings.mockResolvedValue({ reviewRatio: 40 });
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);

      const result = await ProblemService.createInterviewSession("interview-like");

      // CRITICAL: Users get practice session even if interview mode fails
      expect(result.session_type).toBe("standard");
      expect(result.fallbackUsed).toBe(true);
      expect(Array.isArray(result.problems)).toBe(true);
      expect(result.problems.length).toBeGreaterThan(0);
    });

    it.skip("should handle interview session timeout", async () => {
      // Mock interview service that takes too long
      InterviewService.createInterviewSession.mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => resolve({
            sessionLength: 3,
            selectionCriteria: {},
            config: {},
            interviewMetrics: {}
          }), 15000); // 15 seconds - longer than timeout
        })
      );

      problemsDb.fetchAllProblems.mockResolvedValue([
        { id: 1, title: "Timeout Problem" }
      ]);

      const start = Date.now();
      await expect(ProblemService.createInterviewSession("interview-like"))
        .rejects.toThrow(/timed out/);
      const elapsed = Date.now() - start;

      // CRITICAL: Should timeout quickly, not hang user interface
      expect(elapsed).toBeLessThan(13000); // Within timeout range
    });
  });

  describe("⚡ CRITICAL: Performance under load", () => {
    it("should handle large problem datasets efficiently", async () => {
      // Create large dataset that could cause performance issues
      const largeProblemsArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        title: `Problem ${i}`,
        difficulty: i % 3 === 0 ? "Easy" : i % 3 === 1 ? "Medium" : "Hard",
        Tags: [`tag-${i % 20}`] // 20 different tags
      }));

      buildAdaptiveSessionSettings.mockResolvedValue({
        sessionLength: 5,
        numberOfNewProblems: 3,
        currentAllowedTags: ["tag-1", "tag-2"],
        currentDifficultyCap: "Medium",
        userFocusAreas: [],
        isOnboarding: false
      });

      problemsDb.fetchAllProblems.mockResolvedValue(largeProblemsArray);
      problemsDb.fetchAdditionalProblems.mockResolvedValue([]);
      StorageService.getSettings.mockResolvedValue({ reviewRatio: 40 });
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);

      const start = Date.now();
      const result = await ProblemService.createSession();
      const elapsed = Date.now() - start;

      // CRITICAL: Should complete within reasonable time
      expect(elapsed).toBeLessThan(5000); // Within 5 seconds
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5); // Respects session length
    });

    it("should handle tag mastery calculation with many tags", () => {
      // Create scenario with many tags that could slow down performance analysis
      const manyTagsData = Array.from({ length: 1000 }, (_, i) => ({
        tag: `tag-${i}`,
        successRate: Math.random(),
        totalAttempts: Math.floor(Math.random() * 50)
      }));

      const start = Date.now();
      const result = ProblemService.buildUserPerformanceContext(manyTagsData);
      const elapsed = Date.now() - start;

      // CRITICAL: Performance analysis should be fast
      expect(elapsed).toBeLessThan(1000); // Within 1 second
      expect(result).toBeDefined();
      expect(Array.isArray(result.weakTags)).toBe(true);
      expect(Array.isArray(result.newTags)).toBe(true);
    });
  });

  describe("🔧 CRITICAL: Error recovery and resilience", () => {
    it("should recover from corrupted session settings", async () => {
      // Mock corrupted adaptive settings
      buildAdaptiveSessionSettings.mockResolvedValue({
        sessionLength: "not-a-number",
        numberOfNewProblems: null,
        currentAllowedTags: "should-be-array",
        currentDifficultyCap: undefined,
        userFocusAreas: { invalid: "object" }
      });

      problemsDb.fetchAllProblems.mockResolvedValue([
        { id: 1, leetcode_id: 1, title: "Recovery Problem", difficulty: "Easy", tags: ["Array"], slug: "recovery-problem" }
      ]);
      problemsDb.fetchAdditionalProblems.mockResolvedValue([]);
      StorageService.getSettings.mockResolvedValue({ reviewRatio: 40 });
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);

      // Should handle corrupted settings gracefully
      const result = await ProblemService.createSession();
      
      // CRITICAL: Should not crash even with corrupted settings
      expect(Array.isArray(result)).toBe(true);
      // May return empty array if settings are too corrupted to process
    });

    it("should handle network interruption during problem loading", async () => {
      let attemptCount = 0;
      problemsDb.fetchAllProblems.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error("Network timeout");
        }
        return [{ id: 1, title: "Recovered Problem" }];
      });

      buildAdaptiveSessionSettings.mockResolvedValue({
        sessionLength: 5,
        numberOfNewProblems: 3,
        currentAllowedTags: ["array"],
        currentDifficultyCap: "Medium",
        userFocusAreas: [],
        isOnboarding: false
      });

      StorageService.getSettings.mockResolvedValue({ reviewRatio: 40 });
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);

      // First call should fail, but retry mechanisms could help
      await expect(ProblemService.createSession()).rejects.toThrow("Network timeout");
      expect(attemptCount).toBe(1);
    });

    it("should validate problem data integrity before session creation", async () => {
      const problematicProblems = [
        { id: 1, leetcode_id: 1, title: "Valid Problem", difficulty: "Easy", tags: ["Array"], slug: "valid-problem" }, // Valid
        { id: null, leetcode_id: null, title: "Invalid Problem", difficulty: "Easy", tags: ["Array"], slug: "invalid-problem" }, // Invalid ID
        { id: 2, leetcode_id: 2, title: "", difficulty: "Easy", tags: ["Array"], slug: "problem-2" }, // Empty title
        { id: 3, leetcode_id: 3, title: "Problem 3", difficulty: "InvalidDifficulty", tags: ["Array"], slug: "problem-3" }, // Invalid difficulty
        null, // Completely invalid
        undefined, // Also invalid
      ];

      buildAdaptiveSessionSettings.mockResolvedValue({
        sessionLength: 3,
        numberOfNewProblems: 2,
        currentAllowedTags: ["array"],
        currentDifficultyCap: "Medium",
        userFocusAreas: [],
        isOnboarding: false
      });

      problemsDb.fetchAllProblems.mockResolvedValue(problematicProblems);
      problemsDb.fetchAdditionalProblems.mockResolvedValue([
        { id: 4, leetcode_id: 4, title: "Additional Valid Problem", difficulty: "Easy", tags: ["Array"], slug: "additional-valid-problem" }
      ]);
      StorageService.getSettings.mockResolvedValue({ reviewRatio: 40 });
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);

      const result = await ProblemService.createSession();

      // CRITICAL: Should filter out invalid problems and continue
      expect(Array.isArray(result)).toBe(true);
      // Should only include valid problems
      result.forEach(problem => {
        expect(problem).toBeDefined();
        expect(problem.id).toBeTruthy();
        expect(problem.title).toBeTruthy();
      });
    });
  });
});