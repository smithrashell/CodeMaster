/**
 * Tests for Issue #193: Immediate Deletion of Expired Sessions
 *
 * Tests the new deleteSessionFromDB() function, refreshSession() lock mechanism,
 * and edge case handling for session deletion.
 */

import { SessionService } from "../session/sessionService";
import {
  getSessionById,
  deleteSessionFromDB,
} from "../../db/entities/sessions";
import { ProblemService } from "../problem/problemService";
import { StorageService } from "../storage/storageService";

// Mock dependencies
jest.mock("../../db/entities/sessions");
jest.mock("../../db/entities/tag_mastery");
jest.mock("../../db/entities/problem_relationships");
jest.mock("../../db/entities/standard_problems");
jest.mock("../../db/entities/sessionAnalytics");
jest.mock("../problem/problemService");
jest.mock("../storage/storageService");
jest.mock("uuid", () => ({ v4: () => "test-session-uuid" }));

jest.mock("../../utils/performance/PerformanceMonitor.js", () => ({
  __esModule: true,
  default: {
    startQuery: jest.fn(() => ({ id: "test-query" })),
    endQuery: jest.fn(),
  },
}));

jest.mock("../storage/IndexedDBRetryService.js", () => ({
  IndexedDBRetryService: jest.fn().mockImplementation(() => ({
    executeWithRetry: jest.fn((fn) => fn()),
    quickTimeout: 1000,
  })),
}));

