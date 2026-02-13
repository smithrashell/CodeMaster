/**
 * Comprehensive real-DB tests for hint_interactions.js
 *
 * Uses fake-indexeddb (via testDbHelper) so that real IndexedDB transactions,
 * cursors, indexes, and key ranges execute against an in-memory database.
 *
 * The hint_interactions store has keyPath 'id' with autoIncrement and indexes:
 *   by_problem_id, by_session_id, by_timestamp, by_hint_type, by_user_action,
 *   by_difficulty, by_box_level, by_problem_and_action (compound),
 *   by_hint_type_and_difficulty (compound)
 *
 * Covers:
 *   - saveHintInteraction
 *   - getInteractionsByProblem
 *   - getInteractionsBySession
 *   - getInteractionsByHintType
 *   - getInteractionsByAction
 *   - getInteractionsByDateRange
 *   - getInteractionsByDifficultyAndType
 *   - getAllInteractions
 *   - deleteOldInteractions
 *   - getInteractionStats
 *   - getHintEffectiveness
 */

// ---- mocks MUST come before any import that touches them ----

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
}));

jest.mock('../../index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

// ---- imports ----

import { createTestDb, closeTestDb, seedStore, readAll } from '../../../../../test/testDbHelper.js';
import { dbHelper } from '../../index.js';

import {
  saveHintInteraction,
  getInteractionsByProblem,
  getInteractionsBySession,
  getInteractionsByHintType,
  getInteractionsByAction,
  getInteractionsByDateRange,
  getInteractionsByDifficultyAndType,
  getAllInteractions,
  deleteOldInteractions,
  getInteractionStats,
  getHintEffectiveness,
} from '../hint_interactions.js';

// ---- helpers ----

function makeInteraction(overrides = {}) {
  return {
    problem_id: overrides.problem_id || 'prob-1',
    session_id: overrides.session_id || 'sess-1',
    timestamp: overrides.timestamp || new Date().toISOString(),
    hint_type: overrides.hint_type || 'contextual',
    user_action: overrides.user_action || 'clicked',
    problem_difficulty: overrides.problem_difficulty || 'Medium',
    box_level: overrides.box_level ?? 2,
    ...overrides,
  };
}

// ---- test setup ----

let testDb;

beforeEach(async () => {
  testDb = await createTestDb();
  dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
});

afterEach(() => {
  closeTestDb(testDb);
  jest.clearAllMocks();
});

// =========================================================================
// saveHintInteraction
// =========================================================================

describe('saveHintInteraction', () => {
  it('saves an interaction and returns it with an auto-generated id', async () => {
    const data = makeInteraction({ problem_id: 'p-save-1' });
    const result = await saveHintInteraction(data);

    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.problem_id).toBe('p-save-1');
  });

  it('assigns incrementing ids to successive interactions', async () => {
    const r1 = await saveHintInteraction(makeInteraction());
    const r2 = await saveHintInteraction(makeInteraction());

    expect(r2.id).toBeGreaterThan(r1.id);
  });

  it('persists all fields of the interaction', async () => {
    const data = makeInteraction({
      problem_id: 'p-full',
      session_id: 's-full',
      hint_type: 'primer',
      user_action: 'expanded',
      problem_difficulty: 'Hard',
      box_level: 5,
    });

    await saveHintInteraction(data);

    const all = await readAll(testDb.db, 'hint_interactions');
    expect(all).toHaveLength(1);
    expect(all[0].problem_id).toBe('p-full');
    expect(all[0].session_id).toBe('s-full');
    expect(all[0].hint_type).toBe('primer');
    expect(all[0].user_action).toBe('expanded');
    expect(all[0].problem_difficulty).toBe('Hard');
    expect(all[0].box_level).toBe(5);
  });
});

// =========================================================================
// getInteractionsByProblem
// =========================================================================

describe('getInteractionsByProblem', () => {
  it('returns interactions filtered by problem_id', async () => {
    await saveHintInteraction(makeInteraction({ problem_id: 'px' }));
    await saveHintInteraction(makeInteraction({ problem_id: 'px' }));
    await saveHintInteraction(makeInteraction({ problem_id: 'py' }));

    const results = await getInteractionsByProblem('px');
    expect(results).toHaveLength(2);
    expect(results.every(i => i.problem_id === 'px')).toBe(true);
  });

  it('returns an empty array when no interactions match', async () => {
    await saveHintInteraction(makeInteraction({ problem_id: 'px' }));
    const results = await getInteractionsByProblem('nonexistent');
    expect(results).toEqual([]);
  });

  it('returns an empty array when the store is empty', async () => {
    const results = await getInteractionsByProblem('px');
    expect(results).toEqual([]);
  });
});

