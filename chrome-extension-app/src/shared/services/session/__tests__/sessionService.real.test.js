/**
 * Tests for sessionService.js
 *
 * Focuses on: isSessionTypeCompatible, detectSessionTypeMismatch,
 * checkAndCompleteSession, resumeSession, createNewSession,
 * getOrCreateSession, refreshSession, skipProblem,
 * updateSessionStateOnCompletion, and analytics delegations.
 */

// ---------------------------------------------------------------------------
// Mocks (hoisted before imports)
// ---------------------------------------------------------------------------
jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock('../../../db/stores/sessions.js', () => ({
  getSessionById: jest.fn(),
  getLatestSession: jest.fn(),
  getLatestSessionByType: jest.fn(),
  saveSessionToStorage: jest.fn().mockResolvedValue(undefined),
  saveNewSessionToDB: jest.fn().mockResolvedValue(undefined),
  updateSessionInDB: jest.fn().mockResolvedValue(undefined),
  deleteSessionFromDB: jest.fn().mockResolvedValue(undefined),
  getOrCreateSessionAtomic: jest.fn(),
  getSessionPerformance: jest.fn(),
  evaluateDifficultyProgression: jest.fn(),
}));

jest.mock('../../problem/problemService.js', () => ({
  ProblemService: {
    createSession: jest.fn(),
    createInterviewSession: jest.fn(),
  },
}));

jest.mock('../../problem/problemNormalizer.js', () => ({
  normalizeProblem: jest.fn((p) => ({ ...p, normalized: true })),
}));

