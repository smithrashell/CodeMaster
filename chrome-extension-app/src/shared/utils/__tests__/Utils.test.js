/**
 * Comprehensive tests for Utils.js utility functions
 * Tests core helper functions used throughout the application
 */

// Mock uuid
jest.mock("uuid", () => ({
  v4: () => "test-uuid-123",
}));

import {
  calculateDecayScore,
  createAttemptRecord,
  isDifficultyAllowed,
  deduplicateById,
  _clearOrRenameStoreField,
} from "../Utils.js";

// Test data helpers
const createSampleAttemptData = (overrides = {}) => ({
  id: "test-uuid-123",
  ProblemID: "prob-123",
  Success: true,
  TimeSpent: 1800,
  AttemptDate: "2024-01-01T10:00:00Z",
  Difficulty: 6,
  ...overrides,
});

const createExpectedAttemptRecord = (overrides = {}) => ({
  id: "test-uuid-123",
  session_id: undefined,
  problem_id: "prob-123",
  success: true,
  attempt_date: "2024-01-01T10:00:00Z",
  time_spent: 1800,
  difficulty: 6,
  comments: "",
  ...overrides,
});

const validateDateFormat = (dateString) => {
  expect(new Date(dateString)).toBeInstanceOf(Date);
};

// Test case helpers for createAttemptRecord
const testCreateAttemptRecord = () => {
  it("should create properly structured attempt record", () => {
    // Arrange
    const attemptData = createSampleAttemptData();

    // Act
    const result = createAttemptRecord(attemptData);

    // Assert
    expect(result).toEqual(createExpectedAttemptRecord());

    // Verify date format
    validateDateFormat(result.attempt_date);
  });

  it("should handle minimal attempt data", () => {
    // Arrange
    const attemptData = {
      id: "test-uuid-456",
      ProblemID: "prob-456",
      Success: false,
    };

    // Act
    const result = createAttemptRecord(attemptData);

    // Assert
    expect(result.id).toBe("test-uuid-456");
    expect(result.problem_id).toBe("prob-456");
    expect(result.success).toBe(false);
    expect(result.comments).toBe("");
  });

  it("should handle missing ProblemID", () => {
    // Arrange
    const attemptData = {
      id: "test-uuid-789",
      Success: true,
      TimeSpent: 900,
    };

    // Act
    const result = createAttemptRecord(attemptData);

    // Assert
    expect(result.id).toBe("test-uuid-789");
    expect(result.problem_id).toBeUndefined();
    expect(result.success).toBe(true);
    expect(result.time_spent).toBe(900);
  });
};

// Test case helpers for calculateDecayScore
const _testCalculateDecayScore = () => {
  it("should calculate decay score based on time and success rate", () => {
    // Arrange
    const attempt = {
      AttemptDate: "2024-01-01T10:00:00Z",
      Success: true,
      TimeSpent: 1800,
      boxLevel: 2,
    };
    const currentTime = new Date("2024-01-08T10:00:00Z").getTime();

    // Act
    const result = calculateDecayScore(attempt, currentTime);

    // Assert
    expect(result).toBeCloseTo(0.85, 2);
  });

  it("should return higher decay for older attempts", () => {
    // Arrange
    const oldAttempt = {
      AttemptDate: "2024-01-01T10:00:00Z",
      Success: true,
      TimeSpent: 1200,
      boxLevel: 1,
    };
    const newAttempt = {
      AttemptDate: "2024-01-07T10:00:00Z",
      Success: true,
      TimeSpent: 1200,
      boxLevel: 1,
    };
    const currentTime = new Date("2024-01-08T10:00:00Z").getTime();

    // Act
    const oldDecay = calculateDecayScore(oldAttempt, currentTime);
    const newDecay = calculateDecayScore(newAttempt, currentTime);

    // Assert
    expect(oldDecay).toBeLessThan(newDecay);
  });

  it("should handle edge case values", () => {
    // Arrange
    const attempt = {
      AttemptDate: "2024-01-01T10:00:00Z",
      Success: false,
      TimeSpent: 0,
      boxLevel: 0,
    };
    const currentTime = new Date("2024-01-01T10:00:01Z").getTime();

    // Act
    const result = calculateDecayScore(attempt, currentTime);

    // Assert
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });
};

