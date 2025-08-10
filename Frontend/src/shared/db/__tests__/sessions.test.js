/**
 * Comprehensive tests for sessions database operations
 * Tests critical session management and adaptive session settings
 */

// Mock IndexedDB first
import "fake-indexeddb/auto";

// Mock all dependencies before importing
jest.mock("../index.js", () => ({
  dbHelper: {
    openDB: jest.fn()
  }
}));
jest.mock("../../services/tagServices.js");
jest.mock("../../services/storageService.js");
jest.mock("../../services/attemptsService.js");
jest.mock("uuid", () => ({ v4: () => "test-session-uuid-123" }));

import {
  getSessionById,
  getLatestSession,
  saveNewSessionToDB,
  updateSessionInDB,
  saveSessionToStorage,
  buildAdaptiveSessionSettings
} from "../sessions";
import { dbHelper } from "../index.js";
import { TagService } from "../../services/tagServices.js";
import { StorageService } from "../../services/storageService.js";
import { AttemptsService } from "../../services/attemptsService.js";

describe("Sessions Database Operations", () => {
  let mockDB;
  let mockTransaction;
  let mockObjectStore;
  let mockIndex;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock database infrastructure
    mockIndex = {
      openCursor: jest.fn()
    };

    mockObjectStore = {
      get: jest.fn(),
      add: jest.fn(),
      put: jest.fn(),
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
          set: jest.fn()
        }
      },
      runtime: {
        lastError: null
      }
    };
  });

  describe("getSessionById", () => {
    it("should retrieve session by ID successfully", async () => {
      // Arrange
      const sessionId = "session-123";
      const mockSession = {
        id: sessionId,
        date: "2024-01-15T10:00:00Z",
        problems: [{ id: 1, title: "Two Sum" }],
        attempts: [],
        status: "in_progress"
      };

      mockObjectStore.get.mockImplementation(() => ({
        onsuccess: null,
        onerror: null,
        result: mockSession
      }));

      // Simulate async callback
      setTimeout(() => {
        const request = mockObjectStore.get.mock.results[0].value;
        request.result = mockSession;
        if (request.onsuccess) request.onsuccess();
      }, 0);

      // Act
      const result = await getSessionById(sessionId);

      // Assert
      expect(mockDB.transaction).toHaveBeenCalledWith("sessions", "readonly");
      expect(mockObjectStore.get).toHaveBeenCalledWith(sessionId);
      expect(result).toEqual(mockSession);
    });

    it("should return undefined when session not found", async () => {
      // Arrange
      mockObjectStore.get.mockImplementation(() => ({
        onsuccess: null,
        onerror: null,
        result: undefined
      }));

      setTimeout(() => {
        const request = mockObjectStore.get.mock.results[0].value;
        request.result = undefined;
        if (request.onsuccess) request.onsuccess();
      }, 0);

      // Act
      const result = await getSessionById("non-existent");

      // Assert
      expect(result).toBeUndefined();
    });

    it("should handle database errors", async () => {
      // Arrange
      const error = new Error("Database error");
      mockObjectStore.get.mockImplementation(() => ({
        onsuccess: null,
        onerror: null
      }));

      setTimeout(() => {
        const request = mockObjectStore.get.mock.results[0].value;
        request.error = error;
        if (request.onerror) request.onerror();
      }, 0);

      // Act & Assert
      await expect(getSessionById("session-123")).rejects.toEqual(error);
    });
  });

  describe("getLatestSession", () => {
    it("should retrieve the most recent session", async () => {
      // Arrange
      const latestSession = {
        id: "latest-session",
        date: "2024-01-20T15:00:00Z",
        status: "in_progress"
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
              result: { value: latestSession } 
            } 
          });
        }
      }, 0);

      // Act
      const result = await getLatestSession();

      // Assert
      expect(mockObjectStore.index).toHaveBeenCalledWith("by_date");
      expect(mockIndex.openCursor).toHaveBeenCalledWith(null, "prev");
      expect(result).toEqual(latestSession);
    });

    it("should return null when no sessions exist", async () => {
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
      const result = await getLatestSession();

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("saveNewSessionToDB", () => {
    it("should save new session successfully", async () => {
      // Arrange
      const newSession = {
        id: "new-session-123",
        date: new Date().toISOString(),
        problems: [],
        attempts: [],
        status: "in_progress"
      };

      mockObjectStore.add.mockImplementation(() => ({
        onsuccess: null,
        onerror: null
      }));

      setTimeout(() => {
        const request = mockObjectStore.add.mock.results[0].value;
        if (request.onsuccess) request.onsuccess();
      }, 0);

      // Act
      const result = await saveNewSessionToDB(newSession);

      // Assert
      expect(mockDB.transaction).toHaveBeenCalledWith("sessions", "readwrite");
      expect(mockObjectStore.add).toHaveBeenCalledWith(newSession);
      expect(result).toEqual(newSession);
    });

    it("should handle duplicate session ID errors", async () => {
      // Arrange
      const duplicateSession = { id: "duplicate-id" };
      const error = new Error("Duplicate key");

      mockObjectStore.add.mockImplementation(() => ({
        onsuccess: null,
        onerror: null
      }));

      setTimeout(() => {
        const request = mockObjectStore.add.mock.results[0].value;
        request.error = error;
        if (request.onerror) request.onerror();
      }, 0);

      // Act & Assert
      await expect(saveNewSessionToDB(duplicateSession)).rejects.toEqual(error);
    });
  });

  describe("updateSessionInDB", () => {
    it("should update existing session successfully", async () => {
      // Arrange
      const updatedSession = {
        id: "session-123",
        status: "completed",
        problems: [{ id: 1, title: "Problem 1" }],
        attempts: [{ problemId: 1, success: true }]
      };

      mockObjectStore.put.mockImplementation(() => ({
        onsuccess: null,
        onerror: null
      }));

      setTimeout(() => {
        const request = mockObjectStore.put.mock.results[0].value;
        if (request.onsuccess) request.onsuccess();
      }, 0);

      // Act
      const result = await updateSessionInDB(updatedSession);

      // Assert
      expect(mockDB.transaction).toHaveBeenCalledWith("sessions", "readwrite");
      expect(mockObjectStore.put).toHaveBeenCalledWith(updatedSession);
      expect(result).toEqual(updatedSession);
    });
  });

  describe("saveSessionToStorage", () => {
    it("should save session to Chrome storage successfully", async () => {
      // Arrange
      const session = { id: "session-123", status: "in_progress" };
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      // Act
      await saveSessionToStorage(session);

      // Assert
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { currentSession: session },
        expect.any(Function)
      );
    });

    it("should save session and update database when updateDatabase=true", async () => {
      // Arrange
      const session = { id: "session-123", status: "completed" };
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      mockObjectStore.put.mockImplementation(() => ({
        onsuccess: null,
        onerror: null
      }));

      setTimeout(() => {
        const request = mockObjectStore.put.mock.results[0].value;
        if (request.onsuccess) request.onsuccess();
      }, 0);

      // Act
      await saveSessionToStorage(session, true);

      // Assert
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { currentSession: session },
        expect.any(Function)
      );
      expect(mockObjectStore.put).toHaveBeenCalledWith(session);
    });

    it("should handle Chrome storage errors gracefully", async () => {
      // Arrange
      const session = { id: "session-123" };
      chrome.runtime.lastError = { message: "Chrome storage error" };
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      // Act
      await saveSessionToStorage(session);

      // Assert
      expect(chrome.storage.local.set).toHaveBeenCalled();
      // Should not throw error even with Chrome storage error
    });

    it("should fallback to IndexedDB when Chrome storage unavailable", async () => {
      // Arrange
      const session = { id: "session-123" };
      global.chrome = undefined; // Simulate Chrome API unavailable

      const mockRequest = {
        onsuccess: null,
        onerror: null
      };
      mockObjectStore.put.mockReturnValue(mockRequest);

      setTimeout(() => {
        if (mockRequest.onsuccess) mockRequest.onsuccess();
      }, 0);

      // Act - Enable updateDatabase to trigger IndexedDB fallback
      await saveSessionToStorage(session, true);

      // Assert
      expect(mockObjectStore.put).toHaveBeenCalledWith(session);
    });
  });

  describe("buildAdaptiveSessionSettings", () => {
    beforeEach(() => {
      TagService.getCurrentTier = jest.fn();
      StorageService.migrateSessionStateToIndexedDB = jest.fn();
      StorageService.getSessionState = jest.fn();
      AttemptsService.getMostRecentAttempt = jest.fn();
    });

    it("should build settings for onboarding users", async () => {
      // Arrange
      TagService.getCurrentTier.mockResolvedValue({
        focusTags: ["array", "hash-table"]
      });
      StorageService.migrateSessionStateToIndexedDB.mockResolvedValue(null);
      StorageService.getSessionState.mockResolvedValue({
        id: "session_state",
        numSessionsCompleted: 1, // Still onboarding (< 3)
        currentDifficultyCap: "Easy",
        tagIndex: 0,
        difficultyTimeStats: {
          Easy: { problems: 0, totalTime: 0, avgTime: 0 },
          Medium: { problems: 0, totalTime: 0, avgTime: 0 },
          Hard: { problems: 0, totalTime: 0, avgTime: 0 }
        },
        lastPerformance: { accuracy: null, efficiencyScore: null }
      });

      // Act
      const result = await buildAdaptiveSessionSettings();

      // Assert
      expect(result.sessionLength).toBe(4); // Default for onboarding
      expect(result.numberOfNewProblems).toBe(4);
      expect(result.currentAllowedTags).toEqual(["array"]); // First focus tag
      expect(result.currentDifficultyCap).toBe("Easy");
    });

    it("should build settings for experienced users with high performance", async () => {
      // Arrange
      TagService.getCurrentTier.mockResolvedValue({
        focusTags: ["array", "hash-table", "two-pointers"]
      });
      
      StorageService.migrateSessionStateToIndexedDB.mockResolvedValue({
        id: "session_state",
        numSessionsCompleted: 10, // Experienced user
        currentDifficultyCap: "Medium",
        tagIndex: 1,
        lastPerformance: {
          accuracy: 0.9, // High accuracy
          efficiencyScore: 0.8
        },
        escapeHatches: {
          sessionsAtCurrentDifficulty: 3,
          lastDifficultyPromotion: null,
          sessionsWithoutPromotion: 0,
          activatedEscapeHatches: []
        }
      });

      AttemptsService.getMostRecentAttempt.mockResolvedValue({
        AttemptDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
      });

      // Act
      const result = await buildAdaptiveSessionSettings();

      // Assert - Just check that the function returns reasonable values for experienced users
      expect(result.sessionLength).toBeGreaterThan(4); // Should be higher than onboarding
      expect(result.numberOfNewProblems).toBeGreaterThanOrEqual(1);
      expect(result.currentAllowedTags).toContain("array");
      expect(result.currentDifficultyCap).toBeDefined();
    });

    it("should build settings for users with poor performance", async () => {
      // Arrange
      TagService.getCurrentTier.mockResolvedValue({
        focusTags: ["array", "dynamic-programming"]
      });
      
      StorageService.migrateSessionStateToIndexedDB.mockResolvedValue({
        id: "session_state",
        numSessionsCompleted: 5,
        currentDifficultyCap: "Easy",
        tagIndex: 0,
        lastPerformance: {
          accuracy: 0.4, // Poor accuracy
          efficiencyScore: 0.3
        }
      });

      AttemptsService.getMostRecentAttempt.mockResolvedValue({
        AttemptDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString() // 6 days ago
      });

      // Mock the global functions used in buildAdaptiveSessionSettings

      // Act
      const result = await buildAdaptiveSessionSettings();

      // Assert
      expect(result.sessionLength).toBe(5); // Capped at 5 due to long gap + poor accuracy
      expect(result.numberOfNewProblems).toBe(1); // Only 1 new problem for low accuracy
      expect(result.currentAllowedTags).toEqual(["array"]); // Focused on single tag
    });

    it("should handle missing session state gracefully", async () => {
      // Arrange
      TagService.getCurrentTier.mockResolvedValue({
        focusTags: ["array"]
      });
      StorageService.migrateSessionStateToIndexedDB.mockResolvedValue(null);
      StorageService.getSessionState.mockResolvedValue(null);

      // Act
      const result = await buildAdaptiveSessionSettings();

      // Assert
      expect(result.sessionLength).toBe(4); // Default values
      expect(result.numberOfNewProblems).toBe(4);
      expect(result.currentAllowedTags).toEqual(["array"]);
      expect(result.currentDifficultyCap).toBe("Easy"); // Default
    });

    it("should handle missing focus tags gracefully", async () => {
      // Arrange
      TagService.getCurrentTier.mockResolvedValue({
        focusTags: null
      });
      StorageService.migrateSessionStateToIndexedDB.mockResolvedValue(null);
      StorageService.getSessionState.mockResolvedValue(null);

      // Act
      const result = await buildAdaptiveSessionSettings();

      // Assert
      expect(result.currentAllowedTags).toEqual(["array"]); // Fallback to array
    });

    it("should handle session state with escape hatches data", async () => {
      // Arrange
      TagService.getCurrentTier.mockResolvedValue({
        focusTags: ["dynamic-programming"]
      });
      
      StorageService.migrateSessionStateToIndexedDB.mockResolvedValue({
        id: "session_state",
        numSessionsCompleted: 20,
        currentDifficultyCap: "Easy",
        tagIndex: 0,
        lastPerformance: {
          accuracy: 0.6,
          efficiencyScore: 0.5
        },
        escapeHatches: {
          sessionsAtCurrentDifficulty: 12,
          lastDifficultyPromotion: null,
          sessionsWithoutPromotion: 15,
          activatedEscapeHatches: []
        }
      });

      // Act
      const result = await buildAdaptiveSessionSettings();

      // Assert
      expect(result.sessionLength).toBeGreaterThan(0);
      expect(result.numberOfNewProblems).toBeGreaterThan(0);
      expect(result.currentAllowedTags).toContain("dynamic-programming");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle database connection failures", async () => {
      // Arrange
      dbHelper.openDB.mockRejectedValue(new Error("Database unavailable"));

      // Act & Assert
      await expect(getSessionById("session-123")).rejects.toThrow("Database unavailable");
    });

    it("should handle malformed session data", async () => {
      // Arrange
      const malformedSession = {
        // Missing required fields
        status: "invalid_status",
        problems: "not_an_array",
        attempts: null
      };

      let mockRequest;
      mockObjectStore.add.mockImplementation(() => {
        mockRequest = {
          onsuccess: null,
          onerror: null
        };
        return mockRequest;
      });

      setTimeout(() => {
        if (mockRequest && mockRequest.onsuccess) mockRequest.onsuccess();
      }, 0);

      // Act
      const result = await saveNewSessionToDB(malformedSession);

      // Assert
      expect(result).toEqual(malformedSession); // Should still save, validation happens elsewhere
    });

    it("should handle Chrome API being undefined", async () => {
      // Arrange
      const session = { id: "session-123" };
      global.chrome = undefined;

      const mockRequest = {
        onsuccess: null,
        onerror: null
      };
      mockObjectStore.put.mockReturnValue(mockRequest);

      setTimeout(() => {
        if (mockRequest.onsuccess) mockRequest.onsuccess();
      }, 0);

      // Act - Enable updateDatabase to trigger IndexedDB operations
      await saveSessionToStorage(session, true);

      // Assert
      expect(mockObjectStore.put).toHaveBeenCalledWith(session);
    });
  });
});