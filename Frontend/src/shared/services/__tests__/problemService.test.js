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