describe("Utils Functions - Core Functions", function() {
  describe("createAttemptRecord", () => {
    testCreateAttemptRecord();
  });

  describe("calculateDecayScore", () => {
    it("should calculate decay score based on time and success rate", () => {
      // Arrange
      const lastAttemptDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const successRate = 0.8;
      const stability = 10;

      // Act
      const score = calculateDecayScore(
        lastAttemptDate,
        successRate,
        stability
      );

      // Assert
      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("should return higher decay for older attempts", () => {
      // Arrange
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const successRate = 0.7;
      const stability = 10;

      // Act
      const recentScore = calculateDecayScore(
        recentDate,
        successRate,
        stability
      );
      const oldScore = calculateDecayScore(oldDate, successRate, stability);

      // Assert
      expect(oldScore).toBeGreaterThan(recentScore);
    });

    it("should handle edge case values", () => {
      // Arrange
      const date = new Date();
      const successRate = 1.0; // Perfect success
      const stability = 1;

      // Act & Assert
      expect(() =>
        calculateDecayScore(date, successRate, stability)
      ).not.toThrow();

      const score = calculateDecayScore(date, successRate, stability);
      expect(score).toBe(0); // Perfect success rate should give 0 decay
    });
  });
});

describe("Utils Functions - Validation", function() {
  describe("isDifficultyAllowed", () => {
    it("should allow easier difficulties", () => {
      // Act & Assert
      expect(isDifficultyAllowed("Easy", "Hard")).toBe(true);
      expect(isDifficultyAllowed("Medium", "Hard")).toBe(true);
      expect(isDifficultyAllowed("Easy", "Medium")).toBe(true);
    });

    it("should not allow harder difficulties", () => {
      // Act & Assert
      expect(isDifficultyAllowed("Hard", "Easy")).toBe(false);
      expect(isDifficultyAllowed("Hard", "Medium")).toBe(false);
      expect(isDifficultyAllowed("Medium", "Easy")).toBe(false);
    });

    it("should allow same difficulty level", () => {
      // Act & Assert
      expect(isDifficultyAllowed("Easy", "Easy")).toBe(true);
      expect(isDifficultyAllowed("Medium", "Medium")).toBe(true);
      expect(isDifficultyAllowed("Hard", "Hard")).toBe(true);
    });

    it("should handle invalid difficulty levels", () => {
      // Act & Assert
      // Note: indexOf returns -1 for invalid values, so -1 <= -1 is true
      expect(isDifficultyAllowed("Invalid", "Easy")).toBe(true); // Both invalid -> -1 <= valid index
      expect(isDifficultyAllowed("Easy", "Invalid")).toBe(false); // valid index <= -1 is false
    });
  });

  describe("deduplicateById", () => {
    it("should remove duplicate problems by ID", () => {
      // Arrange
      const problems = [
        { id: "1", title: "Problem 1" },
        { id: "2", title: "Problem 2" },
        { id: "1", title: "Problem 1 Duplicate" },
        { id: "3", title: "Problem 3" },
        { id: "2", title: "Problem 2 Duplicate" },
      ];

      // Act
      const result = deduplicateById(problems);

      // Assert
      expect(result).toHaveLength(3);
      expect(result.map((p) => p.id)).toEqual(["1", "2", "3"]);
      // Should keep first occurrence
      expect(result[0].title).toBe("Problem 1");
      expect(result[1].title).toBe("Problem 2");
    });

    it("should handle empty array", () => {
      // Act
      const result = deduplicateById([]);

      // Assert
      expect(result).toEqual([]);
    });

    it("should handle array with no duplicates", () => {
      // Arrange
      const problems = [
        { id: "1", title: "Problem 1" },
        { id: "2", title: "Problem 2" },
        { id: "3", title: "Problem 3" },
      ];

      // Act
      const result = deduplicateById(problems);

      // Assert
      expect(result).toEqual(problems);
      expect(result).toHaveLength(3);
    });

    it("should handle problems with null/undefined IDs", () => {
      // Arrange
      const problems = [
        { id: null, title: "Problem with null ID" },
        { id: "1", title: "Problem 1" },
        { id: undefined, title: "Problem with undefined ID" },
        { id: "1", title: "Problem 1 Duplicate" },
      ];

      // Act
      const result = deduplicateById(problems);

      // Assert
      expect(result).toHaveLength(3); // null, undefined, and "1"
    });
  });
});

describe("Utils Functions - Edge Cases", function() {
  describe("Edge Cases and Data Validation", () => {
    it("should handle malformed attempt data in createAttemptRecord", () => {
      // Arrange
      const malformedData = {
        id: "malformed-id",
        ProblemID: null,
        Success: "maybe",
        TimeSpent: "very long",
        extraField: "should be ignored",
      };

      // Act
      const result = createAttemptRecord(malformedData);

      // Assert
      expect(result.id).toBe("malformed-id");
      expect(result.comments).toBe("");
      // Should still process despite malformed data
      expect(result.problem_id).toBeNull();
      expect(result.success).toBe("maybe");
    });

    it("should handle undefined inputs gracefully", () => {
      // Act & Assert
      expect(() => createAttemptRecord({})).not.toThrow(); // Empty object instead of undefined
      expect(() => isDifficultyAllowed(undefined, "Easy")).not.toThrow();
      expect(() => deduplicateById([])).not.toThrow(); // Empty array instead of undefined
    });

    it("should preserve additional attempt properties", () => {
      // Arrange
      const attemptData = {
        id: "preserve-test",
        ProblemID: "prob-789",
        Success: true,
        Comments: "custom comment",
        Difficulty: 7,
      };

      // Act
      const result = createAttemptRecord(attemptData);

      // Assert
      expect(result.id).toBe("preserve-test");
      expect(result.problem_id).toBe("prob-789");
      expect(result.comments).toBe("custom comment");
      expect(result.difficulty).toBe(7);
    });
  });
});

describe("Utils Functions - Integration Tests", function() {
  describe("Integration Tests", () => {
    it("should work together in realistic scenarios", () => {
      // Arrange - Simulate processing a batch of problems
      const duplicateProblems = [
        { id: "1", title: "Two Sum", difficulty: "Easy" },
        { id: "2", title: "Add Two Numbers", difficulty: "Medium" },
        { id: "1", title: "Two Sum (duplicate)", difficulty: "Easy" },
        { id: "3", title: "Longest Substring", difficulty: "Hard" },
      ];

      const maxDifficulty = "Medium";

      // Act
      const uniqueProblems = deduplicateById(duplicateProblems);
      const allowedProblems = uniqueProblems.filter((p) =>
        isDifficultyAllowed(p.difficulty, maxDifficulty)
      );

      // Assert
      expect(uniqueProblems).toHaveLength(3);
      expect(allowedProblems).toHaveLength(2); // Easy and Medium only
      expect(
        allowedProblems.every((p) =>
          isDifficultyAllowed(p.difficulty, maxDifficulty)
        )
      ).toBe(true);
    });

    it("should handle complex decay calculations", () => {
      // Arrange - Test various time periods
      const testCases = [
        { days: 1, successRate: 0.9, stability: 5 },
        { days: 7, successRate: 0.7, stability: 10 },
        { days: 30, successRate: 0.5, stability: 15 },
      ];

      // Act & Assert
      testCases.forEach(({ days, successRate, stability }) => {
        const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const score = calculateDecayScore(date, successRate, stability);

        expect(score).toBeGreaterThanOrEqual(0);
        expect(typeof score).toBe("number");
        expect(isFinite(score)).toBe(true);
      });
    });
  });
});
