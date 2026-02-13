/**
 * Real fake-indexeddb tests for problemsSelection.js (main entry point)
 *
 * This tests the problemsSelection.js file directly (as opposed to
 * problemSelectionHelpers.js which is already tested in
 * problemsSelection.real.test.js). The file has an import from
 * ../utils/dbUtils/patternLadderUtils.js which requires mocking.
 *
 * Tests all exported functions: loadProblemSelectionContext,
 * filterProblemsByDifficultyCap, logProblemSelectionStart,
 * calculateTagDifficultyAllowances, selectPrimaryAndExpansionProblems,
 * addExpansionProblems, logSelectedProblems, expandWithRemainingFocusTags,
 * fillRemainingWithRandomProblems, getDifficultyScore, selectProblemsForTag
 */

// -- Mocks (before imports) --------------------------------------------------

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

jest.mock('../standard_problems.js', () => ({
  getAllStandardProblems: jest.fn(),
}));

jest.mock('../../../services/attempts/tagServices.js', () => ({
  TagService: {
    getCurrentLearningState: jest.fn(),
  },
}));

jest.mock('../../../services/focus/focusCoordinationService.js', () => ({
  __esModule: true,
  default: {
    getFocusDecision: jest.fn(),
  },
}));

jest.mock('../../../utils/leitner/Utils.js', () => ({
  getDifficultyAllowanceForTag: jest.fn(),
}));

// Mock the unresolvable import path (resolves to src/shared/db/utils/dbUtils/patternLadderUtils.js)
jest.mock('../../utils/dbUtils/patternLadderUtils.js', () => ({
  getPatternLadders: jest.fn(),
}), { virtual: true });

jest.mock('../problem_relationships.js', () => ({
  scoreProblemsWithRelationships: jest.fn(),
}));

jest.mock('../../../services/problem/problemladderService.js', () => ({
  regenerateCompletedPatternLadder: jest.fn(),
}));

jest.mock('../problemsHelpers.js', () => ({
  calculateCompositeScore: jest.fn(),
  logCompositeScores: jest.fn(),
}));

jest.mock('../problems.js', () => ({
  fetchAllProblems: jest.fn(),
}));

// -- Imports -----------------------------------------------------------------

import { dbHelper } from '../../index.js';
import { getAllStandardProblems } from '../standard_problems.js';
import { TagService } from '../../../services/attempts/tagServices.js';
import FocusCoordinationService from '../../../services/focus/focusCoordinationService.js';
import { getDifficultyAllowanceForTag } from '../../../utils/leitner/Utils.js';
import { scoreProblemsWithRelationships } from '../problem_relationships.js';
import { regenerateCompletedPatternLadder } from '../../../services/problem/problemladderService.js';
import { calculateCompositeScore } from '../problemsHelpers.js';
import { fetchAllProblems } from '../problems.js';

import {
  createTestDb,
  closeTestDb,
  seedStore,
} from '../../../../../test/testDbHelper.js';

import {
  loadProblemSelectionContext,
  filterProblemsByDifficultyCap,
  logProblemSelectionStart,
  calculateTagDifficultyAllowances,
  selectPrimaryAndExpansionProblems,
  addExpansionProblems,
  logSelectedProblems,
  expandWithRemainingFocusTags,
  fillRemainingWithRandomProblems,
  getDifficultyScore,
  selectProblemsForTag,
} from '../problemsSelection.js';

import logger from '../../../utils/logging/logger.js';

// -- Lifecycle ---------------------------------------------------------------

let testDb;

beforeEach(async () => {
  testDb = await createTestDb();
  dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
  jest.clearAllMocks();
  // Re-wire after clearAllMocks
  dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
});

afterEach(() => {
  closeTestDb(testDb);
});

// -- filterProblemsByDifficultyCap -------------------------------------------

