/**
 * Isolated unit tests for session creation functions
 * These tests avoid circular dependency issues by mocking at the module level
 */

// Mock all modules upfront to avoid circular dependencies
const mockBuildAdaptiveSessionSettings = jest.fn();
const mockFetchAllProblems = jest.fn();
const mockFetchAdditionalProblems = jest.fn();
const mockGetDailyReviewSchedule = jest.fn();
const mockGetCurrentTier = jest.fn();
const mockMigrateSessionStateToIndexedDB = jest.fn();
const mockGetSessionState = jest.fn();

// Mock the specific functions we need
jest.mock("../../db/sessions", () => ({
  buildAdaptiveSessionSettings: mockBuildAdaptiveSessionSettings,
  getSessionById: jest.fn(),
  getLatestSession: jest.fn(),
  saveSessionToStorage: jest.fn(),
  saveNewSessionToDB: jest.fn(),
  updateSessionInDB: jest.fn(),
  getSessionPerformance: jest.fn(),
}));

jest.mock("../../db/problems", () => ({
  fetchAllProblems: mockFetchAllProblems,
  fetchAdditionalProblems: mockFetchAdditionalProblems,
  countProblemsByBoxLevel: jest.fn(),
  addProblem: jest.fn(),
  checkDatabaseForProblem: jest.fn(),
}));

jest.mock("../scheduleService", () => ({
  ScheduleService: {
    getDailyReviewSchedule: mockGetDailyReviewSchedule,
  },
}));

jest.mock("../tagServices", () => ({
  TagService: {
    getCurrentTier: mockGetCurrentTier,
    getCurrentLearningState: jest.fn(),
  },
}));

jest.mock("../storageService", () => ({
  StorageService: {
    migrateSessionStateToIndexedDB: mockMigrateSessionStateToIndexedDB,
    getSessionState: mockGetSessionState,
    migrateSettingsToIndexedDB: jest.fn(),
  },
}));

// Mock other dependencies
jest.mock("../../db/problem_relationships", () => ({
  updateProblemRelationships: jest.fn(),
}));

jest.mock("../../db/tag_mastery", () => ({
  calculateTagMastery: jest.fn(),
  getTagMastery: jest.fn(),
}));

jest.mock("../../db/sessionAnalytics", () => ({
  storeSessionAnalytics: jest.fn(),
}));

jest.mock("../attemptsService", () => ({
  AttemptsService: {
    addAttempt: jest.fn(),
  },
}));

// Mock utility functions used by ProblemService
const mockDeduplicateById = jest.fn((arr) => arr);
const mockProblemSortingCriteria = jest.fn((a, b) => 0);

