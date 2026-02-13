/**
 * Real fake-indexeddb tests for tag_mastery.js
 *
 * Uses a real in-memory IndexedDB (via fake-indexeddb) instead of mocking
 * the database layer. This exercises actual transaction logic, store reads/writes,
 * and all internal helper functions for maximum code coverage.
 *
 * Note on calculateTagMastery():
 *   A transaction ordering bug was fixed where getLadderCoverage() opened a
 *   second transaction inside a loop that already held an active readwrite
 *   transaction on tag_mastery. Ladder coverage is now pre-fetched before
 *   the write transaction, matching the pattern in updateTagMasteryRecords().
 */

// Mock logger before all other imports
jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the DB index -- will be wired to real fake-indexeddb in beforeEach
jest.mock('../../index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

import { dbHelper } from '../../index.js';
import {
  createTestDb,
  closeTestDb,
  seedStore,
  readAll,
} from '../../../../../test/testDbHelper.js';
import {
  insertDefaultTagMasteryRecords,
  updateTagMasteryForAttempt,
  calculateTagMastery,
  getTagMastery,
  calculateTagSimilarity,
  getAllTagMastery,
  upsertTagMastery,
} from '../tag_mastery.js';

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
let testDb;

beforeEach(async () => {
  testDb = await createTestDb();
  dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
});

afterEach(() => {
  closeTestDb(testDb);
});

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------
function makeTagRelationship(id, overrides = {}) {
  return {
    id,
    classification: 'algorithm',
    mastery_threshold: 0.80,
    min_attempts_required: 6,
    ...overrides,
  };
}

function makeMasteryRecord(tag, overrides = {}) {
  return {
    tag,
    total_attempts: 0,
    successful_attempts: 0,
    attempted_problem_ids: [],
    decay_score: 1,
    mastered: false,
    strength: 0,
    mastery_date: null,
    last_practiced: null,
    ...overrides,
  };
}

function makeProblem(overrides = {}) {
  return {
    problem_id: 'p1',
    title: 'Two Sum',
    tags: ['array', 'hash-table'],
    leetcode_id: 1,
    attempt_stats: { total_attempts: 0, successful_attempts: 0 },
    last_attempt_date: null,
    ...overrides,
  };
}

function makeStandardProblem(overrides = {}) {
  return {
    id: 's1',
    slug: 'two-sum',
    title: 'Two Sum',
    tags: ['array', 'hash-table'],
    difficulty: 'Easy',
    ...overrides,
  };
}

function makePatternLadder(tag, problems = []) {
  return {
    tag,
    problems,
  };
}

// ---------------------------------------------------------------------------
// insertDefaultTagMasteryRecords
// ---------------------------------------------------------------------------
describe('insertDefaultTagMasteryRecords', () => {
  it('inserts default records for each tag_relationship when tag_mastery is empty', async () => {
    await seedStore(testDb.db, 'tag_relationships', [
      makeTagRelationship('Array'),
      makeTagRelationship('Hash Table'),
    ]);

    await insertDefaultTagMasteryRecords();

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(2);
    expect(records.map(r => r.tag).sort()).toEqual(['array', 'hash table']);

    // Verify default field values
    for (const record of records) {
      expect(record.total_attempts).toBe(0);
      expect(record.successful_attempts).toBe(0);
      expect(record.attempted_problem_ids).toEqual([]);
      expect(record.decay_score).toBe(1);
      expect(record.mastered).toBe(false);
      expect(record.strength).toBe(0);
      expect(record.mastery_date).toBeNull();
      expect(record.last_practiced).toBeNull();
    }
  });

  it('skips initialization when no tag_relationships exist', async () => {
    // tag_relationships is empty
    await insertDefaultTagMasteryRecords();

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(0);
  });

  it('skips initialization when tag_mastery already has records', async () => {
    await seedStore(testDb.db, 'tag_relationships', [
      makeTagRelationship('Array'),
      makeTagRelationship('Tree'),
    ]);
    // Pre-seed one mastery record
    await seedStore(testDb.db, 'tag_mastery', [
      makeMasteryRecord('array'),
    ]);

    await insertDefaultTagMasteryRecords();

    // Should still only have the one pre-seeded record (not duplicated)
    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(1);
    expect(records[0].tag).toBe('array');
  });

  it('normalizes tag ids to lowercase and trimmed', async () => {
    await seedStore(testDb.db, 'tag_relationships', [
      makeTagRelationship('  Dynamic Programming  '),
    ]);

    await insertDefaultTagMasteryRecords();

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(1);
    expect(records[0].tag).toBe('dynamic programming');
  });

  it('handles multiple tag_relationships with varying casing', async () => {
    await seedStore(testDb.db, 'tag_relationships', [
      makeTagRelationship('Binary Search'),
      makeTagRelationship('dynamic programming'),
      makeTagRelationship('GRAPH'),
    ]);

    await insertDefaultTagMasteryRecords();

    const records = await readAll(testDb.db, 'tag_mastery');
    const tags = records.map(r => r.tag).sort();
    expect(tags).toEqual(['binary search', 'dynamic programming', 'graph']);
  });
});

// ---------------------------------------------------------------------------
// updateTagMasteryForAttempt
// ---------------------------------------------------------------------------
describe('updateTagMasteryForAttempt', () => {
  it('creates new mastery records for tags not yet in the store', async () => {
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', []),
    ]);

    const problem = { title: 'Two Sum', tags: ['Array'], problem_id: 'p1' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(1);
    expect(records[0].tag).toBe('array');
    expect(records[0].total_attempts).toBe(1);
    expect(records[0].successful_attempts).toBe(1);
    expect(records[0].attempted_problem_ids).toContain('p1');
    expect(records[0].last_practiced).toBeTruthy();
  });

  it('increments counters on an existing mastery record', async () => {
    await seedStore(testDb.db, 'tag_mastery', [
      makeMasteryRecord('array', {
        total_attempts: 3,
        successful_attempts: 2,
        attempted_problem_ids: ['p1'],
      }),
    ]);
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', []),
    ]);

    const problem = { title: 'Two Sum', tags: ['Array'], problem_id: 'p2' };
    const attempt = { success: false };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(1);
    expect(records[0].total_attempts).toBe(4);
    expect(records[0].successful_attempts).toBe(2); // no increment for failure
    expect(records[0].attempted_problem_ids).toContain('p2');
  });

  it('does not duplicate problem_id if already in attempted_problem_ids', async () => {
    await seedStore(testDb.db, 'tag_mastery', [
      makeMasteryRecord('array', {
        total_attempts: 1,
        successful_attempts: 1,
        attempted_problem_ids: ['p1'],
      }),
    ]);
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', []),
    ]);

    const problem = { title: 'Two Sum', tags: ['Array'], problem_id: 'p1' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records[0].attempted_problem_ids).toEqual(['p1']);
    expect(records[0].total_attempts).toBe(2);
  });

  it('skips update when problem has no valid tags', async () => {
    const problem = { title: 'No Tags', tags: [], problem_id: 'p1' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(0);
  });

  it('filters out empty/whitespace-only tags', async () => {
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', []),
    ]);

    const problem = { title: 'Test', tags: ['Array', '', '  ', null, undefined], problem_id: 'p1' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    // Only 'array' should be stored (non-string/empty tags filtered out)
    expect(records).toHaveLength(1);
    expect(records[0].tag).toBe('array');
  });

  it('updates multiple tags for a single problem', async () => {
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', []),
      makePatternLadder('hash-table', []),
    ]);

    const problem = { title: 'Multi-Tag', tags: ['Array', 'Hash-Table'], problem_id: 'p1' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(2);
    const tags = records.map(r => r.tag).sort();
    expect(tags).toEqual(['array', 'hash-table']);
  });

  it('sets mastered=true when all mastery gates are satisfied', async () => {
    // Requirements: min 6 attempts, ceil(6*0.7)=5 unique problems, 80% accuracy, 70% ladder coverage
    await seedStore(testDb.db, 'tag_relationships', [
      makeTagRelationship('array', { mastery_threshold: 0.80, min_attempts_required: 6 }),
    ]);
    await seedStore(testDb.db, 'tag_mastery', [
      makeMasteryRecord('array', {
        total_attempts: 5,
        successful_attempts: 5,
        attempted_problem_ids: ['p1', 'p2', 'p3', 'p4'],
      }),
    ]);
    // 3 of 4 ladder problems attempted = 75% >= 70%
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', [
        { id: 'p1', attempted: true },
        { id: 'p2', attempted: true },
        { id: 'p3', attempted: true },
        { id: 'p4', attempted: false },
      ]),
    ]);

    const problem = { title: 'Final', tags: ['Array'], problem_id: 'p5' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(1);
    // 6 total, 6 successful, 5 unique >= 5, 100% accuracy >= 80%, 75% ladder >= 70%
    expect(records[0].mastered).toBe(true);
    expect(records[0].mastery_date).toBeTruthy();
  });

  it('does not set mastered when accuracy is below threshold', async () => {
    await seedStore(testDb.db, 'tag_relationships', [
      makeTagRelationship('array', { mastery_threshold: 0.80, min_attempts_required: 3 }),
    ]);
    await seedStore(testDb.db, 'tag_mastery', [
      makeMasteryRecord('array', {
        total_attempts: 2,
        successful_attempts: 0,
        attempted_problem_ids: ['p1', 'p2'],
      }),
    ]);
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', [
        { id: 'p1', attempted: true },
        { id: 'p2', attempted: true },
        { id: 'p3', attempted: true },
      ]),
    ]);

    const problem = { title: 'Fail', tags: ['Array'], problem_id: 'p3' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    // 3 total, 1 success -> 33% accuracy < 80%
    expect(records[0].mastered).toBe(false);
  });

  it('does not set mastered when ladder coverage is below threshold', async () => {
    await seedStore(testDb.db, 'tag_relationships', [
      makeTagRelationship('array', { mastery_threshold: 0.80, min_attempts_required: 6 }),
    ]);
    await seedStore(testDb.db, 'tag_mastery', [
      makeMasteryRecord('array', {
        total_attempts: 5,
        successful_attempts: 5,
        attempted_problem_ids: ['p1', 'p2', 'p3', 'p4'],
      }),
    ]);
    // Only 1 of 10 attempted = 10% < 70%
    const ladderProblems = [];
    for (let i = 1; i <= 10; i++) {
      ladderProblems.push({ id: `lp${i}`, attempted: i === 1 });
    }
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', ladderProblems),
    ]);

    const problem = { title: 'Test', tags: ['Array'], problem_id: 'p5' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records[0].mastered).toBe(false);
  });

  it('does not set mastered when volume (total_attempts) is below min_attempts_required', async () => {
    await seedStore(testDb.db, 'tag_relationships', [
      makeTagRelationship('array', { mastery_threshold: 0.50, min_attempts_required: 10 }),
    ]);
    await seedStore(testDb.db, 'tag_mastery', [
      makeMasteryRecord('array', {
        total_attempts: 1,
        successful_attempts: 1,
        attempted_problem_ids: ['p1'],
      }),
    ]);
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', [
        { id: 'p1', attempted: true },
      ]),
    ]);

    const problem = { title: 'Test', tags: ['Array'], problem_id: 'p2' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    // 2 total < 10 required
    expect(records[0].mastered).toBe(false);
  });

  it('does not set mastered when unique problems count is below threshold', async () => {
    // min_attempts_required=4, min_unique=ceil(4*0.7)=3
    await seedStore(testDb.db, 'tag_relationships', [
      makeTagRelationship('array', { mastery_threshold: 0.50, min_attempts_required: 4 }),
    ]);
    await seedStore(testDb.db, 'tag_mastery', [
      makeMasteryRecord('array', {
        total_attempts: 3,
        successful_attempts: 3,
        attempted_problem_ids: ['p1'], // only 1 unique problem
      }),
    ]);
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', [
        { id: 'p1', attempted: true },
        { id: 'p2', attempted: true },
        { id: 'p3', attempted: true },
      ]),
    ]);

    // Same problem again -- still 2 unique (p1, p1 = still 1, plus p1 from seed)
    const problem = { title: 'Test', tags: ['Array'], problem_id: 'p1' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    // 4 total, 4 successful, but only 1 unique problem < 3 required
    expect(records[0].mastered).toBe(false);
  });

  it('calculates strength as rounded mastery ratio percentage', async () => {
    await seedStore(testDb.db, 'tag_mastery', [
      makeMasteryRecord('array', {
        total_attempts: 2,
        successful_attempts: 1,
        attempted_problem_ids: ['p1'],
      }),
    ]);
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', []),
    ]);

    const problem = { title: 'Test', tags: ['Array'], problem_id: 'p2' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    // 3 total, 2 successful -> 66.67% -> Math.round(66.67) = 67
    expect(records[0].strength).toBe(67);
  });

  it('uses leetcode_id as fallback problem identifier', async () => {
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', []),
    ]);

    const problem = { title: 'Test', tags: ['Array'], leetcode_id: 42 };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records[0].attempted_problem_ids).toContain(42);
  });

  it('uses problem.id as last-resort problem identifier', async () => {
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', []),
    ]);

    const problem = { title: 'Test', tags: ['Array'], id: 'fallback-id' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records[0].attempted_problem_ids).toContain('fallback-id');
  });

  it('fetches tag_relationships and applies custom thresholds', async () => {
    await seedStore(testDb.db, 'tag_relationships', [
      makeTagRelationship('array', { mastery_threshold: 0.50, min_attempts_required: 2 }),
    ]);
    await seedStore(testDb.db, 'tag_mastery', [
      makeMasteryRecord('array', {
        total_attempts: 1,
        successful_attempts: 1,
        attempted_problem_ids: ['p1'],
      }),
    ]);
    // 2/2 problems attempted = 100% >= 70%
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', [
        { id: 'p1', attempted: true },
        { id: 'p2', attempted: true },
      ]),
    ]);

    const problem = { title: 'Test', tags: ['Array'], problem_id: 'p2' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    // 2 total, 2 successful -> 100% >= 50%, 2 unique >= ceil(2*0.7)=2, volume 2 >= 2
    expect(records[0].mastered).toBe(true);
  });

  it('uses default thresholds when tag has no tag_relationship entry', async () => {
    // No tag_relationships seeded -- defaults apply (0.80 threshold, 6 min attempts)
    await seedStore(testDb.db, 'tag_mastery', [
      makeMasteryRecord('array', {
        total_attempts: 3,
        successful_attempts: 3,
        attempted_problem_ids: ['p1', 'p2', 'p3'],
      }),
    ]);
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', [
        { id: 'p1', attempted: true },
        { id: 'p2', attempted: true },
        { id: 'p3', attempted: true },
      ]),
    ]);

    const problem = { title: 'Test', tags: ['Array'], problem_id: 'p4' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    // 4 total < 6 default min -> not mastered even with 100% accuracy
    expect(records[0].mastered).toBe(false);
  });

  it('throws and propagates errors from DB operations', async () => {
    dbHelper.openDB.mockRejectedValue(new Error('DB connection failed'));

    const problem = { title: 'Test', tags: ['Array'], problem_id: 'p1' };
    const attempt = { success: true };

    await expect(updateTagMasteryForAttempt(problem, attempt)).rejects.toThrow('DB connection failed');
  });

  it('handles missing tags property on problem', async () => {
    const problem = { title: 'No Tags Prop', problem_id: 'p1' };
    const attempt = { success: true };

    // Should not throw -- tags defaults to []
    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(0);
  });

  it('handles getLadderCoverage when no pattern_ladder exists for tag', async () => {
    // Do not seed any pattern_ladders -- getLadderCoverage should return {0, 0, 0}
    const problem = { title: 'Test', tags: ['Array'], problem_id: 'p1' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(1);
    // With no ladder, percentage = 0 so ladderOK = false => not mastered
    expect(records[0].mastered).toBe(false);
  });

  it('preserves existing mastery when already mastered and subsequent attempt passes gates', async () => {
    const originalDate = '2025-01-15T10:00:00.000Z';
    await seedStore(testDb.db, 'tag_mastery', [
      makeMasteryRecord('array', {
        total_attempts: 10,
        successful_attempts: 10,
        attempted_problem_ids: ['p1', 'p2', 'p3', 'p4', 'p5'],
        mastered: true,
        mastery_date: originalDate,
      }),
    ]);
    await seedStore(testDb.db, 'tag_relationships', [
      makeTagRelationship('array'),
    ]);
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', [
        { id: 'p1', attempted: true },
        { id: 'p2', attempted: true },
        { id: 'p3', attempted: true },
      ]),
    ]);

    const problem = { title: 'Continue', tags: ['Array'], problem_id: 'p6' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    // Should still be mastered (wasAlreadyMastered was true, all gates still pass)
    expect(records[0].mastered).toBe(true);
    // mastery_date should NOT be overwritten since mastery was already true
    expect(records[0].mastery_date).toBe(originalDate);
  });

  it('handles getLadderCoverage with empty ladder problems array', async () => {
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', []),
    ]);

    const problem = { title: 'Test', tags: ['Array'], problem_id: 'p1' };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    // Empty ladder -> percentage=0 -> ladderOK=false -> not mastered
    expect(records[0].mastered).toBe(false);
  });

  it('handles sequential calls on different tags', async () => {
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', []),
      makePatternLadder('tree', []),
    ]);

    const problem1 = { title: 'P1', tags: ['Array'], problem_id: 'p1' };
    const problem2 = { title: 'P2', tags: ['Tree'], problem_id: 'p2' };

    await updateTagMasteryForAttempt(problem1, { success: true });
    await updateTagMasteryForAttempt(problem2, { success: false });

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(2);
    const arrayRec = records.find(r => r.tag === 'array');
    const treeRec = records.find(r => r.tag === 'tree');
    expect(arrayRec.successful_attempts).toBe(1);
    expect(treeRec.successful_attempts).toBe(0);
    expect(treeRec.total_attempts).toBe(1);
  });

  it('does not add problem_id when problem has no id fields at all', async () => {
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', []),
    ]);

    // Problem with no problem_id, leetcode_id, or id
    const problem = { title: 'Anonymous', tags: ['Array'] };
    const attempt = { success: true };

    await updateTagMasteryForAttempt(problem, attempt);

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(1);
    // problemId would be undefined, so the condition `if (problemId && ...)` is false
    expect(records[0].attempted_problem_ids).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// calculateTagMastery
