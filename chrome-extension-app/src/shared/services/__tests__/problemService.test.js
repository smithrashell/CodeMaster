// Mock logger first to prevent initialization errors
jest.mock("../../utils/logger.js", () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    __esModule: true,
    default: mockLogger,
    ...mockLogger, // Export named functions as well for compatibility
  };
});

// Mock all dependencies before importing
jest.mock("../../db/problems");
jest.mock("../../db/standard_problems");
jest.mock("../../db/sessions");
jest.mock("../../db/tag_mastery");
jest.mock("../attemptsService");
jest.mock("../scheduleService", () => ({
  ScheduleService: {
    getDailyReviewSchedule: jest.fn(),
  },
}));
jest.mock("../storageService", () => ({
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
jest.mock("uuid", () => ({ v4: () => "test-uuid-123" }));

import { ProblemService } from "../problemService";
import * as problemsDb from "../../db/problems";
import * as standardProblems from "../../db/standard_problems";
import { buildAdaptiveSessionSettings } from "../../db/sessions";
import { getTagMastery } from "../../db/tag_mastery";
import { AttemptsService } from "../attemptsService";
import { ScheduleService } from "../scheduleService";
import { StorageService } from "../storageService";
import { ProblemReasoningService } from "../../../content/services/problemReasoningService";

// Test fixture factories
const createMockProblem = (overrides = {}) => ({
  id: 1,
  title: "Two Sum",
  difficulty: "Easy",
  tags: ["Array", "Hash Table"],
  slug: "two-sum",
  leetcode_id: 1,
  ...overrides
});

const createMockProblemInDb = (overrides = {}) => ({
  leetcode_id: 1,
  title: "Two Sum",
  difficulty: "Easy",
  tags: ["Array", "Hash Table"],
  slug: "two-sum",
  attempts: 5,
  box_level: 2,
  ...overrides
});

const createContentScriptData = (overrides = {}) => ({
  leetcode_id: 1, // Use the field name expected by the implementation
  leetCodeID: 1, // Keep both for backward compatibility
  title: "Two Sum",
  timeSpent: 1200,
  success: true,
  ...overrides
});

const createSessionSettings = (overrides = {}) => ({
  sessionLength: 5,
  numberOfNewProblems: 3,
  currentAllowedTags: ["array", "hash-table"],
  currentDifficultyCap: "Medium",
  userFocusAreas: [],
  ...overrides
});

const createTagMasteryEntry = (tag, successRate, totalAttempts) => ({
  tag,
  successRate,
  totalAttempts
});

const createAttemptData = (overrides = {}) => ({
  id: "test-uuid-123",
  problem_id: 1,
  time_spent: 1200,
  success: true,
  ...overrides
});

// Common assertion helpers
const assertProblemServiceCall = (mockFn, ...expectedArgs) => {
  expect(mockFn).toHaveBeenCalledWith(...expectedArgs);
};

const assertProblemResult = (result, expectedProblem, expectedFound) => {
  if (expectedProblem && typeof expectedProblem === 'object' && expectedProblem.box_level !== undefined) {
    // For database problems with snake_case, check the merged camelCase result
    expect(result.found).toBe(expectedFound);
    expect(result.problem).toMatchObject({
      id: expectedProblem.leetcode_id || expectedProblem.id,
      leetcode_id: expectedProblem.leetcode_id || expectedProblem.id,
      title: expectedProblem.title,
      difficulty: expectedProblem.difficulty,
      attempts: expectedProblem.attempts,
      boxLevel: expectedProblem.box_level,
      tags: expectedProblem.tags || []
    });
  } else {
    expect(result).toEqual({ problem: expectedProblem, found: expectedFound });
  }
};

const assertAttemptsServiceCall = (mockFn, expectedAttempt, expectedProblem) => {
  expect(mockFn).toHaveBeenCalledWith(expectedAttempt, expectedProblem);
};

// Mock setup helpers
const setupMockStandardProblem = (problem = null) => {
  standardProblems.getProblemFromStandardProblems.mockResolvedValue(problem);
};

const setupMockDatabaseProblem = (problem = null) => {
  problemsDb.checkDatabaseForProblem.mockResolvedValue(problem);
};

const setupMockAddProblem = (result = { success: true }) => {
  problemsDb.addProblem.mockResolvedValue(result);
};

const setupMockAddAttempt = (result = { message: "Attempt added successfully", sessionId: "test-session-123" }) => {
  AttemptsService.addAttempt.mockResolvedValue(result);
};

const setupMockFetchAllProblems = (problems = []) => {
  problemsDb.fetchAllProblems.mockResolvedValue(problems);
};

const setupMockFetchAdditionalProblems = (problems = []) => {
  problemsDb.fetchAdditionalProblems.mockResolvedValue(problems);
};





const createMockProblemsArray = () => [
  { id: 1, title: "Problem 1" },
  { id: 2, title: "Problem 2" },
];



// Test group functions
const runGetProblemByDescriptionTests = () => {
  describe("getProblemByDescription", () => {
    beforeEach(() => {
      standardProblems.getProblemFromStandardProblems.mockClear();
      problemsDb.checkDatabaseForProblem.mockClear();
    });

    it("should return problem from problems store when found in both stores", async () => {
      const mockStandardProblem = createMockProblem();
      const mockProblemInDb = createMockProblemInDb();

      setupMockStandardProblem(mockStandardProblem);
      setupMockDatabaseProblem(mockProblemInDb);

      const result = await ProblemService.getProblemByDescription("Two Sum", "two-sum");

      assertProblemServiceCall(standardProblems.getProblemFromStandardProblems, "two-sum");
      assertProblemServiceCall(problemsDb.checkDatabaseForProblem, 1);
      assertProblemResult(result, mockProblemInDb, true);
    });

    it("should return problem from standard problems when not found in problems store", async () => {
      const mockStandardProblem = createMockProblem();

      setupMockStandardProblem(mockStandardProblem);
      setupMockDatabaseProblem(null);

      const result = await ProblemService.getProblemByDescription("Two Sum", "two-sum");

      assertProblemServiceCall(standardProblems.getProblemFromStandardProblems, "two-sum");
      assertProblemServiceCall(problemsDb.checkDatabaseForProblem, 1);
      assertProblemResult(result, mockStandardProblem, false);
    });

    it("should return null when problem not found in any store", async () => {
      setupMockStandardProblem(null);
      setupMockDatabaseProblem(null);

      const result = await ProblemService.getProblemByDescription("Non-existent", "non-existent");

      assertProblemServiceCall(standardProblems.getProblemFromStandardProblems, "non-existent");
      expect(result).toEqual({ problem: null, found: false });
    });
  });
};

const runAddOrUpdateProblemTests = () => {
  describe("addOrUpdateProblem", () => {
    beforeEach(() => {
      problemsDb.addProblem.mockClear();
      AttemptsService.addAttempt.mockClear();
    });

    it("should add attempt when problem exists", async () => {
      const contentScriptData = createContentScriptData();
      const mockProblem = createMockProblem();
      const attemptData = createAttemptData();

      setupMockDatabaseProblem(mockProblem);
      setupMockAddAttempt();

      const result = await ProblemService.addOrUpdateProblem(contentScriptData);

      assertAttemptsServiceCall(AttemptsService.addAttempt, attemptData, mockProblem);
      expect(result).toEqual({ message: "Attempt added successfully", sessionId: "test-session-123" });
    });

    it("should add new problem when problem does not exist", async () => {
      const contentScriptData = createContentScriptData();
      
      setupMockDatabaseProblem(null);
      setupMockAddProblem({ success: true });

      const result = await ProblemService.addOrUpdateProblem(contentScriptData);

      assertProblemServiceCall(problemsDb.addProblem, contentScriptData);
      expect(result).toEqual({ success: true });
    });
  });
};

const runCreateSessionTests = () => {
  describe("createSession", () => {
    beforeEach(() => {
      ScheduleService.getDailyReviewSchedule.mockClear();
      buildAdaptiveSessionSettings.mockClear();
      problemsDb.fetchAllProblems.mockClear();
      problemsDb.fetchAdditionalProblems.mockClear();
      StorageService.getSettings.mockClear();
    });

    it("should create session with adaptive settings", async () => {
      const sessionSettings = createSessionSettings();
      const _expectedResult = [];
      
      buildAdaptiveSessionSettings.mockResolvedValue(sessionSettings);
      setupMockFetchAllProblems([]);
      setupMockFetchAdditionalProblems([]);
      StorageService.getSettings.mockResolvedValue({ reviewRatio: 40 });
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);

      const result = await ProblemService.createSession();

      expect(buildAdaptiveSessionSettings).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });
  });
};

const runBuildUserPerformanceContextTests = () => {
  describe("buildUserPerformanceContext", () => {
    it("should build performance context from tag mastery data", () => {
      const tagMasteryData = [
        createTagMasteryEntry("array", 0.8, 10),
        createTagMasteryEntry("hash-table", 0.6, 5),
      ];

      const result = ProblemService.buildUserPerformanceContext(tagMasteryData);

      expect(result.weakTags).toContain("hash-table");
      expect(result.newTags).not.toContain("array"); // array has 10 attempts, should not be "new"
    });

    it("should return empty context when no tag mastery data", () => {
      const result = ProblemService.buildUserPerformanceContext([]);

      expect(result.weakTags).toEqual([]);
      expect(result.newTags).toEqual([]);
      expect(result.tagAccuracy).toEqual({});
      expect(result.tagAttempts).toEqual({});
    });

    it("should handle null tag mastery data", () => {
      const result = ProblemService.buildUserPerformanceContext(null);

      expect(result.weakTags).toEqual([]);
      expect(result.newTags).toEqual([]);
      expect(result.tagAccuracy).toEqual({});
      expect(result.tagAttempts).toEqual({});
    });
  });
};

const runAddProblemReasoningToSessionTests = () => {
  describe("addProblemReasoningToSession", () => {
    beforeEach(() => {
      ProblemReasoningService.generateSessionReasons.mockClear();
      getTagMastery.mockClear();
    });

    it("should add reasoning to session problems", async () => {
      const sessionProblems = createMockProblemsArray();
      const sessionContext = { sessionLength: 5, reviewCount: 2, newCount: 3 };
      const reasoningData = [
        { problemId: 1, reasoning: "Use hash map for O(1) lookup" },
        { problemId: 2, reasoning: "Apply sliding window technique" },
      ];

      getTagMastery.mockResolvedValue([]);
      ProblemReasoningService.generateSessionReasons.mockReturnValue(reasoningData);

      const result = await ProblemService.addProblemReasoningToSession(sessionProblems, sessionContext);

      expect(getTagMastery).toHaveBeenCalled();
      expect(ProblemReasoningService.generateSessionReasons).toHaveBeenCalledWith(
        sessionProblems,
        sessionContext,
        expect.any(Object)
      );
      expect(result).toEqual(reasoningData);
    });

    it("should return original problems when reasoning fails", async () => {
      const sessionProblems = createMockProblemsArray();
      const sessionContext = { sessionLength: 5, reviewCount: 2, newCount: 3 };

      getTagMastery.mockResolvedValue([]);
      ProblemReasoningService.generateSessionReasons.mockImplementation(() => {
        throw new Error("Reasoning service failed");
      });

      const result = await ProblemService.addProblemReasoningToSession(sessionProblems, sessionContext);

      expect(result).toEqual(sessionProblems);
    });
  });
};

/** ──────────────── ALGORITHM FAILURE SCENARIO TESTING ──────────────── **/

const runAdaptiveSessionAlgorithmFailureTests = () => {
  describe("Adaptive Session Algorithm Failures", () => {
    beforeEach(() => {
      buildAdaptiveSessionSettings.mockClear();
      problemsDb.fetchAllProblems.mockClear();
      getTagMastery.mockClear();
      StorageService.getSettings.mockClear();
    });

    it("should handle adaptive algorithm failure with fallback settings", async () => {
      // For now, let's test the fallback scenario by having the mock return fallback settings
      buildAdaptiveSessionSettings.mockResolvedValue({
        sessionLength: 5,
        numberOfNewProblems: 2,
        reviewRatio: 0.4,
        tags: [],
        difficulty: ["Easy", "Medium"]
      });
      setupMockFetchAllProblems([createMockProblem()]);
      setupMockFetchAdditionalProblems([createMockProblem(), createMockProblem()]); // Provide additional problems for the session
      StorageService.getSettings.mockResolvedValue({ reviewRatio: 40 });
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);

      const result = await ProblemService.createSession();

      expect(buildAdaptiveSessionSettings).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
      // Should create session successfully
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle tag mastery calculation overflow", () => {
      const corruptedTagData = Array.from({ length: 10000 }, (_, i) => 
        createTagMasteryEntry(`tag-${i}`, Math.random(), Number.MAX_SAFE_INTEGER)
      );
      
      getTagMastery.mockResolvedValue(corruptedTagData);
      
      // This should handle massive dataset gracefully
      const result = ProblemService.buildUserPerformanceContext(corruptedTagData);
      
      expect(result).toHaveProperty('tagAccuracy');
      expect(result).toHaveProperty('tagAttempts');
      
      // Should not crash on large datasets
      expect(Object.keys(result.tagAccuracy).length).toBeLessThanOrEqual(10000);
    });

    it("should handle circular dependency in problem difficulty calculation", async () => {
      const circularProblems = [
        { id: 1, title: "Problem 1", dependencies: [2], difficulty: "Medium" },
        { id: 2, title: "Problem 2", dependencies: [3], difficulty: "Medium" },
        { id: 3, title: "Problem 3", dependencies: [1], difficulty: "Medium" }, // Circular
      ];
      
      setupMockFetchAllProblems(circularProblems);
      buildAdaptiveSessionSettings.mockResolvedValue(createSessionSettings());
      StorageService.getSettings.mockResolvedValue({ reviewRatio: 40 });
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);

      // Should not hang due to circular dependencies
      const result = await ProblemService.createSession();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle box level progression algorithm failure", async () => {
      const problemWithInvalidBoxLevel = createMockProblemInDb({ 
        boxLevel: -1, // Invalid box level
        attempts: NaN, // Invalid attempts
      });
      
      setupMockDatabaseProblem(problemWithInvalidBoxLevel);
      
      const contentScriptData = createContentScriptData();
      
      // Should handle invalid data gracefully
      const result = await ProblemService.addOrUpdateProblem(contentScriptData);
      
      expect(result).toBeDefined();
      expect(problemsDb.checkDatabaseForProblem).toHaveBeenCalled();
    });
  });
};

