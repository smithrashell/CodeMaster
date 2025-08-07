/**
 * Isolated unit tests for SessionService.summarizeSessionPerformance
 * Avoids circular dependency issues through comprehensive mocking
 */

// Mock all dependencies upfront
const mockGetTagMastery = jest.fn();
const mockCalculateTagMastery = jest.fn();
const mockUpdateProblemRelationships = jest.fn();
const mockGetSessionPerformance = jest.fn();
const mockStoreSessionAnalytics = jest.fn();
const mockFetchProblemById = jest.fn().mockResolvedValue({ difficulty: "Medium" });

jest.mock("../../db/tag_mastery", () => ({
  getTagMastery: mockGetTagMastery,
  calculateTagMastery: mockCalculateTagMastery,
}));

jest.mock("../../db/problem_relationships", () => ({
  updateProblemRelationships: mockUpdateProblemRelationships,
}));

jest.mock("../../db/sessions", () => ({
  getSessionPerformance: mockGetSessionPerformance,
}));

jest.mock("../../db/sessionAnalytics", () => ({
  storeSessionAnalytics: mockStoreSessionAnalytics,
}));

// Mock other modules to prevent circular imports
jest.mock("../../db/problems", () => ({}));
jest.mock("../../db/attempts", () => ({}));
jest.mock("../../db/standard_problems", () => ({
  fetchProblemById: mockFetchProblemById,
}));
jest.mock("../storageService", () => ({}));
jest.mock("../scheduleService", () => ({}));
jest.mock("../tagServices", () => ({}));
jest.mock("../problemService", () => ({}));
jest.mock("../attemptsService", () => ({}));

// Mock Chrome API
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => callback({ sessionAnalytics: [] })),
      set: jest.fn(),
    },
  },
};

// Mock console to reduce noise
global.console = {
  ...console,
  info: jest.fn(),
  error: jest.fn(),
};