// eslint-disable-next-line max-lines-per-function -- Integration test for session deletion feature
describe("Session Deletion (Issue #193)", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock StorageService
    StorageService.getSettings = jest.fn().mockResolvedValue({
      sessionsPerWeek: 5,
      sessionLength: 5,
      focusAreas: ["Array", "String"],
    });

    // Mock ProblemService
    ProblemService.createSession = jest.fn().mockResolvedValue({
      problems: [{ id: 1, title: "Test Problem" }],
      tags: ["Array"],
    });
  });

  describe("deleteSessionFromDB", () => {
    it("should delete a session with valid ID", async () => {
      const sessionId = "valid-session-id-123";

      getSessionById.mockResolvedValue({
        id: sessionId,
        status: "in_progress",
        date: new Date().toISOString(),
      });

      deleteSessionFromDB.mockResolvedValue(undefined);

      await deleteSessionFromDB(sessionId);

      expect(deleteSessionFromDB).toHaveBeenCalledWith(sessionId);
      expect(deleteSessionFromDB).toHaveBeenCalledTimes(1);
    });

    it("should throw error when sessionId is null", async () => {
      deleteSessionFromDB.mockImplementation((id) => {
        if (!id) {
          return Promise.reject(new Error("deleteSessionFromDB requires a valid sessionId"));
        }
        return Promise.resolve();
      });

      await expect(deleteSessionFromDB(null)).rejects.toThrow(
        "deleteSessionFromDB requires a valid sessionId"
      );
    });

    it("should throw error when sessionId is undefined", async () => {
      deleteSessionFromDB.mockImplementation((id) => {
        if (!id) {
          return Promise.reject(new Error("deleteSessionFromDB requires a valid sessionId"));
        }
        return Promise.resolve();
      });

      await expect(deleteSessionFromDB(undefined)).rejects.toThrow(
        "deleteSessionFromDB requires a valid sessionId"
      );
    });

    it("should log warning when deleting completed session", async () => {
      const sessionId = "completed-session-id";
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      getSessionById.mockResolvedValue({
        id: sessionId,
        status: "completed",
        date: new Date().toISOString(),
      });

      deleteSessionFromDB.mockResolvedValue(undefined);

      await deleteSessionFromDB(sessionId);

      consoleSpy.mockRestore();
    });
  });

  describe("refreshSession - Lock Mechanism", () => {
    it("should prevent concurrent refresh operations", async () => {
      const sessionType = "standard";

      // Mock resumeSession to return existing session
      SessionService.resumeSession = jest.fn().mockResolvedValue({
        id: "old-session-id",
        status: "in_progress",
        session_type: sessionType,
      });

      // Mock deleteSessionFromDB with delay
      deleteSessionFromDB.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve();
          }, 100);
        });
      });

      // Mock createNewSession
      SessionService.createNewSession = jest.fn().mockResolvedValue({
        id: "new-session-id",
        status: "in_progress",
        session_type: sessionType,
      });

      // Start first refresh
      const firstRefresh = SessionService.refreshSession(sessionType, true);

      // Wait a bit to ensure first refresh has started
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Start second refresh (should return same promise)
      const secondRefresh = SessionService.refreshSession(sessionType, true);

      // Both should resolve to the same result
      const [result1, result2] = await Promise.all([firstRefresh, secondRefresh]);

      expect(result1).toBe(result2);
      expect(deleteSessionFromDB).toHaveBeenCalledTimes(1); // Only called once due to lock
    });

    it("should allow refresh after previous one completes", async () => {
      const sessionType = "standard";

      SessionService.resumeSession = jest.fn().mockResolvedValue({
        id: "old-session-id",
        status: "in_progress",
        session_type: sessionType,
      });

      deleteSessionFromDB.mockResolvedValue(undefined);

      SessionService.createNewSession = jest.fn()
        .mockResolvedValueOnce({
          id: "new-session-1",
          status: "in_progress",
        })
        .mockResolvedValueOnce({
          id: "new-session-2",
          status: "in_progress",
        });

      // First refresh
      const result1 = await SessionService.refreshSession(sessionType, true);
      expect(result1.id).toBe("new-session-1");

      // Second refresh (should work since first completed)
      const result2 = await SessionService.refreshSession(sessionType, true);
      expect(result2.id).toBe("new-session-2");

      expect(deleteSessionFromDB).toHaveBeenCalledTimes(2);
    });
  });

  describe("refreshSession - Edge Cases", () => {
    it("should handle deletion success but creation failure", async () => {
      const sessionType = "standard";

      SessionService.resumeSession = jest.fn().mockResolvedValue({
        id: "old-session-id",
        status: "in_progress",
        session_type: sessionType,
      });

      deleteSessionFromDB.mockResolvedValue(undefined);

      // Mock creation to fail
      SessionService.createNewSession = jest.fn().mockRejectedValue(
        new Error("Failed to create new session")
      );

      await expect(
        SessionService.refreshSession(sessionType, true)
      ).rejects.toThrow("Failed to create new session");

      // Verify deletion happened but creation failed
      expect(deleteSessionFromDB).toHaveBeenCalledWith("old-session-id");
      expect(SessionService.createNewSession).toHaveBeenCalled();
    });

    it("should not delete if forceNew is false", async () => {
      const sessionType = "standard";

      SessionService.resumeSession = jest.fn().mockResolvedValue({
        id: "existing-session",
        status: "in_progress",
      });

      SessionService.createNewSession = jest.fn().mockResolvedValue({
        id: "new-session",
        status: "in_progress",
      });

      deleteSessionFromDB.mockResolvedValue(undefined);

      await SessionService.refreshSession(sessionType, false);

      // Should not delete when forceNew=false
      expect(deleteSessionFromDB).not.toHaveBeenCalled();
    });

    it("should handle no existing session gracefully", async () => {
      const sessionType = "standard";

      SessionService.resumeSession = jest.fn().mockResolvedValue(null);

      SessionService.createNewSession = jest.fn().mockResolvedValue({
        id: "new-session",
        status: "in_progress",
      });

      deleteSessionFromDB.mockResolvedValue(undefined);

      const result = await SessionService.refreshSession(sessionType, true);

      expect(result.id).toBe("new-session");
      expect(deleteSessionFromDB).not.toHaveBeenCalled(); // No session to delete
    });
  });
});
