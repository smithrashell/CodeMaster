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
  deleteSessionFromDB,
} from "../../db/stores/sessions";
import { updateProblemRelationships } from "../../db/stores/problem_relationships";
import { calculateTagMastery } from "../../db/stores/tag_mastery";
import { ProblemService } from "../problem/problemService";
import { StorageService } from "../storage/storageService";

// Mock the database modules
jest.mock("../../db/stores/sessions");
jest.mock("../../db/stores/tag_mastery");
jest.mock("../../db/stores/problem_relationships");
jest.mock("../../db/stores/standard_problems");
jest.mock("../../db/stores/sessionAnalytics");
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

jest.mock("../storage/indexedDBRetryService.js", () => ({
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

// Test helper functions - focused on contract verification, not implementation

/**
 * Setup mocks for session completion scenarios.
 * Note: We mock dependencies but verify return contracts, not mock calls.
 */
const setupMocksForCompletedSession = (session) => {
  getSessionById.mockResolvedValue(session);
  updateSessionInDB.mockResolvedValue();
  calculateTagMastery.mockResolvedValue();
  updateProblemRelationships.mockResolvedValue();
  StorageService.getSessionState = jest.fn().mockResolvedValue({ numSessionsCompleted: 5 });
  StorageService.setSessionState = jest.fn().mockResolvedValue();
};

/**
 * Contract assertion: Verify checkAndCompleteSession return value matches expected contract.
 *
 * @param {boolean|Array} result - The function return value
 * @param {'not_found'|'completed'|'unattempted'} expectedState - Expected state
 * @param {number} [expectedUnattemptedCount] - For 'unattempted' state, expected count
 */
const assertCheckAndCompleteContract = (result, expectedState, expectedUnattemptedCount = 0) => {
  switch (expectedState) {
    case 'not_found':
      expect(result).toBe(false);
      break;
    case 'completed':
      expect(result).toEqual([]);
      break;
    case 'unattempted':
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(expectedUnattemptedCount);
      result.forEach(problem => {
        expect(problem).toHaveProperty('id');
        expect(problem).toHaveProperty('title');
      });
      break;
  }
};

const setupMocksForNewSession = () => {
  ProblemService.createSession = jest.fn();
  saveNewSessionToDB.mockImplementation(() => Promise.resolve());
  saveSessionToStorage.mockImplementation(() => Promise.resolve());
};

/**
 * Contract assertion: Verify createNewSession return matches Session contract.
 */
const assertNewSessionContract = (session) => {
  expect(session).not.toBeNull();
  expect(session).toHaveProperty('id');
  expect(session).toHaveProperty('status', 'in_progress');
  expect(session).toHaveProperty('problems');
  expect(Array.isArray(session.problems)).toBe(true);
  expect(session).toHaveProperty('attempts');
  expect(Array.isArray(session.attempts)).toBe(true);
};

// Test group functions
const runCheckAndCompleteSessionTests = () => {
  describe("checkAndCompleteSession", () => {
    // CONTRACT: Returns [] when all problems are attempted (session just completed)
    it("should return empty array when all problems are attempted", async () => {
      const sessionId = "test-session-123";
      const mockSession = createMockSession({ id: sessionId });

      setupMocksForCompletedSession(mockSession);

      const result = await SessionService.checkAndCompleteSession(sessionId);

      // Verify contract: returns empty array for completed session
      assertCheckAndCompleteContract(result, 'completed');
    });

    // CONTRACT: Returns array of unattempted problems when session incomplete
    it("should return unattempted problems when not all problems are attempted", async () => {
      const sessionId = "test-session-456";
      const mockSession = createMockSession({
        id: sessionId,
        attempts: [{ problemId: 1, leetcode_id: 1 }, { problemId: 3, leetcode_id: 3 }],
      });

      getSessionById.mockResolvedValue(mockSession);

      const result = await SessionService.checkAndCompleteSession(sessionId);

      // Verify contract: returns array of unattempted problems with required fields
      assertCheckAndCompleteContract(result, 'unattempted', 1);
      expect(result[0]).toMatchObject({ id: 2, title: "Problem 2" });
    });

    // CONTRACT: Returns false when session not found
    it("should return false when session not found", async () => {
      const sessionId = "non-existent-session";
      getSessionById.mockResolvedValue(null);

      const result = await SessionService.checkAndCompleteSession(sessionId);

      // Verify contract: returns false for not found
      assertCheckAndCompleteContract(result, 'not_found');
    });

    // CONTRACT: Returns [] for already completed session (idempotent)
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

      // Verify contract: completed sessions return empty array
      assertCheckAndCompleteContract(result, 'completed');
    });
  });
};

const runResumeSessionTests = () => {
  describe("resumeSession", () => {
    // CONTRACT: Returns session object with required fields when resumable session exists
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

      // Verify contract: returns session with required fields preserved
      expect(result).not.toBeNull();
      expect(result.id).toBe("resume-session-123");
      expect(result.status).toBe("in_progress");
      expect(result.problems).toEqual([1, 2]);
      expect(result.attempts).toHaveLength(1);
      expect(result).toHaveProperty('currentProblemIndex');
    });

    // CONTRACT: Returns null when no resumable session exists
    it("should return null when no in-progress session exists", async () => {
      getLatestSessionByType.mockResolvedValue(null);

      const result = await SessionService.resumeSession();

      // Verify contract: null when no session
      expect(result).toBeNull();
    });

    // CONTRACT: Returns null when session is completed (not resumable)
    it("should return null when session is completed", async () => {
      getLatestSessionByType.mockResolvedValue(null);

      const result = await SessionService.resumeSession();

      // Verify contract: null when completed
      expect(result).toBeNull();
    });
  });
};

