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
import * as sessionsDb from "../../db/sessions";
import * as tagMasteryDb from "../../db/tag_mastery";
import { AttemptsService } from "../attemptsService";
import { ScheduleService } from "../scheduleService";
import { ProblemReasoningService } from "../../../content/services/problemReasoningService";

describe("ProblemService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up common mocks
    ScheduleService.getDailyReviewSchedule = jest.fn();
  });

  describe("getProblemByDescription", () => {
    beforeEach(() => {
      // Functions are already mocked via jest.mock() - just clear them
      standardProblems.getProblemFromStandardProblems.mockClear();
      problemsDb.checkDatabaseForProblem.mockClear();
    });

    it("should return problem from problems store when found in both stores", async () => {
      // Arrange
      const mockStandardProblem = {
        id: 1,
        title: "Two Sum",
        difficulty: "Easy",
      };
      const mockProblemInDb = {
        id: 1,
        title: "Two Sum",
        difficulty: "Easy",
        attempts: 5,
        boxLevel: 2,
      };

      standardProblems.getProblemFromStandardProblems.mockResolvedValue(
        mockStandardProblem
      );
      problemsDb.checkDatabaseForProblem.mockResolvedValue(mockProblemInDb);

      // Act
      const result = await ProblemService.getProblemByDescription(
        "Two Sum",
        "two-sum"
      );

      // Assert
      expect(
        standardProblems.getProblemFromStandardProblems
      ).toHaveBeenCalledWith("two-sum");
      expect(problemsDb.checkDatabaseForProblem).toHaveBeenCalledWith(1);
      expect(result).toEqual({ problem: mockProblemInDb, found: true });
    });

    it("should return problem from standard problems when not found in problems store", async () => {
      // Arrange
      const mockStandardProblem = {
        id: 1,
        title: "Two Sum",
        difficulty: "Easy",
      };

      standardProblems.getProblemFromStandardProblems.mockResolvedValue(
        mockStandardProblem
      );
      problemsDb.checkDatabaseForProblem.mockResolvedValue(null);

      // Act
      const result = await ProblemService.getProblemByDescription(
        "Two Sum",
        "two-sum"
      );

      // Assert
      expect(
        standardProblems.getProblemFromStandardProblems
      ).toHaveBeenCalledWith("two-sum");
      expect(problemsDb.checkDatabaseForProblem).toHaveBeenCalledWith(1);
      expect(result).toEqual({ problem: mockStandardProblem, found: false });
    });

    it("should return null when problem not found in any store", async () => {
      // Arrange
      standardProblems.getProblemFromStandardProblems.mockResolvedValue(null);

      // Act
      const result = await ProblemService.getProblemByDescription(
        "Non-existent",
        "non-existent"
      );

      // Assert
      expect(
        standardProblems.getProblemFromStandardProblems
      ).toHaveBeenCalledWith("non-existent");
      expect(problemsDb.checkDatabaseForProblem).not.toHaveBeenCalled();
      expect(result).toEqual({ problem: null, found: false });
    });
  });

  describe("addOrUpdateProblem", () => {
    beforeEach(() => {
      // Functions are already mocked via jest.mock() - just clear them
      problemsDb.checkDatabaseForProblem.mockClear();
      problemsDb.addProblem.mockClear();
      AttemptsService.addAttempt.mockClear();
    });

    it("should add attempt when problem exists", async () => {
      // Arrange
      const contentScriptData = {
        leetCodeID: 1,
        title: "Two Sum",
        timeSpent: 1200,
        success: true,
      };
      const existingProblem = { id: 1, title: "Two Sum", attempts: 3 };

      problemsDb.checkDatabaseForProblem.mockResolvedValue(existingProblem);
      AttemptsService.addAttempt.mockResolvedValue({ success: true });

      // Act
      await ProblemService.addOrUpdateProblem(contentScriptData);

      // Assert
      expect(problemsDb.checkDatabaseForProblem).toHaveBeenCalledWith(1);
      expect(AttemptsService.addAttempt).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "test-uuid-123",
          ProblemID: 1,
          TimeSpent: 1200,
          Success: true,
        }),
        existingProblem
      );
      expect(problemsDb.addProblem).not.toHaveBeenCalled();
    });

    it("should add new problem when problem does not exist", async () => {
      // Arrange
      const contentScriptData = {
        leetCodeID: 1,
        title: "Two Sum",
        timeSpent: 1200,
        success: true,
      };

      problemsDb.checkDatabaseForProblem.mockResolvedValue(null);
      problemsDb.addProblem.mockResolvedValue({ success: true });

      // Act
      await ProblemService.addOrUpdateProblem(contentScriptData);

      // Assert
      expect(problemsDb.checkDatabaseForProblem).toHaveBeenCalledWith(1);
      expect(problemsDb.addProblem).toHaveBeenCalledWith(contentScriptData);
      expect(AttemptsService.addAttempt).not.toHaveBeenCalled();
    });
  });

  describe("createSession", () => {
    beforeEach(() => {
      sessionsDb.buildAdaptiveSessionSettings.mockClear();
      jest.spyOn(ProblemService, "fetchAndAssembleSessionProblems");
    });

    it("should create session with adaptive settings", async () => {
      // Arrange
      const mockSettings = {
        sessionLength: 5,
        numberOfNewProblems: 3,
        currentAllowedTags: ["array", "hash-table"],
        currentDifficultyCap: "Medium",
        userFocusAreas: [],
      };
      const mockProblems = [
        { id: 1, title: "Problem 1" },
        { id: 2, title: "Problem 2" },
      ];

      sessionsDb.buildAdaptiveSessionSettings.mockResolvedValue(mockSettings);
      ProblemService.fetchAndAssembleSessionProblems.mockResolvedValue(
        mockProblems
      );

      // Act
      const result = await ProblemService.createSession();

      // Assert
      expect(sessionsDb.buildAdaptiveSessionSettings).toHaveBeenCalled();
      expect(
        ProblemService.fetchAndAssembleSessionProblems
      ).toHaveBeenCalledWith(5, 3, ["array", "hash-table"], "Medium", []);
      expect(result).toEqual(mockProblems);
    });
  });

  describe("fetchAndAssembleSessionProblems", () => {
    let addReasoningSpy;

    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();

      // Setup database mocks
      problemsDb.fetchAllProblems.mockClear();
      problemsDb.fetchAdditionalProblems.mockClear();
      ScheduleService.getDailyReviewSchedule = jest.fn();

      // Setup reasoning service spy
      addReasoningSpy = jest
        .spyOn(ProblemService, "addProblemReasoningToSession")
        .mockImplementation((problems) => Promise.resolve(problems));
    });

    afterEach(() => {
      // Clean up spies
      addReasoningSpy?.mockRestore();
    });

    it.skip("should assemble session with review and new problems", async () => {
      // Arrange
      const sessionLength = 5;
      const mockAllProblems = [
        { id: 1, leetCodeID: 1 },
        { id: 2, leetCodeID: 2 },
      ];
      const mockReviewProblems = [{ id: 1, title: "Review Problem" }];
      const mockNewProblems = [
        { id: 3, title: "New Problem 1" },
        { id: 4, title: "New Problem 2" },
      ];

      problemsDb.fetchAllProblems.mockResolvedValue(mockAllProblems);
      ScheduleService.getDailyReviewSchedule.mockResolvedValue(
        mockReviewProblems
      );
      problemsDb.fetchAdditionalProblems.mockResolvedValue(mockNewProblems);

      // Act
      const result = await ProblemService.fetchAndAssembleSessionProblems(
        sessionLength,
        3,
        ["array"],
        "Medium"
      );

      // Assert
      expect(problemsDb.fetchAllProblems).toHaveBeenCalled();
      expect(ScheduleService.getDailyReviewSchedule).toHaveBeenCalledWith(2); // 40% of 5 = 2
      expect(problemsDb.fetchAdditionalProblems).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Set)
      );
      expect(addReasoningSpy).toHaveBeenCalled();
      expect(result).toHaveLength(3); // review (1) + new (2)
      expect(result).toContainEqual(mockReviewProblems[0]);
    });

    it.skip("should use fallback problems when session is short", async () => {
      // Arrange
      const sessionLength = 3;
      const mockAllProblems = [
        {
          id: 1,
          leetCodeID: 1,
          ReviewSchedule: "2024-01-01T00:00:00.000Z",
          AttemptStats: { TotalAttempts: 1, SuccessfulAttempts: 1 },
          lastAttemptDate: "2024-01-01T00:00:00.000Z",
        },
        {
          id: 2,
          leetCodeID: 2,
          ReviewSchedule: "2024-01-02T00:00:00.000Z",
          AttemptStats: { TotalAttempts: 2, SuccessfulAttempts: 1 },
          lastAttemptDate: "2024-01-02T00:00:00.000Z",
        },
        {
          id: 3,
          leetCodeID: 3,
          ReviewSchedule: "2024-01-03T00:00:00.000Z",
          AttemptStats: { TotalAttempts: 1, SuccessfulAttempts: 0 },
          lastAttemptDate: "2024-01-03T00:00:00.000Z",
        },
      ];

      problemsDb.fetchAllProblems.mockResolvedValue(mockAllProblems);
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]); // No review problems
      problemsDb.fetchAdditionalProblems.mockResolvedValue([]); // No new problems

      // Act
      const result = await ProblemService.fetchAndAssembleSessionProblems(
        sessionLength,
        3,
        ["array"],
        "Medium"
      );

      // Assert - Should use fallback logic to fill session
      expect(result).toHaveLength(sessionLength);
      expect(result.every((p) => p.id)).toBe(true); // All problems should have IDs
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: expect.any(Number) }),
        ])
      );
    });
  });

  describe("buildUserPerformanceContext", () => {
    it("should build performance context from tag mastery data", () => {
      // Arrange
      const tagMasteryData = [
        { tag: "Array", successRate: 0.8, totalAttempts: 10 },
        { tag: "Hash-Table", successRate: 0.5, totalAttempts: 4 },
        { tag: "Dynamic-Programming", successRate: 0.9, totalAttempts: 2 },
      ];

      // Act
      const result = ProblemService.buildUserPerformanceContext(tagMasteryData);

      // Assert
      expect(result).toEqual({
        weakTags: ["hash-table"], // Below 0.7 and >= 3 attempts
        newTags: ["dynamic-programming"], // < 3 attempts
        tagAccuracy: {
          array: 0.8,
          "hash-table": 0.5,
          "dynamic-programming": 0.9,
        },
        tagAttempts: {
          array: 10,
          "hash-table": 4,
          "dynamic-programming": 2,
        },
      });
    });

    it("should return empty context when no tag mastery data", () => {
      // Act
      const result = ProblemService.buildUserPerformanceContext([]);

      // Assert
      expect(result).toEqual({
        weakTags: [],
        newTags: [],
        tagAccuracy: {},
        tagAttempts: {},
      });
    });

    it("should handle null tag mastery data", () => {
      // Act
      const result = ProblemService.buildUserPerformanceContext(null);

      // Assert
      expect(result).toEqual({
        weakTags: [],
        newTags: [],
        tagAccuracy: {},
        tagAttempts: {},
      });
    });
  });

  describe("addProblemReasoningToSession", () => {
    beforeEach(() => {
      tagMasteryDb.getTagMastery.mockClear();
      ProblemReasoningService.generateSessionReasons = jest.fn();
      jest.spyOn(ProblemService, "buildUserPerformanceContext");

      // Reset the spy from the previous describe block
      ProblemService.addProblemReasoningToSession.mockRestore?.();
    });

    it("should add reasoning to session problems", async () => {
      // Arrange
      const problems = [
        { id: 1, title: "Problem 1", tags: ["array"] },
        { id: 2, title: "Problem 2", tags: ["hash-table"] },
      ];
      const sessionContext = { sessionLength: 5, reviewCount: 2, newCount: 3 };
      const mockTagMastery = [
        { tag: "array", successRate: 0.8, totalAttempts: 5 },
      ];
      const mockUserPerformance = { weakTags: [], newTags: [] };

      tagMasteryDb.getTagMastery.mockResolvedValue(mockTagMastery);
      ProblemService.buildUserPerformanceContext.mockReturnValue(
        mockUserPerformance
      );
      ProblemReasoningService.generateSessionReasons.mockReturnValue(
        problems.map((p) => ({ ...p, selectionReason: "Test reason" }))
      );

      // Act
      const result = await ProblemService.addProblemReasoningToSession(
        problems,
        sessionContext
      );

      // Assert
      expect(tagMasteryDb.getTagMastery).toHaveBeenCalled();
      expect(ProblemService.buildUserPerformanceContext).toHaveBeenCalledWith(
        mockTagMastery
      );
      expect(
        ProblemReasoningService.generateSessionReasons
      ).toHaveBeenCalledWith(problems, sessionContext, mockUserPerformance);
      expect(result).toHaveLength(2);
      expect(result[0].selectionReason).toBe("Test reason");
    });

    it("should return original problems when reasoning fails", async () => {
      // Arrange
      const problems = [{ id: 1, title: "Problem 1" }];
      const sessionContext = { sessionLength: 5 };

      tagMasteryDb.getTagMastery.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await ProblemService.addProblemReasoningToSession(
        problems,
        sessionContext
      );

      // Assert
      expect(result).toEqual(problems);
    });
  });

  describe("addOrUpdateProblemInSession", () => {
    it("should update existing problem in session", async () => {
      // Arrange
      const session = {
        problems: [
          { id: 1, title: "Problem 1", difficulty: "Easy" },
          { id: 2, title: "Problem 2", difficulty: "Medium" },
        ],
      };
      const updatedProblem = {
        id: 1,
        title: "Problem 1 Updated",
        difficulty: "Easy",
      };
      const attemptId = "attempt-123";

      // Act
      const result = await ProblemService.addOrUpdateProblemInSession(
        session,
        { leetCodeID: 1, ...updatedProblem },
        attemptId
      );

      // Assert
      expect(result.problems).toHaveLength(2);
      expect(result.problems[0]).toEqual({ leetCodeID: 1, ...updatedProblem });
      expect(result.problems[1].id).toBe(2); // Other problem unchanged
    });

    it("should return session unchanged when problem not found", async () => {
      // Arrange
      const session = {
        problems: [
          { id: 1, title: "Problem 1" },
          { id: 2, title: "Problem 2" },
        ],
      };
      const newProblem = { id: 3, title: "Problem 3" };
      const attemptId = "attempt-123";

      // Act
      const result = await ProblemService.addOrUpdateProblemInSession(
        session,
        { leetCodeID: 3, ...newProblem },
        attemptId
      );

      // Assert
      expect(result.problems).toHaveLength(2);
      expect(result.problems).toEqual(session.problems);
    });
  });

  describe("countProblemsByBoxLevel", () => {
    it("should return box level counts", async () => {
      // Arrange
      const mockCounts = { 1: 10, 2: 15, 3: 8, 4: 5, 5: 2 };
      problemsDb.countProblemsByBoxLevel.mockResolvedValue(mockCounts);

      // Act
      const result = await ProblemService.countProblemsByBoxLevel();

      // Assert
      expect(problemsDb.countProblemsByBoxLevel).toHaveBeenCalled();
      expect(result).toEqual(mockCounts);
    });
  });
});

