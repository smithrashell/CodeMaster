/**
 * Tests for patternLadderUtils.js
 * Covers: getAllowedClassifications, getValidProblems, buildLadder, getPatternLadders
 */

jest.mock('../../../db/index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

import { dbHelper } from '../../../db/index.js';
import {
  getAllowedClassifications,
  getValidProblems,
  buildLadder,
  getPatternLadders,
} from '../patternLadderUtils.js';

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getAllowedClassifications
// ---------------------------------------------------------------------------
describe('getAllowedClassifications', () => {
  it('returns only Core Concept for core concept input', () => {
    const result = getAllowedClassifications('core concept');
    expect(result).toEqual(['Core Concept']);
  });

  it('returns core and fundamental for fundamental technique input', () => {
    const result = getAllowedClassifications('fundamental technique');
    expect(result).toContain('Core Concept');
    expect(result).toContain('Fundamental Technique');
    expect(result).toHaveLength(2);
  });

  it('returns all classifications for advanced technique input', () => {
    const result = getAllowedClassifications('advanced technique');
    expect(result).toContain('Core Concept');
    expect(result).toContain('Fundamental Technique');
    expect(result).toContain('Advanced Technique');
    expect(result).toHaveLength(3);
  });

  it('handles case-insensitive input', () => {
    const result = getAllowedClassifications('CORE CONCEPT');
    expect(result).toEqual(['Core Concept']);
  });

  it('handles leading/trailing whitespace', () => {
    const result = getAllowedClassifications('  core concept  ');
    expect(result).toEqual(['Core Concept']);
  });

  it('defaults to core concept for unknown classification', () => {
    const result = getAllowedClassifications('unknown');
    expect(result).toEqual(['Core Concept']);
  });

  it('defaults to core concept for null/undefined', () => {
    expect(getAllowedClassifications(null)).toEqual(['Core Concept']);
    expect(getAllowedClassifications(undefined)).toEqual(['Core Concept']);
    expect(getAllowedClassifications('')).toEqual(['Core Concept']);
  });
});

// ---------------------------------------------------------------------------
// getValidProblems
// ---------------------------------------------------------------------------
describe('getValidProblems', () => {
  const tagRelationships = [
    { id: 'array', classification: 'core concept' },
    { id: 'hash-table', classification: 'core concept' },
    { id: 'dp', classification: 'advanced technique' },
    { id: 'graph', classification: 'fundamental technique' },
  ];

  it('returns problems that match focus tags and are within allowed classifications', () => {
    const problems = [
      { id: 1, tags: ['array'], difficulty: 'Easy' },
      { id: 2, tags: ['hash-table'], difficulty: 'Medium' },
    ];
    const result = getValidProblems({
      problems,
      userProblemMap: new Map(),
      tagRelationships,
      allowedClassifications: ['Core Concept'],
      focusTags: ['array', 'hash-table'],
    });

    expect(result).toHaveLength(2);
  });

  it('filters out already-attempted problems', () => {
    const problems = [
      { id: 1, tags: ['array'], difficulty: 'Easy' },
      { id: 2, tags: ['hash-table'], difficulty: 'Medium' },
    ];
    const userMap = new Map([[1, true]]);

    const result = getValidProblems({
      problems,
      userProblemMap: userMap,
      tagRelationships,
      allowedClassifications: ['Core Concept'],
      focusTags: ['array', 'hash-table'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('filters out problems without focus tags', () => {
    const problems = [
      { id: 1, tags: ['graph'], difficulty: 'Medium' },
    ];

    const result = getValidProblems({
      problems,
      userProblemMap: new Map(),
      tagRelationships,
      allowedClassifications: ['Core Concept', 'Fundamental Technique'],
      focusTags: ['array'],
    });

    expect(result).toHaveLength(0);
  });

  it('filters out problems with tags outside allowed classification tier', () => {
    const problems = [
      { id: 1, tags: ['dp'], difficulty: 'Hard' },
    ];

    const result = getValidProblems({
      problems,
      userProblemMap: new Map(),
      tagRelationships,
      allowedClassifications: ['Core Concept'],
      focusTags: ['dp'],
    });

    expect(result).toHaveLength(0);
  });

  it('sorts by number of matched focus tags (descending)', () => {
    const problems = [
      { id: 1, tags: ['array'], difficulty: 'Easy' },
      { id: 2, tags: ['array', 'hash-table'], difficulty: 'Medium' },
    ];

    const result = getValidProblems({
      problems,
      userProblemMap: new Map(),
      tagRelationships,
      allowedClassifications: ['Core Concept'],
      focusTags: ['array', 'hash-table'],
    });

    expect(result[0].id).toBe(2);
    expect(result[0]._matchedFocusTags).toBe(2);
  });

  it('handles empty problems array', () => {
    const result = getValidProblems({
      problems: [],
      userProblemMap: new Map(),
      tagRelationships,
      allowedClassifications: ['Core Concept'],
      focusTags: ['array'],
    });
    expect(result).toHaveLength(0);
  });

  it('handles tags not in tagInfoMap with a warning', () => {
    const problems = [
      { id: 1, tags: ['unknown-tag', 'array'], difficulty: 'Easy' },
    ];

    const result = getValidProblems({
      problems,
      userProblemMap: new Map(),
      tagRelationships,
      allowedClassifications: ['Core Concept'],
      focusTags: ['array'],
    });

    // unknown-tag not in allowedClsSet, so problem is filtered out
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildLadder
// ---------------------------------------------------------------------------
describe('buildLadder', () => {
  it('builds a ladder with correct difficulty distribution', () => {
    const validProblems = [
      { id: 1, title: 'P1', difficulty: 'Easy', tags: ['array'] },
      { id: 2, title: 'P2', difficulty: 'Easy', tags: ['array'] },
      { id: 3, title: 'P3', difficulty: 'Medium', tags: ['array'] },
      { id: 4, title: 'P4', difficulty: 'Medium', tags: ['array'] },
      { id: 5, title: 'P5', difficulty: 'Hard', tags: ['array'] },
    ];

    const result = buildLadder({
      validProblems,
      problemCounts: { easy: 2, medium: 2, hard: 1 },
      userProblemMap: new Map(),
      relationshipMap: null,
      ladderSize: 5,
    });

    expect(result).toHaveLength(5);
    expect(result.filter(p => p.difficulty === 'Easy')).toHaveLength(2);
    expect(result.filter(p => p.difficulty === 'Medium')).toHaveLength(2);
    expect(result.filter(p => p.difficulty === 'Hard')).toHaveLength(1);
  });

  it('returns problems with correct shape', () => {
    const validProblems = [
      { id: 1, title: 'P1', difficulty: 'Easy', tags: ['array'] },
    ];

    const result = buildLadder({
      validProblems,
      problemCounts: { easy: 1, medium: 0, hard: 0 },
      userProblemMap: new Map(),
      relationshipMap: null,
      ladderSize: 1,
    });

    expect(result[0]).toEqual({
      id: 1,
      title: 'P1',
      difficulty: 'Easy',
      tags: ['array'],
      attempted: false,
    });
  });

  it('marks attempted problems', () => {
    const validProblems = [
      { id: 1, title: 'P1', difficulty: 'Easy', tags: ['array'] },
    ];
    const userMap = new Map([[1, true]]);

    const result = buildLadder({
      validProblems,
      problemCounts: { easy: 1, medium: 0, hard: 0 },
      userProblemMap: userMap,
      relationshipMap: null,
      ladderSize: 1,
    });

    expect(result[0].attempted).toBe(true);
  });

  it('handles zero total problem counts gracefully', () => {
    const result = buildLadder({
      validProblems: [],
      problemCounts: { easy: 0, medium: 0, hard: 0 },
      userProblemMap: new Map(),
      relationshipMap: null,
      ladderSize: 5,
    });
    expect(result).toHaveLength(0);
  });

  it('sorts by relationship score when relationshipMap is provided', () => {
    const validProblems = [
      { id: 1, title: 'P1', difficulty: 'Easy', tags: ['array'] },
      { id: 2, title: 'P2', difficulty: 'Easy', tags: ['array'] },
    ];

    const relMap = new Map([
      [2, { 99: 0.8 }], // problem 2 is related to attempted problem 99
    ]);

    const userMap = new Map([[99, true]]);

    const result = buildLadder({
      validProblems,
      problemCounts: { easy: 2, medium: 0, hard: 0 },
      userProblemMap: userMap,
      relationshipMap: relMap,
      ladderSize: 2,
    });

    // Problem 2 should come first due to higher relationship score
    expect(result[0].id).toBe(2);
  });

  it('handles non-Map relationshipMap gracefully', () => {
    const validProblems = [
      { id: 1, title: 'P1', difficulty: 'Easy', tags: ['array'] },
    ];

    // Pass a plain object instead of Map - should not crash
    const result = buildLadder({
      validProblems,
      problemCounts: { easy: 1, medium: 0, hard: 0 },
      userProblemMap: new Map(),
      relationshipMap: { notAMap: true },
      ladderSize: 1,
    });

    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getPatternLadders
// ---------------------------------------------------------------------------
describe('getPatternLadders', () => {
  it('returns ladders as a map keyed by tag', async () => {
    const ladders = [
      { tag: 'array', problems: [1, 2] },
      { tag: 'dp', problems: [3, 4] },
    ];

    const mockDb = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          getAll: jest.fn(() => {
            const req = {};
            Promise.resolve().then(() => {
              req.result = ladders;
              if (req.onsuccess) req.onsuccess();
            });
            return req;
          }),
        })),
      })),
    };

    dbHelper.openDB.mockResolvedValue(mockDb);

    const result = await getPatternLadders();
    expect(result).toEqual({
      array: { tag: 'array', problems: [1, 2] },
      dp: { tag: 'dp', problems: [3, 4] },
    });
  });

  it('returns empty map when no ladders exist', async () => {
    const mockDb = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          getAll: jest.fn(() => {
            const req = {};
            Promise.resolve().then(() => {
              req.result = [];
              if (req.onsuccess) req.onsuccess();
            });
            return req;
          }),
        })),
      })),
    };

    dbHelper.openDB.mockResolvedValue(mockDb);

    const result = await getPatternLadders();
    expect(result).toEqual({});
  });

  it('rejects on error', async () => {
    const mockDb = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          getAll: jest.fn(() => {
            const req = {};
            Promise.resolve().then(() => {
              req.error = new Error('store fail');
              if (req.onerror) req.onerror();
            });
            return req;
          }),
        })),
      })),
    };

    dbHelper.openDB.mockResolvedValue(mockDb);

    await expect(getPatternLadders()).rejects.toThrow('store fail');
  });
});