describe('filterProblemsByDifficultyCap', () => {
  const problems = [
    { id: 1, difficulty: 'Easy' },
    { id: 2, difficulty: 'Medium' },
    { id: 3, difficulty: 'Hard' },
    { id: 4, difficulty: 'Easy' },
  ];

  it('filters to Easy only when cap is Easy', () => {
    const result = filterProblemsByDifficultyCap(problems, 'Easy');
    expect(result).toHaveLength(2);
    expect(result.every(p => p.difficulty === 'Easy')).toBe(true);
  });

  it('includes Easy and Medium when cap is Medium', () => {
    const result = filterProblemsByDifficultyCap(problems, 'Medium');
    expect(result).toHaveLength(3);
    expect(result.map(p => p.id).sort()).toEqual([1, 2, 4]);
  });

  it('includes all difficulties when cap is Hard', () => {
    const result = filterProblemsByDifficultyCap(problems, 'Hard');
    expect(result).toHaveLength(4);
  });

  it('defaults to max difficulty (3) for unknown cap string', () => {
    const result = filterProblemsByDifficultyCap(problems, 'Unknown');
    expect(result).toHaveLength(4);
  });

  it('defaults problem difficulty to Medium (2) when missing', () => {
    const result = filterProblemsByDifficultyCap(
      [{ id: 5 }], // no difficulty field
      'Easy'
    );
    expect(result).toHaveLength(0);
  });
});

// -- getDifficultyScore ------------------------------------------------------

describe('getDifficultyScore', () => {
  it('returns 1 for Easy', () => expect(getDifficultyScore('Easy')).toBe(1));
  it('returns 2 for Medium', () => expect(getDifficultyScore('Medium')).toBe(2));
  it('returns 3 for Hard', () => expect(getDifficultyScore('Hard')).toBe(3));
  it('defaults to 2 for unknown', () => {
    expect(getDifficultyScore('Extreme')).toBe(2);
    expect(getDifficultyScore(undefined)).toBe(2);
  });
});

// -- logProblemSelectionStart ------------------------------------------------

describe('logProblemSelectionStart', () => {
  it('logs focus decision and debug data without throwing', () => {
    const context = {
      enhancedFocusTags: ['array', 'dp'],
      focusDecision: {
        algorithmReasoning: 'test',
        userPreferences: [],
        systemRecommendation: 'array',
      },
      availableProblems: [{ id: 1 }],
      ladders: { array: {} },
    };

    expect(() => logProblemSelectionStart(5, context)).not.toThrow();
    expect(logger.info).toHaveBeenCalled();
  });

  it('handles null ladders gracefully', () => {
    const context = {
      enhancedFocusTags: [],
      focusDecision: {
        algorithmReasoning: null,
        userPreferences: null,
        systemRecommendation: null,
      },
      availableProblems: [],
      ladders: null,
    };

    expect(() => logProblemSelectionStart(0, context)).not.toThrow();
  });
});

// -- logSelectedProblems -----------------------------------------------------

describe('logSelectedProblems', () => {
  it('logs difficulty breakdown of selected problems', () => {
    const selected = [
      { id: 1, difficulty: 'Easy', title: 'A' },
      { id: 2, difficulty: 'Medium', title: 'B' },
      { id: 3, difficulty: 'Hard', title: 'C' },
    ];

    logSelectedProblems(selected);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Selected 3 problems'),
    );
  });

  it('handles empty list without errors', () => {
    logSelectedProblems([]);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Selected 0 problems'),
    );
  });
});

// -- calculateTagDifficultyAllowances ----------------------------------------

describe('calculateTagDifficultyAllowances', () => {
  it('computes allowances for each enhanced focus tag', () => {
    getDifficultyAllowanceForTag.mockReturnValue({ Easy: 3, Medium: 2, Hard: 1 });

    const masteryData = [
      { tag: 'array', totalAttempts: 5, successfulAttempts: 3, mastered: false },
    ];
    const tagRelationshipsRaw = [
      { id: 'array', difficulty_distribution: { easy: 10, medium: 20, hard: 5 } },
    ];

    const result = calculateTagDifficultyAllowances(
      ['array'],
      masteryData,
      tagRelationshipsRaw
    );

    expect(result).toEqual({ array: { Easy: 3, Medium: 2, Hard: 1 } });
    expect(getDifficultyAllowanceForTag).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: 'array',
        totalAttempts: 5,
        difficulty_distribution: { easy: 10, medium: 20, hard: 5 },
      })
    );
  });

  it('creates default mastery when tag not in masteryData', () => {
    getDifficultyAllowanceForTag.mockReturnValue({ Easy: 1, Medium: 1, Hard: 1 });

    const result = calculateTagDifficultyAllowances(['dp'], [], []);

    expect(result).toEqual({ dp: { Easy: 1, Medium: 1, Hard: 1 } });
    expect(getDifficultyAllowanceForTag).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: 'dp',
        totalAttempts: 0,
        successfulAttempts: 0,
        mastered: false,
      })
    );
  });

  it('handles tag not found in tagRelationshipsRaw', () => {
    getDifficultyAllowanceForTag.mockReturnValue({ Easy: 2, Medium: 2, Hard: 0 });

    const result = calculateTagDifficultyAllowances(
      ['tree'],
      [{ tag: 'tree', totalAttempts: 1, successfulAttempts: 0, mastered: false }],
      []
    );

    expect(result).toEqual({ tree: { Easy: 2, Medium: 2, Hard: 0 } });
  });

  it('handles multiple tags', () => {
    getDifficultyAllowanceForTag.mockReturnValue({ Easy: 1, Medium: 1, Hard: 0 });

    const result = calculateTagDifficultyAllowances(
      ['array', 'dp'],
      [],
      []
    );

    expect(Object.keys(result)).toEqual(['array', 'dp']);
  });
});

