import { HintAnalyticsService } from "../hintAnalyticsService";

// Mock the HintInteractionService
jest.mock("../hintInteractionService", () => ({
  HintInteractionService: {
    getSystemAnalytics: jest.fn(),
  },
}));

// Mock the hint_interactions database module
jest.mock("../../db/hint_interactions", () => ({
  getInteractionsByDateRange: jest.fn(),
  getInteractionsByHintType: jest.fn(),
  getInteractionsByDifficultyAndType: jest.fn(),
}));

describe("HintAnalyticsService", () => {
  let mockHintInteractionService;
  let mockHintDb;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockHintInteractionService = require("../hintInteractionService").HintInteractionService;
    mockHintDb = require("../../db/hint_interactions");
  });

  describe("generateEffectivenessReport", () => {
    it("should generate comprehensive effectiveness report", async () => {
      // Arrange
      const mockSystemAnalytics = {
        overview: {
          totalInteractions: 100,
          uniqueProblems: 25,
          uniqueSessions: 15,
        },
        effectiveness: {
          "contextual-Medium": {
            hintType: "contextual",
            difficulty: "Medium",
            totalInteractions: 50,
            expansions: 40,
            engagementRate: 0.8,
            uniqueProblems: 15,
          },
          "general-Easy": {
            hintType: "general",
            difficulty: "Easy",
            totalInteractions: 30,
            expansions: 15,
            engagementRate: 0.5,
            uniqueProblems: 10,
          },
        },
      };

      const mockInteractions = [
        {
          timestamp: "2024-01-15T10:00:00Z",
          hintType: "contextual",
          userAction: "expand",
        },
        {
          timestamp: "2024-01-15T14:00:00Z",
          hintType: "general",
          userAction: "dismissed",
        },
      ];

      mockHintInteractionService.getSystemAnalytics.mockResolvedValue(mockSystemAnalytics);
      mockHintDb.getInteractionsByDateRange.mockResolvedValue(mockInteractions);
      mockHintDb.getInteractionsByHintType
        .mockResolvedValueOnce([]) // contextual
        .mockResolvedValueOnce([]) // general
        .mockResolvedValueOnce([]) // primer
        .mockResolvedValueOnce([]); // panel
      mockHintDb.getInteractionsByDifficultyAndType.mockResolvedValue([]);

      // Act
      const result = await HintAnalyticsService.generateEffectivenessReport();

      // Assert
      expect(result).toEqual({
        generatedAt: expect.any(String),
        dateRange: {
          start: expect.any(String),
          end: expect.any(String),
        },
        filters: { difficulty: null, hintType: null },
        summary: {
          totalInteractions: 100,
          uniqueProblems: 25,
          uniqueSessions: 15,
          averageEngagementRate: 0.65, // (0.8 + 0.5) / 2
        },
        systemAnalytics: mockSystemAnalytics,
        engagementPatterns: expect.any(Object),
        hintTypeComparison: expect.any(Object),
        difficultyInsights: expect.any(Object),
        recommendations: expect.any(Array),
        insights: expect.any(Array),
      });
    });

    it("should apply date range filters", async () => {
      // Arrange
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      
      const options = { startDate, endDate, difficulty: "Medium" };
      
      mockHintInteractionService.getSystemAnalytics.mockResolvedValue({
        overview: { totalInteractions: 10 },
        effectiveness: {},
      });
      
      mockHintDb.getInteractionsByDateRange.mockResolvedValue([]);
      mockHintDb.getInteractionsByHintType.mockResolvedValue([]);
      mockHintDb.getInteractionsByDifficultyAndType.mockResolvedValue([]);

      // Act
      const result = await HintAnalyticsService.generateEffectivenessReport(options);

      // Assert
      expect(mockHintInteractionService.getSystemAnalytics).toHaveBeenCalledWith({
        startDate,
        endDate,
        difficulty: "Medium",
        hintType: null,
      });
      
      expect(result.filters).toEqual({ difficulty: "Medium", hintType: null });
    });

    it("should generate meaningful recommendations", async () => {
      // Arrange
      const mockSystemAnalytics = {
        overview: { totalInteractions: 100 },
        effectiveness: {
          "contextual-Medium": {
            hintType: "contextual",
            difficulty: "Medium",
            engagementRate: 0.85, // High engagement
            totalInteractions: 50,
          },
          "general-Easy": {
            hintType: "general", 
            difficulty: "Easy",
            engagementRate: 0.2, // Low engagement
            totalInteractions: 25,
          },
        },
      };

      mockHintInteractionService.getSystemAnalytics.mockResolvedValue(mockSystemAnalytics);
      mockHintDb.getInteractionsByDateRange.mockResolvedValue([]);
      mockHintDb.getInteractionsByHintType.mockResolvedValue([]);
      mockHintDb.getInteractionsByDifficultyAndType.mockResolvedValue([]);

      // Act
      const result = await HintAnalyticsService.generateEffectivenessReport();

      // Assert
      const recommendations = result.recommendations;
      
      // Should have high engagement recommendation
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          type: "optimization",
          priority: "medium",
          message: expect.stringContaining("contextual hints for Medium problems are highly effective"),
        })
      );
      
      // Should have low engagement improvement recommendation
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          type: "improvement",
          priority: "high",
          message: expect.stringContaining("general hints for Easy problems have low engagement"),
        })
      );
    });

    it("should handle insufficient data gracefully", async () => {
      // Arrange
      mockHintInteractionService.getSystemAnalytics.mockResolvedValue({
        overview: { totalInteractions: 5 }, // Low sample size
        effectiveness: {},
      });
      
      mockHintDb.getInteractionsByDateRange.mockResolvedValue([]);
      mockHintDb.getInteractionsByHintType.mockResolvedValue([]);
      mockHintDb.getInteractionsByDifficultyAndType.mockResolvedValue([]);

      // Act
      const result = await HintAnalyticsService.generateEffectivenessReport();

      // Assert
      expect(result.recommendations).toContainEqual(
        expect.objectContaining({
          type: "data",
          message: expect.stringContaining("Not enough interaction data"),
        })
      );
    });
  });

  describe("getMostHelpfulHints", () => {
    it("should return top performing hints by engagement rate", async () => {
      // Arrange
      const mockSystemAnalytics = {
        effectiveness: {
          "contextual-Hard": {
            hintType: "contextual",
            difficulty: "Hard",
            engagementRate: 0.9,
            totalInteractions: 20,
            uniqueProblems: 8,
          },
          "general-Medium": {
            hintType: "general",
            difficulty: "Medium", 
            engagementRate: 0.7,
            totalInteractions: 15,
            uniqueProblems: 6,
          },
          "contextual-Easy": {
            hintType: "contextual",
            difficulty: "Easy",
            engagementRate: 0.6,
            totalInteractions: 10,
            uniqueProblems: 4,
          },
          "primer-Medium": {
            hintType: "primer",
            difficulty: "Medium",
            engagementRate: 0.8,
            totalInteractions: 3, // Below minimum threshold
            uniqueProblems: 2,
          },
        },
      };

      mockHintInteractionService.getSystemAnalytics.mockResolvedValue(mockSystemAnalytics);

      // Act
      const result = await HintAnalyticsService.getMostHelpfulHints();

      // Assert
      expect(result).toHaveLength(3); // Should exclude primer with <5 interactions
      
      // Should be sorted by engagement rate
      expect(result[0]).toEqual({
        hintType: "contextual",
        difficulty: "Hard",
        engagementRate: "90.0%",
        totalInteractions: 20,
        uniqueProblems: 8,
        score: expect.any(Number),
      });
      
      expect(result[1]).toEqual({
        hintType: "general",
        difficulty: "Medium",
        engagementRate: "70.0%",
        totalInteractions: 15,
        uniqueProblems: 6,
        score: expect.any(Number),
      });

      // Highest score should be first
      expect(result[0].score).toBeGreaterThan(result[1].score);
    });

    it("should handle empty effectiveness data", async () => {
      // Arrange
      mockHintInteractionService.getSystemAnalytics.mockResolvedValue({
        effectiveness: {},
      });

      // Act
      const result = await HintAnalyticsService.getMostHelpfulHints();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("getEngagementAnalysis", () => {
    it("should analyze user engagement patterns", async () => {
      // Arrange
      const mockInteractions = [
        {
          userAction: "expand",
          timestamp: "2024-01-15T10:00:00Z",
          sessionId: "session-1",
          problemId: "problem-1",
        },
        {
          userAction: "expand",
          timestamp: "2024-01-15T11:00:00Z", 
          sessionId: "session-1",
          problemId: "problem-1",
        },
        {
          userAction: "dismissed",
          timestamp: "2024-01-15T12:00:00Z",
          sessionId: "session-2",
          problemId: "problem-2",
        },
        {
          userAction: "copied",
          timestamp: "2024-01-15T13:00:00Z",
          sessionId: "session-2", 
          problemId: "problem-2",
        },
      ];

      mockHintDb.getInteractionsByDateRange.mockResolvedValue(mockInteractions);

      // Act
      const result = await HintAnalyticsService.getEngagementAnalysis();

      // Assert
      expect(result).toEqual({
        totalInteractions: 4,
        engagementMetrics: {
          expandRate: 0.5, // 2 out of 4
          dismissRate: 0.25, // 1 out of 4
          copyRate: 0.25, // 1 out of 4
          collapseRate: 0, // 0 out of 4
        },
        temporalPatterns: expect.any(Object),
        sessionEngagement: expect.any(Object),
        dropOffPoints: expect.any(Object),
      });
    });

    it("should identify drop-off patterns", async () => {
      // Arrange
      const mockInteractions = [
        // Quick dismissal
        {
          problemId: "problem-1",
          userAction: "dismissed",
          timestamp: "2024-01-15T10:00:00Z",
        },
        // No return (single interaction)
        {
          problemId: "problem-2", 
          userAction: "expand",
          timestamp: "2024-01-15T11:00:00Z",
        },
        // Short session (same problem, close timestamps)
        {
          problemId: "problem-3",
          userAction: "expand", 
          timestamp: "2024-01-15T12:00:00Z",
        },
        {
          problemId: "problem-3",
          userAction: "collapse",
          timestamp: "2024-01-15T12:00:10Z", // 10 seconds later
        },
      ];

      mockHintDb.getInteractionsByDateRange.mockResolvedValue(mockInteractions);

      // Act
      const result = await HintAnalyticsService.getEngagementAnalysis();

      // Assert
      expect(result.dropOffPoints).toEqual({
        quickDismissals: 1, // problem-1
        noReturns: 2, // problem-1 and problem-2 (single interactions)
        shortSessions: 3, // All problems have short sessions (< 30s)
      });
    });
  });

  describe("getPresentationMethodEffectiveness", () => {
    it("should compare effectiveness of different presentation methods", async () => {
      // Arrange
      const contextualInteractions = [
        { userAction: "expand", problemId: "p1", sessionId: "s1" },
        { userAction: "dismissed", problemId: "p2", sessionId: "s1" },
        { userAction: "expand", problemId: "p1", sessionId: "s2" },
      ];

      const generalInteractions = [
        { userAction: "expand", problemId: "p3", sessionId: "s3" },
        { userAction: "collapse", problemId: "p3", sessionId: "s3" },
      ];

      const primerInteractions = [
        { userAction: "expand", problemId: "p4", sessionId: "s4" },
        { userAction: "expand", problemId: "p5", sessionId: "s4" },
        { userAction: "expand", problemId: "p4", sessionId: "s5" },
      ];

      const panelInteractions = [
        { userAction: "dismissed", problemId: "p6", sessionId: "s6" },
      ];

      mockHintDb.getInteractionsByHintType
        .mockResolvedValueOnce(contextualInteractions)
        .mockResolvedValueOnce(generalInteractions)
        .mockResolvedValueOnce(primerInteractions)
        .mockResolvedValueOnce(panelInteractions);

      // Act
      const result = await HintAnalyticsService.getPresentationMethodEffectiveness();

      // Assert
      expect(result.comparison).toEqual({
        contextual: {
          name: "Contextual Hints",
          totalInteractions: 3,
          engagementRate: 2/3, // 2 expands out of 3 total
          dismissalRate: 1/3, // 1 dismissed out of 3 total
          uniqueProblems: 2, // p1, p2
          averageSessionsPerProblem: expect.any(Number),
        },
        general: {
          name: "General Hints",
          totalInteractions: 2,
          engagementRate: 0.5, // 1 expand out of 2 total
          dismissalRate: 0,
          uniqueProblems: 1, // p3
          averageSessionsPerProblem: expect.any(Number),
        },
        primer: {
          name: "Primer Section",
          totalInteractions: 3,
          engagementRate: 1.0, // 3 expands out of 3 total
          dismissalRate: 0,
          uniqueProblems: 2, // p4, p5
          averageSessionsPerProblem: expect.any(Number),
        },
        panel: {
          name: "Hint Panel",
          totalInteractions: 1,
          engagementRate: 0, // 0 expands out of 1 total
          dismissalRate: 1.0, // 1 dismissed out of 1 total
          uniqueProblems: 1, // p6
          averageSessionsPerProblem: expect.any(Number),
        },
      });

      // Should be ranked by engagement rate
      expect(result.ranking[0].method).toBe("primer");
      expect(result.ranking[0].engagementRate).toBe(1.0);
    });

    it("should generate insights about presentation methods", async () => {
      // Arrange
      mockHintDb.getInteractionsByHintType.mockResolvedValue([]);

      // Act
      const result = await HintAnalyticsService.getPresentationMethodEffectiveness();

      // Assert
      expect(result.insights).toEqual(expect.any(Array));
    });
  });

  describe("helper methods", () => {
    it("should calculate helpfulness score correctly", () => {
      // Arrange
      const hint = {
        engagementRate: 0.8,
        totalInteractions: 25,
        uniqueProblems: 10,
      };

      // Act
      const score = HintAnalyticsService._calculateHelpfulnessScore(hint);

      // Assert
      // Score = (0.8 * 0.6) + (min(25/50, 1) * 0.2) + (min(10/10, 1) * 0.2) * 100
      // Score = (0.48) + (0.5 * 0.2) + (1 * 0.2) * 100 = 78
      expect(score).toBeCloseTo(78, 0);
    });

    it("should calculate action rates correctly", () => {
      // Arrange
      const interactions = [
        { userAction: "expand" },
        { userAction: "expand" },
        { userAction: "collapse" },
        { userAction: "dismissed" },
      ];

      // Act
      const expandRate = HintAnalyticsService._calculateActionRate(interactions, "expand");
      const collapseRate = HintAnalyticsService._calculateActionRate(interactions, "collapse");

      // Assert
      expect(expandRate).toBe(0.5); // 2 out of 4
      expect(collapseRate).toBe(0.25); // 1 out of 4
    });

    it("should handle empty interactions gracefully", () => {
      // Act
      const rate = HintAnalyticsService._calculateActionRate([], "expand");

      // Assert
      expect(rate).toBe(0);
    });
  });

  describe("error handling", () => {
    it("should handle service errors gracefully", async () => {
      // Arrange
      const serviceError = new Error("Service unavailable");
      mockHintInteractionService.getSystemAnalytics.mockRejectedValue(serviceError);

      // Act & Assert
      await expect(HintAnalyticsService.generateEffectivenessReport())
        .rejects.toThrow("Service unavailable");
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      const dbError = new Error("Database connection failed");
      mockHintDb.getInteractionsByDateRange.mockRejectedValue(dbError);

      // Act & Assert
      await expect(HintAnalyticsService.getEngagementAnalysis())
        .rejects.toThrow("Database connection failed");
    });

    it("should handle malformed data gracefully", async () => {
      // Arrange
      const malformedInteractions = [
        { /* missing required fields */ },
        null,
        undefined,
        { userAction: "expand" }, // valid
      ];

      mockHintDb.getInteractionsByDateRange.mockResolvedValue(malformedInteractions);

      // Act
      const result = await HintAnalyticsService.getEngagementAnalysis();

      // Assert - should not crash and provide meaningful results
      expect(result.totalInteractions).toBe(4); // Includes all entries
      expect(result.engagementMetrics.expandRate).toBe(0.5); // 1 expand out of 2 valid interactions
    });
  });

  describe("temporal analysis", () => {
    it("should group interactions by day correctly", () => {
      // Arrange
      const interactions = [
        { timestamp: "2024-01-15T10:00:00Z" },
        { timestamp: "2024-01-15T14:00:00Z" },
        { timestamp: "2024-01-16T09:00:00Z" },
      ];

      // Act
      const dailyData = HintAnalyticsService._groupByDay(interactions);

      // Assert
      expect(dailyData).toEqual({
        "Mon Jan 15 2024": 2,
        "Tue Jan 16 2024": 1,
      });
    });

    it("should group interactions by hour correctly", () => {
      // Arrange
      const interactions = [
        { timestamp: "2024-01-15T10:30:00Z" }, // Hour 10 UTC
        { timestamp: "2024-01-15T10:45:00Z" }, // Hour 10 UTC
        { timestamp: "2024-01-15T14:20:00Z" }, // Hour 14 UTC
      ];

      // Act
      const hourlyData = HintAnalyticsService._groupByHour(interactions);

      // Assert - getHours() returns UTC hours for Z timezone
      expect(hourlyData[10]).toBe(2);
      expect(hourlyData[14]).toBe(1);
      expect(hourlyData[0]).toBe(0); // Unused hours should be 0
    });
  });
});