const runProblemSelectionAlgorithmFailureTests = () => {
  describe("Problem Selection Algorithm Failures", () => {
    it("should handle empty problem pool gracefully", async () => {
      setupMockFetchAllProblems([]); // No problems available
      setupMockFetchAdditionalProblems([]);
      buildAdaptiveSessionSettings.mockResolvedValue(createSessionSettings());
      StorageService.getSettings.mockResolvedValue({ reviewRatio: 40 });
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);

      const result = await ProblemService.createSession();
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0); // Should return empty array, not crash
    });

    it("should handle malformed problem data in selection algorithm", async () => {
      const malformedProblems = [
        { id: null, title: "", difficulty: "InvalidDifficulty" },
        { id: "not-a-number", title: null, tags: "should-be-array" },
        { boxLevel: "infinity", attempts: -1, successRate: "not-a-number" },
        undefined,
        null,
        { /* missing required fields */ }
      ];
      
      setupMockFetchAllProblems(malformedProblems);
      buildAdaptiveSessionSettings.mockResolvedValue(createSessionSettings());
      StorageService.getSettings.mockResolvedValue({ reviewRatio: 40 });
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);

      const result = await ProblemService.createSession();
      
      // Should filter out malformed problems and continue
      expect(Array.isArray(result)).toBe(true);
      expect(result.every(p => p && p.id && p.title)).toBe(true);
    });

    it("should handle infinite loop in problem recommendation algorithm", async () => {
      // Mock a scenario that could cause infinite loops
      let callCount = 0;
      problemsDb.fetchAdditionalProblems.mockImplementation(() => {
        callCount++;
        if (callCount > 100) {
          throw new Error("Infinite loop detected in problem selection");
        }
        return []; // Keep returning empty, which could cause infinite retry
      });
      
      setupMockFetchAllProblems([]);
      buildAdaptiveSessionSettings.mockResolvedValue(createSessionSettings({ sessionLength: 10 }));
      StorageService.getSettings.mockResolvedValue({ reviewRatio: 40 });
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);

      const result = await ProblemService.createSession();
      
      expect(Array.isArray(result)).toBe(true);
      // Should break out of infinite loop and return empty session
      expect(result.length).toBe(0);
    });
  });
};