// -- fillRemainingWithRandomProblems -----------------------------------------

describe('fillRemainingWithRandomProblems', () => {
  it('fills remaining slots with random unused problems', () => {
    const selected = [{ id: 1 }];
    const usedIds = new Set([1]);
    const available = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

    fillRemainingWithRandomProblems(3, selected, usedIds, available);

    expect(selected).toHaveLength(3);
    expect(selected.map(p => p.id)).toContain(2);
    expect(selected.map(p => p.id)).toContain(3);
  });

  it('does nothing when already at target count', () => {
    const selected = [{ id: 1 }, { id: 2 }];
    fillRemainingWithRandomProblems(2, selected, new Set(), [{ id: 3 }]);
    expect(selected).toHaveLength(2);
  });

  it('does nothing when available problems list is empty', () => {
    const selected = [{ id: 1 }];
    fillRemainingWithRandomProblems(5, selected, new Set(), []);
    expect(selected).toHaveLength(1);
  });

  it('excludes problems already in usedProblemIds', () => {
    const selected = [];
    const usedIds = new Set([1, 2]);
    const available = [{ id: 1 }, { id: 2 }, { id: 3 }];

    fillRemainingWithRandomProblems(2, selected, usedIds, available);

    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe(3);
  });

  it('logs info about fallback selection', () => {
    const selected = [];
    fillRemainingWithRandomProblems(2, selected, new Set(), [{ id: 1 }]);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Tag-based selection found')
    );
  });
});

// -- loadProblemSelectionContext (real DB for tag_relationships) ---------------