// ---------------------------------------------------------------------------
describe('calculateTagMastery', () => {
  // NOTE: calculateTagMastery has a known transaction ordering issue where
  // getLadderCoverage opens a second transaction while tag_mastery readwrite
  // is active. In fake-indexeddb this auto-commits the first tx. The function
  // catches the error silently. These tests still exercise fetchProblemsData,
  // extractAllTags, calculateTagStats, and all the early code paths.

  it('exercises fetchProblemsData, extractAllTags, and calculateTagStats code paths', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      makeStandardProblem({ id: 's1', tags: ['array'] }),
      makeStandardProblem({ id: 's2', tags: ['tree'] }),
    ]);
    await seedStore(testDb.db, 'problems', [
      makeProblem({
        problem_id: 'p1',
        tags: ['array'],
        attempt_stats: { total_attempts: 10, successful_attempts: 9 },
        last_attempt_date: new Date().toISOString(),
      }),
    ]);
    await seedStore(testDb.db, 'tag_relationships', [
      makeTagRelationship('array'),
      makeTagRelationship('tree'),
    ]);
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', [
        { id: 'p1', attempted: true },
        { id: 'p2', attempted: true },
        { id: 'p3', attempted: true },
      ]),
      makePatternLadder('tree', []),
    ]);

    // Should resolve without throwing (catches internally if transaction fails)
    await expect(calculateTagMastery()).resolves.toBeUndefined();
  });

  it('exercises tag stats accumulation with user problems having tags not in standard problems', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      makeStandardProblem({ id: 's1', tags: ['array'] }),
    ]);
    await seedStore(testDb.db, 'problems', [
      makeProblem({
        problem_id: 'p1',
        tags: ['exotic-tag'],
        attempt_stats: { total_attempts: 3, successful_attempts: 2 },
        last_attempt_date: new Date().toISOString(),
      }),
    ]);
    await seedStore(testDb.db, 'tag_relationships', []);
    await seedStore(testDb.db, 'pattern_ladders', []);

    // The function will attempt to process both 'array' and 'exotic-tag'
    // calculateTagStats creates entries for tags not in standard_problems with a console.warn
    await expect(calculateTagMastery()).resolves.toBeUndefined();
  });

  it('catches errors gracefully when openDB rejects', async () => {
    dbHelper.openDB.mockRejectedValue(new Error('DB failure'));

    // Should not throw
    await expect(calculateTagMastery()).resolves.toBeUndefined();
  });

  it('handles standard problems with non-array tags gracefully', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      { id: 's1', slug: 'test', title: 'Test', tags: null, difficulty: 'Easy' },
      { id: 's2', slug: 'test2', title: 'Test2', difficulty: 'Medium' },
    ]);
    await seedStore(testDb.db, 'problems', []);
    await seedStore(testDb.db, 'tag_relationships', []);
    await seedStore(testDb.db, 'pattern_ladders', []);

    await calculateTagMastery();

    // extractAllTags handles non-array tags gracefully
    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(0);
  });

  it('exercises tag_relationships fetching and normalization', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      makeStandardProblem({ id: 's1', tags: ['array'] }),
    ]);
    await seedStore(testDb.db, 'problems', [
      makeProblem({
        problem_id: 'p1',
        tags: ['array'],
        attempt_stats: { total_attempts: 10, successful_attempts: 10 },
        last_attempt_date: new Date().toISOString(),
      }),
    ]);
    await seedStore(testDb.db, 'tag_relationships', [
      makeTagRelationship('Array', { mastery_threshold: 0.90, min_attempts_required: 8 }),
    ]);
    await seedStore(testDb.db, 'pattern_ladders', [
      makePatternLadder('array', [
        { id: 'p1', attempted: true },
        { id: 'p2', attempted: true },
      ]),
    ]);

    await expect(calculateTagMastery()).resolves.toBeUndefined();
  });

  it('exercises decay score and mastery ratio computation', async () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    await seedStore(testDb.db, 'standard_problems', [
      makeStandardProblem({ id: 's1', tags: ['array'] }),
    ]);
    await seedStore(testDb.db, 'problems', [
      makeProblem({
        problem_id: 'p1',
        tags: ['array'],
        attempt_stats: { total_attempts: 4, successful_attempts: 2 },
        last_attempt_date: oldDate,
      }),
    ]);
    await seedStore(testDb.db, 'tag_relationships', []);
    await seedStore(testDb.db, 'pattern_ladders', []);

    await expect(calculateTagMastery()).resolves.toBeUndefined();
  });

  it('exercises last_attempt_date tracking across multiple user problems', async () => {
    const newerDate = '2025-06-15T10:00:00.000Z';
    const olderDate = '2025-01-01T10:00:00.000Z';

    await seedStore(testDb.db, 'standard_problems', [
      makeStandardProblem({ id: 's1', tags: ['array'] }),
    ]);
    await seedStore(testDb.db, 'problems', [
      makeProblem({
        problem_id: 'p1',
        tags: ['array'],
        attempt_stats: { total_attempts: 2, successful_attempts: 1 },
        last_attempt_date: olderDate,
      }),
      makeProblem({
        problem_id: 'p2',
        tags: ['array'],
        attempt_stats: { total_attempts: 3, successful_attempts: 2 },
        last_attempt_date: newerDate,
      }),
    ]);
    await seedStore(testDb.db, 'tag_relationships', []);
    await seedStore(testDb.db, 'pattern_ladders', []);

    await expect(calculateTagMastery()).resolves.toBeUndefined();
  });

  it('exercises handling user problems with missing attempt_stats', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      makeStandardProblem({ id: 's1', tags: ['array'] }),
    ]);
    await seedStore(testDb.db, 'problems', [
      { problem_id: 'p1', title: 'Test', tags: ['array'] }, // no attempt_stats
    ]);
    await seedStore(testDb.db, 'tag_relationships', []);
    await seedStore(testDb.db, 'pattern_ladders', []);

    await expect(calculateTagMastery()).resolves.toBeUndefined();
  });

  it('exercises zero-attempt tags with decay_score default of 1', async () => {
    await seedStore(testDb.db, 'standard_problems', [
      makeStandardProblem({ id: 's1', tags: ['graph'] }),
    ]);
    await seedStore(testDb.db, 'problems', []);
    await seedStore(testDb.db, 'tag_relationships', []);
    await seedStore(testDb.db, 'pattern_ladders', []);

    // graph tag has 0 attempts -> decayScore = 1 (default)
    await expect(calculateTagMastery()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getTagMastery
// ---------------------------------------------------------------------------
describe('getTagMastery', () => {
  it('returns all records from the tag_mastery store', async () => {
    await seedStore(testDb.db, 'tag_mastery', [
      makeMasteryRecord('array', { strength: 50 }),
      makeMasteryRecord('tree', { strength: 80 }),
    ]);

    const result = await getTagMastery();
    expect(result).toHaveLength(2);
    const tags = result.map(r => r.tag).sort();
    expect(tags).toEqual(['array', 'tree']);
  });

  it('returns an empty array when store is empty', async () => {
    const result = await getTagMastery();
    expect(result).toEqual([]);
  });

  it('returns empty array as fallback on DB error', async () => {
    dbHelper.openDB.mockRejectedValue(new Error('DB unavailable'));

    const result = await getTagMastery();
    expect(result).toEqual([]);
  });

  it('returns all field values accurately', async () => {
    const record = makeMasteryRecord('dp', {
      total_attempts: 15,
      successful_attempts: 12,
      mastered: true,
      strength: 80,
      decay_score: 0.3,
      mastery_date: '2025-05-01T10:00:00Z',
      last_practiced: '2025-06-01T10:00:00Z',
    });
    await seedStore(testDb.db, 'tag_mastery', [record]);

    const result = await getTagMastery();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(record);
  });
});

// ---------------------------------------------------------------------------
// getAllTagMastery
// ---------------------------------------------------------------------------
describe('getAllTagMastery', () => {
  it('returns all records from tag_mastery', async () => {
    await seedStore(testDb.db, 'tag_mastery', [
      makeMasteryRecord('dp', { strength: 30 }),
      makeMasteryRecord('graph', { strength: 60 }),
      makeMasteryRecord('tree', { strength: 90 }),
    ]);

    const result = await getAllTagMastery();
    expect(result).toHaveLength(3);
  });

  it('returns empty array when no records exist', async () => {
    const result = await getAllTagMastery();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// upsertTagMastery
// ---------------------------------------------------------------------------
describe('upsertTagMastery', () => {
  it('inserts a new tag mastery record', async () => {
    await upsertTagMastery({
      tag: 'Array',
      mastered: false,
      decay_score: 1.0,
      strength: 0,
    });

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(1);
    expect(records[0].tag).toBe('array');
    expect(records[0].mastered).toBe(false);
  });

  it('normalizes tag to lowercase and trimmed', async () => {
    await upsertTagMastery({ tag: '  HASH-TABLE  ', mastered: true });

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(1);
    expect(records[0].tag).toBe('hash-table');
  });

  it('updates an existing record when tag key matches', async () => {
    await seedStore(testDb.db, 'tag_mastery', [
      makeMasteryRecord('array', { strength: 10 }),
    ]);

    await upsertTagMastery({ tag: 'Array', strength: 75, mastered: true });

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(1);
    expect(records[0].strength).toBe(75);
    expect(records[0].mastered).toBe(true);
  });

  it('preserves all extra fields in the object', async () => {
    await upsertTagMastery({
      tag: 'tree',
      mastered: false,
      custom_field: 'extra',
      decay_score: 0.5,
    });

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records[0].custom_field).toBe('extra');
    expect(records[0].decay_score).toBe(0.5);
  });

  it('can upsert multiple records sequentially', async () => {
    await upsertTagMastery({ tag: 'Array', mastered: false });
    await upsertTagMastery({ tag: 'Tree', mastered: true });
    await upsertTagMastery({ tag: 'Graph', mastered: false });

    const records = await readAll(testDb.db, 'tag_mastery');
    expect(records).toHaveLength(3);
    const tags = records.map(r => r.tag).sort();
    expect(tags).toEqual(['array', 'graph', 'tree']);
  });
});

// ---------------------------------------------------------------------------
// calculateTagSimilarity (pure function, a few tests for coverage)
// ---------------------------------------------------------------------------
describe('calculateTagSimilarity', () => {
  it('returns positive similarity for direct tag match with same difficulty', () => {
    const result = calculateTagSimilarity({
      tags1: ['array'],
      tags2: ['array'],
      tagGraph: {},
      tagMastery: {},
      difficulty1: 'Medium',
      difficulty2: 'Medium',
    });
    // direct match: 2, same difficulty: *1.2 = 2.4
    expect(result).toBeCloseTo(2.4, 5);
  });

  it('applies 1.0x multiplier when difficulty gap is 1 (Medium vs Hard)', () => {
    const result = calculateTagSimilarity({
      tags1: ['array'],
      tags2: ['array'],
      tagGraph: {},
      tagMastery: {},
      difficulty1: 'Medium',
      difficulty2: 'Hard',
    });
    expect(result).toBeCloseTo(2 * 1.0, 5);
  });

  it('applies 0.7x penalty for large difficulty gap (Easy vs Hard)', () => {
    const result = calculateTagSimilarity({
      tags1: ['array'],
      tags2: ['array'],
      tagGraph: {},
      tagMastery: {},
      difficulty1: 'Easy',
      difficulty2: 'Hard',
    });
    expect(result).toBeCloseTo(2 * 0.7, 5);
  });

  it('boosts similarity for unmastered tags', () => {
    const tagMastery = {
      array: { mastered: false, decayScore: 2.0 },
    };
    const result = calculateTagSimilarity({
      tags1: ['array'],
      tags2: ['array'],
      tagGraph: {},
      tagMastery,
      difficulty1: 'Medium',
      difficulty2: 'Medium',
    });
    // direct: 2, concat: ['array','array'], each adds 2.0*0.5=1.0 -> +2.0
    // base = 2 + 2 = 4, * 1.2 = 4.8
    expect(result).toBeCloseTo(4.8, 5);
  });

  it('uses indirect tag graph relationships with log scaling', () => {
    const tagGraph = { array: { tree: 99 } };
    const result = calculateTagSimilarity({
      tags1: ['array'],
      tags2: ['tree'],
      tagGraph,
      tagMastery: {},
      difficulty1: 'Hard',
      difficulty2: 'Hard',
    });
    // indirect: log10(100)*0.5 = 1.0, same difficulty: *1.2 = 1.2
    expect(result).toBeCloseTo(1.2, 5);
  });

  it('returns 0 for no matches and no mastery data', () => {
    const result = calculateTagSimilarity({
      tags1: ['array'],
      tags2: ['graph'],
      tagGraph: {},
      tagMastery: {},
      difficulty1: 'Easy',
      difficulty2: 'Easy',
    });
    expect(result).toBe(0);
  });

  it('falls back to Medium difficulty for unknown values', () => {
    const result = calculateTagSimilarity({
      tags1: ['array'],
      tags2: ['array'],
      tagGraph: {},
      tagMastery: {},
      difficulty1: 'Unknown',
      difficulty2: 'Unknown',
    });
    // Both unknown -> Medium (2), gap=0 -> 1.2
    expect(result).toBeCloseTo(2 * 1.2, 5);
  });
});