// =========================================================================
// getInteractionsBySession
// =========================================================================

describe('getInteractionsBySession', () => {
  it('returns interactions filtered by session_id', async () => {
    await saveHintInteraction(makeInteraction({ session_id: 's1' }));
    await saveHintInteraction(makeInteraction({ session_id: 's1' }));
    await saveHintInteraction(makeInteraction({ session_id: 's2' }));

    const results = await getInteractionsBySession('s1');
    expect(results).toHaveLength(2);
    expect(results.every(i => i.session_id === 's1')).toBe(true);
  });

  it('returns an empty array when no interactions match the session_id', async () => {
    await saveHintInteraction(makeInteraction({ session_id: 's1' }));
    const results = await getInteractionsBySession('nonexistent');
    expect(results).toEqual([]);
  });

  it('returns an empty array when the store is empty', async () => {
    const results = await getInteractionsBySession('s1');
    expect(results).toEqual([]);
  });
});

// =========================================================================
// getInteractionsByHintType
// =========================================================================

describe('getInteractionsByHintType', () => {
  it('returns interactions filtered by hint_type', async () => {
    await saveHintInteraction(makeInteraction({ hint_type: 'contextual' }));
    await saveHintInteraction(makeInteraction({ hint_type: 'general' }));
    await saveHintInteraction(makeInteraction({ hint_type: 'contextual' }));

    const results = await getInteractionsByHintType('contextual');
    expect(results).toHaveLength(2);
    expect(results.every(i => i.hint_type === 'contextual')).toBe(true);
  });

  it('returns an empty array for a hint type that has no records', async () => {
    await saveHintInteraction(makeInteraction({ hint_type: 'contextual' }));
    const results = await getInteractionsByHintType('primer');
    expect(results).toEqual([]);
  });
});

// =========================================================================
// getInteractionsByAction
// =========================================================================

describe('getInteractionsByAction', () => {
  it('returns interactions filtered by user_action', async () => {
    await saveHintInteraction(makeInteraction({ user_action: 'clicked' }));
    await saveHintInteraction(makeInteraction({ user_action: 'dismissed' }));
    await saveHintInteraction(makeInteraction({ user_action: 'clicked' }));
    await saveHintInteraction(makeInteraction({ user_action: 'copied' }));

    const results = await getInteractionsByAction('clicked');
    expect(results).toHaveLength(2);
    expect(results.every(i => i.user_action === 'clicked')).toBe(true);
  });

  it('returns an empty array for an action with no records', async () => {
    await saveHintInteraction(makeInteraction({ user_action: 'clicked' }));
    const results = await getInteractionsByAction('expanded');
    expect(results).toEqual([]);
  });
});

// =========================================================================
// getInteractionsByDateRange
// =========================================================================

describe('getInteractionsByDateRange', () => {
  it('returns interactions within the specified date range', async () => {
    await saveHintInteraction(makeInteraction({ timestamp: '2025-01-15T10:00:00.000Z' }));
    await saveHintInteraction(makeInteraction({ timestamp: '2025-02-10T10:00:00.000Z' }));
    await saveHintInteraction(makeInteraction({ timestamp: '2025-03-20T10:00:00.000Z' }));

    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-02-28T23:59:59.999Z');

    const results = await getInteractionsByDateRange(start, end);
    expect(results).toHaveLength(2);
  });

  it('returns an empty array when no interactions fall within the range', async () => {
    await saveHintInteraction(makeInteraction({ timestamp: '2025-06-01T10:00:00.000Z' }));

    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-02-28T23:59:59.999Z');

    const results = await getInteractionsByDateRange(start, end);
    expect(results).toEqual([]);
  });

  it('includes boundary timestamps', async () => {
    const exactStart = '2025-03-01T00:00:00.000Z';
    const exactEnd = '2025-03-31T23:59:59.999Z';
    await saveHintInteraction(makeInteraction({ timestamp: exactStart }));
    await saveHintInteraction(makeInteraction({ timestamp: exactEnd }));

    const results = await getInteractionsByDateRange(
      new Date(exactStart),
      new Date(exactEnd)
    );
    expect(results).toHaveLength(2);
  });
});

// =========================================================================
// getInteractionsByDifficultyAndType
// =========================================================================