const runCreateNewSessionTests = () => {
  describe("createNewSession", () => {
    beforeEach(() => {
      setupMocksForNewSession();
    });

    // CONTRACT: Returns Session object with required fields when problems available
    it("should create a new session with problems successfully", async () => {
      const mockProblems = createMockProblems();
      ProblemService.createSession.mockResolvedValue(mockProblems);

      const result = await SessionService.createNewSession();

      // Verify contract: returns session matching Session type definition
      assertNewSessionContract(result);
      expect(result.id).toBe("test-uuid-123");
      expect(result.problems).toEqual(mockProblems);
      expect(result.attempts).toEqual([]);
    });

    // CONTRACT: Returns null when no problems are available
    it("should return null when no problems are available", async () => {
      ProblemService.createSession.mockResolvedValue([]);

      const result = await SessionService.createNewSession();

      // Verify contract: null when no problems
      expect(result).toBeNull();
    });

    // CONTRACT: Returns null when ProblemService fails
    it("should return null when ProblemService fails", async () => {
      ProblemService.createSession.mockResolvedValue(null);

      const result = await SessionService.createNewSession();

      // Verify contract: null on failure
      expect(result).toBeNull();
    });
  });
};

const runSkipProblemTests = () => {
  describe("skipProblem", () => {
    // CONTRACT: Returns session with problem removed when valid
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

      // Verify contract: returns session with specified problem removed
      expect(result).not.toBeNull();
      expect(result.problems).toHaveLength(1);
      expect(result.problems[0].leetcode_id).toBe("problem-456");
      expect(result.problems.find(p => p.leetcode_id === "problem-123")).toBeUndefined();
    });

    // CONTRACT: Returns null when no session exists
    it("should return null when no session exists", async () => {
      getLatestSession.mockResolvedValue(null);

      const result = await SessionService.skipProblem("problem-123");

      // Verify contract: null when no session
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

const runRefreshSessionTests = () => {
  describe("refreshSession", () => {
    beforeEach(() => {
      setupMocksForNewSession();
      deleteSessionFromDB.mockResolvedValue();
    });

    // CONTRACT: Returns null when forceNew=true but no existing session of that type exists
    // This prevents accidentally creating a session of the wrong type (bug fix for interview session regeneration)
    it("should return null when forceNew=true but no session of that type exists", async () => {
      // No existing session found
      getLatestSessionByType.mockResolvedValue(null);

      const result = await SessionService.refreshSession('interview-like', true);

      // Verify contract: returns null when no session exists to regenerate
      expect(result).toBeNull();
      // Should NOT attempt to create a new session
      expect(ProblemService.createSession).not.toHaveBeenCalled();
      expect(ProblemService.createInterviewSession).not.toHaveBeenCalled();
    });

    // CONTRACT: Returns new session when forceNew=true and existing session exists
    it("should create new session when forceNew=true and existing session exists", async () => {
      const existingSession = {
        id: "existing-interview-session",
        status: "in_progress",
        session_type: "interview-like",
        problems: [{ id: 1 }],
        attempts: []
      };
      const mockProblems = createMockProblems();

      getLatestSessionByType.mockResolvedValue(existingSession);
      ProblemService.createInterviewSession = jest.fn().mockResolvedValue({
        problems: mockProblems,
        session_type: 'interview-like',
        interviewConfig: { timeLimit: 45 }
      });

      const result = await SessionService.refreshSession('interview-like', true);

      // Verify contract: old session deleted, new session created
      expect(deleteSessionFromDB).toHaveBeenCalledWith("existing-interview-session");
      expect(result).not.toBeNull();
      expect(result.session_type).toBe('interview-like');
    });

    // CONTRACT: Preserves session type during regeneration (critical bug fix)
    it("should preserve session type when regenerating an interview session", async () => {
      const existingInterviewSession = {
        id: "interview-session-123",
        status: "in_progress",
        session_type: "full-interview",
        problems: [{ id: 1 }],
        attempts: []
      };
      const mockProblems = createMockProblems();

      getLatestSessionByType.mockResolvedValue(existingInterviewSession);
      ProblemService.createInterviewSession = jest.fn().mockResolvedValue({
        problems: mockProblems,
        session_type: 'full-interview',
        interviewConfig: { timeLimit: 60 }
      });

      const result = await SessionService.refreshSession('full-interview', true);

      // Verify contract: session type is preserved
      expect(result.session_type).toBe('full-interview');
      expect(ProblemService.createInterviewSession).toHaveBeenCalledWith('full-interview');
    });

    // CONTRACT: Does not affect sessions of other types
    it("should not affect sessions of other types when regenerating", async () => {
      // Mock: No interview session exists
      getLatestSessionByType.mockResolvedValue(null);

      // Try to regenerate interview session when none exists
      const result = await SessionService.refreshSession('interview-like', true);

      // Verify: Returns null without creating anything
      expect(result).toBeNull();
      // Verify: updateSessionInDB was not called (no standard session should be affected)
      expect(updateSessionInDB).not.toHaveBeenCalled();
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
  runRefreshSessionTests();
});