describe("SessionService.summarizeSessionPerformance (Isolated)", () => {
  let SessionService;

  beforeAll(async () => {
    // Import after mocks are set up
    const sessionModule = await import("../sessionService");
    SessionService = sessionModule.SessionService;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("comprehensive performance analysis", () => {
    it("should orchestrate full session performance workflow", async () => {
      // Arrange
      const mockSession = {
        id: "test-session-123",
        problems: [
          { id: 1, leetCodeID: 1, difficulty: "Easy", tags: ["array"] },
          { id: 2, leetCodeID: 2, difficulty: "Medium", tags: ["string"] },
          { id: 3, leetCodeID: 3, difficulty: "Easy", tags: ["hash-table"] },
        ],
        attempts: [
          { problemId: 1, success: true },
          { problemId: 2, success: false },
          { problemId: 3, success: true },
        ],
      };

      const mockPreTagMastery = [
        { tag: "array", mastered: false, totalAttempts: 5, decayScore: 1.0 },
        { tag: "string", mastered: true, totalAttempts: 10, decayScore: 0.95 },
      ];

      const mockPostTagMastery = [
        { tag: "array", mastered: true, totalAttempts: 6, decayScore: 1.0 },
        { tag: "string", mastered: true, totalAttempts: 11, decayScore: 0.96 },
        {
          tag: "hash-table",
          mastered: false,
          totalAttempts: 1,
          decayScore: 1.0,
        },
      ];

      const mockPerformanceMetrics = {
        accuracy: 0.67,
        avgTime: 420,
        strongTags: ["array"],
        weakTags: ["hash-table"],
        timingFeedback: {},
        Easy: { attempts: 2, correct: 2, time: 600, avgTime: 300 },
        Medium: { attempts: 1, correct: 0, time: 840, avgTime: 840 },
        Hard: { attempts: 0, correct: 0, time: 0, avgTime: 0 },
      };

      // Setup mocks
      mockGetTagMastery
        .mockResolvedValueOnce(mockPreTagMastery)
        .mockResolvedValueOnce(mockPostTagMastery);
      mockUpdateProblemRelationships.mockResolvedValue();
      mockCalculateTagMastery.mockResolvedValue();
      mockGetSessionPerformance.mockResolvedValue(mockPerformanceMetrics);
      mockStoreSessionAnalytics.mockResolvedValue();
      
      // Mock standard problems for each problem in the session
      mockFetchProblemById
        .mockResolvedValueOnce({ difficulty: "Easy" })
        .mockResolvedValueOnce({ difficulty: "Medium" })
        .mockResolvedValueOnce({ difficulty: "Easy" });

      // Act
      const result = await SessionService.summarizeSessionPerformance(
        mockSession
      );

      // Assert workflow execution
      expect(mockGetTagMastery).toHaveBeenCalledTimes(2);
      expect(mockUpdateProblemRelationships).toHaveBeenCalledWith(mockSession);
      expect(mockCalculateTagMastery).toHaveBeenCalled();
      expect(mockGetSessionPerformance).toHaveBeenCalledWith({
        recentSessionsLimit: 1,
        unmasteredTags: ["hash-table"],
      });
      expect(mockStoreSessionAnalytics).toHaveBeenCalled();

      // Assert result structure
      expect(result).toMatchObject({
        sessionId: mockSession.id,
        completedAt: expect.any(String),
        performance: mockPerformanceMetrics,
        masteryProgression: {
          deltas: expect.any(Array),
          newMasteries: expect.any(Number),
          decayedMasteries: expect.any(Number),
        },
        difficultyAnalysis: {
          counts: expect.any(Object),
          percentages: expect.any(Object),
          totalProblems: 3,
          predominantDifficulty: expect.any(String),
        },
        insights: expect.any(Object),
      });
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      const mockSession = { id: "error-session", problems: [], attempts: [] };
      const error = new Error("Database connection failed");

      mockGetTagMastery.mockRejectedValue(error);

      // Act & Assert
      await expect(
        SessionService.summarizeSessionPerformance(mockSession)
      ).rejects.toThrow("Database connection failed");

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "❌ Error summarizing session performance for error-session"
        ),
        error
      );
    });
  });

  describe("calculateMasteryDeltas", () => {
    it("should calculate deltas for new and updated tags", () => {
      // Arrange
      const preSessionMap = new Map([
        ["array", { mastered: false, totalAttempts: 5, decayScore: 1.0 }],
      ]);

      const postSessionMap = new Map([
        ["array", { mastered: true, totalAttempts: 8, decayScore: 1.0 }],
        ["string", { mastered: false, totalAttempts: 3, decayScore: 1.0 }],
      ]);

      // Act
      const deltas = SessionService.calculateMasteryDeltas(
        preSessionMap,
        postSessionMap
      );

      // Assert
      expect(deltas).toHaveLength(2);

      const arrayDelta = deltas.find((d) => d.tag === "array");
      expect(arrayDelta).toMatchObject({
        tag: "array",
        type: "updated",
        preMastered: false,
        postMastered: true,
        masteredChanged: true,
        strengthDelta: 3,
      });

      const stringDelta = deltas.find((d) => d.tag === "string");
      expect(stringDelta).toMatchObject({
        tag: "string",
        type: "new",
        preMastered: false,
        postMastered: false,
        strengthDelta: 3,
      });
    });

    it("should filter out unchanged tags", () => {
      // Arrange
      const preSessionMap = new Map([
        ["array", { mastered: false, totalAttempts: 5, decayScore: 1.0 }],
      ]);

      const postSessionMap = new Map([
        ["array", { mastered: false, totalAttempts: 5, decayScore: 1.0 }], // No change
      ]);

      // Act
      const deltas = SessionService.calculateMasteryDeltas(
        preSessionMap,
        postSessionMap
      );

      // Assert - No deltas should be returned for unchanged tags
      expect(deltas).toHaveLength(0);
    });
  });

  describe("analyzeSessionDifficulty", () => {
    it("should analyze difficulty distribution correctly", async () => {
      // Arrange
      const mockSession = {
        problems: [
          { leetCodeID: 1, difficulty: "Easy" },
          { leetCodeID: 2, difficulty: "Easy" },
          { leetCodeID: 3, Rating: "Medium" }, // Alternative field name
          { leetCodeID: 4, difficulty: "Hard" },
          { leetCodeID: 5, difficulty: "Easy" },
        ],
      };

      // Clear and set up the mock for this specific test
      jest.clearAllMocks();
      mockFetchProblemById
        .mockResolvedValueOnce({ difficulty: "Easy" })
        .mockResolvedValueOnce({ difficulty: "Easy" })
        .mockResolvedValueOnce({ difficulty: "Medium" })
        .mockResolvedValueOnce({ difficulty: "Hard" })
        .mockResolvedValueOnce({ difficulty: "Easy" });

      // Act
      const analysis = await SessionService.analyzeSessionDifficulty(mockSession);

      // Assert
      expect(analysis).toEqual({
        counts: { Easy: 3, Medium: 1, Hard: 1 },
        percentages: { Easy: 60, Medium: 20, Hard: 20 },
        totalProblems: 5,
        predominantDifficulty: "Easy",
      });
      
      // Verify the mock was called correctly
      expect(mockFetchProblemById).toHaveBeenCalledTimes(5);
    });

    it("should handle empty problems array", async () => {
      // Arrange
      const emptySession = { problems: [] };

      // Act
      const analysis = await SessionService.analyzeSessionDifficulty(emptySession);

      // Assert
      expect(analysis.totalProblems).toBe(0);
      expect(analysis.counts).toEqual({ Easy: 0, Medium: 0, Hard: 0 });
    });

    it("should default unknown difficulties to Medium", async () => {
      // Arrange
      const mockSession = {
        problems: [
          { leetCodeID: 1 },
          { leetCodeID: 2 },
          { leetCodeID: 3 },
        ],
      };

      // Mock fetchProblemById to return null (problem not found)
      const mockFetchProblemById = jest.fn()
        .mockResolvedValue(null);

      jest.doMock("../../db/standard_problems.js", () => ({
        fetchProblemById: mockFetchProblemById,
      }));

      // Act
      const analysis = await SessionService.analyzeSessionDifficulty(mockSession);

      // Assert - When problems not found, should default to Medium
      expect(analysis.counts.Medium).toBe(3);
      expect(analysis.totalProblems).toBe(3);
      expect(analysis.predominantDifficulty).toBe("Medium");
    });
  });

  describe("generateSessionInsights", () => {
    it("should generate comprehensive insights", () => {
      // Arrange
      const mockPerformance = {
        accuracy: 0.4, // Low accuracy
        avgTime: 900,
        strongTags: ["array"],
        weakTags: ["dynamic-programming", "graph", "tree", "backtracking"],
      };

      const mockMasteryDeltas = [
        { tag: "array", masteredChanged: true, postMastered: true },
      ];

      const mockDifficultyMix = {
        predominantDifficulty: "Medium",
      };

      // Act
      const insights = SessionService.generateSessionInsights(
        mockPerformance,
        mockMasteryDeltas,
        mockDifficultyMix
      );

      // Assert
      expect(insights).toHaveProperty("accuracy");
      expect(insights).toHaveProperty("efficiency");
      expect(insights).toHaveProperty("mastery");
      expect(insights).toHaveProperty("nextActions");
      expect(Array.isArray(insights.nextActions)).toBe(true);

      // Should suggest improvement for low accuracy
      expect(
        insights.nextActions.some((action) =>
          action.includes("Focus on review problems")
        )
      ).toBe(true);

      // Should suggest prioritizing weak tags
      expect(
        insights.nextActions.some((action) =>
          action.includes("Prioritize improvement")
        )
      ).toBe(true);
    });
  });

  describe("insight helper methods", () => {
    it("should provide accurate feedback for different accuracy levels", () => {
      expect(SessionService.getAccuracyInsight(0.95)).toContain(
        "Excellent accuracy"
      );
      expect(SessionService.getAccuracyInsight(0.8)).toContain("Good accuracy");
      expect(SessionService.getAccuracyInsight(0.6)).toContain(
        "Accuracy needs improvement"
      );
      expect(SessionService.getAccuracyInsight(0.3)).toContain(
        "Consider reviewing concepts"
      );
    });

    it("should provide efficiency feedback based on difficulty", () => {
      const easyMix = { predominantDifficulty: "Easy" };
      const mediumMix = { predominantDifficulty: "Medium" };

      expect(SessionService.getEfficiencyInsight(500, easyMix)).toContain(
        "Very efficient"
      );
      expect(SessionService.getEfficiencyInsight(1800, mediumMix)).toContain(
        "Taking a bit longer"
      ); // 1800 > 1350 * 1.2
    });

    it("should provide mastery progression feedback", () => {
      const newMasteries = [
        { masteredChanged: true, postMastered: true },
        { masteredChanged: true, postMastered: true },
      ];
      expect(SessionService.getMasteryInsight(newMasteries)).toContain(
        "Excellent! Mastered 2"
      );

      const noChanges = [];
      expect(SessionService.getMasteryInsight(noChanges)).toContain(
        "Maintained current mastery"
      );
    });
  });

  describe("logSessionAnalytics", () => {
    it("should log structured analytics", () => {
      // Arrange
      const mockSessionSummary = {
        sessionId: "test-session",
        completedAt: "2023-12-15T10:00:00Z",
        performance: {
          accuracy: 0.756789,
          avgTime: 456.789,
          strongTags: ["array"],
          weakTags: ["graph"],
        },
        difficultyAnalysis: {
          totalProblems: 5,
          predominantDifficulty: "Medium",
        },
        masteryProgression: {
          newMasteries: 2,
        },
      };

      // Act
      SessionService.logSessionAnalytics(mockSessionSummary);

      // Assert
      expect(console.info).toHaveBeenCalledWith(
        "📊 Session Analytics:",
        expect.any(String)
      );

      const loggedCall = console.info.mock.calls.find(
        (call) => call[0] === "📊 Session Analytics:"
      );
      const analyticsData = JSON.parse(loggedCall[1]);

      expect(analyticsData).toMatchObject({
        type: "session_completed",
        sessionId: "test-session",
        metrics: {
          accuracy: 0.76, // Rounded
          avgTime: 457, // Rounded
          problemsCompleted: 5,
          newMasteries: 2,
        },
      });
    });

    it("should store analytics in Chrome storage", () => {
      // Arrange
      const mockSessionSummary = {
        sessionId: "test-session",
        completedAt: "2023-12-15T10:00:00Z",
        performance: {
          accuracy: 0.8,
          avgTime: 400,
          strongTags: [],
          weakTags: [],
        },
        difficultyAnalysis: { totalProblems: 3, predominantDifficulty: "Easy" },
        masteryProgression: { newMasteries: 1 },
      };

      // Act
      SessionService.logSessionAnalytics(mockSessionSummary);

      // Assert
      expect(global.chrome.storage.local.get).toHaveBeenCalledWith(
        ["sessionAnalytics"],
        expect.any(Function)
      );
      expect(global.chrome.storage.local.set).toHaveBeenCalled();
    });
  });
});