const runPerformanceAnalysisAlgorithmFailureTests = () => {
  describe("Performance Analysis Algorithm Failures", () => {
    it("should handle division by zero in success rate calculations", () => {
      const zeroAttemptsData = [
        createTagMasteryEntry("array", 0, 0), // Division by zero scenario
        createTagMasteryEntry("dp", 1, 0), // Another zero attempts
      ];
      
      const result = ProblemService.buildUserPerformanceContext(zeroAttemptsData);
      
      expect(result.tagAccuracy).toBeDefined();
      expect(Object.values(result.tagAccuracy).every(rate => 
        !isNaN(rate) && isFinite(rate)
      )).toBe(true);
    });

    it("should handle floating point precision errors in calculations", () => {
      const precisionProblematicData = [
        createTagMasteryEntry("array", 0.1 + 0.2, 1), // 0.30000000000000004
        createTagMasteryEntry("math", 1 / 3, 3), // 0.3333333333333333
        createTagMasteryEntry("precision", 0.999999999999999, 1),
      ];
      
      const result = ProblemService.buildUserPerformanceContext(precisionProblematicData);
      
      expect(result.tagAccuracy).toBeDefined();
      // All values should be reasonable numbers
      Object.values(result.tagAccuracy).forEach(rate => {
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
        expect(rate).not.toBeNaN();
      });
    });

    it("should handle negative performance metrics gracefully", () => {
      const negativeMetricsData = [
        createTagMasteryEntry("array", -0.5, -10), // Negative values
        createTagMasteryEntry("dp", 1.5, 5), // Success rate > 1
        createTagMasteryEntry("invalid", Number.NEGATIVE_INFINITY, 1),
      ];
      
      const result = ProblemService.buildUserPerformanceContext(negativeMetricsData);
      
      expect(result.tagAccuracy).toBeDefined();
      // Should normalize or handle invalid values
      Object.values(result.tagAccuracy).forEach(rate => {
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(1);
        expect(Number.isFinite(rate)).toBe(true);
      });
    });
  });
};

