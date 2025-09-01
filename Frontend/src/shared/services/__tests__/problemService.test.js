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
jest.mock("../../../content/services/problemReasoningService");
jest.mock("uuid", () => ({ v4: () => "test-uuid-123" }));

import { ProblemService } from "../problemService";
import * as problemsDb from "../../db/problems";
import * as standardProblems from "../../db/standard_problems";
import { AttemptsService } from "../attemptsService";
import { ScheduleService } from "../scheduleService";
import { ProblemReasoningService } from "../../../content/services/problemReasoningService";

// Test fixture factories
const createMockProblem = (overrides = {}) => ({
  id: 1,
  title: "Two Sum",
  difficulty: "Easy",
  ...overrides
});

const createMockProblemInDb = (overrides = {}) => ({
  id: 1,
  title: "Two Sum",
  difficulty: "Easy",
  attempts: 5,
  boxLevel: 2,
  ...overrides
});

const createContentScriptData = (overrides = {}) => ({
  leetCodeID: 1,
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
  ProblemID: 1,
  TimeSpent: 1200,
  Success: true,
  ...overrides
});

// Common assertion helpers
const assertProblemServiceCall = (mockFn, ...expectedArgs) => {
  expect(mockFn).toHaveBeenCalledWith(...expectedArgs);
};

const assertProblemResult = (result, expectedProblem, expectedFound) => {
  expect(result).toEqual({ problem: expectedProblem, found: expectedFound });
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

const setupMockAddAttempt = (result = { success: true }) => {
  AttemptsService.addAttempt.mockResolvedValue(result);
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
      expect(result).toBeNull();
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
      setupMockAddAttempt({ success: true });

      const result = await ProblemService.addOrUpdateProblem(contentScriptData);

      assertAttemptsServiceCall(AttemptsService.addAttempt, attemptData, mockProblem);
      expect(result).toEqual({ success: true, message: "Attempt added successfully" });
    });

    it("should add new problem when problem does not exist", async () => {
      const contentScriptData = createContentScriptData();
      
      setupMockDatabaseProblem(null);
      setupMockAddProblem({ success: true });

      const result = await ProblemService.addOrUpdateProblem(contentScriptData);

      assertProblemServiceCall(problemsDb.addProblem, contentScriptData);
      expect(result).toEqual({ success: true, message: "Problem added successfully" });
    });
  });
};

const runCreateSessionTests = () => {
  describe("createSession", () => {
    beforeEach(() => {
      ScheduleService.getDailyReviewSchedule.mockClear();
    });

    it("should create session with adaptive settings", async () => {
      const sessionSettings = createSessionSettings();
      const mockProblems = createMockProblemsArray();
      
      ScheduleService.getDailyReviewSchedule.mockResolvedValue(mockProblems);

      const result = await ProblemService.createSession(sessionSettings);

      expect(ScheduleService.getDailyReviewSchedule).toHaveBeenCalledWith(sessionSettings);
      expect(result).toEqual(mockProblems);
    });
  });
};

const runBuildUserPerformanceContextTests = () => {
  describe("buildUserPerformanceContext", () => {
    it("should build performance context from tag mastery data", () => {
      const tagMasteryMap = new Map([
        ["array", createTagMasteryEntry("array", 0.8, 10)],
        ["hash-table", createTagMasteryEntry("hash-table", 0.6, 5)],
      ]);

      const result = ProblemService.buildUserPerformanceContext(tagMasteryMap);

      expect(result.strongTags).toContain("array");
      expect(result.weakTags).toContain("hash-table");
    });

    it("should return empty context when no tag mastery data", () => {
      const result = ProblemService.buildUserPerformanceContext(new Map());

      expect(result.strongTags).toEqual([]);
      expect(result.weakTags).toEqual([]);
      expect(result.totalProblemsAttempted).toBe(0);
    });

    it("should handle null tag mastery data", () => {
      const result = ProblemService.buildUserPerformanceContext(null);

      expect(result.strongTags).toEqual([]);
      expect(result.weakTags).toEqual([]);
      expect(result.totalProblemsAttempted).toBe(0);
    });
  });
};

const runAddProblemReasoningToSessionTests = () => {
  describe("addProblemReasoningToSession", () => {
    beforeEach(() => {
      ProblemReasoningService.addReasoningToProblems.mockClear();
    });

    it("should add reasoning to session problems", async () => {
      const sessionProblems = createMockProblemsArray();
      const reasoningData = [
        { problemId: 1, reasoning: "Use hash map for O(1) lookup" },
        { problemId: 2, reasoning: "Apply sliding window technique" },
      ];

      ProblemReasoningService.addReasoningToProblems.mockResolvedValue(reasoningData);

      const result = await ProblemService.addProblemReasoningToSession(sessionProblems);

      expect(ProblemReasoningService.addReasoningToProblems).toHaveBeenCalledWith(sessionProblems);
      expect(result).toEqual(reasoningData);
    });

    it("should return original problems when reasoning fails", async () => {
      const sessionProblems = createMockProblemsArray();

      ProblemReasoningService.addReasoningToProblems.mockRejectedValue(
        new Error("Reasoning service failed")
      );

      const result = await ProblemService.addProblemReasoningToSession(sessionProblems);

      expect(result).toEqual(sessionProblems);
    });
  });
};

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

  // Additional tests would be extracted here in a similar manner
  // Following the same pattern for remaining describe blocks:
  // - fetchAndAssembleSessionProblems
  // - addOrUpdateProblemInSession
  // - etc.
});