describe('loadProblemSelectionContext', () => {
  beforeEach(() => {
    TagService.getCurrentLearningState.mockResolvedValue({
      masteryData: [{ tag: 'array' }],
      _focusTags: ['array'],
      allTagsInCurrentTier: ['array', 'dp'],
    });
    getAllStandardProblems.mockResolvedValue([
      { id: 1, leetcode_id: 1, title: 'Two Sum', difficulty: 'Easy', tags: ['array'] },
      { id: 2, leetcode_id: 2, title: 'Add Two', difficulty: 'Medium', tags: ['dp'] },
    ]);
    fetchAllProblems.mockResolvedValue([
      { leetcode_id: 1, problem_id: 'p1' },
    ]);
    FocusCoordinationService.getFocusDecision.mockResolvedValue({
      activeFocusTags: ['array'],
      algorithmReasoning: 'test',
    });
  });

  it('reads tag_relationships from real DB and returns full context', async () => {
    await seedStore(testDb.db, 'tag_relationships', [
      { id: 'array', classification: 'Core Concept', related_tags: [], difficulty_distribution: { easy: 5, medium: 5, hard: 0 } },
    ]);

    const ctx = await loadProblemSelectionContext(null);

    expect(ctx.masteryData).toEqual([{ tag: 'array' }]);
    expect(ctx.tagRelationshipsRaw).toHaveLength(1);
    expect(ctx.tagRelationshipsRaw[0].id).toBe('array');
    expect(ctx.enhancedFocusTags).toEqual(['array']);
  });

  it('filters out attempted problems from available set', async () => {
    await seedStore(testDb.db, 'tag_relationships', []);

    const ctx = await loadProblemSelectionContext(null);

    // Problem 1 (leetcode_id=1) was attempted, so only problem 2 remains
    expect(ctx.availableProblems).toHaveLength(1);
    expect(ctx.availableProblems[0].id).toBe(2);
  });

  it('applies difficulty cap to available problems', async () => {
    await seedStore(testDb.db, 'tag_relationships', []);

    const ctx = await loadProblemSelectionContext('Easy');

    // Problem 2 is Medium, filtered by Easy cap
    // Problem 1 is Easy but already attempted
    expect(ctx.availableProblems).toHaveLength(0);
  });

  it('returns all context fields', async () => {
    await seedStore(testDb.db, 'tag_relationships', []);

    const ctx = await loadProblemSelectionContext(null);

    expect(ctx).toHaveProperty('masteryData');
    expect(ctx).toHaveProperty('allTagsInCurrentTier');
    expect(ctx).toHaveProperty('availableProblems');
    expect(ctx).toHaveProperty('ladders');
    expect(ctx).toHaveProperty('focusDecision');
    expect(ctx).toHaveProperty('enhancedFocusTags');
    expect(ctx).toHaveProperty('tagRelationshipsRaw');
  });

  it('returns empty tag_relationships when store is empty', async () => {
    const ctx = await loadProblemSelectionContext(null);

    expect(ctx.tagRelationshipsRaw).toEqual([]);
  });

  it('returns multiple tag_relationships records', async () => {
    await seedStore(testDb.db, 'tag_relationships', [
      { id: 'array', classification: 'Core', related_tags: [] },
      { id: 'dp', classification: 'Advanced', related_tags: [] },
    ]);

    const ctx = await loadProblemSelectionContext(null);

    expect(ctx.tagRelationshipsRaw).toHaveLength(2);
  });
});

// -- selectProblemsForTag (real DB for ladder + relationships) ----------------

