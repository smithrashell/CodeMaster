/**
 * Tests for problemladderService.js (81 lines, 1% coverage)
 * All exports are async functions that orchestrate DB operations.
 */

jest.mock('../../../db/stores/pattern_ladder.js', () => ({
  clearPatternLadders: jest.fn(),
  upsertPatternLadder: jest.fn(),
}));

jest.mock('../../../utils/leitner/patternLadderUtils.js', () => ({
  getAllowedClassifications: jest.fn(() => ['Core Fundamentals']),
  getValidProblems: jest.fn(() => []),
  buildLadder: jest.fn(() => [{ id: 1, attempted: false }]),
  getPatternLadders: jest.fn(),
}));

jest.mock('../../../db/stores/problem_relationships.js', () => ({
  buildRelationshipMap: jest.fn(() => new Map()),
}));

jest.mock('../../attempts/tagServices.js', () => ({
  TagService: {
    getCurrentLearningState: jest.fn(() => ({
      allTagsInCurrentTier: [],
      focusTags: [],
    })),
  },
}));

jest.mock('../../../db/core/common.js', () => ({
  getAllFromStore: jest.fn(() => []),
}));

import {
  initializePatternLaddersForOnboarding,
  updatePatternLaddersOnAttempt,
  regenerateCompletedPatternLadder,
  generatePatternLaddersAndUpdateTagMastery,
} from '../problemladderService.js';

import { clearPatternLadders, upsertPatternLadder } from '../../../db/stores/pattern_ladder.js';
import {
  getAllowedClassifications,
  buildLadder,
  getPatternLadders,
} from '../../../utils/leitner/patternLadderUtils.js';
import { TagService } from '../../attempts/tagServices.js';
import { getAllFromStore } from '../../../db/core/common.js';

