import { 
  getDashboardStatistics, 
  getSessionHistoryData,
  getProductivityInsightsData,
  getTagMasteryData,
  getLearningPathData,
  getGoalsData,
  generateSessionAnalytics,
  generateMasteryData,
  generateGoalsData
} from "../dashboardService";

// Mock database modules
jest.mock("../../../shared/db/problems");
jest.mock("../../../shared/db/attempts");
jest.mock("../../../shared/db/sessions");
jest.mock("../../../shared/db/standard_problems");
jest.mock("../../../shared/db/sessionAnalytics");
jest.mock("../../../shared/services/tagServices");
jest.mock("../../../shared/services/problemService");
jest.mock("../../../shared/services/storageService");

import { fetchAllProblems } from "../../../shared/db/problems";
import { getAllAttempts } from "../../../shared/db/attempts";
import { getAllSessions } from "../../../shared/db/sessions";
import { getAllStandardProblems } from "../../../shared/db/standard_problems";
import { TagService } from "../../../shared/services/tagServices";
import { ProblemService } from "../../../shared/services/problemService";
import { StorageService } from "../../../shared/services/storageService";

describe("Dashboard Service", function() {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Mock data setup
  const mockProblems = [
    { id: "1", leetCodeID: "1", title: "Two Sum" },
    { id: "2", leetCodeID: "2", title: "Add Two Numbers" }
  ];

  const mockAttempts = [
    { 
      id: "1", 
      ProblemID: "1", 
      Success: true, 
      AttemptDate: "2025-01-01T10:00:00Z",
      TimeSpent: 1500,
      HintsUsed: 1
    },
    { 
      id: "2", 
      ProblemID: "2", 
      Success: false, 
      AttemptDate: "2025-01-02T10:00:00Z",
      TimeSpent: 3000,
      HintsUsed: 3
    }
  ];

  const mockSessions = [
    {
      id: "session1",
      Date: "2025-01-01T10:00:00Z",
      problems: [{ id: "1", solved: true }],
      sessionType: "adaptive"
    }
  ];

  const mockStandardProblems = [
    { id: "1", difficulty: "Easy", tags: ["Array", "Hash Table"] },
    { id: "2", difficulty: "Medium", tags: ["Linked List", "Math"] }
  ];

  const mockLearningState = {
    currentTier: "Core Concept",
    masteredTags: ["Array"],
    allTagsInCurrentTier: ["Array", "String"],
    unmasteredTags: ["Hash Table"]
  };

  describe("getDashboardStatistics", () => {
    beforeEach(() => {
      fetchAllProblems.mockResolvedValue(mockProblems);
      getAllAttempts.mockResolvedValue(mockAttempts);
      getAllSessions.mockResolvedValue(mockSessions);
      getAllStandardProblems.mockResolvedValue(mockStandardProblems);
      TagService.getCurrentLearningState.mockResolvedValue(mockLearningState);
      ProblemService.countProblemsByBoxLevel.mockResolvedValue({});
    });

    it("should return complete dashboard statistics", async () => {
      const result = await getDashboardStatistics();

      expect(result).toBeDefined();
      expect(result.statistics).toBeDefined();
      expect(result.averageTime).toBeDefined();
      expect(result.successRate).toBeDefined();
      expect(result.allSessions).toEqual(mockSessions);
      expect(result.sessions).toBeDefined();
      expect(result.mastery).toBeDefined();
      expect(result.goals).toBeDefined();
    });

    it("should handle focus area filtering", async () => {
      const options = { focusAreaFilter: ["Array"] };
      const result = await getDashboardStatistics(options);

      expect(result.filters.appliedFilters.hasFocusAreaFilter).toBe(true);
      expect(result.filters.focusAreaFilter).toEqual(["Array"]);
    });

    it("should handle date range filtering", async () => {
      const options = { 
        dateRange: { 
          startDate: "2025-01-01", 
          endDate: "2025-01-02" 
        } 
      };
      const result = await getDashboardStatistics(options);

      expect(result.filters.appliedFilters.hasDateFilter).toBe(true);
      expect(result.filters.dateRange).toEqual(options.dateRange);
    });

    it("should handle errors gracefully", async () => {
      fetchAllProblems.mockRejectedValue(new Error("Database error"));

      await expect(getDashboardStatistics()).rejects.toThrow("Database error");
      
      // Restore mocks after error test to prevent affecting other tests
      fetchAllProblems.mockResolvedValue(mockProblems);
    });
  });

  describe("generateSessionAnalytics", () => {
    it("should generate session analytics with productivity metrics", async () => {
      const result = await generateSessionAnalytics(mockSessions, mockAttempts);

      expect(result).toBeDefined();
      expect(result.allSessions).toBeDefined();
      expect(result.sessionAnalytics).toBeDefined();
      expect(result.productivityMetrics).toBeDefined();
    });

    it("should handle empty sessions gracefully", async () => {
      const result = await generateSessionAnalytics([], []);

      expect(result.allSessions).toEqual([]);
      expect(result.sessionAnalytics).toEqual([]);
      expect(result.productivityMetrics).toBeDefined();
    });
  });

  describe("generateMasteryData", () => {
    beforeEach(() => {
      StorageService.getSettings.mockResolvedValue({ focusAreas: ["Array"] });
    });

    it("should generate mastery data with focus areas", async () => {
      const result = await generateMasteryData(mockLearningState);

      expect(result.currentTier).toBe("Core Concept");
      expect(result.masteredTags).toEqual(["Array"]);
      expect(result.focusTags).toBeDefined();
      expect(result.learningState).toBeDefined();
    });

    it("should handle missing learning state", async () => {
      const result = await generateMasteryData(null);

      expect(result.currentTier).toBe("Core Concept");
      expect(result.masteredTags).toEqual([]);
    });
  });

  describe("generateGoalsData", () => {
    beforeEach(() => {
      StorageService.getSettings.mockResolvedValue({
        sessionsPerWeek: 5,
        sessionLength: 4,
        focusAreas: ["Array"],
        reviewRatio: 40
      });
    });

    it("should generate goals data with learning plan", async () => {
      const result = await generateGoalsData();

      expect(result.learningPlan).toBeDefined();
      expect(result.learningPlan.cadence).toBeDefined();
      expect(result.learningPlan.focus).toBeDefined();
      expect(result.learningPlan.guardrails).toBeDefined();
    });

    it("should handle missing settings gracefully", async () => {
      StorageService.getSettings.mockResolvedValue({});

      const result = await generateGoalsData();

      expect(result.learningPlan).toBeDefined();
      expect(result.learningPlan.cadence.sessionsPerWeek).toBe(5); // Default
    });
  });

  describe("Page-specific data functions", () => {
    beforeEach(() => {
      // Mock getDashboardStatistics to return complete data
      jest.spyOn({ getDashboardStatistics }, 'getDashboardStatistics').mockResolvedValue({
        statistics: { totalSolved: 10 },
        sessions: { allSessions: mockSessions },
        mastery: mockLearningState,
        goals: { learningPlan: {} }
      });
    });

    describe("getSessionHistoryData", () => {
      it("should return session history data", async () => {
        const result = await getSessionHistoryData();

        expect(result.allSessions).toBeDefined();
        expect(result.sessionAnalytics).toBeDefined();
      });
    });

    describe("getProductivityInsightsData", () => {
      it("should return productivity insights data", async () => {
        const result = await getProductivityInsightsData();

        expect(result.productivityMetrics).toBeDefined();
        expect(result.sessionAnalytics).toBeDefined();
      });
    });

    describe("getTagMasteryData", () => {
      it("should return tag mastery data", async () => {
        const result = await getTagMasteryData();

        expect(result).toBeDefined();
      });
    });

    describe("getLearningPathData", () => {
      it("should return learning path data", async () => {
        const result = await getLearningPathData();

        expect(result).toBeDefined();
      });
    });

    describe("getGoalsData", () => {
      it("should return goals data", async () => {
        const result = await getGoalsData();

        expect(result.learningPlan).toBeDefined();
      });
    });
  });
});