describe('selectProblemsForTag', () => {
  it('selects problems from ladder, scored and sorted by composite score', async () => {
    const standardProblems = [
      { id: 10, title: 'P10', difficulty: 'Easy', tags: ['array'] },
      { id: 20, title: 'P20', difficulty: 'Medium', tags: ['array'] },
    ];

    scoreProblemsWithRelationships.mockResolvedValue([
      { id: 10, difficulty: 'Easy', tags: ['array'], difficultyScore: 1, allowanceWeight: 1, relationshipScore: 0.5 },
      { id: 20, difficulty: 'Medium', tags: ['array'], difficultyScore: 2, allowanceWeight: 0.8, relationshipScore: 0.3 },
    ]);
    calculateCompositeScore.mockImplementation((p) => p.relationshipScore || 0);
    regenerateCompletedPatternLadder.mockResolvedValue();

    await seedStore(testDb.db, 'pattern_ladders', [
      {
        tag: 'array',
        problems: [
          { id: 10, difficulty: 'Easy', tags: ['array'], attempted: false },
          { id: 20, difficulty: 'Medium', tags: ['array'], attempted: false },
        ],
      },
    ]);

    const result = await selectProblemsForTag('array', 2, {
      difficultyAllowance: { Easy: 3, Medium: 3, Hard: 1 },
      ladders: {
        array: {
          problems: [
            { id: 10, difficulty: 'Easy', tags: ['array'], attempted: false },
            { id: 20, difficulty: 'Medium', tags: ['array'], attempted: false },
          ],
        },
      },
      allProblems: standardProblems,
      allTagsInCurrentTier: ['array'],
      usedProblemIds: new Set(),
      currentDifficultyCap: null,
    });

    expect(result).toHaveLength(2);
    expect(scoreProblemsWithRelationships).toHaveBeenCalled();
    expect(calculateCompositeScore).toHaveBeenCalled();
  });

  it('skips problems already in usedProblemIds', async () => {
    scoreProblemsWithRelationships.mockResolvedValue([]);
    calculateCompositeScore.mockReturnValue(0.5);
    regenerateCompletedPatternLadder.mockResolvedValue();

    await seedStore(testDb.db, 'pattern_ladders', [
      { tag: 'dp', problems: [{ id: 99, difficulty: 'Hard', tags: ['dp'], attempted: false }] },
    ]);

    const result = await selectProblemsForTag('dp', 1, {
      difficultyAllowance: { Easy: 1, Medium: 1, Hard: 1 },
      ladders: {
        dp: {
          problems: [{ id: 99, difficulty: 'Hard', tags: ['dp'], attempted: false }],
        },
      },
      allProblems: [{ id: 99, title: 'P99', difficulty: 'Hard', tags: ['dp'] }],
      allTagsInCurrentTier: ['dp'],
      usedProblemIds: new Set([99]),
      currentDifficultyCap: null,
    });

    expect(result).toHaveLength(0);
  });

  it('filters out problems whose difficulty has zero allowance', async () => {
    scoreProblemsWithRelationships.mockResolvedValue([]);
    regenerateCompletedPatternLadder.mockResolvedValue();

    await seedStore(testDb.db, 'pattern_ladders', [
      { tag: 'dp', problems: [{ id: 5, difficulty: 'Hard', tags: ['dp'], attempted: false }] },
    ]);

    const result = await selectProblemsForTag('dp', 1, {
      difficultyAllowance: { Easy: 1, Medium: 1, Hard: 0 },
      ladders: {
        dp: {
          problems: [{ id: 5, difficulty: 'Hard', tags: ['dp'], attempted: false }],
        },
      },
      allProblems: [{ id: 5, title: 'P5', difficulty: 'Hard', tags: ['dp'] }],
      allTagsInCurrentTier: ['dp'],
      usedProblemIds: new Set(),
      currentDifficultyCap: null,
    });

    expect(result).toHaveLength(0);
  });

  it('triggers ladder regeneration when available below 60% threshold', async () => {
    scoreProblemsWithRelationships.mockResolvedValue([]);
    regenerateCompletedPatternLadder.mockResolvedValue();

    await seedStore(testDb.db, 'pattern_ladders', [
      { tag: 'tree', problems: [] },
    ]);

    await selectProblemsForTag('tree', 10, {
      difficultyAllowance: { Easy: 5, Medium: 5, Hard: 5 },
      ladders: { tree: { problems: [] } },
      allProblems: [],
      allTagsInCurrentTier: ['tree'],
      usedProblemIds: new Set(),
      currentDifficultyCap: null,
    });

    expect(regenerateCompletedPatternLadder).toHaveBeenCalledWith('tree');
  });

  it('handles regeneration failure gracefully', async () => {
    scoreProblemsWithRelationships.mockResolvedValue([]);
    regenerateCompletedPatternLadder.mockRejectedValue(new Error('regen failed'));

    await seedStore(testDb.db, 'pattern_ladders', [
      { tag: 'graph', problems: [] },
    ]);

    const result = await selectProblemsForTag('graph', 5, {
      difficultyAllowance: { Easy: 3, Medium: 3, Hard: 3 },
      ladders: { graph: { problems: [] } },
      allProblems: [],
      allTagsInCurrentTier: ['graph'],
      usedProblemIds: new Set(),
      currentDifficultyCap: null,
    });

    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to regenerate ladder'),
      expect.any(Error)
    );
  });

  it('filters problems whose tag does not match the target tag', async () => {
    scoreProblemsWithRelationships.mockResolvedValue([]);
    regenerateCompletedPatternLadder.mockResolvedValue();

    await seedStore(testDb.db, 'pattern_ladders', [
      { tag: 'array', problems: [] },
    ]);

    const result = await selectProblemsForTag('array', 1, {
      difficultyAllowance: { Easy: 3, Medium: 3, Hard: 3 },
      ladders: {
        array: {
          problems: [{ id: 1, difficulty: 'Easy', tags: ['dp'], attempted: false }],
        },
      },
      allProblems: [{ id: 1, title: 'DP Problem', difficulty: 'Easy', tags: ['dp'] }],
      allTagsInCurrentTier: ['array'],
      usedProblemIds: new Set(),
      currentDifficultyCap: null,
    });

    expect(result).toHaveLength(0);
  });

  it('sorts by composite score descending, then difficulty ascending', async () => {
    scoreProblemsWithRelationships.mockResolvedValue([
      { id: 10, difficulty: 'Easy', tags: ['array'], difficultyScore: 1, allowanceWeight: 1 },
      { id: 20, difficulty: 'Hard', tags: ['array'], difficultyScore: 3, allowanceWeight: 1 },
    ]);
    calculateCompositeScore
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.9);
    regenerateCompletedPatternLadder.mockResolvedValue();

    await seedStore(testDb.db, 'pattern_ladders', [
      { tag: 'array', problems: [] },
    ]);

    const standardProblems = [
      { id: 10, title: 'P10', difficulty: 'Easy', tags: ['array'] },
      { id: 20, title: 'P20', difficulty: 'Hard', tags: ['array'] },
    ];

    const result = await selectProblemsForTag('array', 2, {
      difficultyAllowance: { Easy: 3, Medium: 3, Hard: 3 },
      ladders: {
        array: {
          problems: [
            { id: 10, difficulty: 'Easy', tags: ['array'], attempted: false },
            { id: 20, difficulty: 'Hard', tags: ['array'], attempted: false },
          ],
        },
      },
      allProblems: standardProblems,
      allTagsInCurrentTier: ['array'],
      usedProblemIds: new Set(),
      currentDifficultyCap: null,
    });

    // Problem 20 has higher composite score (0.9) so should come first
    expect(result[0].id).toBe(20);
    expect(result[1].id).toBe(10);
  });
});

