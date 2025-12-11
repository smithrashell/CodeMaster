/**
 * Unit tests for problemSelectionHelpers.js
 * Tests pure functions extracted during Issue #214 refactor
 */

// Mock logger first to prevent initialization errors
jest.mock("../../../utils/logging/logger.js", () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
  return {
    __esModule: true,
    default: mockLogger,
    ...mockLogger
  };
});

import {
  normalizeTags,
  getDifficultyScore,
  filterProblemsByDifficultyCap,
  logProblemSelectionStart,
  calculateTagDifficultyAllowances,
  logSelectedProblems,
  fillRemainingWithRandomProblems
} from "../problemSelectionHelpers";

describe("problemSelectionHelpers", () => {
  describe("normalizeTags", () => {
    it("converts tags to lowercase", () => {
      const result = normalizeTags(["ARRAY", "Hash Table", "DyNaMiC PrOgRaMmInG"]);

      expect(result).toEqual(["array", "hash table", "dynamic programming"]);
    });

    it("trims whitespace from tags", () => {
      const result = normalizeTags(["  array  ", "tree ", " graph"]);

      expect(result).toEqual(["array", "tree", "graph"]);
    });

    it("returns empty array for non-array input", () => {
      expect(normalizeTags(null)).toEqual([]);
      expect(normalizeTags(undefined)).toEqual([]);
      expect(normalizeTags("string")).toEqual([]);
      expect(normalizeTags(123)).toEqual([]);
    });

    it("handles empty array", () => {
      expect(normalizeTags([])).toEqual([]);
    });

    it("combines trim and lowercase", () => {
      const result = normalizeTags(["  TWO POINTERS  ", " Binary Search "]);

      expect(result).toEqual(["two pointers", "binary search"]);
    });
  });

  describe("getDifficultyScore", () => {
    it("returns 1 for Easy", () => {
      expect(getDifficultyScore("Easy")).toBe(1);
    });

    it("returns 2 for Medium", () => {
      expect(getDifficultyScore("Medium")).toBe(2);
    });

    it("returns 3 for Hard", () => {
      expect(getDifficultyScore("Hard")).toBe(3);
    });

    it("returns 2 (default) for unknown difficulty", () => {
      expect(getDifficultyScore("Unknown")).toBe(2);
      expect(getDifficultyScore("")).toBe(2);
      expect(getDifficultyScore(null)).toBe(2);
      expect(getDifficultyScore(undefined)).toBe(2);
    });

    it("is case-sensitive", () => {
      expect(getDifficultyScore("easy")).toBe(2); // Not "Easy"
      expect(getDifficultyScore("HARD")).toBe(2); // Not "Hard"
    });
  });

  describe("filterProblemsByDifficultyCap", () => {
    const allProblems = [
      { id: 1, difficulty: "Easy" },
      { id: 2, difficulty: "Medium" },
      { id: 3, difficulty: "Hard" },
      { id: 4, difficulty: "Easy" },
      { id: 5, difficulty: "Medium" }
    ];

    it("filters to Easy only when cap is Easy", () => {
      const result = filterProblemsByDifficultyCap(allProblems, "Easy");

      expect(result).toHaveLength(2);
      expect(result.every(p => p.difficulty === "Easy")).toBe(true);
    });

    it("filters to Easy and Medium when cap is Medium", () => {
      const result = filterProblemsByDifficultyCap(allProblems, "Medium");

      expect(result).toHaveLength(4);
      expect(result.every(p => p.difficulty !== "Hard")).toBe(true);
    });

    it("returns all problems when cap is Hard", () => {
      const result = filterProblemsByDifficultyCap(allProblems, "Hard");

      expect(result).toHaveLength(5);
    });

    it("returns all problems when cap is unknown", () => {
      const result = filterProblemsByDifficultyCap(allProblems, "Unknown");

      expect(result).toHaveLength(5);
    });

    it("defaults missing difficulty to Medium", () => {
      const problemsWithMissingDifficulty = [
        { id: 1 }, // No difficulty
        { id: 2, difficulty: "Easy" }
      ];

      const easyResult = filterProblemsByDifficultyCap(problemsWithMissingDifficulty, "Easy");
      // Problem 1 defaults to Medium, should be filtered out
      expect(easyResult).toHaveLength(1);

      const mediumResult = filterProblemsByDifficultyCap(problemsWithMissingDifficulty, "Medium");
      // Problem 1 defaults to Medium, should be included
      expect(mediumResult).toHaveLength(2);
    });

    it("handles empty array", () => {
      const result = filterProblemsByDifficultyCap([], "Medium");

      expect(result).toEqual([]);
    });
  });

  describe("logProblemSelectionStart", () => {
    it("logs without throwing errors", () => {
      const context = {
        enhancedFocusTags: ["array", "tree"],
        focusDecision: {
          algorithmReasoning: "test reasoning",
          userPreferences: [],
          systemRecommendation: null
        },
        availableProblems: [{ id: 1 }, { id: 2 }],
        ladders: { array: {}, tree: {} }
      };

      expect(() => logProblemSelectionStart(5, context)).not.toThrow();
    });

    it("handles missing optional context fields", () => {
      const context = {
        enhancedFocusTags: [],
        focusDecision: {},
        availableProblems: [],
        ladders: null
      };

      expect(() => logProblemSelectionStart(3, context)).not.toThrow();
    });
  });

  describe("logSelectedProblems", () => {
    it("logs without throwing errors", () => {
      const selectedProblems = [
        { id: 1, difficulty: "Easy", title: "Two Sum" },
        { id: 2, difficulty: "Medium", title: "Three Sum" }
      ];

      expect(() => logSelectedProblems(selectedProblems)).not.toThrow();
    });

    it("handles empty array", () => {
      expect(() => logSelectedProblems([])).not.toThrow();
    });

    it("handles problems without difficulty", () => {
      const problems = [{ id: 1, title: "Unknown" }];

      expect(() => logSelectedProblems(problems)).not.toThrow();
    });
  });

  describe("fillRemainingWithRandomProblems", () => {
    it("fills remaining slots from available problems", () => {
      const selectedProblems = [{ id: 1 }, { id: 2 }];
      const usedProblemIds = new Set([1, 2]);
      const availableProblems = [
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
        { id: 5 }
      ];

      fillRemainingWithRandomProblems(5, selectedProblems, usedProblemIds, availableProblems);

      expect(selectedProblems).toHaveLength(5);
    });

    it("does not add duplicates", () => {
      const selectedProblems = [{ id: 1 }];
      const usedProblemIds = new Set([1]);
      const availableProblems = [
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ];

      fillRemainingWithRandomProblems(3, selectedProblems, usedProblemIds, availableProblems);

      const ids = selectedProblems.map(p => p.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids).toHaveLength(uniqueIds.length);
    });

    it("does nothing when already at target count", () => {
      const selectedProblems = [{ id: 1 }, { id: 2 }];
      const originalLength = selectedProblems.length;

      fillRemainingWithRandomProblems(2, selectedProblems, new Set(), [{ id: 3 }]);

      expect(selectedProblems).toHaveLength(originalLength);
    });

    it("does nothing when available problems is empty", () => {
      const selectedProblems = [{ id: 1 }];
      const originalLength = selectedProblems.length;

      fillRemainingWithRandomProblems(5, selectedProblems, new Set(), []);

      expect(selectedProblems).toHaveLength(originalLength);
    });

    it("handles when not enough problems available", () => {
      const selectedProblems = [];
      const usedProblemIds = new Set();
      const availableProblems = [{ id: 1 }, { id: 2 }];

      fillRemainingWithRandomProblems(5, selectedProblems, usedProblemIds, availableProblems);

      expect(selectedProblems).toHaveLength(2); // Only 2 available
    });

    it("excludes problems already in usedProblemIds", () => {
      const selectedProblems = [];
      const usedProblemIds = new Set([1, 2]);
      const availableProblems = [
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ];

      fillRemainingWithRandomProblems(3, selectedProblems, usedProblemIds, availableProblems);

      expect(selectedProblems).toHaveLength(1);
      expect(selectedProblems[0].id).toBe(3);
    });
  });

  describe("calculateTagDifficultyAllowances", () => {
    // Mock the getDifficultyAllowanceForTag function behavior
    it("returns object with tag keys", () => {
      // Since this function depends on getDifficultyAllowanceForTag from Utils,
      // we test that it creates the expected structure
      const enhancedFocusTags = ["array", "tree"];
      const masteryData = [
        { tag: "array", totalAttempts: 10, successfulAttempts: 8, mastered: false },
        { tag: "tree", totalAttempts: 5, successfulAttempts: 2, mastered: false }
      ];
      const tagRelationshipsRaw = [
        { id: "array", difficulty_distribution: { Easy: 50, Medium: 40, Hard: 10 } }
      ];

      const result = calculateTagDifficultyAllowances(enhancedFocusTags, masteryData, tagRelationshipsRaw);

      expect(result).toHaveProperty("array");
      expect(result).toHaveProperty("tree");
    });

    it("handles missing mastery data for tag", () => {
      const enhancedFocusTags = ["graph"]; // Not in masteryData
      const masteryData = [];
      const tagRelationshipsRaw = [];

      const result = calculateTagDifficultyAllowances(enhancedFocusTags, masteryData, tagRelationshipsRaw);

      expect(result).toHaveProperty("graph");
    });

    it("handles empty focus tags", () => {
      const result = calculateTagDifficultyAllowances([], [], []);

      expect(result).toEqual({});
    });
  });
});
