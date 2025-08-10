import { SessionService } from "../sessionService";
import * as sessionDb from "../../db/sessions";
import * as tagMasteryDb from "../../db/tag_mastery";
import * as problemRelationships from "../../db/problem_relationships";
import * as standardProblems from "../../db/standard_problems";
import * as sessionAnalytics from "../../db/sessionAnalytics";
import { ProblemService } from "../problemService";
import { StorageService } from "../storageService";

// Mock the database modules
jest.mock("../../db/sessions");
jest.mock("../../db/tag_mastery");
jest.mock("../../db/problem_relationships");
jest.mock("../../db/standard_problems");
jest.mock("../../db/sessionAnalytics");
jest.mock("../problemService");
jest.mock("../storageService");
jest.mock("uuid", () => ({ v4: () => "test-uuid-123" }));

describe("SessionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("checkAndCompleteSession", () => {
    it("should return empty array when all problems are attempted", async () => {
      // Arrange
      const sessionId = "test-session-123";
      const mockSession = {
        id: sessionId,
        status: "in_progress",
        problems: [
          { id: 1, title: "Problem 1" },
          { id: 2, title: "Problem 2" },
          { id: 3, title: "Problem 3" },
        ],
        attempts: [{ problemId: 1 }, { problemId: 2 }, { problemId: 3 }],
      };

      sessionDb.getSessionById.mockResolvedValue(mockSession);
      sessionDb.updateSessionInDB.mockResolvedValue();
      tagMasteryDb.calculateTagMastery.mockResolvedValue();
      problemRelationships.updateProblemRelationships.mockResolvedValue();

      // Act
      const result = await SessionService.checkAndCompleteSession(sessionId);

      // Assert
      expect(sessionDb.getSessionById).toHaveBeenCalledWith(sessionId);
      expect(sessionDb.updateSessionInDB).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed" })
      );
      expect(tagMasteryDb.calculateTagMastery).toHaveBeenCalled();
      expect(
        problemRelationships.updateProblemRelationships
      ).toHaveBeenCalledWith(mockSession);
      expect(result).toEqual([]);
    });

    it("should return unattempted problems when not all problems are attempted", async () => {
      // Arrange
      const sessionId = "test-session-456";
      const mockSession = {
        id: sessionId,
        status: "in_progress",
        problems: [
          { id: 1, title: "Problem 1" },
          { id: 2, title: "Problem 2" },
          { id: 3, title: "Problem 3" },
        ],
        attempts: [{ problemId: 1 }, { problemId: 3 }],
      };

      sessionDb.getSessionById.mockResolvedValue(mockSession);

      // Act
      const result = await SessionService.checkAndCompleteSession(sessionId);

      // Assert
      expect(sessionDb.getSessionById).toHaveBeenCalledWith(sessionId);
      expect(sessionDb.updateSessionInDB).not.toHaveBeenCalled();
      expect(tagMasteryDb.calculateTagMastery).not.toHaveBeenCalled();
      expect(result).toEqual([{ id: 2, title: "Problem 2" }]); // Problem 2 is not attempted
    });

    it("should return false when session not found", async () => {
      // Arrange
      const sessionId = "non-existent-session";
      sessionDb.getSessionById.mockResolvedValue(null);

      // Act
      const result = await SessionService.checkAndCompleteSession(sessionId);

      // Assert
      expect(sessionDb.getSessionById).toHaveBeenCalledWith(sessionId);
      expect(result).toBe(false);
    });

    it("should return empty array for already completed session", async () => {
      // Arrange
      const sessionId = "completed-session";
      const mockSession = {
        id: sessionId,
        status: "completed",
        problems: [
          { id: 1, title: "Problem 1" },
          { id: 2, title: "Problem 2" },
        ],
        attempts: [{ problemId: 1 }, { problemId: 2 }],
      };

      sessionDb.getSessionById.mockResolvedValue(mockSession);
      sessionDb.updateSessionInDB.mockResolvedValue();
      tagMasteryDb.calculateTagMastery.mockResolvedValue();
      problemRelationships.updateProblemRelationships.mockResolvedValue();

      // Act
      const result = await SessionService.checkAndCompleteSession(sessionId);

      // Assert
      expect(sessionDb.getSessionById).toHaveBeenCalledWith(sessionId);
      // Function will still process completion logic since all problems are attempted
      expect(result).toEqual([]);
    });
  });

  describe("resumeSession", () => {
    it("should resume an existing in-progress session with remaining problems", async () => {
      // Arrange
      const mockSession = {
        id: "resume-session-123",
        status: "in_progress",
        problems: [1, 2],
        attempts: [{ problemId: 1 }],
      };

      sessionDb.getLatestSession.mockResolvedValue(mockSession);
      sessionDb.saveSessionToStorage.mockResolvedValue();

      // Mock checkAndCompleteSession to return unattempted problems
      const mockCheckAndComplete = jest
        .spyOn(SessionService, "checkAndCompleteSession")
        .mockResolvedValue([2]); // Problem 2 is not attempted

      // Act
      const result = await SessionService.resumeSession();

      // Assert
      expect(sessionDb.getLatestSession).toHaveBeenCalled();
      expect(mockCheckAndComplete).toHaveBeenCalledWith("resume-session-123");
      expect(sessionDb.saveSessionToStorage).toHaveBeenCalledWith(mockSession);
      expect(result).toEqual([2]);
    });

    it("should return null when no in-progress session exists", async () => {
      // Arrange
      sessionDb.getLatestSession.mockResolvedValue(null);

      // Act
      const result = await SessionService.resumeSession();

      // Assert
      expect(sessionDb.getLatestSession).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should return null when session is completed", async () => {
      // Arrange
      const mockSession = {
        id: "completed-session",
        status: "completed",
        problems: [1, 2],
        attempts: [{ problemId: 1 }, { problemId: 2 }],
      };

      sessionDb.getLatestSession.mockResolvedValue(mockSession);

      // Act
      const result = await SessionService.resumeSession();

      // Assert
      expect(sessionDb.getLatestSession).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe("createNewSession", () => {
    beforeEach(() => {
      ProblemService.createSession = jest.fn();
      sessionDb.saveNewSessionToDB = jest.fn();
      sessionDb.saveSessionToStorage = jest.fn();
    });

    it("should create a new session with problems successfully", async () => {
      // Arrange
      const mockProblems = [
        { id: 1, title: "Two Sum", difficulty: "Easy" },
        { id: 2, title: "Add Two Numbers", difficulty: "Medium" }
      ];
      ProblemService.createSession.mockResolvedValue(mockProblems);
      sessionDb.saveNewSessionToDB.mockResolvedValue();
      sessionDb.saveSessionToStorage.mockResolvedValue();

      // Act
      const result = await SessionService.createNewSession();

      // Assert
      expect(ProblemService.createSession).toHaveBeenCalled();
      expect(sessionDb.saveNewSessionToDB).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "test-uuid-123",
          status: "in_progress",
          problems: mockProblems,
          attempts: []
        })
      );
      expect(sessionDb.saveSessionToStorage).toHaveBeenCalled();
      expect(result).toEqual(mockProblems);
    });

    it("should return null when no problems are available", async () => {
      // Arrange
      ProblemService.createSession.mockResolvedValue([]);

      // Act
      const result = await SessionService.createNewSession();

      // Assert
      expect(ProblemService.createSession).toHaveBeenCalled();
      expect(sessionDb.saveNewSessionToDB).not.toHaveBeenCalled();
      expect(sessionDb.saveSessionToStorage).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should return null when ProblemService fails", async () => {
      // Arrange
      ProblemService.createSession.mockResolvedValue(null);

      // Act
      const result = await SessionService.createNewSession();

      // Assert
      expect(ProblemService.createSession).toHaveBeenCalled();
      expect(sessionDb.saveNewSessionToDB).not.toHaveBeenCalled();
      expect(sessionDb.saveSessionToStorage).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe("getOrCreateSession", () => {
    beforeEach(() => {
      StorageService.migrateSettingsToIndexedDB = jest.fn();
      jest.spyOn(SessionService, "resumeSession");
      jest.spyOn(SessionService, "createNewSession");
    });

    it("should resume existing session when available", async () => {
      // Arrange
      const mockSettings = { adaptiveSession: true };
      const mockProblems = [{ id: 1, title: "Problem 1" }];
      
      StorageService.migrateSettingsToIndexedDB.mockResolvedValue(mockSettings);
      SessionService.resumeSession.mockResolvedValue(mockProblems);

      // Act
      const result = await SessionService.getOrCreateSession();

      // Assert
      expect(StorageService.migrateSettingsToIndexedDB).toHaveBeenCalled();
      expect(SessionService.resumeSession).toHaveBeenCalled();
      expect(SessionService.createNewSession).not.toHaveBeenCalled();
      expect(result).toEqual(mockProblems);
    });

    it("should create new session when no resumable session exists", async () => {
      // Arrange
      const mockSettings = { adaptiveSession: true };
      const mockProblems = [{ id: 1, title: "Problem 1" }];
      
      StorageService.migrateSettingsToIndexedDB.mockResolvedValue(mockSettings);
      SessionService.resumeSession.mockResolvedValue(null);
      SessionService.createNewSession.mockResolvedValue(mockProblems);

      // Act
      const result = await SessionService.getOrCreateSession();

      // Assert
      expect(StorageService.migrateSettingsToIndexedDB).toHaveBeenCalled();
      expect(SessionService.resumeSession).toHaveBeenCalled();
      expect(SessionService.createNewSession).toHaveBeenCalled();
      expect(result).toEqual(mockProblems);
    });

    it("should return null when settings are not found", async () => {
      // Arrange
      StorageService.migrateSettingsToIndexedDB.mockResolvedValue(null);

      // Act
      const result = await SessionService.getOrCreateSession();

      // Assert
      expect(StorageService.migrateSettingsToIndexedDB).toHaveBeenCalled();
      expect(SessionService.resumeSession).not.toHaveBeenCalled();
      expect(SessionService.createNewSession).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe("skipProblem", () => {
    it("should remove problem from session and save to storage", async () => {
      // Arrange
      const leetCodeID = "problem-123";
      const mockSession = {
        id: "session-123",
        problems: [
          { leetCodeID: "problem-123", title: "Problem 1" },
          { leetCodeID: "problem-456", title: "Problem 2" }
        ]
      };
      
      sessionDb.getLatestSession.mockResolvedValue(mockSession);
      sessionDb.saveSessionToStorage.mockResolvedValue();

      // Act
      const result = await SessionService.skipProblem(leetCodeID);

      // Assert
      expect(sessionDb.getLatestSession).toHaveBeenCalled();
      expect(sessionDb.saveSessionToStorage).toHaveBeenCalledWith(
        expect.objectContaining({
          problems: [{ leetCodeID: "problem-456", title: "Problem 2" }]
        }),
        true
      );
      expect(result.problems).toHaveLength(1);
      expect(result.problems[0].leetCodeID).toBe("problem-456");
    });

    it("should return null when no session exists", async () => {
      // Arrange
      sessionDb.getLatestSession.mockResolvedValue(null);

      // Act
      const result = await SessionService.skipProblem("problem-123");

      // Assert
      expect(sessionDb.getLatestSession).toHaveBeenCalled();
      expect(sessionDb.saveSessionToStorage).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe("calculateMasteryDeltas", () => {
    it("should calculate deltas for new tags", () => {
      // Arrange
      const preSessionMap = new Map();
      const postSessionMap = new Map([
        ["array", { mastered: false, totalAttempts: 3, decayScore: 0.9 }]
      ]);

      // Act
      const result = SessionService.calculateMasteryDeltas(preSessionMap, postSessionMap);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        tag: "array",
        type: "new",
        preMastered: false,
        postMastered: false,
        masteredChanged: false,
        strengthDelta: 3,
        decayDelta: expect.closeTo(-0.1, 5)
      });
    });

    it("should calculate deltas for mastery progression", () => {
      // Arrange
      const preSessionMap = new Map([
        ["array", { mastered: false, totalAttempts: 8, decayScore: 1.0 }]
      ]);
      const postSessionMap = new Map([
        ["array", { mastered: true, totalAttempts: 12, decayScore: 1.0 }]
      ]);

      // Act
      const result = SessionService.calculateMasteryDeltas(preSessionMap, postSessionMap);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        tag: "array",
        type: "updated",
        preMastered: false,
        postMastered: true,
        masteredChanged: true,
        strengthDelta: 4,
        decayDelta: 0
      });
    });

    it("should filter out deltas with no meaningful changes", () => {
      // Arrange
      const preSessionMap = new Map([
        ["array", { mastered: true, totalAttempts: 10, decayScore: 1.0 }]
      ]);
      const postSessionMap = new Map([
        ["array", { mastered: true, totalAttempts: 10, decayScore: 1.0 }]
      ]);

      // Act
      const result = SessionService.calculateMasteryDeltas(preSessionMap, postSessionMap);

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe("analyzeSessionDifficulty", () => {
    beforeEach(() => {
      standardProblems.fetchProblemById = jest.fn();
    });

    it("should analyze difficulty distribution correctly", async () => {
      // Arrange
      const session = {
        problems: [
          { leetCodeID: 1 },
          { leetCodeID: 2 },
          { leetCodeID: 3 }
        ]
      };

      standardProblems.fetchProblemById
        .mockResolvedValueOnce({ difficulty: "Easy" })
        .mockResolvedValueOnce({ difficulty: "Medium" })
        .mockResolvedValueOnce({ difficulty: "Hard" });

      // Act
      const result = await SessionService.analyzeSessionDifficulty(session);

      // Assert
      expect(result.counts).toEqual({ Easy: 1, Medium: 1, Hard: 1 });
      expect(result.percentages.Easy).toBeCloseTo(33.33, 2);
      expect(result.percentages.Medium).toBeCloseTo(33.33, 2);
      expect(result.percentages.Hard).toBeCloseTo(33.33, 2);
      expect(result.totalProblems).toBe(3);
      expect(["Easy", "Medium", "Hard"]).toContain(result.predominantDifficulty);
    });

    it("should default to Medium when problem difficulty is not found", async () => {
      // Arrange
      const session = {
        problems: [{ leetCodeID: 1 }]
      };

      standardProblems.fetchProblemById.mockResolvedValue(null);

      // Act
      const result = await SessionService.analyzeSessionDifficulty(session);

      // Assert
      expect(result.counts.Medium).toBe(1);
      expect(result.counts.Easy).toBe(0);
      expect(result.counts.Hard).toBe(0);
    });
  });

  describe("summarizeSessionPerformance", () => {
    beforeEach(() => {
      tagMasteryDb.getTagMastery = jest.fn();
      tagMasteryDb.calculateTagMastery = jest.fn();
      sessionDb.getSessionPerformance = jest.fn();
      sessionAnalytics.storeSessionAnalytics = jest.fn();
      problemRelationships.updateProblemRelationships = jest.fn();
      jest.spyOn(SessionService, "calculateMasteryDeltas");
      jest.spyOn(SessionService, "analyzeSessionDifficulty");
      jest.spyOn(SessionService, "generateSessionInsights");
      jest.spyOn(SessionService, "logSessionAnalytics");
    });

    it("should summarize session performance with all components", async () => {
      // Arrange
      const session = { 
        id: "test-session", 
        problems: [{ leetCodeID: 1 }],
        attempts: [{ problemId: 1, correct: true, timeSpent: 1200 }]
      };

      const mockPreTagMastery = [
        { tag: "array", mastered: false, totalAttempts: 5 }
      ];
      const mockPostTagMastery = [
        { tag: "array", mastered: true, totalAttempts: 8 }
      ];
      const mockPerformance = {
        accuracy: 0.8,
        avgTime: 1500,
        strongTags: ["array"],
        weakTags: []
      };

      tagMasteryDb.getTagMastery
        .mockResolvedValueOnce(mockPreTagMastery)
        .mockResolvedValueOnce(mockPostTagMastery);
      sessionDb.getSessionPerformance.mockResolvedValue(mockPerformance);
      SessionService.calculateMasteryDeltas.mockReturnValue([{
        tag: "array", type: "updated", masteredChanged: true, postMastered: true
      }]);
      SessionService.analyzeSessionDifficulty.mockResolvedValue({
        counts: { Easy: 1, Medium: 0, Hard: 0 }
      });
      SessionService.generateSessionInsights.mockReturnValue({
        accuracy: "Good performance", nextActions: []
      });

      // Act
      const result = await SessionService.summarizeSessionPerformance(session);

      // Assert
      expect(tagMasteryDb.getTagMastery).toHaveBeenCalledTimes(2);
      expect(problemRelationships.updateProblemRelationships).toHaveBeenCalledWith(session);
      expect(tagMasteryDb.calculateTagMastery).toHaveBeenCalled();
      expect(sessionAnalytics.storeSessionAnalytics).toHaveBeenCalled();
      expect(result).toMatchObject({
        sessionId: "test-session",
        performance: mockPerformance,
        masteryProgression: {
          newMasteries: 1,
          decayedMasteries: 0
        }
      });
    });

    it("should handle errors gracefully", async () => {
      // Arrange
      const session = { id: "error-session" };
      tagMasteryDb.getTagMastery.mockRejectedValue(new Error("Database error"));

      // Act & Assert
      await expect(SessionService.summarizeSessionPerformance(session))
        .rejects.toThrow("Database error");
    });
  });
});