// -- expandWithRemainingFocusTags --------------------------------------------

describe('expandWithRemainingFocusTags', () => {
  it('does nothing when selectedProblems already meets target', async () => {
    const selected = [{ id: 1 }, { id: 2 }, { id: 3 }];

    await expandWithRemainingFocusTags({
      numNewProblems: 3,
      selectedProblems: selected,
      usedProblemIds: new Set([1, 2, 3]),
      context: {
        enhancedFocusTags: ['a', 'b', 'c'],
        masteryData: [],
        ladders: {},
        availableProblems: [],
        allTagsInCurrentTier: [],
      },
      currentDifficultyCap: null,
    });

    expect(selected).toHaveLength(3);
  });

  it('does nothing when only 2 or fewer focus tags', async () => {
    const selected = [{ id: 1 }];

    await expandWithRemainingFocusTags({
      numNewProblems: 5,
      selectedProblems: selected,
      usedProblemIds: new Set([1]),
      context: {
        enhancedFocusTags: ['a', 'b'],
        masteryData: [],
        ladders: {},
        availableProblems: [],
        allTagsInCurrentTier: [],
      },
      currentDifficultyCap: null,
    });

    expect(selected).toHaveLength(1);
  });
});

// -- addExpansionProblems ----------------------------------------------------

describe('addExpansionProblems', () => {
  it('enriches tagMastery with difficulty_distribution from tagRelationshipsRaw', async () => {
    getDifficultyAllowanceForTag.mockReturnValue({ Easy: 2, Medium: 2, Hard: 1 });
    scoreProblemsWithRelationships.mockResolvedValue([]);
    calculateCompositeScore.mockReturnValue(0.5);
    regenerateCompletedPatternLadder.mockResolvedValue();

    await seedStore(testDb.db, 'pattern_ladders', [
      { tag: 'dp', problems: [] },
    ]);

    const selected = [];

    await addExpansionProblems({
      expansionCount: 2,
      context: {
        enhancedFocusTags: ['array', 'dp'],
        masteryData: [{ tag: 'dp', totalAttempts: 3, successfulAttempts: 2, mastered: false }],
        tagRelationshipsRaw: [
          { id: 'dp', difficulty_distribution: { easy: 5, medium: 10, hard: 2 } },
        ],
        ladders: { dp: { problems: [] } },
        availableProblems: [],
        allTagsInCurrentTier: ['dp'],
      },
      selectedProblems: selected,
      usedProblemIds: new Set(),
      currentDifficultyCap: null,
    });

    expect(getDifficultyAllowanceForTag).toHaveBeenCalledWith(
      expect.objectContaining({
        difficulty_distribution: { easy: 5, medium: 10, hard: 2 },
      })
    );
  });

  it('uses default mastery when expansion tag has no mastery data', async () => {
    getDifficultyAllowanceForTag.mockReturnValue({ Easy: 1, Medium: 1, Hard: 0 });
    scoreProblemsWithRelationships.mockResolvedValue([]);
    regenerateCompletedPatternLadder.mockResolvedValue();

    await seedStore(testDb.db, 'pattern_ladders', [
      { tag: 'graph', problems: [] },
    ]);

    const selected = [];

    await addExpansionProblems({
      expansionCount: 1,
      context: {
        enhancedFocusTags: ['array', 'graph'],
        masteryData: [],
        tagRelationshipsRaw: [],
        ladders: { graph: { problems: [] } },
        availableProblems: [],
        allTagsInCurrentTier: ['graph'],
      },
      selectedProblems: selected,
      usedProblemIds: new Set(),
      currentDifficultyCap: null,
    });

    expect(getDifficultyAllowanceForTag).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: 'graph',
        totalAttempts: 0,
        mastered: false,
      })
    );
  });
});

