import {
  saveHintInteraction,
  getInteractionsByProblem,
  getInteractionsBySession,
  getInteractionsByHintType,
  getInteractionsByAction,
  getInteractionsByDateRange,
  getInteractionsByDifficultyAndType,
  getAllInteractions,
  getInteractionStats,
  getHintEffectiveness,
  deleteOldInteractions,
} from "../hint_interactions";

// Mock the dbHelper
jest.mock("../index.js", () => ({
  dbHelper: {
    openDB: jest.fn(),
  },
}));

describe("hint_interactions database module", () => {
  let mockDB;
  let mockTransaction;
  let mockStore;
  let mockIndex;
  let mockRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create comprehensive mocks
    mockRequest = {
      onsuccess: null,
      onerror: null,
      result: null,
    };

    mockIndex = {
      getAll: jest.fn(() => mockRequest),
      openCursor: jest.fn(() => mockRequest),
    };

    mockStore = {
      add: jest.fn(() => mockRequest),
      getAll: jest.fn(() => mockRequest),
      index: jest.fn(() => mockIndex),
    };

    mockTransaction = {
      objectStore: jest.fn(() => mockStore),
    };

    mockDB = {
      transaction: jest.fn(() => mockTransaction),
    };

    const { dbHelper } = require("../index.js");
    dbHelper.openDB.mockResolvedValue(mockDB);
  });

  describe("saveHintInteraction", () => {
    it("should save hint interaction successfully", async () => {
      // Arrange
      const interactionData = {
        problemId: "two-sum",
        hintType: "contextual",
        hintId: "array-hash-table",
        userAction: "expand",
        timestamp: "2024-01-15T10:30:00Z",
      };

      mockRequest.result = 123; // Mock auto-generated ID
      
      // Act
      const savePromise = saveHintInteraction(interactionData);
      
      // Simulate successful database operation
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);

      const result = await savePromise;

      // Assert
      expect(mockDB.transaction).toHaveBeenCalledWith("hint_interactions", "readwrite");
      expect(mockTransaction.objectStore).toHaveBeenCalledWith("hint_interactions");
      expect(mockStore.add).toHaveBeenCalledWith(interactionData);
      expect(result).toEqual({ ...interactionData, id: 123 });
    });

    it("should handle save errors", async () => {
      // Arrange
      const interactionData = { problemId: "test" };
      const error = new Error("Database error");

      // Act
      const savePromise = saveHintInteraction(interactionData);
      
      // Simulate database error
      setTimeout(() => {
        if (mockRequest.onerror) {
          mockRequest.onerror({ target: { error } });
        }
      }, 0);

      // Assert
      await expect(savePromise).rejects.toEqual(error);
    });
  });

  describe("getInteractionsByProblem", () => {
    it("should retrieve interactions for a specific problem", async () => {
      // Arrange
      const problemId = "two-sum";
      const mockInteractions = [
        {
          id: 1,
          problemId: "two-sum",
          hintType: "contextual",
          userAction: "expand",
        },
        {
          id: 2,
          problemId: "two-sum",
          hintType: "general",
          userAction: "collapse",
        },
      ];

      mockRequest.result = mockInteractions;
      
      // Act
      const getPromise = getInteractionsByProblem(problemId);
      
      // Simulate successful database operation
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);

      const result = await getPromise;

      // Assert
      expect(mockDB.transaction).toHaveBeenCalledWith("hint_interactions", "readonly");
      expect(mockStore.index).toHaveBeenCalledWith("by_problem_id");
      expect(mockIndex.getAll).toHaveBeenCalledWith(problemId);
      expect(result).toEqual(mockInteractions);
    });
  });

  describe("getInteractionsBySession", () => {
    it("should retrieve interactions for a specific session", async () => {
      // Arrange
      const sessionId = "session-123";
      const mockInteractions = [
        {
          id: 1,
          sessionId: "session-123",
          hintType: "contextual",
        },
      ];

      mockRequest.result = mockInteractions;
      
      // Act
      const getPromise = getInteractionsBySession(sessionId);
      
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);

      const result = await getPromise;

      // Assert
      expect(mockStore.index).toHaveBeenCalledWith("by_session_id");
      expect(mockIndex.getAll).toHaveBeenCalledWith(sessionId);
      expect(result).toEqual(mockInteractions);
    });
  });

  describe("getInteractionsByHintType", () => {
    it("should retrieve interactions by hint type", async () => {
      // Arrange
      const hintType = "contextual";
      const mockInteractions = [
        { id: 1, hintType: "contextual" },
        { id: 2, hintType: "contextual" },
      ];

      mockRequest.result = mockInteractions;
      
      // Act
      const getPromise = getInteractionsByHintType(hintType);
      
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);

      const result = await getPromise;

      // Assert
      expect(mockStore.index).toHaveBeenCalledWith("by_hint_type");
      expect(mockIndex.getAll).toHaveBeenCalledWith(hintType);
      expect(result).toEqual(mockInteractions);
    });
  });

  describe("getInteractionsByAction", () => {
    it("should retrieve interactions by user action", async () => {
      // Arrange
      const userAction = "expand";
      const mockInteractions = [
        { id: 1, userAction: "expand" },
        { id: 2, userAction: "expand" },
      ];

      mockRequest.result = mockInteractions;
      
      // Act
      const getPromise = getInteractionsByAction(userAction);
      
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);

      const result = await getPromise;

      // Assert
      expect(mockStore.index).toHaveBeenCalledWith("by_user_action");
      expect(mockIndex.getAll).toHaveBeenCalledWith(userAction);
      expect(result).toEqual(mockInteractions);
    });
  });

  describe("getInteractionsByDateRange", () => {
    it("should retrieve interactions within date range", async () => {
      // Arrange
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");
      const mockInteractions = [
        { id: 1, timestamp: "2024-01-15T10:30:00Z" },
        { id: 2, timestamp: "2024-01-20T14:20:00Z" },
      ];

      mockRequest.result = mockInteractions;
      
      // Act
      const getPromise = getInteractionsByDateRange(startDate, endDate);
      
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);

      const result = await getPromise;

      // Assert
      expect(mockStore.index).toHaveBeenCalledWith("by_timestamp");
      expect(mockIndex.getAll).toHaveBeenCalledWith(
        expect.objectContaining({
          lower: startDate.toISOString(),
          upper: endDate.toISOString(),
        })
      );
      expect(result).toEqual(mockInteractions);
    });
  });

  describe("getInteractionsByDifficultyAndType", () => {
    it("should retrieve interactions by difficulty and hint type", async () => {
      // Arrange
      const difficulty = "Medium";
      const hintType = "contextual";
      const mockInteractions = [
        {
          id: 1,
          problemDifficulty: "Medium",
          hintType: "contextual",
        },
      ];

      mockRequest.result = mockInteractions;
      
      // Act
      const getPromise = getInteractionsByDifficultyAndType(difficulty, hintType);
      
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);

      const result = await getPromise;

      // Assert
      expect(mockStore.index).toHaveBeenCalledWith("by_hint_type_and_difficulty");
      expect(mockIndex.getAll).toHaveBeenCalledWith([hintType, difficulty]);
      expect(result).toEqual(mockInteractions);
    });
  });

  describe("getAllInteractions", () => {
    it("should retrieve all interactions", async () => {
      // Arrange
      const mockInteractions = [
        { id: 1, hintType: "contextual" },
        { id: 2, hintType: "general" },
        { id: 3, hintType: "primer" },
      ];

      mockRequest.result = mockInteractions;
      
      // Act
      const getPromise = getAllInteractions();
      
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);

      const result = await getPromise;

      // Assert
      expect(mockStore.getAll).toHaveBeenCalled();
      expect(result).toEqual(mockInteractions);
    });
  });

  describe("deleteOldInteractions", () => {
    it("should delete interactions older than cutoff date", async () => {
      // Arrange
      const cutoffDate = new Date("2024-01-01");
      const mockCursor = {
        delete: jest.fn(),
        continue: jest.fn(),
      };

      // Act
      const deletePromise = deleteOldInteractions(cutoffDate);
      
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          // Simulate cursor iteration - first call with cursor
          mockRequest.onsuccess({ target: { result: mockCursor } });
          
          // Immediately simulate second call with null (end of iteration)
          setTimeout(() => {
            mockRequest.onsuccess({ target: { result: null } });
          }, 0);
        }
      }, 0);

      const result = await deletePromise;

      // Assert
      expect(mockStore.index).toHaveBeenCalledWith("by_timestamp");
      expect(mockIndex.openCursor).toHaveBeenCalledWith(
        expect.objectContaining({
          upper: cutoffDate.toISOString(),
        })
      );
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getInteractionStats", () => {
    it("should calculate interaction statistics", async () => {
      // Arrange
      const mockInteractions = [
        {
          id: 1,
          userAction: "expand",
          hintType: "contextual",
          problemDifficulty: "Medium",
          boxLevel: 2,
          problemId: "two-sum",
          sessionId: "session-1",
          timestamp: new Date().toISOString(),
        },
        {
          id: 2,
          userAction: "collapse",
          hintType: "general",
          problemDifficulty: "Easy",
          boxLevel: 1,
          problemId: "valid-parentheses",
          sessionId: "session-2",
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        },
      ];

      mockRequest.result = mockInteractions;
      
      // Act
      const statsPromise = getInteractionStats();
      
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);

      const result = await statsPromise;

      // Assert
      expect(result).toEqual({
        totalInteractions: 2,
        byAction: {
          expand: 1,
          collapse: 1,
        },
        byHintType: {
          contextual: 1,
          general: 1,
        },
        byDifficulty: {
          Medium: 1,
          Easy: 1,
        },
        byBoxLevel: {
          1: 1,
          2: 1,
        },
        recentInteractions: 2, // Both interactions are recent (the logic counts all)
        uniqueProblems: 2,
        uniqueSessions: 2,
      });
    });
  });

  describe("getHintEffectiveness", () => {
    it("should calculate hint effectiveness analytics", async () => {
      // Arrange
      const mockInteractions = [
        {
          id: 1,
          hintType: "contextual",
          problemDifficulty: "Medium",
          userAction: "expand",
          problemId: "two-sum",
        },
        {
          id: 2,
          hintType: "contextual", 
          problemDifficulty: "Medium",
          userAction: "expand",
          problemId: "valid-parentheses",
        },
        {
          id: 3,
          hintType: "contextual",
          problemDifficulty: "Medium", 
          userAction: "dismissed",
          problemId: "two-sum",
        },
      ];

      mockRequest.result = mockInteractions;
      
      // Act
      const effectivenessPromise = getHintEffectiveness();
      
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);

      const result = await effectivenessPromise;

      // Assert
      expect(result["contextual-Medium"]).toEqual({
        hintType: "contextual",
        difficulty: "Medium",
        totalInteractions: 3,
        expansions: 2,
        dismissals: 1,
        engagementRate: 2/3, // 2 expansions out of 3 total
        uniqueProblems: 2,
      });
    });
  });

  describe("error handling", () => {
    it("should handle database connection errors", async () => {
      // Arrange
      const { dbHelper } = require("../index.js");
      const dbError = new Error("Database connection failed");
      dbHelper.openDB.mockRejectedValue(dbError);

      // Act & Assert
      await expect(getAllInteractions()).rejects.toThrow("Database connection failed");
    });

    it("should handle transaction errors", async () => {
      // Arrange
      const transactionError = new Error("Transaction failed");
      
      // Act
      const savePromise = saveHintInteraction({ problemId: "test" });
      
      setTimeout(() => {
        if (mockRequest.onerror) {
          mockRequest.onerror({ target: { error: transactionError } });
        }
      }, 0);

      // Assert
      await expect(savePromise).rejects.toEqual(transactionError);
    });
  });

  describe("edge cases", () => {
    it("should handle empty result sets", async () => {
      // Arrange
      mockRequest.result = [];
      
      // Act
      const getPromise = getInteractionsByProblem("non-existent");
      
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);

      const result = await getPromise;

      // Assert
      expect(result).toEqual([]);
    });

    it("should handle null/undefined inputs gracefully", async () => {
      // Arrange
      mockRequest.result = null;
      
      // Act & Assert - should not throw errors
      const savePromise = saveHintInteraction(null);
      
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess();
        }
      }, 0);

      await expect(savePromise).resolves.toEqual({ id: null });
    });

    it("should handle malformed interaction data", async () => {
      // Arrange
      const malformedData = {
        // Missing required fields
        hintType: "contextual",
        // No problemId, userAction, etc.
      };

      // Act
      const savePromise = saveHintInteraction(malformedData);
      
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.result = 1;
          mockRequest.onsuccess();
        }
      }, 0);

      const result = await savePromise;

      // Assert - should still save and add ID
      expect(result).toEqual({ ...malformedData, id: 1 });
    });
  });
});