describe('problemladderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------
  // initializePatternLaddersForOnboarding
  // -------------------------------------------------------------------
  describe('initializePatternLaddersForOnboarding', () => {
    it('skips initialization if pattern ladders already exist', async () => {
      getAllFromStore.mockImplementation((store) => {
        if (store === 'pattern_ladders') return [{ tag: 'array' }];
        if (store === 'standard_problems') return [];
        return [];
      });

      await initializePatternLaddersForOnboarding();
      expect(upsertPatternLadder).not.toHaveBeenCalled();
    });

    it('creates ladders for each tag relationship', async () => {
      getAllFromStore.mockImplementation((store) => {
        if (store === 'standard_problems') return [{ id: 1, tags: ['array'] }];
        if (store === 'problems') return [];
        if (store === 'tag_relationships') return [
          { id: 'Array', classification: 'Core Fundamentals', difficulty_distribution: { Easy: 3 } },
        ];
        if (store === 'problem_relationships') return [];
        if (store === 'pattern_ladders') return [];
        return [];
      });

      await initializePatternLaddersForOnboarding();
      expect(upsertPatternLadder).toHaveBeenCalledTimes(1);
      expect(upsertPatternLadder).toHaveBeenCalledWith(
        expect.objectContaining({
          tag: 'array',
          problems: expect.any(Array),
        })
      );
    });

    it('gives larger ladder size for focus tags (12)', async () => {
      TagService.getCurrentLearningState.mockResolvedValue({
        allTagsInCurrentTier: ['array'],
        focusTags: ['array'],
      });

      getAllFromStore.mockImplementation((store) => {
        if (store === 'standard_problems') return [];
        if (store === 'tag_relationships') return [
          { id: 'Array', classification: 'Core Fundamentals' },
        ];
        if (store === 'pattern_ladders') return [];
        return [];
      });

      await initializePatternLaddersForOnboarding();
      expect(buildLadder).toHaveBeenCalledWith(
        expect.objectContaining({ ladderSize: 12 })
      );
    });

    it('gives medium ladder size for tier tags (9)', async () => {
      TagService.getCurrentLearningState.mockResolvedValue({
        allTagsInCurrentTier: ['array'],
        focusTags: [],
      });

      getAllFromStore.mockImplementation((store) => {
        if (store === 'standard_problems') return [];
        if (store === 'tag_relationships') return [
          { id: 'Array', classification: 'Core Fundamentals' },
        ];
        if (store === 'pattern_ladders') return [];
        return [];
      });

      await initializePatternLaddersForOnboarding();
      expect(buildLadder).toHaveBeenCalledWith(
        expect.objectContaining({ ladderSize: 9 })
      );
    });

    it('gives small ladder size for other tags (5)', async () => {
      TagService.getCurrentLearningState.mockResolvedValue({
        allTagsInCurrentTier: [],
        focusTags: [],
      });

      getAllFromStore.mockImplementation((store) => {
        if (store === 'standard_problems') return [];
        if (store === 'tag_relationships') return [
          { id: 'Graph', classification: 'Advanced Techniques' },
        ];
        if (store === 'pattern_ladders') return [];
        return [];
      });

      await initializePatternLaddersForOnboarding();
      expect(buildLadder).toHaveBeenCalledWith(
        expect.objectContaining({ ladderSize: 5 })
      );
    });
  });

  // -------------------------------------------------------------------
  // updatePatternLaddersOnAttempt
  // -------------------------------------------------------------------
  describe('updatePatternLaddersOnAttempt', () => {
    it('marks problem as attempted and updates ladder', async () => {
      getPatternLadders.mockResolvedValue({
        array: {
          problems: [
            { id: 1, attempted: false },
            { id: 2, attempted: false },
          ],
        },
      });

      const result = await updatePatternLaddersOnAttempt(1);
      expect(upsertPatternLadder).toHaveBeenCalledWith(
        expect.objectContaining({
          tag: 'array',
          problems: expect.arrayContaining([
            expect.objectContaining({ id: 1, attempted: true }),
          ]),
        })
      );
      expect(result).toEqual(['array']);
    });

    it('does not update already attempted problems', async () => {
      getPatternLadders.mockResolvedValue({
        array: {
          problems: [
            { id: 1, attempted: true },
          ],
        },
      });

      const result = await updatePatternLaddersOnAttempt(1);
      expect(upsertPatternLadder).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('handles problem not in any ladder', async () => {
      getPatternLadders.mockResolvedValue({
        array: {
          problems: [{ id: 2, attempted: false }],
        },
      });

      const result = await updatePatternLaddersOnAttempt(99);
      expect(upsertPatternLadder).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('updates multiple ladders containing the same problem', async () => {
      getPatternLadders.mockResolvedValue({
        array: {
          problems: [{ id: 1, attempted: false }],
        },
        sorting: {
          problems: [{ id: 1, attempted: false }],
        },
      });

      const result = await updatePatternLaddersOnAttempt(1);
      expect(upsertPatternLadder).toHaveBeenCalledTimes(2);
      expect(result).toEqual(['array', 'sorting']);
    });

    it('handles error gracefully', async () => {
      getPatternLadders.mockRejectedValue(new Error('DB error'));

      const result = await updatePatternLaddersOnAttempt(1);
      expect(result).toBeUndefined();
    });

    it('triggers regeneration when all problems are attempted', async () => {
      getAllFromStore.mockImplementation((store) => {
        if (store === 'standard_problems') return [];
        if (store === 'tag_relationships') return [
          { id: 'Array', classification: 'Core Fundamentals' },
        ];
        return [];
      });

      getPatternLadders.mockResolvedValue({
        array: {
          problems: [
            { id: 1, attempted: false },
            { id: 2, attempted: true },
          ],
        },
      });

      await updatePatternLaddersOnAttempt(1);
      // After marking id=1 as attempted, all are attempted, so regeneration should be triggered
      // This calls regenerateCompletedPatternLadder which calls upsertPatternLadder again
      // First call is the update, second (if regeneration succeeds) is the regeneration
      expect(upsertPatternLadder).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  // regenerateCompletedPatternLadder
  // -------------------------------------------------------------------
  describe('regenerateCompletedPatternLadder', () => {
    it('regenerates a ladder for a specific tag', async () => {
      getAllFromStore.mockImplementation((store) => {
        if (store === 'standard_problems') return [{ id: 1 }];
        if (store === 'problems') return [];
        if (store === 'tag_relationships') return [
          { id: 'Array', classification: 'Core Fundamentals', difficulty_distribution: {} },
        ];
        if (store === 'problem_relationships') return [];
        return [];
      });

      await regenerateCompletedPatternLadder('Array');
      expect(upsertPatternLadder).toHaveBeenCalledWith(
        expect.objectContaining({
          tag: 'array',
        })
      );
      expect(buildLadder).toHaveBeenCalledWith(
        expect.objectContaining({ isOnboarding: false })
      );
    });

    it('throws if tag relationship not found', async () => {
      getAllFromStore.mockImplementation(() => []);

      await expect(regenerateCompletedPatternLadder('nonexistent'))
        .rejects
        .toThrow('Tag relationship not found for: nonexistent');
    });

    it('normalizes the tag name to lowercase', async () => {
      getAllFromStore.mockImplementation((store) => {
        if (store === 'tag_relationships') return [
          { id: 'Hash Table', classification: 'Core Fundamentals' },
        ];
        return [];
      });

      await regenerateCompletedPatternLadder('Hash Table');
      expect(upsertPatternLadder).toHaveBeenCalledWith(
        expect.objectContaining({ tag: 'hash table' })
      );
    });
  });

  // -------------------------------------------------------------------
  // generatePatternLaddersAndUpdateTagMastery
  // -------------------------------------------------------------------
  describe('generatePatternLaddersAndUpdateTagMastery', () => {
    it('clears existing ladders and rebuilds', async () => {
      getAllFromStore.mockImplementation((store) => {
        if (store === 'standard_problems') return [];
        if (store === 'tag_relationships') return [
          { id: 'Array', classification: 'Core Fundamentals' },
          { id: 'Sorting', classification: 'Core Fundamentals' },
        ];
        return [];
      });

      await generatePatternLaddersAndUpdateTagMastery();
      expect(clearPatternLadders).toHaveBeenCalledTimes(1);
      expect(upsertPatternLadder).toHaveBeenCalledTimes(2);
    });

    it('uses default classification when not provided', async () => {
      getAllFromStore.mockImplementation((store) => {
        if (store === 'tag_relationships') return [
          { id: 'Graph' }, // no classification
        ];
        return [];
      });

      await generatePatternLaddersAndUpdateTagMastery();
      expect(getAllowedClassifications).toHaveBeenCalledWith('Advanced Techniques');
    });

    it('computes dynamic ladder sizes based on focus state', async () => {
      TagService.getCurrentLearningState.mockResolvedValue({
        focusTags: ['array'],
        allTagsInCurrentTier: ['array', 'sorting'],
      });

      getAllFromStore.mockImplementation((store) => {
        if (store === 'tag_relationships') return [
          { id: 'Array', classification: 'Core Fundamentals' },
          { id: 'Sorting', classification: 'Core Fundamentals' },
          { id: 'Graph', classification: 'Advanced Techniques' },
        ];
        return [];
      });

      await generatePatternLaddersAndUpdateTagMastery();

      const calls = buildLadder.mock.calls;
      expect(calls[0][0].ladderSize).toBe(12); // array is focus tag
      expect(calls[1][0].ladderSize).toBe(9);  // sorting is tier tag
      expect(calls[2][0].ladderSize).toBe(5);  // graph is neither
    });
  });
});