// -- selectPrimaryAndExpansionProblems ----------------------------------------

describe('selectPrimaryAndExpansionProblems', () => {
  it('selects primary problems and adds expansion when needed', async () => {
    scoreProblemsWithRelationships.mockResolvedValue([
      { id: 10, difficulty: 'Easy', tags: ['array'], difficultyScore: 1, allowanceWeight: 1, relationshipScore: 0.9 },
    ]);
    calculateCompositeScore.mockReturnValue(0.9);
    regenerateCompletedPatternLadder.mockResolvedValue();
    getDifficultyAllowanceForTag.mockReturnValue({ Easy: 3, Medium: 3, Hard: 1 });

    await seedStore(testDb.db, 'pattern_ladders', [
      { tag: 'array', problems: [{ id: 10, difficulty: 'Easy', tags: ['array'], attempted: false }] },
      { tag: 'dp', problems: [] },
    ]);

    const result = await selectPrimaryAndExpansionProblems(
      2,
      {
        enhancedFocusTags: ['array', 'dp'],
        masteryData: [],
        ladders: {
          array: { problems: [{ id: 10, difficulty: 'Easy', tags: ['array'], attempted: false }] },
          dp: { problems: [] },
        },
        availableProblems: [{ id: 10, title: 'P10', difficulty: 'Easy', tags: ['array'] }],
        allTagsInCurrentTier: ['array', 'dp'],
        tagRelationshipsRaw: [],
      },
      { array: { Easy: 3, Medium: 3, Hard: 1 } },
      null
    );

    expect(result.selectedProblems.length).toBeGreaterThanOrEqual(1);
    expect(result.usedProblemIds).toBeInstanceOf(Set);
  });

  it('returns usedProblemIds that include excludeIds', async () => {
    scoreProblemsWithRelationships.mockResolvedValue([]);
    calculateCompositeScore.mockReturnValue(0.5);
    regenerateCompletedPatternLadder.mockResolvedValue();
    getDifficultyAllowanceForTag.mockReturnValue({ Easy: 1, Medium: 1, Hard: 1 });

    await seedStore(testDb.db, 'pattern_ladders', [
      { tag: 'array', problems: [] },
    ]);

    const result = await selectPrimaryAndExpansionProblems(
      1,
      {
        enhancedFocusTags: ['array'],
        masteryData: [],
        ladders: { array: { problems: [] } },
        availableProblems: [],
        allTagsInCurrentTier: ['array'],
        tagRelationshipsRaw: [],
      },
      { array: { Easy: 1, Medium: 1, Hard: 1 } },
      null,
      new Set([42, 43])
    );

    expect(result.usedProblemIds.has(42)).toBe(true);
    expect(result.usedProblemIds.has(43)).toBe(true);
  });

  it('does not add expansion when only 1 focus tag', async () => {
    scoreProblemsWithRelationships.mockResolvedValue([]);
    calculateCompositeScore.mockReturnValue(0.5);
    regenerateCompletedPatternLadder.mockResolvedValue();

    await seedStore(testDb.db, 'pattern_ladders', [
      { tag: 'array', problems: [] },
    ]);

    const result = await selectPrimaryAndExpansionProblems(
      3,
      {
        enhancedFocusTags: ['array'],
        masteryData: [],
        ladders: { array: { problems: [] } },
        availableProblems: [],
        allTagsInCurrentTier: ['array'],
        tagRelationshipsRaw: [],
      },
      { array: { Easy: 1, Medium: 1, Hard: 1 } },
      null
    );

    // With only 1 focus tag, no expansion occurs
    expect(result.selectedProblems).toEqual([]);
  });
});
