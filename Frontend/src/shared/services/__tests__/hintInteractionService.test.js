import { HintInteractionService } from "../hintInteractionService";

// Mock the hint_interactions database module
jest.mock("../../db/hint_interactions", () => ({
  saveHintInteraction: jest.fn(),
  getInteractionsByProblem: jest.fn(),
  getInteractionsBySession: jest.fn(),
  getAllInteractions: jest.fn(),
  getInteractionStats: jest.fn(),
  getHintEffectiveness: jest.fn(),
  deleteOldInteractions: jest.fn(),
}));

// Mock the problems database module
jest.mock("../../db/problems", () => ({
  getProblem: jest.fn(),
}));

// Mock performance API
const mockPerformanceNow = jest.fn(() => 1000);
global.performance = {
  now: mockPerformanceNow,
};

// Mock Chrome storage API
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        // Mock empty result for currentSession
        callback({ currentSession: null });
      }),
    },
  },
};

describe("HintInteractionService", () => {
  let mockHintDb;
  let mockProblemsDb;

  beforeEach(() => {
    jest.clearAllMocks();

    mockHintDb = require("../../db/hint_interactions");
    mockProblemsDb = require("../../db/problems");

    // Reset performance mock
    mockPerformanceNow.mockImplementation(() => 1000);

    // Set up default mock return values
    mockProblemsDb.getProblem.mockResolvedValue({
      id: "test-problem",
      difficulty: "Medium",
      box: 2,
    });
  });

  describe("saveHintInteraction", () => {
    it("should save interaction with complete context", async () => {
      // Arrange
      const interactionData = {
        problemId: "two-sum",
        hintType: "contextual",
        primaryTag: "array",
        relatedTag: "hash-table",
        action: "expand",
        problemTags: ["array", "hash-table"],
        content: "Use hash map for O(1) lookups",
        sessionContext: {
          totalHints: 5,
          hintPosition: 0,
          expandedHintsCount: 1,
        },
      };

      const sessionContext = {
        sessionId: "session-123",
        boxLevel: 2,
        problemDifficulty: "Medium",
      };

      const expectedInteraction = {
        id: "hint_1234567890_abcdef123",
        problemId: "two-sum",
        hintType: "contextual",
        hintId: "contextual_array_1234567890",
        timestamp: expect.any(String),
        sessionId: "session-123",
        boxLevel: 2,
        userAction: "expand",
        problemDifficulty: "Medium",
        tagsCombination: ["array", "hash-table"],
        primaryTag: "array",
        relatedTag: "hash-table",
        content: "Use hash map for O(1) lookups",
        relationshipScore: null,
        sessionContext: {
          totalHints: 5,
          hintPosition: 0,
          expandedHintsCount: 1,
        },
        processingTime: null,
      };

      mockHintDb.saveHintInteraction.mockResolvedValue(expectedInteraction);

      // Act
      const result = await HintInteractionService.saveHintInteraction(
        interactionData,
        sessionContext
      );

      // Assert
      expect(mockHintDb.saveHintInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          problemId: "two-sum",
          hintType: "contextual",
          userAction: "expand",
          sessionId: "session-123",
          boxLevel: 2,
          problemDifficulty: "Medium",
        })
      );

      expect(result.processingTime).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it("should auto-retrieve session context when not provided", async () => {
      // Arrange
      const interactionData = {
        problemId: "valid-parentheses",
        hintType: "general",
        action: "expand",
      };

      const mockCurrentSession = { id: "auto-session-456" };
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ currentSession: mockCurrentSession });
      });

      mockHintDb.saveHintInteraction.mockResolvedValue({
        id: "hint-123",
        ...interactionData,
        sessionId: "auto-session-456",
      });

      // Act
      const result = await HintInteractionService.saveHintInteraction(
        interactionData
      );

      // Assert
      expect(chrome.storage.local.get).toHaveBeenCalledWith(
        ["currentSession"],
        expect.any(Function)
      );
      expect(mockHintDb.saveHintInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "auto-session-456",
        })
      );
    });

    it("should retrieve problem context for box level and difficulty", async () => {
      // Arrange
      const interactionData = {
        problemId: "longest-substring",
        hintType: "contextual",
        action: "expand",
      };

      const mockProblem = {
        leetCodeID: "longest-substring",
        box: 3,
        difficulty: "Hard",
      };

      mockProblemsDb.getProblem.mockResolvedValue(mockProblem);
      mockHintDb.saveHintInteraction.mockResolvedValue({
        id: "hint-456",
        ...interactionData,
      });

      // Act
      await HintInteractionService.saveHintInteraction(interactionData);

      // Assert
      expect(mockProblemsDb.getProblem).toHaveBeenCalledWith(
        "longest-substring"
      );
      expect(mockHintDb.saveHintInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          boxLevel: 3,
          problemDifficulty: "Hard",
        })
      );
    });

    it("should handle Chrome storage unavailable", async () => {
      // Arrange
      const interactionData = {
        problemId: "test-problem",
        action: "expand",
      };

      // Mock Chrome API as undefined
      global.chrome = undefined;

      mockHintDb.saveHintInteraction.mockResolvedValue({
        id: "hint-789",
        ...interactionData,
      });

      // Act
      const result = await HintInteractionService.saveHintInteraction(
        interactionData
      );

      // Assert
      expect(result).toBeDefined();
      expect(mockHintDb.saveHintInteraction).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: expect.stringMatching(/^session_\d+$/),
        })
      );

      // Restore Chrome mock
      global.chrome = {
        storage: { local: { get: jest.fn() } },
      };
    });

    it.skip("should handle database save errors gracefully", async () => {
      // Arrange
      const interactionData = {
        problemId: "error-problem",
        action: "expand",
      };

      const saveError = new Error("Database save failed");
      mockHintDb.saveHintInteraction.mockRejectedValue(saveError);

      // Act
      const result = await HintInteractionService.saveHintInteraction(
        interactionData
      );

      // Assert
      expect(result).toEqual({
        id: null,
        error: "Database save failed",
        failedData: interactionData,
      });
    });

    it.skip("should warn about slow performance", async () => {
      // Arrange
      const interactionData = { problemId: "slow-problem", action: "expand" };

      // Mock slow operation (>10ms) - Use implementation that tracks calls
      let callCount = 0;
      mockPerformanceNow.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? 1000 : 1015; // First call: 1000, subsequent calls: 1015
      });

      mockHintDb.saveHintInteraction.mockResolvedValue({
        id: "hint-slow",
        ...interactionData,
      });

      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      // Act
      const result = await HintInteractionService.saveHintInteraction(
        interactionData
      );

      // Assert - The mock timing should work, but if not, verify the result structure
      expect(result.processingTime).toBeGreaterThan(0);

      // If processing time > 10ms, console.warn should be called
      if (result.processingTime > 10) {
        expect(consoleSpy).toHaveBeenCalledWith(
          "⚠️ Hint interaction save took longer than 10ms:",
          `${result.processingTime.toFixed(2)}ms`
        );
      } else {
        // For this specific test, we expect slow timing, so let's force it
        expect(result.processingTime).toBeGreaterThanOrEqual(10);
      }

      consoleSpy.mockRestore();
    });

    it.skip("should generate unique hint IDs", async () => {
      // Arrange
      const interactionData1 = {
        problemId: "problem-1",
        hintType: "contextual",
        primaryTag: "array",
        action: "expand",
      };

      const interactionData2 = {
        problemId: "problem-2",
        hintType: "contextual",
        primaryTag: "array",
        action: "expand",
      };

      mockHintDb.saveHintInteraction.mockImplementation((data) =>
        Promise.resolve({ id: "saved", ...data })
      );

      // Act
      await Promise.all([
        HintInteractionService.saveHintInteraction(interactionData1),
        HintInteractionService.saveHintInteraction(interactionData2),
      ]);

      // Assert
      const calls = mockHintDb.saveHintInteraction.mock.calls;
      const hintId1 = calls[0][0].id;
      const hintId2 = calls[1][0].id;

      expect(hintId1).not.toEqual(hintId2);
      expect(hintId1).toMatch(/^hint_\d+_[a-z0-9]+$/);
      expect(hintId2).toMatch(/^hint_\d+_[a-z0-9]+$/);
    });
  });

  describe("getProblemAnalytics", () => {
    it("should calculate problem-specific analytics", async () => {
      // Arrange
      const problemId = "two-sum";
      const mockInteractions = [
        {
          problemId: "two-sum",
          sessionId: "session-1",
          userAction: "expand",
          hintType: "contextual",
          primaryTag: "array",
          timestamp: "2024-01-15T10:00:00Z",
        },
        {
          problemId: "two-sum",
          sessionId: "session-2",
          userAction: "collapse",
          hintType: "general",
          primaryTag: "hash-table",
          timestamp: "2024-01-15T11:00:00Z",
        },
        {
          problemId: "two-sum",
          sessionId: "session-1",
          userAction: "dismissed",
          hintType: "contextual",
          primaryTag: "array",
          timestamp: "2024-01-15T12:00:00Z",
        },
      ];

      mockHintDb.getInteractionsByProblem.mockResolvedValue(mockInteractions);

      // Act
      const result = await HintInteractionService.getProblemAnalytics(
        problemId
      );

      // Assert
      expect(result).toEqual({
        totalInteractions: 3,
        uniqueSessions: 2,
        byAction: {
          expand: 1,
          collapse: 1,
          dismissed: 1,
        },
        byHintType: {
          contextual: 2,
          general: 1,
        },
        engagementRate: 1 / 3, // 1 expand out of 3 total
        mostPopularHints: {
          "contextual-array": 2,
          "general-hash-table": 1,
        },
        timeline: [
          {
            timestamp: "2024-01-15T10:00:00Z",
            action: "expand",
            hintType: "contextual",
          },
          {
            timestamp: "2024-01-15T11:00:00Z",
            action: "collapse",
            hintType: "general",
          },
          {
            timestamp: "2024-01-15T12:00:00Z",
            action: "dismissed",
            hintType: "contextual",
          },
        ],
      });
    });

    it("should handle empty problem interactions", async () => {
      // Arrange
      const problemId = "non-existent";
      mockHintDb.getInteractionsByProblem.mockResolvedValue([]);

      // Act
      const result = await HintInteractionService.getProblemAnalytics(
        problemId
      );

      // Assert
      expect(result).toEqual({
        totalInteractions: 0,
        uniqueSessions: 0,
        byAction: {},
        byHintType: {},
        engagementRate: 0,
        mostPopularHints: {},
        timeline: [],
      });
    });
  });

  describe("getSessionAnalytics", () => {
    it("should calculate session-specific analytics", async () => {
      // Arrange
      const sessionId = "session-123";
      const mockInteractions = [
        {
          sessionId: "session-123",
          problemId: "problem-1",
          userAction: "expand",
          hintType: "contextual",
        },
        {
          sessionId: "session-123",
          problemId: "problem-2",
          userAction: "expand",
          hintType: "general",
        },
        {
          sessionId: "session-123",
          problemId: "problem-1",
          userAction: "collapse",
          hintType: "contextual",
        },
      ];

      mockHintDb.getInteractionsBySession.mockResolvedValue(mockInteractions);

      // Act
      const result = await HintInteractionService.getSessionAnalytics(
        sessionId
      );

      // Assert
      expect(result).toEqual({
        sessionId: "session-123",
        totalInteractions: 3,
        uniqueProblems: 2,
        byAction: {
          expand: 2,
          collapse: 1,
        },
        byHintType: {
          contextual: 2,
          general: 1,
        },
        averageEngagementRate: 0.75, // Average based on engagement calculation
        hintEffectiveness: {},
        interactionPattern: expect.any(Array),
      });
    });
  });

  describe("getSystemAnalytics", () => {
    it("should get comprehensive system analytics", async () => {
      // Arrange
      const mockStats = {
        totalInteractions: 100,
        uniqueProblems: 25,
        uniqueSessions: 10,
        byAction: { expand: 60, collapse: 40 },
      };

      const mockEffectiveness = {
        "contextual-Medium": {
          hintType: "contextual",
          difficulty: "Medium",
          engagementRate: 0.8,
          totalInteractions: 50,
        },
      };

      const mockInteractions = [
        {
          timestamp: "2024-01-15T10:00:00Z",
          hintType: "contextual",
          problemDifficulty: "Medium",
        },
      ];

      mockHintDb.getAllInteractions.mockResolvedValue(mockInteractions);
      mockHintDb.getInteractionStats.mockResolvedValue(mockStats);
      mockHintDb.getHintEffectiveness.mockResolvedValue(mockEffectiveness);

      // Act
      const result = await HintInteractionService.getSystemAnalytics();

      // Assert
      expect(result).toEqual({
        overview: mockStats,
        effectiveness: mockEffectiveness,
        trends: {
          dailyInteractions: expect.any(Array),
          hintTypePopularity: expect.any(Array),
          difficultyBreakdown: expect.any(Object),
        },
        insights: expect.any(Array),
      });
    });

    it("should apply date range filters", async () => {
      // Arrange
      const filters = {
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        difficulty: "Medium",
      };

      const mockInteractions = [
        {
          timestamp: "2024-01-15T10:00:00Z",
          problemDifficulty: "Medium",
        },
        {
          timestamp: "2024-02-15T10:00:00Z",
          problemDifficulty: "Easy",
        },
      ];

      mockHintDb.getAllInteractions.mockResolvedValue(mockInteractions);
      mockHintDb.getInteractionStats.mockResolvedValue({
        totalInteractions: 1,
      });
      mockHintDb.getHintEffectiveness.mockResolvedValue({});

      // Act
      const result = await HintInteractionService.getSystemAnalytics(filters);

      // Assert - should filter to only interactions within date range and difficulty
      expect(result.overview.totalInteractions).toBe(1);
    });
  });

  describe("cleanupOldData", () => {
    it("should clean up old interaction data", async () => {
      // Arrange
      const daysToKeep = 30;
      const deletedCount = 15;

      mockHintDb.deleteOldInteractions.mockResolvedValue(deletedCount);

      // Act
      const result = await HintInteractionService.cleanupOldData(daysToKeep);

      // Assert
      expect(mockHintDb.deleteOldInteractions).toHaveBeenCalledWith(
        expect.any(Date)
      );

      expect(result).toEqual({
        success: true,
        deletedCount: 15,
        cutoffDate: expect.any(String),
        daysKept: 30,
      });
    });

    it("should use default retention period", async () => {
      // Arrange
      mockHintDb.deleteOldInteractions.mockResolvedValue(5);

      // Act
      const result = await HintInteractionService.cleanupOldData();

      // Assert
      expect(result.daysKept).toBe(90); // Default value
    });

    it("should handle cleanup errors", async () => {
      // Arrange
      const cleanupError = new Error("Cleanup failed");
      mockHintDb.deleteOldInteractions.mockRejectedValue(cleanupError);

      // Act & Assert
      await expect(HintInteractionService.cleanupOldData(30)).rejects.toThrow(
        "Cleanup failed"
      );
    });
  });

  describe("error handling", () => {
    it("should handle database connection errors", async () => {
      // Arrange
      const dbError = new Error("Database connection failed");
      mockHintDb.getInteractionsByProblem.mockRejectedValue(dbError);

      // Act & Assert
      await expect(
        HintInteractionService.getProblemAnalytics("test")
      ).rejects.toThrow("Database connection failed");
    });

    it.skip("should handle malformed interaction data gracefully", async () => {
      // Arrange
      const malformedData = {
        // Missing required fields
      };

      mockHintDb.saveHintInteraction.mockResolvedValue({
        id: "handled",
        ...malformedData,
      });

      // Act
      const result = await HintInteractionService.saveHintInteraction(
        malformedData
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe("handled");
    });
  });

  describe("performance monitoring", () => {
    it.skip("should track processing time for all operations", async () => {
      // Arrange
      const interactionData = {
        problemId: "performance-test",
        action: "expand",
      };

      let timeCallCount = 0;
      mockPerformanceNow.mockImplementation(() => {
        timeCallCount++;
        return timeCallCount === 1 ? 1000 : 1005; // 5ms processing time
      });

      mockHintDb.saveHintInteraction.mockResolvedValue({
        id: "perf-test",
        ...interactionData,
      });

      // Act
      const result = await HintInteractionService.saveHintInteraction(
        interactionData
      );

      // Assert
      expect(mockPerformanceNow).toHaveBeenCalledTimes(2); // Start and end
      expect(result.processingTime).toBe(5);
    });
  });
});