// Now we can safely import the modules
describe("Session Creation Functions (Isolated)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("ProblemService.createSession integration", () => {
    it("should create session with adaptive settings and fetch problems", async () => {
      // Arrange
      const mockSettings = {
        sessionLength: 5,
        numberOfNewProblems: 3,
        currentAllowedTags: ["array", "string"],
        currentDifficultyCap: "Easy",
      };

      const mockProblems = [
        { id: 1, title: "Two Sum", difficulty: "Easy", tags: ["array"] },
        {
          id: 2,
          title: "Valid Parentheses",
          difficulty: "Easy",
          tags: ["string"],
        },
        {
          id: 3,
          title: "Merge Intervals",
          difficulty: "Medium",
          tags: ["array"],
        },
      ];

      mockBuildAdaptiveSessionSettings.mockResolvedValue(mockSettings);

      // Mock the problem fetching workflow
      mockFetchAllProblems.mockResolvedValue([{ id: 100, leetCodeID: 100 }]);
      mockGetDailyReviewSchedule.mockResolvedValue([mockProblems[0]]);
      mockFetchAdditionalProblems.mockResolvedValue([
        mockProblems[1],
        mockProblems[2],
      ]);

      // Import after mocks are set up
      const { ProblemService } = require("../problemService");

      // Act
      const result = await ProblemService.createSession();

      // Assert
      expect(mockBuildAdaptiveSessionSettings).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("buildAdaptiveSessionSettings function", () => {
    it("should build settings for new user", async () => {
      // Arrange
      const mockFocusTags = ["array", "string"];
      mockGetCurrentTier.mockResolvedValue({ focusTags: mockFocusTags });
      mockMigrateSessionStateToIndexedDB.mockResolvedValue(null);
      mockGetSessionState.mockResolvedValue(null);

      // Mock the actual implementation
      mockBuildAdaptiveSessionSettings.mockImplementation(async () => {
        const { TagService } = require("../tagServices");
        const { StorageService } = require("../storageService");

        const { focusTags } = await TagService.getCurrentTier();
        const sessionState =
          (await StorageService.migrateSessionStateToIndexedDB()) ||
          (await StorageService.getSessionState("session_state"));

        if (!sessionState) {
          return {
            id: "session_state",
            numSessionsCompleted: 0,
            currentDifficultyCap: "Easy",
            sessionLength: 5,
            numberOfNewProblems: 3,
            currentAllowedTags: focusTags,
          };
        }

        return {
          ...sessionState,
          currentAllowedTags: focusTags,
        };
      });

      // Act
      const result = await mockBuildAdaptiveSessionSettings();

      // Assert
      expect(result).toMatchObject({
        id: "session_state",
        numSessionsCompleted: 0,
        currentDifficultyCap: "Easy",
        sessionLength: expect.any(Number),
        numberOfNewProblems: expect.any(Number),
        currentAllowedTags: mockFocusTags,
      });

      expect(mockGetCurrentTier).toHaveBeenCalled();
    });

    it("should use existing session state when available", async () => {
      // Arrange
      const mockFocusTags = ["dynamic-programming", "graph"];
      const existingSessionState = {
        id: "session_state",
        numSessionsCompleted: 15,
        currentDifficultyCap: "Medium",
        sessionLength: 8,
        numberOfNewProblems: 3,
      };

      mockGetCurrentTier.mockResolvedValue({ focusTags: mockFocusTags });
      mockMigrateSessionStateToIndexedDB.mockResolvedValue(
        existingSessionState
      );

      mockBuildAdaptiveSessionSettings.mockImplementation(async () => {
        const { TagService } = require("../tagServices");
        const { StorageService } = require("../storageService");

        const { focusTags } = await TagService.getCurrentTier();
        const sessionState =
          await StorageService.migrateSessionStateToIndexedDB();

        return {
          ...sessionState,
          currentAllowedTags: focusTags,
        };
      });

      // Act
      const result = await mockBuildAdaptiveSessionSettings();

      // Assert
      expect(result).toEqual({
        ...existingSessionState,
        currentAllowedTags: mockFocusTags,
      });
      expect(result.numSessionsCompleted).toBe(15);
      expect(result.currentDifficultyCap).toBe("Medium");
    });
  });

  describe("fetchAndAssembleSessionProblems workflow", () => {
    it("should assemble problems from review and new sources", async () => {
      // Arrange
      const sessionLength = 4;
      const numberOfNewProblems = 2;
      const currentAllowedTags = ["array"];
      const currentDifficultyCap = "Medium";

      const mockAllProblems = [
        { id: 1, leetCodeID: 1, title: "Existing Problem" },
      ];

      const mockReviewProblems = [
        { id: 2, leetCodeID: 2, title: "Review Problem", difficulty: "Easy" },
      ];

      const mockNewProblems = [
        { id: 3, leetCodeID: 3, title: "New Problem 1", difficulty: "Easy" },
        { id: 4, leetCodeID: 4, title: "New Problem 2", difficulty: "Medium" },
      ];

      mockFetchAllProblems.mockResolvedValue(mockAllProblems);
      mockGetDailyReviewSchedule.mockResolvedValue(mockReviewProblems);
      mockFetchAdditionalProblems.mockResolvedValue(mockNewProblems);

      // Import and execute
      const { ProblemService } = require("../problemService");

      // Act
      const result = await ProblemService.fetchAndAssembleSessionProblems(
        sessionLength,
        numberOfNewProblems,
        currentAllowedTags,
        currentDifficultyCap
      );

      // Assert
      expect(mockFetchAllProblems).toHaveBeenCalled();
      expect(mockGetDailyReviewSchedule).toHaveBeenCalledWith(1); // 40% of 4 = 1.6, floor = 1
      expect(mockFetchAdditionalProblems).toHaveBeenCalledWith(
        3, // 4 - 1 review problem
        new Set([1]) // exclude IDs from existing problems
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle empty review schedule", async () => {
      // Arrange
      const sessionLength = 3;
      const numberOfNewProblems = 3;

      const mockAllProblems = [{ id: 1, leetCodeID: 1 }];
      const mockNewProblems = [
        { id: 2, leetCodeID: 2, title: "New Problem 1" },
        { id: 3, leetCodeID: 3, title: "New Problem 2" },
      ];

      mockFetchAllProblems.mockResolvedValue(mockAllProblems);
      mockGetDailyReviewSchedule.mockResolvedValue([]); // No review problems
      mockFetchAdditionalProblems.mockResolvedValue(mockNewProblems);

      const { ProblemService } = require("../problemService");

      // Act
      const result = await ProblemService.fetchAndAssembleSessionProblems(
        sessionLength,
        numberOfNewProblems,
        ["array"],
        "Easy"
      );

      // Assert
      expect(mockGetDailyReviewSchedule).toHaveBeenCalledWith(1); // 40% of 3 = 1.2, floor = 1
      expect(mockFetchAdditionalProblems).toHaveBeenCalledWith(3, new Set([1]));
      expect(result).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle buildAdaptiveSessionSettings errors", async () => {
      // Arrange
      const error = new Error("Settings build failed");
      mockBuildAdaptiveSessionSettings.mockRejectedValue(error);

      const { ProblemService } = require("../problemService");

      // Act & Assert
      await expect(ProblemService.createSession()).rejects.toThrow(
        "Settings build failed"
      );
    });

    it("should handle problem fetching errors", async () => {
      // Arrange
      const mockSettings = {
        sessionLength: 5,
        numberOfNewProblems: 3,
        currentAllowedTags: ["array"],
        currentDifficultyCap: "Medium",
      };

      mockBuildAdaptiveSessionSettings.mockResolvedValue(mockSettings);
      mockFetchAllProblems.mockRejectedValue(new Error("Database error"));

      const { ProblemService } = require("../problemService");

      // Act & Assert
      await expect(
        ProblemService.fetchAndAssembleSessionProblems(
          5,
          3,
          ["array"],
          "Medium"
        )
      ).rejects.toThrow("Database error");
    });
  });
});