jest.mock('../../storage/storageService.js', () => ({
  StorageService: {
    getSettings: jest.fn().mockResolvedValue({ sessionLength: 5 }),
    getSessionState: jest.fn().mockResolvedValue(null),
    setSessionState: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../focus/focusCoordinationService.js', () => ({
  FocusCoordinationService: {
    getFocusDecision: jest.fn().mockResolvedValue({ action: 'keep' }),
    updateSessionState: jest.fn((state) => state),
  },
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-fixed'),
}));

jest.mock('../../storage/indexedDBRetryService.js', () => ({
  IndexedDBRetryService: jest.fn().mockImplementation(() => ({
    executeWithRetry: jest.fn((fn) => fn()),
    quickTimeout: 5000,
  })),
}));

jest.mock('../sessionSummaryHelpers.js', () => ({
  createEmptySessionSummary: jest.fn((id) => ({ session_id: id, performance: { accuracy: 0 } })),
  createAdHocSessionSummary: jest.fn((s) => ({ session_id: s.id, performance: { accuracy: 0 } })),
  getMasteryDeltas: jest.fn().mockResolvedValue({ preSessionMasteryMap: new Map() }),
  updateRelationshipsAndGetPostMastery: jest.fn().mockResolvedValue({
    postSessionTagMastery: [],
    postSessionMasteryMap: new Map(),
  }),
  getPerformanceMetrics: jest.fn().mockResolvedValue({
    accuracy: 0.8,
    avgTime: 120,
    strongTags: [],
    weakTags: [],
    timingFeedback: {},
  }),
  storeSessionSummary: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../sessionAnalyticsHelpers.js', () => ({
  calculateMasteryDeltas: jest.fn(() => []),
  analyzeSessionDifficulty: jest.fn().mockResolvedValue({
    predominantDifficulty: 'Medium',
    totalProblems: 2,
    percentages: {},
  }),
  generateSessionInsights: jest.fn(() => ({ strengths: [], improvements: [] })),
  logSessionAnalytics: jest.fn(),
  updateSessionStateWithPerformance: jest.fn().mockResolvedValue(undefined),
}));

import { SessionService } from '../sessionService.js';
import {
  getSessionById,
  getLatestSession,
  getLatestSessionByType,
  saveSessionToStorage,
  saveNewSessionToDB,
  updateSessionInDB,
  deleteSessionFromDB,
  getOrCreateSessionAtomic,
} from '../../../db/stores/sessions.js';
import { ProblemService } from '../../problem/problemService.js';
import { StorageService } from '../../storage/storageService.js';
import { FocusCoordinationService } from '../../focus/focusCoordinationService.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SessionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================================================
  // isSessionTypeCompatible
  // ========================================================================
  describe('isSessionTypeCompatible', () => {
    it('should return false for null session', () => {
      expect(SessionService.isSessionTypeCompatible(null, 'standard')).toBe(false);
    });

    it('should treat missing session_type as standard', () => {
      expect(SessionService.isSessionTypeCompatible({}, 'standard')).toBe(true);
    });

    it('should allow standard with standard', () => {
      expect(SessionService.isSessionTypeCompatible(
        { session_type: 'standard' }, 'standard'
      )).toBe(true);
    });

    it('should allow standard with tracking (both in standard group)', () => {
      expect(SessionService.isSessionTypeCompatible(
        { session_type: 'tracking' }, 'standard'
      )).toBe(true);
    });

    it('should allow tracking with tracking', () => {
      expect(SessionService.isSessionTypeCompatible(
        { session_type: 'tracking' }, 'tracking'
      )).toBe(true);
    });

    it('should allow standard session with interview-like expected (mixed standard)', () => {
      // standard expected = 'standard' makes allowMixedStandard true
      expect(SessionService.isSessionTypeCompatible(
        { session_type: 'standard' }, 'interview-like'
      )).toBe(true);
    });

    it('should allow interview-like with standard expected (mixed)', () => {
      expect(SessionService.isSessionTypeCompatible(
        { session_type: 'interview-like' }, 'standard'
      )).toBe(true);
    });

    it('should allow exact interview-like match', () => {
      expect(SessionService.isSessionTypeCompatible(
        { session_type: 'interview-like' }, 'interview-like'
      )).toBe(true);
    });

    it('should NOT allow interview-like with full-interview', () => {
      expect(SessionService.isSessionTypeCompatible(
        { session_type: 'interview-like' }, 'full-interview'
      )).toBe(false);
    });

    it('should NOT allow full-interview with interview-like', () => {
      expect(SessionService.isSessionTypeCompatible(
        { session_type: 'full-interview' }, 'interview-like'
      )).toBe(false);
    });

    it('should allow full-interview with full-interview (exact match)', () => {
      expect(SessionService.isSessionTypeCompatible(
        { session_type: 'full-interview' }, 'full-interview'
      )).toBe(true);
    });

    it('should treat null expected as standard', () => {
      expect(SessionService.isSessionTypeCompatible(
        { session_type: 'standard' }, null
      )).toBe(true);
    });
  });

  // ========================================================================
  // detectSessionTypeMismatch
  // ========================================================================
  describe('detectSessionTypeMismatch', () => {
    it('should return hasMismatch:false for null session', () => {
      const result = SessionService.detectSessionTypeMismatch(null, 'standard');
      expect(result.hasMismatch).toBe(false);
      expect(result.reason).toBe('no_session');
    });

    it('should return hasMismatch:false for compatible session', () => {
      const result = SessionService.detectSessionTypeMismatch(
        { id: 's1', session_type: 'standard', status: 'in_progress' },
        'standard'
      );
      expect(result.hasMismatch).toBe(false);
      expect(result.reason).toBe('compatible');
    });

    it('should return hasMismatch:true for incompatible session', () => {
      const result = SessionService.detectSessionTypeMismatch(
        { id: 's1', session_type: 'interview-like', status: 'in_progress' },
        'full-interview'
      );
      expect(result.hasMismatch).toBe(true);
      expect(result.reason).toBe('type_mismatch');
      expect(result.sessionType).toBe('interview-like');
      expect(result.expectedType).toBe('full-interview');
    });

    it('should include session details in mismatch info', () => {
      const result = SessionService.detectSessionTypeMismatch(
        { id: 'sess-123', session_type: 'full-interview', status: 'in_progress' },
        'interview-like'
      );
      expect(result.sessionId).toBe('sess-123');
      expect(result.sessionStatus).toBe('in_progress');
      expect(result.details).toContain('mismatch');
    });
  });

  // ========================================================================
  // checkAndCompleteSession
  // ========================================================================
  describe('checkAndCompleteSession', () => {
    it('should return false for null sessionId', async () => {
      const result = await SessionService.checkAndCompleteSession(null);
      expect(result).toBe(false);
    });

    it('should return false for empty string sessionId', async () => {
      const result = await SessionService.checkAndCompleteSession('');
      expect(result).toBe(false);
    });

    it('should return false when session is not found', async () => {
      getSessionById.mockResolvedValue(null);
      const result = await SessionService.checkAndCompleteSession('nonexistent');
      expect(result).toBe(false);
    });

    it('should return empty array for already completed session', async () => {
      getSessionById.mockResolvedValue({
        id: 's1',
        status: 'completed',
        problems: [],
        attempts: [],
      });

      const result = await SessionService.checkAndCompleteSession('s1');
      expect(result).toEqual([]);
    });

    it('should return unattempted problems when not all problems are attempted', async () => {
      getSessionById.mockResolvedValue({
        id: 's1',
        status: 'in_progress',
        problems: [
          { leetcode_id: 1, title: 'Two Sum' },
          { leetcode_id: 2, title: 'Add Two Numbers' },
        ],
        attempts: [
          { leetcode_id: 1, success: true, time_spent: 300 },
        ],
      });

      const result = await SessionService.checkAndCompleteSession('s1');
      expect(result).toHaveLength(1);
      expect(result[0].leetcode_id).toBe(2);
    });

    it('should mark session as completed when all problems attempted', async () => {
      getSessionById.mockResolvedValue({
        id: 's1',
        status: 'in_progress',
        problems: [
          { leetcode_id: 1, title: 'Two Sum' },
          { leetcode_id: 2, title: 'Add Two Numbers' },
        ],
        attempts: [
          { leetcode_id: 1, success: true, time_spent: 300 },
          { leetcode_id: 2, success: false, time_spent: 600 },
        ],
      });

      const result = await SessionService.checkAndCompleteSession('s1');
      expect(result).toEqual([]);
      expect(updateSessionInDB).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          accuracy: 0.5,
        })
      );
    });

    it('should calculate correct accuracy', async () => {
      getSessionById.mockResolvedValue({
        id: 's1',
        status: 'in_progress',
        problems: [
          { leetcode_id: 1, title: 'P1' },
          { leetcode_id: 2, title: 'P2' },
          { leetcode_id: 3, title: 'P3' },
        ],
        attempts: [
          { leetcode_id: 1, success: true, time_spent: 100 },
          { leetcode_id: 2, success: true, time_spent: 200 },
          { leetcode_id: 3, success: false, time_spent: 300 },
        ],
      });

      await SessionService.checkAndCompleteSession('s1');
      expect(updateSessionInDB).toHaveBeenCalledWith(
        expect.objectContaining({
          accuracy: 2/3,
        })
      );
    });

    it('should calculate duration in minutes', async () => {
      getSessionById.mockResolvedValue({
        id: 's1',
        status: 'in_progress',
        problems: [{ leetcode_id: 1, title: 'P1' }],
        attempts: [
          { leetcode_id: 1, success: true, time_spent: 120 }, // 120 seconds = 2 minutes
        ],
      });

      await SessionService.checkAndCompleteSession('s1');
      expect(updateSessionInDB).toHaveBeenCalledWith(
        expect.objectContaining({ duration: 2 })
      );
    });

    it('should throw for problem missing valid leetcode_id', async () => {
      getSessionById.mockResolvedValue({
        id: 's1',
        status: 'in_progress',
        problems: [
          { leetcode_id: 'invalid', title: 'Bad Problem' },
        ],
        attempts: [],
      });

      await expect(SessionService.checkAndCompleteSession('s1')).rejects.toThrow(
        'missing valid leetcode_id'
      );
    });
  });

  // ========================================================================
  // resumeSession
  // ========================================================================
  describe('resumeSession', () => {
    it('should return null when no in_progress session found', async () => {
      getLatestSessionByType.mockResolvedValue(null);

      const result = await SessionService.resumeSession('standard');
      expect(result).toBeNull();
    });

    it('should return session when compatible session found', async () => {
      const session = {
        id: 'sess-1',
        session_type: 'standard',
        status: 'in_progress',
      };
      getLatestSessionByType.mockResolvedValue(session);

      const result = await SessionService.resumeSession('standard');
      expect(result).toEqual(expect.objectContaining({ id: 'sess-1' }));
      expect(saveSessionToStorage).toHaveBeenCalledWith(session);
    });

    it('should return null when session type is incompatible', async () => {
      const session = {
        id: 'sess-1',
        session_type: 'interview-like',
        status: 'in_progress',
      };
      getLatestSessionByType.mockResolvedValue(session);

      const result = await SessionService.resumeSession('full-interview');
      expect(result).toBeNull();
    });

    it('should initialize currentProblemIndex if missing', async () => {
      const session = {
        id: 'sess-1',
        session_type: 'standard',
        status: 'in_progress',
      };
      getLatestSessionByType.mockResolvedValue(session);

      const result = await SessionService.resumeSession('standard');
      expect(result.currentProblemIndex).toBe(0);
    });

    it('should preserve existing currentProblemIndex', async () => {
      const session = {
        id: 'sess-1',
        session_type: 'standard',
        status: 'in_progress',
        currentProblemIndex: 3,
      };
      getLatestSessionByType.mockResolvedValue(session);

      const result = await SessionService.resumeSession('standard');
      expect(result.currentProblemIndex).toBe(3);
    });
  });

  // ========================================================================
  // createNewSession
  // ========================================================================
  describe('createNewSession', () => {
    it('should create a standard session with problems', async () => {
      getLatestSessionByType.mockResolvedValue(null);
      ProblemService.createSession.mockResolvedValue([
        { leetcode_id: 1, title: 'Two Sum' },
        { leetcode_id: 2, title: 'Add Two Numbers' },
      ]);

      const session = await SessionService.createNewSession('standard');

      expect(session).toBeDefined();
      expect(session.id).toBe('test-uuid-fixed');
      expect(session.status).toBe('in_progress');
      expect(session.session_type).toBe('standard');
      expect(session.origin).toBe('generator');
      expect(session.problems).toHaveLength(2);
      expect(session.attempts).toEqual([]);
    });

    it('should return null when no problems available', async () => {
      getLatestSessionByType.mockResolvedValue(null);
      ProblemService.createSession.mockResolvedValue([]);

      const session = await SessionService.createNewSession('standard');
      expect(session).toBeNull();
    });

    it('should create interview session with config', async () => {
      getLatestSessionByType.mockResolvedValue(null);
      ProblemService.createInterviewSession.mockResolvedValue({
        problems: [{ leetcode_id: 1, title: 'P1' }],
        session_type: 'interview-like',
        interviewConfig: { hintsEnabled: false, timePressure: 50 },
        interviewMetrics: {},
        createdAt: '2024-01-01',
      });

      const session = await SessionService.createNewSession('interview-like');

      expect(session).toBeDefined();
      expect(session.session_type).toBe('interview-like');
      expect(session.interviewConfig).toBeDefined();
      expect(session.interviewConfig.hintsEnabled).toBe(false);
    });

    it('should mark existing in_progress sessions as completed', async () => {
      const existingSession = {
        id: 'old-session',
        status: 'in_progress',
        session_type: 'standard',
      };
      getLatestSessionByType.mockResolvedValue(existingSession);
      ProblemService.createSession.mockResolvedValue([
        { leetcode_id: 1, title: 'P1' },
      ]);

      await SessionService.createNewSession('standard');

      expect(updateSessionInDB).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'old-session',
          status: 'completed',
        })
      );
    });
  });

  // ========================================================================
  // getOrCreateSession
  // ========================================================================
  describe('getOrCreateSession', () => {
    it('should return existing session from atomic query', async () => {
      const existingSession = {
        id: 'existing-123',
        session_type: 'standard',
        status: 'in_progress',
      };
      getOrCreateSessionAtomic.mockResolvedValue(existingSession);
      StorageService.getSettings.mockResolvedValue({ sessionLength: 5 });

      const result = await SessionService.getOrCreateSession('standard');
      expect(result.id).toBe('existing-123');
    });

    it('should create new session when none exists', async () => {
      getOrCreateSessionAtomic.mockResolvedValue(null);
      getLatestSessionByType.mockResolvedValue(null);
      StorageService.getSettings.mockResolvedValue({ sessionLength: 5 });
      ProblemService.createSession.mockResolvedValue([
        { leetcode_id: 1, title: 'P1' },
      ]);

      const result = await SessionService.getOrCreateSession('standard');
      expect(result).toBeDefined();
      expect(result.session_type).toBe('standard');
    });
  });

  // ========================================================================
  // refreshSession
  // ========================================================================
  describe('refreshSession', () => {
    it('should create fresh session when no existing session and forceNew=false', async () => {
      getLatestSessionByType.mockResolvedValue(null);
      ProblemService.createSession.mockResolvedValue([
        { leetcode_id: 1, title: 'P1' },
      ]);

      const result = await SessionService.refreshSession('standard', false);
      expect(result).toBeDefined();
      expect(result.session_type).toBe('standard');
    });

    it('should return null when forceNew=true but no existing session', async () => {
      getLatestSessionByType.mockResolvedValue(null);

      const result = await SessionService.refreshSession('standard', true);
      expect(result).toBeNull();
    });

    it('should delete existing session and create new when forceNew=true', async () => {
      const existingSession = {
        id: 'old-sess',
        session_type: 'standard',
        status: 'in_progress',
      };
      getLatestSessionByType.mockResolvedValueOnce(existingSession); // resumeSession call
      getLatestSessionByType.mockResolvedValueOnce(null); // createNewSession call
      ProblemService.createSession.mockResolvedValue([
        { leetcode_id: 1, title: 'P1' },
      ]);

      const result = await SessionService.refreshSession('standard', true);
      expect(deleteSessionFromDB).toHaveBeenCalledWith('old-sess');
      expect(result).toBeDefined();
    });
  });

  // ========================================================================
  // skipProblem
  // ========================================================================
  describe('skipProblem', () => {
    it('should return null when no session exists', async () => {
      getLatestSession.mockResolvedValue(null);

      const result = await SessionService.skipProblem(123);
      expect(result).toBeNull();
    });

    it('should remove skipped problem from session', async () => {
      const session = {
        id: 's1',
        problems: [
          { leetcode_id: 1, title: 'P1' },
          { leetcode_id: 2, title: 'P2' },
        ],
      };
      getLatestSession.mockResolvedValue(session);

      const result = await SessionService.skipProblem(1);
      expect(result.problems).toHaveLength(1);
      expect(result.problems[0].leetcode_id).toBe(2);
    });

    it('should add replacement problem when provided', async () => {
      const session = {
        id: 's1',
        problems: [
          { leetcode_id: 1, title: 'P1' },
          { leetcode_id: 2, title: 'P2' },
        ],
      };
      getLatestSession.mockResolvedValue(session);

      const replacement = { leetcode_id: 3, title: 'Replacement' };
      const result = await SessionService.skipProblem(1, replacement);

      expect(result.problems).toHaveLength(2);
      // Last problem should be the normalized replacement
      const lastProblem = result.problems[result.problems.length - 1];
      expect(lastProblem.normalized).toBe(true);
    });

    it('should save session to storage after skip', async () => {
      const session = {
        id: 's1',
        problems: [{ leetcode_id: 1, title: 'P1' }],
      };
      getLatestSession.mockResolvedValue(session);

      await SessionService.skipProblem(1);
      expect(saveSessionToStorage).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // updateSessionStateOnCompletion
  // ========================================================================
  describe('updateSessionStateOnCompletion', () => {
    it('should increment num_sessions_completed', async () => {
      StorageService.getSessionState.mockResolvedValue({
        id: 'session_state',
        num_sessions_completed: 5,
      });

      await SessionService.updateSessionStateOnCompletion({
        accuracy: 0.8,
      });

      expect(FocusCoordinationService.getFocusDecision).toHaveBeenCalled();
      expect(StorageService.setSessionState).toHaveBeenCalledWith(
        'session_state',
        expect.objectContaining({
          num_sessions_completed: 6,
        })
      );
    });

    it('should create initial session state when none exists', async () => {
      StorageService.getSessionState.mockResolvedValue(null);

      await SessionService.updateSessionStateOnCompletion({ accuracy: 0.5 });

      expect(StorageService.setSessionState).toHaveBeenCalledWith(
        'session_state',
        expect.objectContaining({
          num_sessions_completed: 1,
        })
      );
    });

    it('should track last_progress_date when accuracy is high', async () => {
      StorageService.getSessionState.mockResolvedValue({
        id: 'session_state',
        num_sessions_completed: 0,
        last_performance: { accuracy: 0 },
      });

      await SessionService.updateSessionStateOnCompletion({ accuracy: 0.9 });

      expect(StorageService.setSessionState).toHaveBeenCalledWith(
        'session_state',
        expect.objectContaining({
          last_progress_date: expect.any(String),
        })
      );
    });

    it('should handle focus coordination error gracefully', async () => {
      StorageService.getSessionState.mockResolvedValue({
        id: 'session_state',
        num_sessions_completed: 0,
      });
      FocusCoordinationService.getFocusDecision.mockRejectedValue(new Error('focus error'));

      // Should not throw
      await SessionService.updateSessionStateOnCompletion({ accuracy: 0.5 });
      // Should still save basic state
      expect(StorageService.setSessionState).toHaveBeenCalled();
    });

    it('should not throw when entire function fails', async () => {
      StorageService.getSessionState.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await SessionService.updateSessionStateOnCompletion({ accuracy: 0.5 });
    });
  });

  // ========================================================================
  // summarizeSessionPerformance
  // ========================================================================
  describe('summarizeSessionPerformance', () => {
    it('should return empty summary for session without attempts', async () => {
      const result = await SessionService.summarizeSessionPerformance({
        id: 's1',
        attempts: [],
        problems: [],
      });

      expect(result.session_id).toBe('s1');
    });

    it('should return ad-hoc summary for session with attempts but no problems', async () => {
      const result = await SessionService.summarizeSessionPerformance({
        id: 's2',
        attempts: [{ leetcode_id: 1, success: true }],
        problems: [],
      });

      expect(result.session_id).toBe('s2');
    });

    it('should return comprehensive summary for full session', async () => {
      const result = await SessionService.summarizeSessionPerformance({
        id: 's3',
        attempts: [{ leetcode_id: 1, success: true, time_spent: 120 }],
        problems: [{ leetcode_id: 1, title: 'P1' }],
      });

      expect(result).toHaveProperty('session_id', 's3');
      expect(result).toHaveProperty('performance');
      expect(result).toHaveProperty('mastery_progression');
      expect(result).toHaveProperty('difficulty_analysis');
      expect(result).toHaveProperty('insights');
    });
  });

  // ========================================================================
  // Analytics delegations
  // ========================================================================
  describe('analytics delegations', () => {
    it('calculateMasteryDeltas should delegate to helper', () => {
      const result = SessionService.calculateMasteryDeltas(new Map(), new Map());
      expect(result).toEqual([]);
    });

    it('analyzeSessionDifficulty should delegate to helper', async () => {
      const result = await SessionService.analyzeSessionDifficulty({ id: 's1' });
      expect(result).toHaveProperty('predominantDifficulty');
    });

    it('generateSessionInsights should delegate to helper', () => {
      const result = SessionService.generateSessionInsights({}, [], {});
      expect(result).toHaveProperty('strengths');
    });

    it('logSessionAnalytics should delegate to helper', () => {
      SessionService.logSessionAnalytics({});
      // Just verifying no error
    });
  });
});