describe('getInteractionsByDifficultyAndType', () => {
  it('returns interactions matching both difficulty and hint type via compound index', async () => {
    await saveHintInteraction(makeInteraction({ hint_type: 'contextual', problem_difficulty: 'Easy' }));
    await saveHintInteraction(makeInteraction({ hint_type: 'contextual', problem_difficulty: 'Hard' }));
    await saveHintInteraction(makeInteraction({ hint_type: 'general', problem_difficulty: 'Easy' }));
    await saveHintInteraction(makeInteraction({ hint_type: 'contextual', problem_difficulty: 'Easy' }));

    const results = await getInteractionsByDifficultyAndType('Easy', 'contextual');
    expect(results).toHaveLength(2);
    expect(results.every(i => i.hint_type === 'contextual' && i.problem_difficulty === 'Easy')).toBe(true);
  });

  it('returns an empty array when no interactions match the compound key', async () => {
    await saveHintInteraction(makeInteraction({ hint_type: 'contextual', problem_difficulty: 'Easy' }));

    const results = await getInteractionsByDifficultyAndType('Hard', 'primer');
    expect(results).toEqual([]);
  });
});

// =========================================================================
// getAllInteractions
// =========================================================================

describe('getAllInteractions', () => {
  it('returns all interactions in the store', async () => {
    await saveHintInteraction(makeInteraction());
    await saveHintInteraction(makeInteraction());
    await saveHintInteraction(makeInteraction());

    const results = await getAllInteractions();
    expect(results).toHaveLength(3);
  });

  it('returns an empty array when the store is empty', async () => {
    const results = await getAllInteractions();
    expect(results).toEqual([]);
  });
});

// =========================================================================
// deleteOldInteractions
// =========================================================================

describe('deleteOldInteractions', () => {
  it('deletes interactions older than the cutoff date', async () => {
    await saveHintInteraction(makeInteraction({ timestamp: '2024-01-15T10:00:00.000Z' }));
    await saveHintInteraction(makeInteraction({ timestamp: '2024-06-15T10:00:00.000Z' }));
    await saveHintInteraction(makeInteraction({ timestamp: '2025-03-01T10:00:00.000Z' }));

    const cutoff = new Date('2025-01-01T00:00:00.000Z');
    const deletedCount = await deleteOldInteractions(cutoff);

    expect(deletedCount).toBe(2);

    const remaining = await getAllInteractions();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].timestamp).toBe('2025-03-01T10:00:00.000Z');
  });

  it('returns 0 when no interactions are older than cutoff', async () => {
    await saveHintInteraction(makeInteraction({ timestamp: '2025-06-01T10:00:00.000Z' }));

    const cutoff = new Date('2025-01-01T00:00:00.000Z');
    const deletedCount = await deleteOldInteractions(cutoff);

    expect(deletedCount).toBe(0);

    const remaining = await getAllInteractions();
    expect(remaining).toHaveLength(1);
  });

  it('returns 0 when the store is empty', async () => {
    const cutoff = new Date('2025-01-01T00:00:00.000Z');
    const deletedCount = await deleteOldInteractions(cutoff);
    expect(deletedCount).toBe(0);
  });

  it('deletes all interactions when cutoff is in the far future', async () => {
    await saveHintInteraction(makeInteraction({ timestamp: '2025-01-01T00:00:00.000Z' }));
    await saveHintInteraction(makeInteraction({ timestamp: '2025-06-01T00:00:00.000Z' }));
    await saveHintInteraction(makeInteraction({ timestamp: '2025-12-31T00:00:00.000Z' }));

    const cutoff = new Date('2099-01-01T00:00:00.000Z');
    const deletedCount = await deleteOldInteractions(cutoff);

    expect(deletedCount).toBe(3);

    const remaining = await getAllInteractions();
    expect(remaining).toHaveLength(0);
  });
});

// =========================================================================
// getInteractionStats
// =========================================================================

