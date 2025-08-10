/**
 * Comprehensive tests for attempts database operations
 * Tests critical database functionality for tracking user attempts
 */

// Mock IndexedDB first
import "fake-indexeddb/auto";

// Mock all dependencies before importing
jest.mock("../index.js", () => ({
  dbHelper: {
    openDB: jest.fn()
  }
}));
jest.mock("../problems.js", () => ({
  getProblem: jest.fn(),
  saveUpdatedProblem: jest.fn()
}));
jest.mock("../sessions.js", () => ({
  getOrCreateSession: jest.fn(),
  saveSessionToStorage: jest.fn(),
  addOrUpdateProblemInSession: jest.fn()
}));
jest.mock("../../services/sessionService.js", () => ({
  SessionService: {
    checkAndCompleteSession: jest.fn(),
    getOrCreateSession: jest.fn()
  },
  sessionService: {
    checkAndCompleteSession: jest.fn()
  }
}));
jest.mock("../../services/problemService.js", () => ({
  ProblemService: {
    addOrUpdateProblemInSession: jest.fn()
  }
}));
jest.mock("../../utils/leitnerSystem.js");
jest.mock("../../utils/Utils.js");

// Mock global functions used in attempts.js
global.evaluateAttempts = jest.fn();


import {
  addAttempt,
  getAttemptsByProblem,
  getAllAttempts,
  getMostRecentAttempt,
  saveAttempts,
  updateProblemsWithAttemptStats
} from "../attempts";
import { dbHelper } from "../index.js";
import { getProblem, saveUpdatedProblem } from "../problems.js";
import { getOrCreateSession, saveSessionToStorage, addOrUpdateProblemInSession } from "../sessions.js";
import { SessionService } from "../../services/sessionService.js";
import { ProblemService } from "../../services/problemService.js";
import { calculateLeitnerBox } from "../../utils/leitnerSystem.js";
import { createAttemptRecord } from "../../utils/Utils.js";