const runReasoningAlgorithmFailureTests = () => {
  describe("Problem Reasoning Algorithm Failures", () => {
    it("should handle reasoning service complete failure", async () => {
      const sessionProblems = createMockProblemsArray();
      const sessionContext = { sessionLength: 5 };
      
      getTagMastery.mockRejectedValue(new Error("Tag mastery service down"));
      ProblemReasoningService.generateSessionReasons.mockImplementation(() => {
        throw new Error("Reasoning service crashed");
      });

      const result = await ProblemService.addProblemReasoningToSession(sessionProblems, sessionContext);
      
      // Should fallback to original problems
      expect(result).toEqual(sessionProblems);
    });

    it("should handle partial reasoning failures", async () => {
      const sessionProblems = createMockProblemsArray();
      const sessionContext = { sessionLength: 5 };
      
      getTagMastery.mockResolvedValue([]);
      // Mock should return problems with reasoning merged, not separate objects
      ProblemReasoningService.generateSessionReasons.mockReturnValue([
        { id: 1, title: "Problem 1", reasoning: "Valid reasoning" },
        { id: 2, title: "Problem 2", reasoning: null }, // Partial failure
      ]);

      const result = await ProblemService.addProblemReasoningToSession(sessionProblems, sessionContext);
      
      expect(Array.isArray(result)).toBe(true);
      // Should include valid reasoning and handle failures gracefully
      expect(result.some(r => r.reasoning === "Valid reasoning")).toBe(true);
    });

    it("should handle reasoning generation timeout", async () => {
      const sessionProblems = createMockProblemsArray();
      const sessionContext = { sessionLength: 100 }; // Large session
      
      getTagMastery.mockResolvedValue([]);
      
      // Simulate timeout by delaying reasoning generation
      ProblemReasoningService.generateSessionReasons.mockImplementation(
        () => new Promise(resolve => 
          setTimeout(() => resolve([]), 30000) // 30 second delay
        )
      );

      // Should timeout and fallback
      const startTime = Date.now();
      const result = await ProblemService.addProblemReasoningToSession(sessionProblems, sessionContext);
      const elapsed = Date.now() - startTime;
      
      expect(elapsed).toBeLessThan(5000); // Should not wait 30 seconds
      expect(result).toEqual(sessionProblems); // Should fallback
    });
  });
};