describe('getInteractionStats', () => {
  it('returns zeroed stats when no interactions exist', async () => {
    const stats = await getInteractionStats();

    expect(stats.totalInteractions).toBe(0);
    expect(stats.byAction).toEqual({});
    expect(stats.byHintType).toEqual({});
    expect(stats.byDifficulty).toEqual({});
    expect(stats.byBoxLevel).toEqual({});
    expect(stats.recentInteractions).toBe(0);
    expect(stats.uniqueProblems).toBe(0);
    expect(stats.uniqueSessions).toBe(0);
  });

  it('computes correct aggregate stats from multiple interactions', async () => {
    const now = new Date();
    const recentTimestamp = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(); // 1 day ago
    const oldTimestamp = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago

    await saveHintInteraction(makeInteraction({
      problem_id: 'p1', session_id: 's1',
      hint_type: 'contextual', user_action: 'clicked',
      problem_difficulty: 'Easy', box_level: 1,
      timestamp: recentTimestamp,
    }));
    await saveHintInteraction(makeInteraction({
      problem_id: 'p1', session_id: 's1',
      hint_type: 'general', user_action: 'dismissed',
      problem_difficulty: 'Easy', box_level: 1,
      timestamp: recentTimestamp,
    }));
    await saveHintInteraction(makeInteraction({
      problem_id: 'p2', session_id: 's2',
      hint_type: 'contextual', user_action: 'clicked',
      problem_difficulty: 'Hard', box_level: 3,
      timestamp: oldTimestamp,
    }));

    const stats = await getInteractionStats();

    expect(stats.totalInteractions).toBe(3);
    expect(stats.byAction).toEqual({ clicked: 2, dismissed: 1 });
    expect(stats.byHintType).toEqual({ contextual: 2, general: 1 });
    expect(stats.byDifficulty).toEqual({ Easy: 2, Hard: 1 });
    expect(stats.byBoxLevel).toEqual({ 1: 2, 3: 1 });
    expect(stats.uniqueProblems).toBe(2);
    expect(stats.uniqueSessions).toBe(2);
    // 2 recent (within 7 days), 1 old
    expect(stats.recentInteractions).toBe(2);
  });

  it('counts unique problems and sessions correctly', async () => {
    const ts = new Date().toISOString();
    await saveHintInteraction(makeInteraction({ problem_id: 'p1', session_id: 's1', timestamp: ts }));
    await saveHintInteraction(makeInteraction({ problem_id: 'p1', session_id: 's2', timestamp: ts }));
    await saveHintInteraction(makeInteraction({ problem_id: 'p2', session_id: 's2', timestamp: ts }));
    await saveHintInteraction(makeInteraction({ problem_id: 'p3', session_id: 's3', timestamp: ts }));

    const stats = await getInteractionStats();
    expect(stats.uniqueProblems).toBe(3);
    expect(stats.uniqueSessions).toBe(3);
  });
});

// =========================================================================
// getHintEffectiveness
// =========================================================================

describe('getHintEffectiveness', () => {
  it('returns empty object when no interactions exist', async () => {
    const effectiveness = await getHintEffectiveness();
    expect(effectiveness).toEqual({});
  });

  it('groups by hint_type-difficulty and calculates engagement metrics', async () => {
    const ts = new Date().toISOString();
    await saveHintInteraction(makeInteraction({
      hint_type: 'contextual', problem_difficulty: 'Easy', user_action: 'expand',
      problem_id: 'p1', timestamp: ts,
    }));
    await saveHintInteraction(makeInteraction({
      hint_type: 'contextual', problem_difficulty: 'Easy', user_action: 'dismissed',
      problem_id: 'p1', timestamp: ts,
    }));
    await saveHintInteraction(makeInteraction({
      hint_type: 'contextual', problem_difficulty: 'Easy', user_action: 'expand',
      problem_id: 'p2', timestamp: ts,
    }));

    const effectiveness = await getHintEffectiveness();

    const key = 'contextual-Easy';
    expect(effectiveness[key]).toBeDefined();
    expect(effectiveness[key].totalInteractions).toBe(3);
    expect(effectiveness[key].expansions).toBe(2);
    expect(effectiveness[key].dismissals).toBe(1);
    expect(effectiveness[key].engagementRate).toBeCloseTo(2 / 3);
    expect(effectiveness[key].uniqueProblems).toBe(2);
    expect(effectiveness[key].hintType).toBe('contextual');
    expect(effectiveness[key].difficulty).toBe('Easy');
  });

  it('tracks multiple hint_type-difficulty groups separately', async () => {
    const ts = new Date().toISOString();
    await saveHintInteraction(makeInteraction({
      hint_type: 'contextual', problem_difficulty: 'Easy', user_action: 'expand',
      problem_id: 'p1', timestamp: ts,
    }));
    await saveHintInteraction(makeInteraction({
      hint_type: 'general', problem_difficulty: 'Hard', user_action: 'dismissed',
      problem_id: 'p2', timestamp: ts,
    }));

    const effectiveness = await getHintEffectiveness();

    expect(Object.keys(effectiveness)).toHaveLength(2);
    expect(effectiveness['contextual-Easy']).toBeDefined();
    expect(effectiveness['general-Hard']).toBeDefined();
    expect(effectiveness['contextual-Easy'].engagementRate).toBe(1); // 1 expand / 1 total
    expect(effectiveness['general-Hard'].engagementRate).toBe(0);    // 0 expand / 1 total
  });

  it('removes the internal Set (problems) for JSON serialization', async () => {
    const ts = new Date().toISOString();
    await saveHintInteraction(makeInteraction({
      hint_type: 'primer', problem_difficulty: 'Medium', user_action: 'clicked',
      problem_id: 'p1', timestamp: ts,
    }));

    const effectiveness = await getHintEffectiveness();
    const key = 'primer-Medium';

    // The 'problems' Set should have been replaced by 'uniqueProblems' count
    expect(effectiveness[key].problems).toBeUndefined();
    expect(effectiveness[key].uniqueProblems).toBe(1);
  });

  it('handles zero engagement (no expand actions)', async () => {
    const ts = new Date().toISOString();
    await saveHintInteraction(makeInteraction({
      hint_type: 'contextual', problem_difficulty: 'Easy', user_action: 'clicked',
      problem_id: 'p1', timestamp: ts,
    }));
    await saveHintInteraction(makeInteraction({
      hint_type: 'contextual', problem_difficulty: 'Easy', user_action: 'dismissed',
      problem_id: 'p2', timestamp: ts,
    }));

    const effectiveness = await getHintEffectiveness();
    expect(effectiveness['contextual-Easy'].engagementRate).toBe(0);
    expect(effectiveness['contextual-Easy'].expansions).toBe(0);
    expect(effectiveness['contextual-Easy'].dismissals).toBe(1);
  });
});