describe("Attempts Database Operations", () => {
  let mockDB;
  let mockTransaction;
  let mockObjectStore;
  let mockIndex;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock database infrastructure
    mockIndex = {
      getAll: jest.fn(),
      openCursor: jest.fn()
    };

    mockObjectStore = {
      put: jest.fn(),
      getAll: jest.fn(),
      index: jest.fn(() => mockIndex)
    };

    mockTransaction = {
      objectStore: jest.fn(() => mockObjectStore),
      oncomplete: null,
      onerror: null
    };

    mockDB = {
      transaction: jest.fn(() => mockTransaction)
    };

    dbHelper.openDB.mockResolvedValue(mockDB);

    // Mock Chrome storage
    global.chrome = {
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn()
        }
      }
    };
  });

  describe("addAttempt", () => {
    beforeEach(() => {
      getProblem.mockImplementation(() => Promise.resolve({ id: 1, title: "Test Problem" }));
      calculateLeitnerBox.mockImplementation((problem) => Promise.resolve({ ...problem, boxLevel: 2 }));
      createAttemptRecord.mockImplementation((data) => ({ 
        id: "attempt-123", 
        ...data, 
        AttemptDate: new Date().toISOString() 
      }));
      SessionService.checkAndCompleteSession = jest.fn();
      SessionService.getOrCreateSession = jest.fn().mockResolvedValue({ id: "new-session-123", attempts: [] });
      ProblemService.addOrUpdateProblemInSession = jest.fn().mockImplementation((session, problem, attemptId) => ({
        ...session,
        problems: [...(session.problems || []), problem]
      }));
    });

    it.skip("should add attempt successfully with existing session", async () => {
      // Arrange
      const mockSession = {
        id: "session-123",
        problems: [{ id: 1, title: "Test Problem" }],
        attempts: []
      };
      const attemptData = {
        ProblemID: 1,
        Success: true,
        TimeSpent: 1200,
        id: "attempt-123"
      };

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ currentSession: mockSession });
      });
      saveSessionToStorage.mockResolvedValue();

      // Simplify the transaction mocking - mock successful completion
      const mockRequest = { onsuccess: null, onerror: null };
      mockObjectStore.put.mockReturnValue(mockRequest);
      
      // Mock transaction completion
      mockTransaction.oncomplete = null;
      mockTransaction.onerror = null;

      // Act - Use Promise.resolve to handle the async mocking
      const resultPromise = addAttempt(attemptData);
      
      // Trigger the async success callbacks
      setTimeout(() => {
        if (mockRequest.onsuccess) mockRequest.onsuccess();
        if (mockTransaction.oncomplete) mockTransaction.oncomplete();
      }, 10);
      
      const result = await resultPromise;

      // Assert
      expect(getProblem).toHaveBeenCalledWith(1);
      expect(calculateLeitnerBox).toHaveBeenCalled();
      expect(createAttemptRecord).toHaveBeenCalledWith(attemptData);
      expect(result.message).toContain("successfully");
    }, 5000);

    it("should handle missing problem gracefully", async () => {
      // Arrange
      const mockSession = { id: "session-123", attempts: [] };
      const attemptData = { ProblemID: 999 };

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ currentSession: mockSession });
      });
      getProblem.mockResolvedValue(null);

      // Act
      const result = await addAttempt(attemptData);

      // Assert
      expect(result.error).toBe("Problem not found.");
      expect(calculateLeitnerBox).not.toHaveBeenCalled();
    });

    it.skip("should create new session when none exists", async () => {
      // Arrange
      const attemptData = { ProblemID: 1 };
      const mockNewSession = { id: "new-session-123", attempts: [] };
      
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({}); // No current session
      });
      SessionService.getOrCreateSession.mockResolvedValue(mockNewSession);
      saveSessionToStorage.mockResolvedValue();

      // Simplify transaction mocking
      const mockRequest = { onsuccess: null, onerror: null };
      mockObjectStore.put.mockReturnValue(mockRequest);
      mockTransaction.oncomplete = null;
      mockTransaction.onerror = null;

      // Act
      const resultPromise = addAttempt(attemptData);
      
      // Trigger callbacks after a short delay
      setTimeout(() => {
        if (mockRequest.onsuccess) mockRequest.onsuccess();
        if (mockTransaction.oncomplete) mockTransaction.oncomplete();
      }, 10);
      
      await resultPromise;

      // Assert
      expect(chrome.storage.local.get).toHaveBeenCalledWith(["currentSession"], expect.any(Function));
      expect(SessionService.getOrCreateSession).toHaveBeenCalled();
    }, 5000);

    it("should handle database errors gracefully", async () => {
      // Arrange
      const mockSession = { id: "session-123", attempts: [] };
      const attemptData = { ProblemID: 1 };

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ currentSession: mockSession });
      });

      dbHelper.openDB.mockRejectedValue(new Error("Database connection failed"));

      // Act & Assert
      await expect(addAttempt(attemptData)).rejects.toThrow("Database connection failed");
    });
  });

  describe("getAttemptsByProblem", () => {
    it("should retrieve attempts for a specific problem", async () => {
      // Arrange
      const problemId = "problem-123";
      const mockAttempts = [
        { id: "attempt-1", problemId, Success: true, TimeSpent: 900 },
        { id: "attempt-2", problemId, Success: false, TimeSpent: 1500 }
      ];

      mockIndex.getAll.mockImplementation(() => ({
        onsuccess: null,
        onerror: null,
        result: mockAttempts
      }));

      // Simulate async callback
      setTimeout(() => {
        const request = mockIndex.getAll.mock.results[0].value;
        request.result = mockAttempts;
        if (request.onsuccess) request.onsuccess({ target: request });
      }, 0);

      // Act
      const result = await getAttemptsByProblem(problemId);

      // Assert
      expect(mockDB.transaction).toHaveBeenCalledWith("attempts", "readonly");
      expect(mockObjectStore.index).toHaveBeenCalledWith("by_problemId");
      expect(mockIndex.getAll).toHaveBeenCalledWith(problemId);
      expect(result).toEqual(mockAttempts);
    });

    it("should return empty array when no attempts found", async () => {
      // Arrange
      mockIndex.getAll.mockImplementation(() => ({
        onsuccess: null,
        onerror: null,
        result: null
      }));

      setTimeout(() => {
        const request = mockIndex.getAll.mock.results[0].value;
        request.result = null;
        if (request.onsuccess) request.onsuccess({ target: request });
      }, 0);

      // Act
      const result = await getAttemptsByProblem("non-existent");

      // Assert
      expect(result).toEqual([]);
    });

    it("should handle database errors", async () => {
      // Arrange
      mockIndex.getAll.mockImplementation(() => ({
        onsuccess: null,
        onerror: null
      }));

      setTimeout(() => {
        const request = mockIndex.getAll.mock.results[0].value;
        if (request.onerror) request.onerror({ target: { error: new Error("DB Error") } });
      }, 0);

      // Act & Assert
      await expect(getAttemptsByProblem("problem-123")).rejects.toThrow("DB Error");
    });
  });

  describe("getAllAttempts", () => {
    it("should retrieve all attempts from database", async () => {
      // Arrange
      const mockAllAttempts = [
        { id: "attempt-1", problemId: "prob-1", Success: true },
        { id: "attempt-2", problemId: "prob-2", Success: false },
        { id: "attempt-3", problemId: "prob-1", Success: true }
      ];

      mockObjectStore.getAll.mockImplementation(() => ({
        onsuccess: null,
        onerror: null,
        result: mockAllAttempts
      }));

      setTimeout(() => {
        const request = mockObjectStore.getAll.mock.results[0].value;
        request.result = mockAllAttempts;
        if (request.onsuccess) request.onsuccess({ target: request });
      }, 0);

      // Act
      const result = await getAllAttempts();

      // Assert
      expect(mockDB.transaction).toHaveBeenCalledWith("attempts", "readonly");
      expect(mockObjectStore.getAll).toHaveBeenCalled();
      expect(result).toEqual(mockAllAttempts);
    });

    it("should return empty array when database is empty", async () => {
      // Arrange
      mockObjectStore.getAll.mockImplementation(() => ({
        onsuccess: null,
        onerror: null,
        result: []
      }));

      setTimeout(() => {
        const request = mockObjectStore.getAll.mock.results[0].value;
        request.result = [];
        if (request.onsuccess) request.onsuccess({ target: request });
      }, 0);

      // Act
      const result = await getAllAttempts();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("getMostRecentAttempt", () => {
    it("should get most recent attempt for specific problem", async () => {
      // Arrange
      const problemId = "problem-123";
      const mockRecentAttempt = {
        id: "attempt-latest",
        problemId,
        Success: true,
        AttemptDate: new Date().toISOString()
      };

      mockIndex.openCursor.mockImplementation(() => ({
        onsuccess: null,
        onerror: null
      }));

      setTimeout(() => {
        const request = mockIndex.openCursor.mock.results[0].value;
        if (request.onsuccess) {
          request.onsuccess({ 
            target: { 
              result: { value: mockRecentAttempt } 
            } 
          });
        }
      }, 0);

      // Act
      const result = await getMostRecentAttempt(problemId);

      // Assert
      expect(mockObjectStore.index).toHaveBeenCalledWith("by_problem_and_date");
      expect(mockIndex.openCursor).toHaveBeenCalledWith(problemId, "prev");
      expect(result).toEqual(mockRecentAttempt);
    });

    it("should get most recent attempt across all problems when no problemId provided", async () => {
      // Arrange
      const mockRecentAttempt = {
        id: "attempt-global-latest",
        Success: false,
        AttemptDate: new Date().toISOString()
      };

      mockIndex.openCursor.mockImplementation(() => ({
        onsuccess: null,
        onerror: null
      }));

      setTimeout(() => {
        const request = mockIndex.openCursor.mock.results[0].value;
        if (request.onsuccess) {
          request.onsuccess({ 
            target: { 
              result: { value: mockRecentAttempt } 
            } 
          });
        }
      }, 0);

      // Act
      const result = await getMostRecentAttempt();

      // Assert
      expect(mockObjectStore.index).toHaveBeenCalledWith("by_date");
      expect(mockIndex.openCursor).toHaveBeenCalledWith(null, "prev");
      expect(result).toEqual(mockRecentAttempt);
    });

    it("should return null when no attempts found", async () => {
      // Arrange
      mockIndex.openCursor.mockImplementation(() => ({
        onsuccess: null,
        onerror: null
      }));

      setTimeout(() => {
        const request = mockIndex.openCursor.mock.results[0].value;
        if (request.onsuccess) {
          request.onsuccess({ target: { result: null } });
        }
      }, 0);

      // Act
      const result = await getMostRecentAttempt("non-existent");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("saveAttempts", () => {
    it("should save multiple attempts successfully", async () => {
      // Arrange
      const attemptsToSave = [
        { id: "attempt-1", problemId: "prob-1", Success: true },
        { id: "attempt-2", problemId: "prob-2", Success: false }
      ];

      mockObjectStore.put.mockImplementation(() => ({
        onsuccess: null,
        onerror: null
      }));

      // Simulate transaction completion
      setTimeout(() => {
        if (mockTransaction.oncomplete) mockTransaction.oncomplete();
      }, 10);

      // Act
      await saveAttempts(attemptsToSave);

      // Assert
      expect(mockDB.transaction).toHaveBeenCalledWith("attempts", "readwrite");
      expect(mockObjectStore.put).toHaveBeenCalledTimes(2);
      expect(mockObjectStore.put).toHaveBeenCalledWith(attemptsToSave[0]);
      expect(mockObjectStore.put).toHaveBeenCalledWith(attemptsToSave[1]);
    });

    it("should handle save errors gracefully", async () => {
      // Arrange
      const attemptsToSave = [{ id: "attempt-1", Success: true }];

      mockObjectStore.put.mockImplementation(() => ({
        onsuccess: null,
        onerror: null
      }));

      // Simulate error in put operation
      setTimeout(() => {
        const request = mockObjectStore.put.mock.results[0].value;
        if (request.onerror) {
          request.onerror({ target: { errorCode: "SAVE_ERROR" } });
        }
      }, 0);

      // Act & Assert
      await expect(saveAttempts(attemptsToSave)).rejects.toBe("Error saving attempt: SAVE_ERROR");
    });

    it("should handle transaction errors", async () => {
      // Arrange
      const attemptsToSave = [{ id: "attempt-1" }];

      mockObjectStore.put.mockImplementation(() => ({
        onsuccess: null,
        onerror: null
      }));

      // Simulate transaction error
      setTimeout(() => {
        if (mockTransaction.onerror) {
          mockTransaction.onerror({ target: { errorCode: "TRANSACTION_ERROR" } });
        }
      }, 10);

      // Act & Assert
      await expect(saveAttempts(attemptsToSave)).rejects.toBe("Transaction error: TRANSACTION_ERROR");
    });
  });

  describe("updateProblemsWithAttemptStats", () => {
    beforeEach(() => {
      global.evaluateAttempts.mockClear();
    });

    it("should update all problems with their attempt statistics", async () => {
      // Arrange
      const mockAttempts = [
        { id: "attempt-1", problemId: "prob-1" },
        { id: "attempt-2", problemId: "prob-2" }
      ];

      const mockUpdatedProblems = [
        { id: "prob-1", boxLevel: 3, totalAttempts: 5 },
        { id: "prob-2", boxLevel: 1, totalAttempts: 2 }
      ];

      // Mock getAllAttempts to return attempts
      mockObjectStore.getAll.mockImplementation(() => ({
        onsuccess: null,
        onerror: null,
        result: mockAttempts
      }));

      setTimeout(() => {
        const request = mockObjectStore.getAll.mock.results[0].value;
        request.result = mockAttempts;
        if (request.onsuccess) request.onsuccess({ target: request });
      }, 0);

      global.evaluateAttempts
        .mockResolvedValueOnce(mockUpdatedProblems[0])
        .mockResolvedValueOnce(mockUpdatedProblems[1]);

      // Act
      await updateProblemsWithAttemptStats();

      // Assert
      expect(global.evaluateAttempts).toHaveBeenCalledTimes(2);
      expect(saveUpdatedProblem).toHaveBeenCalledTimes(2);
      expect(saveUpdatedProblem).toHaveBeenCalledWith(mockUpdatedProblems[0]);
      expect(saveUpdatedProblem).toHaveBeenCalledWith(mockUpdatedProblems[1]);
    });

    it("should handle empty attempts gracefully", async () => {
      // Arrange
      mockObjectStore.getAll.mockImplementation(() => ({
        onsuccess: null,
        onerror: null,
        result: []
      }));

      setTimeout(() => {
        const request = mockObjectStore.getAll.mock.results[0].value;
        request.result = [];
        if (request.onsuccess) request.onsuccess({ target: request });
      }, 0);

      // Act
      await updateProblemsWithAttemptStats();

      // Assert
      expect(global.evaluateAttempts).not.toHaveBeenCalled();
      expect(saveUpdatedProblem).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle corrupted attempt data", async () => {
      // Arrange
      const corruptedAttemptData = {
        ProblemID: null, // Invalid problem ID
        Success: "maybe", // Invalid success value
        TimeSpent: "fast" // Invalid time value
      };

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ currentSession: { id: "session-123", attempts: [] } });
      });

      getProblem.mockResolvedValue(null);

      // Act
      const result = await addAttempt(corruptedAttemptData);

      // Assert
      expect(result.error).toBe("Problem not found.");
    });

    it("should handle database connection failures", async () => {
      // Arrange
      dbHelper.openDB.mockRejectedValue(new Error("Database unavailable"));

      // Act & Assert
      await expect(getAllAttempts()).rejects.toThrow("Database unavailable");
    });

    it("should handle Chrome storage failures", async () => {
      // Arrange
      const attemptData = { ProblemID: 1 };
      
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        // Simulate Chrome storage error
        throw new Error("Chrome storage unavailable");
      });

      // Act & Assert
      await expect(addAttempt(attemptData)).rejects.toThrow("Chrome storage unavailable");
    });
  });
});