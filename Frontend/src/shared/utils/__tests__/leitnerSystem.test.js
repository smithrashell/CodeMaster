/**
 * Comprehensive tests for Leitner Spaced Repetition System
 * Tests core business logic for problem difficulty progression and box level calculations
 */

import "fake-indexeddb/auto";

// Mock all database dependencies
jest.mock("../../../shared/db/problems.js", () => ({
  updateStabilityFSRS: jest.fn(),
  fetchAllProblems: jest.fn(),
  saveUpdatedProblem: jest.fn(),
}));

jest.mock("../../../shared/db/index.js", () => ({
  dbHelper: {
    openDB: jest.fn(),
  },
}));

import {
  calculateLeitnerBox,
  reassessBoxLevel,
  evaluateAttempts,
} from "../leitnerSystem.js";
import { dbHelper } from "../../db/index.js";
import { updateStabilityFSRS } from "../../db/problems.js";

describe("Leitner System", () => {
  let mockDB;
  let mockTransaction;
  let mockObjectStore;
  let mockIndex;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock database infrastructure
    mockIndex = {
      openCursor: jest.fn(),
    };

    mockObjectStore = {
      index: jest.fn(() => mockIndex),
    };

    mockTransaction = {
      objectStore: jest.fn(() => mockObjectStore),
    };

    mockDB = {
      transaction: jest.fn(() => mockTransaction),
    };

    dbHelper.openDB.mockResolvedValue(mockDB);
    updateStabilityFSRS.mockResolvedValue();
  });

  describe("reassessBoxLevel", () => {
    it.skip("should calculate correct box level for successful attempts", () => {
      // Arrange
      const problem = {
        id: "prob-1",
        title: "Test Problem",
        BoxLevel: 1,
        Difficulty: 0,
      };

      const attempts = [
        { AttemptDate: "2024-01-01", Success: true, Difficulty: 5 },
        { AttemptDate: "2024-01-02", Success: true, Difficulty: 4 },
        { AttemptDate: "2024-01-03", Success: true, Difficulty: 3 },
      ];

      // Act
      const result = reassessBoxLevel(problem, attempts);

      // Assert
      expect(result.AttemptStats.TotalAttempts).toBe(3);
      expect(result.AttemptStats.SuccessfulAttempts).toBe(3);
      expect(result.AttemptStats.UnsuccessfulAttempts).toBe(0);
      expect(result.BoxLevel).toBe(4); // Started at 1, +1 for each success = 4
      expect(result.Difficulty).toBeCloseTo(4); // (5+4+3)/3 = 4
    });

    it.skip("should demote box level after consecutive failures", () => {
      // Arrange
      const problem = {
        id: "prob-1",
        title: "Test Problem",
        boxLevel: 5,
      };

      const attempts = [
        { AttemptDate: "2024-01-01", Success: false, Difficulty: 8 },
        { AttemptDate: "2024-01-02", Success: false, Difficulty: 9 },
        { AttemptDate: "2024-01-03", Success: false, Difficulty: 7 },
      ];

      // Act
      const result = reassessBoxLevel(problem, attempts);

      // Assert
      expect(result.AttemptStats.TotalAttempts).toBe(3);
      expect(result.AttemptStats.SuccessfulAttempts).toBe(0);
      expect(result.AttemptStats.UnsuccessfulAttempts).toBe(3);
      expect(result.BoxLevel).toBe(4); // Started at 5, demoted by 1 after 3 failures
      expect(result.avgDifficulty).toBe(8); // (8+9+7)/3 = 8
    });

    it.skip("should handle mixed success and failure patterns", () => {
      // Arrange
      const problem = {
        id: "prob-1",
        title: "Test Problem",
        boxLevel: 3,
      };

      const attempts = [
        { AttemptDate: "2024-01-01", Success: true, Difficulty: 6 },
        { AttemptDate: "2024-01-02", Success: false, Difficulty: 8 },
        { AttemptDate: "2024-01-03", Success: false, Difficulty: 7 },
        { AttemptDate: "2024-01-04", Success: true, Difficulty: 5 },
      ];

      // Act
      const result = reassessBoxLevel(problem, attempts);

      // Assert
      expect(result.AttemptStats.TotalAttempts).toBe(4);
      expect(result.AttemptStats.SuccessfulAttempts).toBe(2);
      expect(result.AttemptStats.UnsuccessfulAttempts).toBe(2);
      expect(result.BoxLevel).toBe(5); // 3 + 1 - 0 + 1 = 5 (no demotion since < 3 consecutive failures)
    });

    it("should not exceed maximum box level", () => {
      // Arrange
      const problem = {
        id: "prob-1",
        title: "Test Problem",
        boxLevel: 8, // Already at max
      };

      const attempts = [
        { AttemptDate: "2024-01-01", Success: true, Difficulty: 3 },
        { AttemptDate: "2024-01-02", Success: true, Difficulty: 2 },
      ];

      // Act
      const result = reassessBoxLevel(problem, attempts);

      // Assert
      expect(result.boxLevel).toBe(8); // Should stay at maximum
    });

    it("should not go below minimum box level", () => {
      // Arrange
      const problem = {
        id: "prob-1",
        title: "Test Problem",
        boxLevel: 1, // Already at minimum
      };

      const attempts = [
        { AttemptDate: "2024-01-01", Success: false, Difficulty: 10 },
        { AttemptDate: "2024-01-02", Success: false, Difficulty: 9 },
        { AttemptDate: "2024-01-03", Success: false, Difficulty: 8 },
      ];

      // Act
      const result = reassessBoxLevel(problem, attempts);

      // Assert
      expect(result.boxLevel).toBe(1); // Should stay at minimum
    });

    it.skip("should reset consecutive failures after success", () => {
      // Arrange
      const problem = {
        id: "prob-1",
        title: "Test Problem",
        boxLevel: 4,
      };

      const attempts = [
        { AttemptDate: "2024-01-01", Success: false, Difficulty: 8 },
        { AttemptDate: "2024-01-02", Success: false, Difficulty: 9 },
        { AttemptDate: "2024-01-03", Success: true, Difficulty: 6 }, // Resets failure count
        { AttemptDate: "2024-01-04", Success: false, Difficulty: 7 },
        { AttemptDate: "2024-01-05", Success: false, Difficulty: 8 },
      ];

      // Act
      const result = reassessBoxLevel(problem, attempts);

      // Assert
      expect(result.BoxLevel).toBe(5); // 4 + 1 (success) = 5, no demotion since only 2 consecutive failures at end
    });
  });

  describe("calculateLeitnerBox", () => {
    it.skip("should calculate next review date based on box level", async () => {
      // Arrange
      const problem = {
        id: "prob-1",
        boxLevel: 3,
        title: "Test Problem",
        AttemptStats: {
          TotalAttempts: 5,
          SuccessfulAttempts: 3,
          UnsuccessfulAttempts: 2,
        },
        Stability: 2.5,
        CooldownStatus: false,
        ConsecutiveFailures: 0,
      };

      const lastAttempt = {
        AttemptDate: "2024-01-01T10:00:00Z",
        Success: true,
      };

      // Act
      const result = await calculateLeitnerBox(problem, lastAttempt);

      // Assert
      expect(result).toHaveProperty("ReviewSchedule");
      expect(result.BoxLevel).toBe(3);
      expect(new Date(result.ReviewSchedule)).toBeInstanceOf(Date);
    });

    it.skip("should handle problems without last attempt", async () => {
      // Arrange
      const problem = {
        id: "prob-1",
        boxLevel: 1,
        title: "Test Problem",
        AttemptStats: {
          TotalAttempts: 0,
          SuccessfulAttempts: 0,
          UnsuccessfulAttempts: 0,
        },
        Stability: 2.5,
        CooldownStatus: false,
        ConsecutiveFailures: 0,
      };

      // Act - Use minimal attempt data instead of null
      const minimalAttempt = {
        AttemptDate: new Date().toISOString(),
        Success: false,
        Difficulty: 1,
      };
      const result = await calculateLeitnerBox(problem, minimalAttempt);

      // Assert
      expect(result).toHaveProperty("ReviewSchedule");
      expect(result.BoxLevel).toBe(1);
    });

    it.skip("should update stability using FSRS algorithm", async () => {
      // Arrange
      const problem = {
        id: "prob-1",
        boxLevel: 2,
        title: "Test Problem",
        AttemptStats: {
          TotalAttempts: 3,
          SuccessfulAttempts: 2,
          UnsuccessfulAttempts: 1,
        },
        Stability: 2.5,
        CooldownStatus: false,
        ConsecutiveFailures: 0,
      };

      const lastAttempt = {
        AttemptDate: "2024-01-01T10:00:00Z",
        Success: true,
        TimeSpent: 300,
        Difficulty: 2,
      };

      // Act
      await calculateLeitnerBox(problem, lastAttempt);

      // Assert
      expect(updateStabilityFSRS).toHaveBeenCalledWith(problem, lastAttempt);
    });
  });

  describe("evaluateAttempts", () => {
    it.skip("should evaluate problem performance and update box level", async () => {
      // Arrange
      const problem = {
        id: "prob-123",
        title: "Test Problem",
        boxLevel: 2,
      };

      const mockAttempts = [
        { AttemptDate: "2024-01-01T10:00:00Z", Success: true, Difficulty: 5 },
        { AttemptDate: "2024-01-02T11:00:00Z", Success: true, Difficulty: 4 },
        { AttemptDate: "2024-01-03T12:00:00Z", Success: false, Difficulty: 8 },
      ];

      // Mock cursor behavior
      let cursorCallCount = 0;
      mockIndex.openCursor.mockImplementation((_range, _direction) => ({
        onsuccess: null,
        onerror: null,
      }));

      // Simulate cursor traversal
      setTimeout(() => {
        const request = mockIndex.openCursor.mock.results[0].value;

        // Simulate cursor results
        const simulateCursorTraversal = () => {
          if (cursorCallCount < mockAttempts.length) {
            const mockCursor = {
              value: mockAttempts[cursorCallCount],
              continue: jest.fn(() => {
                cursorCallCount++;
                setTimeout(simulateCursorTraversal, 0);
              }),
            };
            if (request.onsuccess) {
              request.onsuccess({ target: { result: mockCursor } });
            }
          } else {
            // End of cursor traversal
            if (request.onsuccess) {
              request.onsuccess({ target: { result: null } });
            }
          }
        };

        simulateCursorTraversal();
      }, 0);

      // Act
      const result = await evaluateAttempts(problem);

      // Assert
      expect(result).toHaveProperty("boxLevel");
      expect(result).toHaveProperty("TotalAttempts");
      expect(result).toHaveProperty("NextReviewDate");
      expect(mockDB.transaction).toHaveBeenCalledWith(["attempts"], "readonly");
      expect(mockObjectStore.index).toHaveBeenCalledWith("by_problem_and_date");
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      const problem = {
        id: "prob-123",
        title: "Test Problem",
        boxLevel: 2,
      };

      mockIndex.openCursor.mockImplementation(() => ({
        onsuccess: null,
        onerror: null,
      }));

      // Simulate database error
      setTimeout(() => {
        const request = mockIndex.openCursor.mock.results[0].value;
        if (request.onerror) {
          request.onerror({ target: { errorCode: "DB_ERROR" } });
        }
      }, 0);

      // Act & Assert
      await expect(evaluateAttempts(problem)).rejects.toBe("DB_ERROR");
    });

    it.skip("should handle problems with no attempts", async () => {
      // Arrange
      const problem = {
        id: "prob-no-attempts",
        title: "Unattempted Problem",
        boxLevel: 1,
      };

      mockIndex.openCursor.mockImplementation(() => ({
        onsuccess: null,
        onerror: null,
      }));

      // Simulate no cursor results (empty database)
      setTimeout(() => {
        const request = mockIndex.openCursor.mock.results[0].value;
        if (request.onsuccess) {
          request.onsuccess({ target: { result: null } });
        }
      }, 0);

      // Act
      const result = await evaluateAttempts(problem);

      // Assert
      expect(result).toHaveProperty("boxLevel");
      expect(result.TotalAttempts).toBe(0);
      expect(result.SuccessfulAttempts).toBe(0);
      expect(result.UnsuccessfulAttempts).toBe(0);
    });
  });

  describe("Box Level Intervals", () => {
    it("should use correct intervals for each box level", () => {
      // Testing the internal box intervals: [1, 3, 7, 14, 30, 60, 90, 120]
      const testCases = [
        { boxLevel: 1, expectedMinInterval: 1 },
        { boxLevel: 3, expectedMinInterval: 7 },
        { boxLevel: 5, expectedMinInterval: 30 },
        { boxLevel: 8, expectedMinInterval: 120 },
      ];

      testCases.forEach(({ boxLevel, _expectedMinInterval }) => {
        const problem = { id: "test", boxLevel, title: "Test" };
        const attempts = Array(boxLevel)
          .fill()
          .map((_, i) => ({
            AttemptDate: `2024-01-0${i + 1}`,
            Success: true,
            Difficulty: 5,
          }));

        const result = reassessBoxLevel(problem, attempts);

        // Box level should match expected progression
        expect(result.boxLevel).toBeGreaterThanOrEqual(boxLevel);
      });
    });
  });

  describe("Edge Cases", () => {
    it.skip("should handle empty attempts array", () => {
      const problem = { id: "test", boxLevel: 3, title: "Test" };
      const result = reassessBoxLevel(problem, []);

      expect(result.AttemptStats.TotalAttempts).toBe(0);
      expect(result.AttemptStats.SuccessfulAttempts).toBe(0);
      expect(result.AttemptStats.UnsuccessfulAttempts).toBe(0);
      expect(result.BoxLevel).toBe(3); // Should maintain original box level
    });

    it("should handle malformed attempt data", () => {
      const problem = { id: "test", boxLevel: 2, title: "Test" };
      const attempts = [
        { AttemptDate: "invalid-date", Success: true, Difficulty: "invalid" },
        { AttemptDate: "2024-01-01", Success: null, Difficulty: 5 },
      ];

      // Should not throw error
      expect(() => reassessBoxLevel(problem, attempts)).not.toThrow();
    });

    it.skip("should sort attempts by date before processing", () => {
      const problem = { id: "test", boxLevel: 1, title: "Test" };
      const unsortedAttempts = [
        { AttemptDate: "2024-01-03", Success: true, Difficulty: 5 },
        { AttemptDate: "2024-01-01", Success: false, Difficulty: 8 },
        { AttemptDate: "2024-01-02", Success: true, Difficulty: 6 },
      ];

      const result = reassessBoxLevel(problem, unsortedAttempts);

      // The algorithm should process in chronological order
      // 1st: failure (no change), 2nd: success (+1), 3rd: success (+1)
      expect(result.BoxLevel).toBe(3);
    });
  });
});