// Test retry-enabled methods
describe("ProblemService Retry-Enabled Methods", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addOrUpdateProblemWithRetry", () => {
    beforeEach(() => {
      problemsDb.addProblemWithRetry.mockClear();
    });

    it("should successfully add problem with retry logic", async () => {
      // Arrange
      const contentScriptData = {
        leetCodeID: 123,
        title: "Test Problem",
        success: true,
        timeSpent: 1500,
      };
      const mockResult = { id: 123, success: true };
      const mockSendResponse = jest.fn();

      problemsDb.addProblemWithRetry.mockResolvedValue(mockResult);

      // Act
      const result = await ProblemService.addOrUpdateProblemWithRetry(
        contentScriptData,
        mockSendResponse
      );

      // Assert
      expect(problemsDb.addProblemWithRetry).toHaveBeenCalledWith(
        contentScriptData,
        expect.objectContaining({
          timeout: 10000,
          priority: "high",
          operationName: "ProblemService.addOrUpdateProblem",
        })
      );
      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        message: "Problem added successfully",
        data: mockResult,
      });
      expect(result).toEqual(mockResult);
    });

    it("should handle retry errors gracefully", async () => {
      // Arrange
      const contentScriptData = { leetCodeID: 123 };
      const mockSendResponse = jest.fn();
      const error = new Error("Database connection failed");

      problemsDb.addProblemWithRetry.mockRejectedValue(error);

      // Act & Assert
      await expect(
        ProblemService.addOrUpdateProblemWithRetry(
          contentScriptData,
          mockSendResponse
        )
      ).rejects.toThrow("Database connection failed");

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: "Failed to add problem: Database connection failed",
      });
    });
  });

  describe("getProblemByDescriptionWithRetry", () => {
    beforeEach(() => {
      standardProblems.getProblemFromStandardProblems.mockClear();
      problemsDb.checkDatabaseForProblemWithRetry.mockClear();
      problemsDb.getProblemWithRetry.mockClear();
    });

    it("should find problem with retry logic", async () => {
      // Arrange
      const mockStandardProblem = { id: 1, title: "Test Problem" };
      const mockFullProblem = {
        id: 1,
        title: "Test Problem",
        attempts: 3,
        boxLevel: 2,
      };

      standardProblems.getProblemFromStandardProblems.mockResolvedValue(
        mockStandardProblem
      );
      problemsDb.checkDatabaseForProblemWithRetry.mockResolvedValue(true);
      problemsDb.getProblemWithRetry.mockResolvedValue(mockFullProblem);

      // Act
      const result = await ProblemService.getProblemByDescriptionWithRetry(
        "Test Problem",
        "test-problem"
      );

      // Assert
      expect(
        standardProblems.getProblemFromStandardProblems
      ).toHaveBeenCalledWith("test-problem");
      expect(problemsDb.checkDatabaseForProblemWithRetry).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          timeout: 5000,
          priority: "normal",
          operationName: "ProblemService.checkDatabaseForProblem",
        })
      );
      expect(problemsDb.getProblemWithRetry).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          operationName: "ProblemService.getProblem",
        })
      );
      expect(result).toEqual({ problem: mockFullProblem, found: true });
    });
  });

  describe("getAllProblemsWithRetry", () => {
    beforeEach(() => {
      problemsDb.fetchAllProblemsWithRetry.mockClear();
    });

    it("should fetch all problems with retry configuration", async () => {
      // Arrange
      const mockProblems = [
        { id: 1, title: "Problem 1" },
        { id: 2, title: "Problem 2" },
      ];

      problemsDb.fetchAllProblemsWithRetry.mockResolvedValue(mockProblems);

      // Act
      const result = await ProblemService.getAllProblemsWithRetry({
        timeout: 20000,
        priority: "high",
      });

      // Assert
      expect(problemsDb.fetchAllProblemsWithRetry).toHaveBeenCalledWith({
        timeout: 20000,
        priority: "high",
        abortController: null,
        streaming: false,
        onProgress: null,
        operationName: "ProblemService.getAllProblems",
      });
      expect(result).toEqual(mockProblems);
    });
  });

  describe("generateSessionWithRetry", () => {
    beforeEach(() => {
      jest.spyOn(ProblemService, "getAllProblemsWithRetry");
    });

    it("should generate session with retry and filtering", async () => {
      // Arrange
      const mockAllProblems = [
        { id: 1, difficulty: "Easy", tags: ["array"], review: "2024-01-01" },
        {
          id: 2,
          difficulty: "Medium",
          tags: ["hash-table"],
          review: "2024-01-02",
        },
        {
          id: 3,
          difficulty: "Hard",
          tags: ["dynamic-programming"],
          review: "2024-01-03",
        },
      ];

      ProblemService.getAllProblemsWithRetry.mockResolvedValue(mockAllProblems);

      // Act
      const result = await ProblemService.generateSessionWithRetry({
        sessionLength: 2,
        difficulty: "Easy",
        tags: ["array"],
        timeout: 15000,
      });

      // Assert
      expect(ProblemService.getAllProblemsWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 15000,
          priority: "high",
        })
      );
      expect(result).toHaveLength(1); // Only Easy array problems
      expect(result[0]).toEqual(mockAllProblems[0]);
    });

    it("should handle cancellation gracefully", async () => {
      // Arrange
      const abortController = new AbortController();
      abortController.abort();

      // Act & Assert
      await expect(
        ProblemService.generateSessionWithRetry({}, abortController)
      ).rejects.toThrow("Session generation cancelled before start");
    });
  });

  describe("createAbortController", () => {
    it("should create new abort controller", () => {
      // Act
      const controller = ProblemService.createAbortController();

      // Assert
      expect(controller).toBeInstanceOf(AbortController);
      expect(controller.signal).toBeDefined();
      expect(typeof controller.abort).toBe("function");
    });
  });
});