// =========================================================================
// Integration / save-then-query flows
// =========================================================================

describe('integration: save then query across indexes', () => {
  it('save multiple interactions then query by different indexes', async () => {
    const ts1 = '2025-03-01T10:00:00.000Z';
    const ts2 = '2025-03-15T10:00:00.000Z';

    await saveHintInteraction(makeInteraction({
      problem_id: 'p1', session_id: 's1', hint_type: 'contextual',
      user_action: 'clicked', problem_difficulty: 'Easy', timestamp: ts1,
    }));
    await saveHintInteraction(makeInteraction({
      problem_id: 'p1', session_id: 's2', hint_type: 'general',
      user_action: 'dismissed', problem_difficulty: 'Hard', timestamp: ts2,
    }));
    await saveHintInteraction(makeInteraction({
      problem_id: 'p2', session_id: 's1', hint_type: 'contextual',
      user_action: 'expand', problem_difficulty: 'Easy', timestamp: ts2,
    }));

    // All records
    const all = await getAllInteractions();
    expect(all).toHaveLength(3);

    // By problem
    const byProblem = await getInteractionsByProblem('p1');
    expect(byProblem).toHaveLength(2);

    // By session
    const bySession = await getInteractionsBySession('s1');
    expect(bySession).toHaveLength(2);

    // By hint type
    const byType = await getInteractionsByHintType('contextual');
    expect(byType).toHaveLength(2);

    // By action
    const byAction = await getInteractionsByAction('clicked');
    expect(byAction).toHaveLength(1);

    // By date range
    const byDate = await getInteractionsByDateRange(
      new Date('2025-03-10T00:00:00.000Z'),
      new Date('2025-03-20T00:00:00.000Z')
    );
    expect(byDate).toHaveLength(2);

    // By compound index
    const byCompound = await getInteractionsByDifficultyAndType('Easy', 'contextual');
    expect(byCompound).toHaveLength(2);
  });

  it('delete old interactions then verify remaining stats', async () => {
    const oldTs = '2024-06-01T10:00:00.000Z';
    const recentTs = new Date().toISOString();

    await saveHintInteraction(makeInteraction({
      problem_id: 'p-old', user_action: 'clicked', hint_type: 'contextual',
      problem_difficulty: 'Easy', timestamp: oldTs,
    }));
    await saveHintInteraction(makeInteraction({
      problem_id: 'p-new', user_action: 'expand', hint_type: 'general',
      problem_difficulty: 'Hard', timestamp: recentTs,
    }));

    const deleted = await deleteOldInteractions(new Date('2025-01-01T00:00:00.000Z'));
    expect(deleted).toBe(1);

    const stats = await getInteractionStats();
    expect(stats.totalInteractions).toBe(1);
    expect(stats.uniqueProblems).toBe(1);
    expect(stats.byAction).toEqual({ expand: 1 });
    expect(stats.byHintType).toEqual({ general: 1 });
  });
});
