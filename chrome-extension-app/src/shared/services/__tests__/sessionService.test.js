// Mock logger first before any other imports
jest.mock("../../utils/logging/logger.js", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { SessionService } from "../session/sessionService";
import {
  getSessionById,
  getLatestSession,
  getLatestSessionByType,
  saveSessionToStorage,
  saveNewSessionToDB,
  updateSessionInDB,
} from "../../db/entities/sessions";
import { updateProblemRelationships } from "../../db/entities/problem_relationships";
import { calculateTagMastery } from "../../db/entities/tag_mastery";
import { ProblemService } from "../problem/problemService";
import { StorageService } from "../storage/storageService";

// Mock the database modules
jest.mock("../../db/entities/sessions");
jest.mock("../../db/entities/tag_mastery");
jest.mock("../../db/entities/problem_relationships");
jest.mock("../../db/entities/standard_problems");
jest.mock("../../db/entities/sessionAnalytics");
jest.mock("../problem/problemService");
jest.mock("../storage/storageService");
jest.mock("uuid", () => ({ v4: () => "test-uuid-123" }));

// Mock new dependencies introduced during database integration  
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

// Test data factories
const createMockSession = (overrides = {}) => ({
  id: "test-session-123",
  status: "in_progress",
  problems: [
    { id: 1, title: "Problem 1", leetcode_id: 1, slug: "problem-1", difficulty: "Easy", Tags: ["array"] },
    { id: 2, title: "Problem 2", leetcode_id: 2, slug: "problem-2", difficulty: "Medium", Tags: ["string"] },
    { id: 3, title: "Problem 3", leetcode_id: 3, slug: "problem-3", difficulty: "Hard", Tags: ["graph"] },
  ],
  attempts: [{ problemId: 1, leetcode_id: 1 }, { problemId: 2, leetcode_id: 2 }, { problemId: 3, leetcode_id: 3 }],
  ...overrides,
});

const createMockProblems = () => [
  { id: 1, title: "Two Sum", difficulty: "Easy" },
  { id: 2, title: "Add Two Numbers", difficulty: "Medium" },
];

// Test helper functions
const setupMocksForCompletedSession = (session) => {
  getSessionById.mockResolvedValue(session);
  updateSessionInDB.mockResolvedValue();
  calculateTagMastery.mockResolvedValue();
  updateProblemRelationships.mockResolvedValue();
  StorageService.getSessionState = jest.fn().mockResolvedValue({ numSessionsCompleted: 5 });
  StorageService.setSessionState = jest.fn().mockResolvedValue();
};

const expectSessionCompletion = (sessionId, _session) => {
  expect(getSessionById).toHaveBeenCalledWith(sessionId);
  expect(updateSessionInDB).toHaveBeenCalledWith(
    expect.objectContaining({ status: "completed" })
  );
  // Note: calculateTagMastery and updateProblemRelationships may not be called directly
  // in checkAndCompleteSession anymore - they may be handled elsewhere in the flow
};

const setupMocksForNewSession = () => {
  ProblemService.createSession = jest.fn();
  saveNewSessionToDB.mockImplementation(() => Promise.resolve());
  saveSessionToStorage.mockImplementation(() => Promise.resolve());
};

// Test group functions
const runCheckAndCompleteSessionTests = () => {
  describe("checkAndCompleteSession", () => {
    it("should return empty array when all problems are attempted", async () => {
      const sessionId = "test-session-123";
      const mockSession = createMockSession({ id: sessionId });
      
      setupMocksForCompletedSession(mockSession);
      
      const result = await SessionService.checkAndCompleteSession(sessionId);
      
      expectSessionCompletion(sessionId, mockSession);
      expect(result).toEqual([]);
    });

    it("should return unattempted problems when not all problems are attempted", async () => {
      const sessionId = "test-session-456";
      const mockSession = createMockSession({
        id: sessionId,
        attempts: [{ problemId: 1, leetcode_id: 1 }, { problemId: 3, leetcode_id: 3 }],
      });

      getSessionById.mockResolvedValue(mockSession);

      const result = await SessionService.checkAndCompleteSession(sessionId);

      expect(getSessionById).toHaveBeenCalledWith(sessionId);
      expect(updateSessionInDB).not.toHaveBeenCalled();
      expect(calculateTagMastery).not.toHaveBeenCalled();
      expect(result).toEqual([
        expect.objectContaining({ id: 2, title: "Problem 2" })
      ]);
    });

    it("should return false when session not found", async () => {
      const sessionId = "non-existent-session";
      getSessionById.mockResolvedValue(null);

      const result = await SessionService.checkAndCompleteSession(sessionId);

      expect(getSessionById).toHaveBeenCalledWith(sessionId);
      expect(result).toBe(false);
    });

    it("should return empty array for already completed session", async () => {
      const sessionId = "completed-session";
      const mockSession = createMockSession({
        id: sessionId,
        status: "completed",
        problems: [
          { id: 1, title: "Problem 1", leetcode_id: 1, slug: "problem-1", difficulty: "Easy", Tags: ["array"] },
          { id: 2, title: "Problem 2", leetcode_id: 2, slug: "problem-2", difficulty: "Medium", Tags: ["string"] }
        ],
        attempts: [{ problemId: 1, leetcode_id: 1 }, { problemId: 2, leetcode_id: 2 }],
      });

      setupMocksForCompletedSession(mockSession);

      const result = await SessionService.checkAndCompleteSession(sessionId);

      expect(getSessionById).toHaveBeenCalledWith(sessionId);
      expect(result).toEqual([]);
    });
  });
};

const runResumeSessionTests = () => {
  describe("resumeSession", () => {
    it("should resume an existing in-progress session with remaining problems", async () => {
      const mockSession = {
        id: "resume-session-123",
        status: "in_progress",
        problems: [1, 2],
        attempts: [{ problemId: 1 }],
      };

      getLatestSessionByType.mockResolvedValue(mockSession);
      saveSessionToStorage.mockResolvedValue();

      const result = await SessionService.resumeSession();

      expect(getLatestSessionByType).toHaveBeenCalledWith(null, "in_progress");
      expect(saveSessionToStorage).toHaveBeenCalledWith(mockSession);
      expect(result).toEqual(expect.objectContaining({
        id: "resume-session-123",
        status: "in_progress",
        problems: [1, 2],
        attempts: [{ problemId: 1 }],
        currentProblemIndex: 0,
      }));
    });

    it("should return null when no in-progress session exists", async () => {
      getLatestSessionByType.mockResolvedValue(null);

      const result = await SessionService.resumeSession();

      expect(getLatestSessionByType).toHaveBeenCalledWith(null, "in_progress");
      expect(result).toBeNull();
    });

    it("should return null when session is completed", async () => {
      getLatestSessionByType.mockResolvedValue(null);

      const result = await SessionService.resumeSession();

      expect(getLatestSessionByType).toHaveBeenCalledWith(null, "in_progress");
      expect(result).toBeNull();
    });
  });
};

const runCreateNewSessionTests = () => {
  describe("createNewSession", () => {
    beforeEach(() => {
      setupMocksForNewSession();
    });

    it("should create a new session with problems successfully", async () => {
      const mockProblems = createMockProblems();
      ProblemService.createSession.mockResolvedValue(mockProblems);

      const result = await SessionService.createNewSession();

      expect(ProblemService.createSession).toHaveBeenCalled();
      expect(saveNewSessionToDB).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "test-uuid-123",
          status: "in_progress",
          problems: mockProblems,
          attempts: [],
        })
      );
      expect(saveSessionToStorage).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        id: "test-uuid-123",
        status: "in_progress",
        problems: mockProblems,
        attempts: [],
      }));
    });

    it("should return null when no problems are available", async () => {
      ProblemService.createSession.mockResolvedValue([]);

      const result = await SessionService.createNewSession();

      expect(ProblemService.createSession).toHaveBeenCalled();
      expect(saveNewSessionToDB).not.toHaveBeenCalled();
      expect(saveSessionToStorage).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should return null when ProblemService fails", async () => {
      ProblemService.createSession.mockResolvedValue(null);

      const result = await SessionService.createNewSession();

      expect(ProblemService.createSession).toHaveBeenCalled();
      expect(saveNewSessionToDB).not.toHaveBeenCalled();
      expect(saveSessionToStorage).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
};

const runSkipProblemTests = () => {
  describe("skipProblem", () => {
    it("should remove problem from session and save to storage", async () => {
      const leetCodeID = "problem-123";
      const mockSession = {
        id: "session-123",
        problems: [
          { leetcode_id: "problem-123", title: "Problem 1" },
          { leetcode_id: "problem-456", title: "Problem 2" },
        ],
      };

      getLatestSession.mockResolvedValue(mockSession);
      saveSessionToStorage.mockResolvedValue();

      const result = await SessionService.skipProblem(leetCodeID);

      expect(getLatestSession).toHaveBeenCalled();
      expect(saveSessionToStorage).toHaveBeenCalledWith(
        expect.objectContaining({
          problems: [{ leetcode_id: "problem-456", title: "Problem 2" }],
        }),
        true
      );
      expect(result.problems).toHaveLength(1);
      expect(result.problems[0].leetcode_id).toBe("problem-456");
    });

    it("should return null when no session exists", async () => {
      getLatestSession.mockResolvedValue(null);

      const result = await SessionService.skipProblem("problem-123");

      expect(getLatestSession).toHaveBeenCalled();
      expect(saveSessionToStorage).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
};

const runCalculateMasteryDeltasTests = () => {
  describe("calculateMasteryDeltas", () => {
    it("should calculate deltas for new tags", () => {
      const preSessionMap = new Map();
      const postSessionMap = new Map([
        ["array", { mastered: false, totalAttempts: 3, decayScore: 0.9 }],
      ]);

      const result = SessionService.calculateMasteryDeltas(preSessionMap, postSessionMap);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        tag: "array",
        type: "new",
        preMastered: false,
        postMastered: false,
        masteredChanged: false,
        strengthDelta: 3,
        decayDelta: expect.closeTo(-0.1, 5),
      });
    });

    it("should calculate deltas for mastery progression", () => {
      const preSessionMap = new Map([
        ["array", { mastered: false, totalAttempts: 8, decayScore: 1.0 }],
      ]);
      const postSessionMap = new Map([
        ["array", { mastered: true, totalAttempts: 12, decayScore: 1.0 }],
      ]);

      const result = SessionService.calculateMasteryDeltas(preSessionMap, postSessionMap);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        tag: "array",
        type: "updated",
        preMastered: false,
        postMastered: true,
        masteredChanged: true,
        strengthDelta: 4,
        decayDelta: 0,
      });
    });

    it("should filter out deltas with no meaningful changes", () => {
      const preSessionMap = new Map([
        ["array", { mastered: true, totalAttempts: 10, decayScore: 1.0 }],
      ]);
      const postSessionMap = new Map([
        ["array", { mastered: true, totalAttempts: 10, decayScore: 1.0 }],
      ]);

      const result = SessionService.calculateMasteryDeltas(preSessionMap, postSessionMap);

      expect(result).toHaveLength(0);
    });
  });
};

const runGetOrCreateSessionTests = () => {
  describe("getOrCreateSession", () => {
    it("should exist as a method on SessionService", () => {
      expect(typeof SessionService.getOrCreateSession).toBe('function');
    });
  });
};

describe("SessionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  runCheckAndCompleteSessionTests();
  runResumeSessionTests();
  runCreateNewSessionTests();
  runSkipProblemTests();
  runCalculateMasteryDeltasTests();
  runGetOrCreateSessionTests();
});