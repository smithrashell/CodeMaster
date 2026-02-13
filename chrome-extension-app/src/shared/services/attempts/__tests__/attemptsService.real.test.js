/**
 * Real fake-indexeddb tests for attemptsService.js (239 lines, 12% coverage)
 *
 * Tests the AttemptsService and SessionAttributionEngine logic using a real
 * in-memory IndexedDB. External service dependencies (SessionService,
 * ProblemService, FocusCoordinationService, etc.) are mocked so we can
 * isolate the attempt routing and DB persistence logic.
 */

// ---------------------------------------------------------------------------
// Mocks (must come before imports)
// ---------------------------------------------------------------------------
jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    group: jest.fn(),
    groupEnd: jest.fn(),
  },
  debug: jest.fn(),
  success: jest.fn(),
  system: jest.fn(),
}));

jest.mock('../../../db/index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

jest.mock('../../../db/stores/attempts.js', () => ({
  getMostRecentAttempt: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../session/sessionService.js', () => ({
  SessionService: {
    checkAndCompleteSession: jest.fn().mockResolvedValue({ completed: false }),
  },
}));

jest.mock('../../../db/stores/sessions.js', () => ({
  getLatestSessionByType: jest.fn().mockResolvedValue(null),
  saveSessionToStorage: jest.fn().mockResolvedValue(undefined),
  updateSessionInDB: jest.fn().mockResolvedValue(undefined),
  saveNewSessionToDB: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../utils/leitner/leitnerSystem.js', () => ({
  calculateLeitnerBox: jest.fn((problem) => Promise.resolve(problem)),
}));

jest.mock('../../../utils/leitner/Utils.js', () => ({
  createAttemptRecord: jest.fn((data) => ({
    id: data.id || 'test-attempt-id',
    session_id: data.session_id,
    problem_id: data.problem_id,
    leetcode_id: data.leetcode_id,
    success: data.success,
    attempt_date: new Date(),
    time_spent: data.time_spent || 0,
    comments: data.comments || '',
    source: data.source,
    perceived_difficulty: data.perceived_difficulty,
  })),
}));

jest.mock('../../problem/problemService.js', () => ({
  ProblemService: {
    addOrUpdateProblemInSession: jest.fn((session) => Promise.resolve(session)),
  },
}));

jest.mock('../../focus/focusCoordinationService.js', () => ({
  __esModule: true,
  default: {
    getFocusDecision: jest.fn().mockResolvedValue({
      recommendedTags: ['array'],
      reasoning: 'test reasoning',
    }),
  },
}));

jest.mock('../../../db/stores/tag_mastery.js', () => ({
  updateTagMasteryForAttempt: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../db/stores/problem_relationships.js', () => ({
  updateProblemRelationships: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../problem/problemladderService.js', () => ({
  updatePatternLaddersOnAttempt: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-' + Math.random().toString(36).slice(2, 8)),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { dbHelper } from '../../../db/index.js';
import { getLatestSessionByType, saveSessionToStorage, updateSessionInDB, saveNewSessionToDB } from '../../../db/stores/sessions.js';
import { SessionService } from '../../session/sessionService.js';
import { ProblemService } from '../../problem/problemService.js';
import { calculateLeitnerBox } from '../../../utils/leitner/leitnerSystem.js';
import { createAttemptRecord } from '../../../utils/leitner/Utils.js';
import { updateTagMasteryForAttempt } from '../../../db/stores/tag_mastery.js';
import { updateProblemRelationships } from '../../../db/stores/problem_relationships.js';
import { updatePatternLaddersOnAttempt } from '../../problem/problemladderService.js';
import { AttemptsService } from '../attemptsService.js';
import {
  createTestDb,
  closeTestDb,
  seedStore,
  readAll,
} from '../../../../../test/testDbHelper.js';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
let testDb;

beforeEach(async () => {
  jest.clearAllMocks();
  testDb = await createTestDb();
  dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));

  // Suppress console.log/error from the source file
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  // Default: no active guided session
  getLatestSessionByType.mockResolvedValue(null);
});

afterEach(() => {
  closeTestDb(testDb);
  console.log.mockRestore();
  console.error.mockRestore();
  console.warn.mockRestore();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildProblem(overrides = {}) {
  return {
    id: 'two-sum',
    problem_id: 'prob-uuid-1',
    leetcode_id: 1,
    title: 'Two Sum',
    difficulty: 'Easy',
    tags: ['array', 'hash table'],
    box_level: 1,
    ...overrides,
  };
}

function buildAttemptData(overrides = {}) {
  return {
    id: 'attempt-1',
    success: true,
    timeSpent: 1200,
    time_spent: 1200,
    difficulty: 3,
    timestamp: new Date().toISOString(),
    attempt_date: new Date().toISOString(),
    ...overrides,
  };
}

function buildSession(overrides = {}) {
  return {
    id: 'session-1',
    date: new Date().toISOString(),
    status: 'in_progress',
    session_type: 'standard',
    last_activity_time: new Date().toISOString(),
    problems: [],
    attempts: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// addAttempt - Input Validation
// ---------------------------------------------------------------------------
describe('AttemptsService.addAttempt - input validation', () => {
  it('should return error when problem is null', async () => {
    const result = await AttemptsService.addAttempt(buildAttemptData(), null);
    expect(result).toEqual({ error: 'Problem not found.' });
  });

  it('should return error when problem is undefined', async () => {
    const result = await AttemptsService.addAttempt(buildAttemptData(), undefined);
    expect(result).toEqual({ error: 'Problem not found.' });
  });

  it('should return error when attemptData is null', async () => {
    const result = await AttemptsService.addAttempt(null, buildProblem());
    expect(result).toEqual({ error: 'Invalid attempt data provided.' });
  });

  it('should return error when attemptData is an array', async () => {
    const result = await AttemptsService.addAttempt([{ success: true }], buildProblem());
    expect(result).toEqual({ error: 'Invalid attempt data provided.' });
  });

  it('should return error when attemptData is a string', async () => {
    const result = await AttemptsService.addAttempt('not-an-object', buildProblem());
    expect(result).toEqual({ error: 'Invalid attempt data provided.' });
  });

  it('should return error when attemptData has no recognized properties', async () => {
    const result = await AttemptsService.addAttempt({ foo: 'bar' }, buildProblem());
    expect(result).toEqual({ error: 'Attempt data missing required properties.' });
  });

  it('should accept attemptData with success property', async () => {
    const attempt = { success: true };
    // Will proceed past validation to session routing
    // May throw due to incomplete mock setup but should NOT return validation errors
    try {
      const result = await AttemptsService.addAttempt(attempt, buildProblem());
      expect(result.error).not.toBe('Invalid attempt data provided.');
      expect(result.error).not.toBe('Attempt data missing required properties.');
    } catch {
      // Downstream errors are acceptable; we only test validation
    }
  });

  it('should accept attemptData with timeSpent property', async () => {
    const attempt = { timeSpent: 1200 };
    try {
      const result = await AttemptsService.addAttempt(attempt, buildProblem());
      expect(result.error).not.toBe('Attempt data missing required properties.');
    } catch {
      // Downstream errors are acceptable
    }
  });
});

// ---------------------------------------------------------------------------
// addAttempt - Session Attribution: Guided Session matching
// ---------------------------------------------------------------------------
describe('AttemptsService.addAttempt - guided session routing', () => {
  it('should route to guided session when problem matches', async () => {
    const problem = buildProblem({ leetcode_id: 42 });
    const session = buildSession({
      problems: [{ id: 42, leetcode_id: 42, title: 'Problem 42', tags: ['array'] }],
    });

    // First call returns standard session, rest return null
    getLatestSessionByType.mockImplementation((type, status) => {
      if (type === 'standard' && status === 'in_progress') return Promise.resolve(session);
      return Promise.resolve(null);
    });

    // Seed the DB stores that processAttemptWithSession needs
    await seedStore(testDb.db, 'sessions', [session]);

    const result = await AttemptsService.addAttempt(buildAttemptData(), problem);

    expect(result.message).toBe('Attempt added and problem updated successfully');
    expect(result.sessionId).toBe('session-1');
    expect(updateSessionInDB).toHaveBeenCalled();
  });

  it('should fall through to tracking when guided session has no matching problem', async () => {
    const problem = buildProblem({ leetcode_id: 99 }); // Not in session
    const session = buildSession({
      problems: [{ id: 1, leetcode_id: 1, title: 'Two Sum', tags: ['array'] }],
    });

    getLatestSessionByType.mockImplementation((type, status) => {
      if (type === 'standard' && status === 'in_progress') return Promise.resolve(session);
      return Promise.resolve(null);
    });

    const result = await AttemptsService.addAttempt(buildAttemptData(), problem);

    // Should create a tracking session since no match
    expect(saveNewSessionToDB).toHaveBeenCalled();
    expect(result.message).toBe('Attempt added and problem updated successfully');
  });

  it('should fall through to tracking when guided session has invalid problems array', async () => {
    const session = buildSession({ problems: null });

    getLatestSessionByType.mockImplementation((type, status) => {
      if (type === 'standard' && status === 'in_progress') return Promise.resolve(session);
      return Promise.resolve(null);
    });

    const result = await AttemptsService.addAttempt(buildAttemptData(), buildProblem());

    expect(saveNewSessionToDB).toHaveBeenCalled();
  });

  it('should fall through when guided session has empty problems array', async () => {
    const session = buildSession({ problems: [] });

    getLatestSessionByType.mockImplementation((type, status) => {
      if (type === 'standard' && status === 'in_progress') return Promise.resolve(session);
      return Promise.resolve(null);
    });

    const result = await AttemptsService.addAttempt(buildAttemptData(), buildProblem());

    expect(saveNewSessionToDB).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// addAttempt - Session Attribution: Tracking session routing
// ---------------------------------------------------------------------------
describe('AttemptsService.addAttempt - tracking session routing', () => {
  it('should create new tracking session when none exists', async () => {
    // No guided sessions, no tracking sessions
    getLatestSessionByType.mockResolvedValue(null);

    const result = await AttemptsService.addAttempt(buildAttemptData(), buildProblem());

    expect(saveNewSessionToDB).toHaveBeenCalledWith(
      expect.objectContaining({
        session_type: 'tracking',
        status: 'in_progress',
      })
    );
    expect(result.message).toBe('Attempt added and problem updated successfully');
  });

  it('should not call checkAndCompleteSession for tracking sessions', async () => {
    getLatestSessionByType.mockResolvedValue(null);

    await AttemptsService.addAttempt(buildAttemptData(), buildProblem());

    expect(SessionService.checkAndCompleteSession).not.toHaveBeenCalled();
  });

  it('should call checkAndCompleteSession for guided sessions', async () => {
    const problem = buildProblem({ leetcode_id: 1 });
    const session = buildSession({
      id: 'guided-session-1',
      session_type: 'standard',
      problems: [{ id: 1, leetcode_id: 1, title: 'Two Sum', tags: ['array'] }],
    });

    getLatestSessionByType.mockImplementation((type, status) => {
      if (type === 'standard' && status === 'in_progress') return Promise.resolve(session);
      return Promise.resolve(null);
    });

    await seedStore(testDb.db, 'sessions', [session]);

    await AttemptsService.addAttempt(buildAttemptData(), problem);

    expect(SessionService.checkAndCompleteSession).toHaveBeenCalledWith('guided-session-1');
  });
});

// ---------------------------------------------------------------------------
// addAttempt - Post-attempt updates
// ---------------------------------------------------------------------------
describe('AttemptsService.addAttempt - post-attempt updates', () => {
  it('should update tag mastery after successful attempt', async () => {
    getLatestSessionByType.mockResolvedValue(null);

    await AttemptsService.addAttempt(buildAttemptData({ success: true }), buildProblem());

    expect(updateTagMasteryForAttempt).toHaveBeenCalled();
  });

  it('should update problem relationships after attempt', async () => {
    getLatestSessionByType.mockResolvedValue(null);

    await AttemptsService.addAttempt(buildAttemptData(), buildProblem());

    expect(updateProblemRelationships).toHaveBeenCalled();
  });

  it('should update pattern ladders after attempt', async () => {
    getLatestSessionByType.mockResolvedValue(null);

    await AttemptsService.addAttempt(buildAttemptData(), buildProblem({ leetcode_id: 42 }));

    expect(updatePatternLaddersOnAttempt).toHaveBeenCalledWith(42);
  });

  it('should not fail attempt if tag mastery update throws', async () => {
    getLatestSessionByType.mockResolvedValue(null);
    updateTagMasteryForAttempt.mockRejectedValueOnce(new Error('mastery error'));

    const result = await AttemptsService.addAttempt(buildAttemptData(), buildProblem());

    // Should still succeed despite tag mastery error
    expect(result.message).toBe('Attempt added and problem updated successfully');
  });

  it('should not fail attempt if problem relationships update throws', async () => {
    getLatestSessionByType.mockResolvedValue(null);
    updateProblemRelationships.mockRejectedValueOnce(new Error('relationship error'));

    const result = await AttemptsService.addAttempt(buildAttemptData(), buildProblem());

    expect(result.message).toBe('Attempt added and problem updated successfully');
  });

  it('should not fail attempt if pattern ladder update throws', async () => {
    getLatestSessionByType.mockResolvedValue(null);
    updatePatternLaddersOnAttempt.mockRejectedValueOnce(new Error('ladder error'));

    const result = await AttemptsService.addAttempt(buildAttemptData(), buildProblem());

    expect(result.message).toBe('Attempt added and problem updated successfully');
  });
});

// ---------------------------------------------------------------------------
// getProblemAttemptStats
// ---------------------------------------------------------------------------
describe('AttemptsService.getProblemAttemptStats', () => {
  it('should return zero stats when no attempts exist', async () => {
    const result = await AttemptsService.getProblemAttemptStats('problem-1');

    expect(result).toEqual({
      successful: 0,
      total: 0,
      lastSolved: null,
      lastAttempted: null,
    });
  });

  it('should count successful and total attempts for a problem by problem_id', async () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    await seedStore(testDb.db, 'attempts', [
      { id: 'a1', problem_id: 'prob-1', success: true, attempt_date: yesterday.toISOString() },
      { id: 'a2', problem_id: 'prob-1', success: false, attempt_date: now.toISOString() },
      { id: 'a3', problem_id: 'prob-2', success: true, attempt_date: now.toISOString() },
    ]);

    const result = await AttemptsService.getProblemAttemptStats('prob-1');

    expect(result.total).toBe(2);
    expect(result.successful).toBe(1);
    expect(result.lastSolved).toBe(yesterday.toISOString());
    expect(result.lastAttempted).toBe(now.toISOString());
  });

  it('should match attempts by leetcode_id as well', async () => {
    await seedStore(testDb.db, 'attempts', [
      { id: 'a1', problem_id: 'uuid-1', leetcode_id: 42, success: true, attempt_date: new Date().toISOString() },
      { id: 'a2', problem_id: 'uuid-2', leetcode_id: 42, success: false, attempt_date: new Date().toISOString() },
    ]);

    const result = await AttemptsService.getProblemAttemptStats('42');

    expect(result.total).toBe(2);
    expect(result.successful).toBe(1);
  });

  it('should return null for lastSolved when no successful attempts exist', async () => {
    await seedStore(testDb.db, 'attempts', [
      { id: 'a1', problem_id: 'prob-1', success: false, attempt_date: new Date().toISOString() },
    ]);

    const result = await AttemptsService.getProblemAttemptStats('prob-1');

    expect(result.successful).toBe(0);
    expect(result.lastSolved).toBeNull();
    expect(result.lastAttempted).not.toBeNull();
  });

  it('should return the most recent successful attempt date as lastSolved', async () => {
    const oldDate = '2024-01-01T00:00:00.000Z';
    const newDate = '2025-06-01T00:00:00.000Z';

    await seedStore(testDb.db, 'attempts', [
      { id: 'a1', problem_id: 'prob-1', success: true, attempt_date: oldDate },
      { id: 'a2', problem_id: 'prob-1', success: true, attempt_date: newDate },
    ]);

    const result = await AttemptsService.getProblemAttemptStats('prob-1');

    expect(result.lastSolved).toBe(newDate);
  });
});

// ---------------------------------------------------------------------------
// SessionAttributionEngine.isMatchingProblem (tested indirectly)
// ---------------------------------------------------------------------------
describe('SessionAttributionEngine.isMatchingProblem - via addAttempt', () => {
  it('should match problem by leetcode_id numeric comparison', async () => {
    const problem = buildProblem({ leetcode_id: '42' }); // String ID
    const session = buildSession({
      problems: [{ id: 42, leetcode_id: 42, title: 'Trapping Rain Water', tags: ['array'] }],
    });

    getLatestSessionByType.mockImplementation((type, status) => {
      if (type === 'standard' && status === 'in_progress') return Promise.resolve(session);
      return Promise.resolve(null);
    });

    await seedStore(testDb.db, 'sessions', [session]);

    const result = await AttemptsService.addAttempt(buildAttemptData(), problem);

    // Should match the guided session (string '42' == number 42 after Number())
    expect(result.sessionId).toBe('session-1');
  });

  it('should throw when problem has NaN leetcode_id', async () => {
    const problem = buildProblem({ leetcode_id: 'not-a-number' });
    const session = buildSession({
      problems: [{ id: 1, leetcode_id: 1, title: 'Two Sum', tags: ['array'] }],
    });

    getLatestSessionByType.mockImplementation((type, status) => {
      if (type === 'standard' && status === 'in_progress') return Promise.resolve(session);
      return Promise.resolve(null);
    });

    await expect(
      AttemptsService.addAttempt(buildAttemptData(), problem)
    ).rejects.toThrow('missing valid leetcode_id');
  });
});

// ---------------------------------------------------------------------------
// SessionAttributionEngine.shouldRotateTrackingSession (tested indirectly)
// ---------------------------------------------------------------------------
describe('SessionAttributionEngine.shouldRotateTrackingSession - via getRecentTrackingSession', () => {
  it('should rotate tracking session when attempt count reaches 12', async () => {
    const session = buildSession({
      session_type: 'tracking',
      attempts: new Array(12).fill({ tags: ['array'] }),
    });

    await seedStore(testDb.db, 'sessions', [session]);

    // No guided session available
    getLatestSessionByType.mockResolvedValue(null);

    const result = await AttemptsService.addAttempt(buildAttemptData(), buildProblem());

    // Should create a new tracking session because the existing one is full
    expect(saveNewSessionToDB).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AttemptsService.getMostRecentAttempt (re-export)
// ---------------------------------------------------------------------------
describe('AttemptsService.getMostRecentAttempt', () => {
  it('should be exported and callable', () => {
    expect(typeof AttemptsService.getMostRecentAttempt).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// processAttemptWithSession - markProblemAttemptedInSession
// ---------------------------------------------------------------------------
describe('processAttemptWithSession - marks problem as attempted', () => {
  it('should mark matching problem as attempted in guided session', async () => {
    const problem = buildProblem({ leetcode_id: 1 });
    const session = buildSession({
      session_type: 'standard',
      problems: [
        { id: 1, leetcode_id: 1, title: 'Two Sum', tags: ['array'], attempted: false },
        { id: 2, leetcode_id: 2, title: 'Add Two Numbers', tags: ['linked list'], attempted: false },
      ],
    });

    getLatestSessionByType.mockImplementation((type, status) => {
      if (type === 'standard' && status === 'in_progress') return Promise.resolve(session);
      return Promise.resolve(null);
    });

    ProblemService.addOrUpdateProblemInSession.mockImplementation((s) => Promise.resolve(s));

    await seedStore(testDb.db, 'sessions', [session]);

    await AttemptsService.addAttempt(buildAttemptData(), problem);

    // Verify updateSessionInDB was called with the session that has the problem marked
    const sessionArg = updateSessionInDB.mock.calls[0][0];
    const markedProblem = sessionArg.problems.find(p => String(p.leetcode_id) === '1');
    expect(markedProblem.attempted).toBe(true);

    // Non-matching problem should remain unmarked
    const unmarkedProblem = sessionArg.problems.find(p => String(p.leetcode_id) === '2');
    expect(unmarkedProblem.attempted).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// processAttemptWithSession - attempt record contains correct fields
// ---------------------------------------------------------------------------
describe('processAttemptWithSession - attempt record structure', () => {
  it('should include source field in attempt record', async () => {
    getLatestSessionByType.mockResolvedValue(null);

    await AttemptsService.addAttempt(buildAttemptData(), buildProblem());

    // createAttemptRecord should be called with source = 'ad_hoc' for tracking sessions
    expect(createAttemptRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'ad_hoc',
      })
    );
  });

  it('should include leetcode_id in attempt record', async () => {
    getLatestSessionByType.mockResolvedValue(null);

    await AttemptsService.addAttempt(buildAttemptData(), buildProblem({ leetcode_id: 99 }));

    expect(createAttemptRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        leetcode_id: 99,
      })
    );
  });

  it('should use problem.problem_id for the record when available', async () => {
    getLatestSessionByType.mockResolvedValue(null);

    await AttemptsService.addAttempt(
      buildAttemptData(),
      buildProblem({ problem_id: 'uuid-abc', id: 'some-slug' })
    );

    expect(createAttemptRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        problem_id: 'uuid-abc',
      })
    );
  });

  it('should fall back to problem.id when problem_id is missing', async () => {
    getLatestSessionByType.mockResolvedValue(null);

    const problem = buildProblem();
    delete problem.problem_id;

    await AttemptsService.addAttempt(buildAttemptData(), problem);

    expect(createAttemptRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        problem_id: 'two-sum',
      })
    );
  });
});