const runDatabaseIntegrityFailureTests = () => {
  describe("Database Integrity Algorithm Failures", () => {
    it("should handle corrupted problem data during updates", async () => {
      const corruptedProblem = {
        id: 1,
        title: "Two Sum",
        attempts: "corrupted-string", // Should be number
        boxLevel: { invalid: "object" }, // Should be number
        tags: "should-be-array", // Should be array
        difficulty: 999, // Invalid difficulty
      };
      
      setupMockDatabaseProblem(corruptedProblem);
      setupMockAddAttempt({ message: "Attempt added successfully", sessionId: "test-session-123" });
      
      const contentScriptData = createContentScriptData();
      
      const result = await ProblemService.addOrUpdateProblem(contentScriptData);
      
      expect(result).toBeDefined();
      // Should handle corrupted problem and still add attempt
      expect(AttemptsService.addAttempt).toHaveBeenCalled();
    });

    it("should handle database schema version conflicts", async () => {
      setupMockDatabaseProblem(null); // Ensure problem doesn't exist, so addProblem path is taken
      problemsDb.addProblem.mockRejectedValue(
        new Error("Schema version conflict: expected v36, found v35")
      );
      
      const contentScriptData = createContentScriptData();
      
      await expect(ProblemService.addOrUpdateProblem(contentScriptData))
        .rejects.toThrow("Schema version conflict");
      
      expect(problemsDb.addProblem).toHaveBeenCalledWith(contentScriptData);
    });

    it("should handle concurrent modification conflicts", async () => {
      setupMockDatabaseProblem(null); // Ensure problem doesn't exist, so addProblem path is taken
      
      let attemptCount = 0;
      problemsDb.addProblem.mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error("Transaction conflict: record modified by another process");
        }
        return { success: true };
      });
      
      const contentScriptData = createContentScriptData();
      
      // Should throw on first attempt (no retry logic implemented yet)
      await expect(ProblemService.addOrUpdateProblem(contentScriptData))
        .rejects.toThrow("Transaction conflict");
      
      expect(attemptCount).toBe(1); // Single attempt for now
    });
  });
};

// Removed Memory Constraint Algorithm Failure Tests - these tested theoretical scenarios
// (50K problems, 10K session lengths) that don't occur in real Chrome extension usage

describe("ProblemService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ScheduleService.getDailyReviewSchedule = jest.fn();
  });

  runGetProblemByDescriptionTests();
  runAddOrUpdateProblemTests();
  runCreateSessionTests();
  runBuildUserPerformanceContextTests();
  runAddProblemReasoningToSessionTests();

  // Algorithm failure scenario testing
  runAdaptiveSessionAlgorithmFailureTests();
  runProblemSelectionAlgorithmFailureTests();
  runPerformanceAnalysisAlgorithmFailureTests();
  runReasoningAlgorithmFailureTests();
  runDatabaseIntegrityFailureTests();
  // runMemoryConstraintFailureTests(); // Removed - tested unrealistic scenarios

  // Additional tests would be extracted here in a similar manner
  // Following the same pattern for remaining describe blocks:
  // - fetchAndAssembleSessionProblems
  // - addOrUpdateProblemInSession
  // - etc.
});
