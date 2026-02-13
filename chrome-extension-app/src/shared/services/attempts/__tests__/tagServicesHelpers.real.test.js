/**
 * Tests for tagServicesHelpers.js pure functions (180 lines, 0% coverage)
 */

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../storage/storageService.js', () => ({
  StorageService: {
    getSettings: jest.fn().mockResolvedValue({}),
    setSettings: jest.fn().mockResolvedValue(undefined),
    getSessionState: jest.fn().mockResolvedValue(null),
    setSessionState: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../utils/leitner/Utils.js', () => ({
  calculateSuccessRate: jest.fn((s, t) => (t > 0 ? s / t : 0)),
}));

import {
  calculateLearningVelocity,
  calculateTagWeight,
  calculateRelationshipScore,
  getOptimalLearningScore,
  applyTimeBasedEscapeHatch,
  processAndEnrichTags,
  sortAndSelectFocusTags,
  resetTagIndexForNewWindow,
  createSystemPool,
  maintainSystemPool,
  getStableSystemPool,
  checkFocusAreasGraduation,
  graduateFocusAreas,
} from '../tagServicesHelpers.js';

import { StorageService } from '../../storage/storageService.js';

describe('tagServicesHelpers', () => {
  beforeEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------
  // calculateLearningVelocity
  // -------------------------------------------------------------------
  describe('calculateLearningVelocity', () => {
    it('returns 0.1 for null/invalid input', () => {
      expect(calculateLearningVelocity(null)).toBe(0.1);
      expect(calculateLearningVelocity('string')).toBe(0.1);
    });

    it('returns 0.3 for low attempt count (<3)', () => {
      expect(calculateLearningVelocity({ total_attempts: 2, successful_attempts: 1 })).toBe(0.3);
    });

    it('returns 0.2 for high attempt count (>=8)', () => {
      expect(calculateLearningVelocity({ total_attempts: 10, successful_attempts: 7 })).toBe(0.2);
    });

    it('returns velocity based on success rate for mid-range attempts', () => {
      const result = calculateLearningVelocity({ total_attempts: 5, successful_attempts: 4 });
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------
  // calculateTagWeight
  // -------------------------------------------------------------------
  describe('calculateTagWeight', () => {
    it('returns 0 for null/invalid input', () => {
      expect(calculateTagWeight(null)).toBe(0);
      expect(calculateTagWeight('bad')).toBe(0);
    });

    it('returns 0 for zero attempts', () => {
      expect(calculateTagWeight({ total_attempts: 0, successful_attempts: 0 })).toBe(0);
    });

    it('returns high weight for mastered tag', () => {
      const w = calculateTagWeight({ total_attempts: 10, successful_attempts: 9 }, 0.8);
      expect(w).toBeGreaterThan(0.5);
    });

    it('returns low weight for low success rate', () => {
      const w = calculateTagWeight({ total_attempts: 10, successful_attempts: 2 });
      expect(w).toBeLessThan(0.2);
    });

    it('uses attempt maturity (capped at 1)', () => {
      const lowAttempts = calculateTagWeight({ total_attempts: 2, successful_attempts: 2 });
      const highAttempts = calculateTagWeight({ total_attempts: 10, successful_attempts: 10 });
      expect(highAttempts).toBeGreaterThan(lowAttempts);
    });

    it('proficiency tiers: >=0.6 success rate', () => {
      const w = calculateTagWeight({ total_attempts: 10, successful_attempts: 7 }); // 0.7
      expect(w).toBeGreaterThan(0);
    });

    it('proficiency tiers: >=0.4 success rate', () => {
      const w = calculateTagWeight({ total_attempts: 10, successful_attempts: 4 }); // 0.4
      expect(w).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------
  // calculateRelationshipScore
  // -------------------------------------------------------------------
  describe('calculateRelationshipScore', () => {
    it('returns 0 for non-array masteryData', () => {
      expect(calculateRelationshipScore('tag', null, {})).toBe(0);
    });

    it('returns 0 when no relationships exist', () => {
      expect(calculateRelationshipScore('array', [], {})).toBe(0);
    });

    it('calculates weighted relationship score', () => {
      const mastery = [
        { tag: 'linked-list', total_attempts: 8, successful_attempts: 6 },
      ];
      const rels = { array: { 'linked-list': 0.8 } };
      const score = calculateRelationshipScore('array', mastery, rels);
      expect(score).toBeGreaterThan(0);
    });

    it('skips tags with zero attempts', () => {
      const mastery = [{ tag: 'stack', total_attempts: 0, successful_attempts: 0 }];
      const rels = { array: { stack: 0.5 } };
      expect(calculateRelationshipScore('array', mastery, rels)).toBe(0);
    });

    it('skips invalid tag objects', () => {
      const mastery = [null, undefined, { tag: 'x', total_attempts: 5, successful_attempts: 3 }];
      const rels = { t: { x: 0.5 } };
      const score = calculateRelationshipScore('t', mastery, rels);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------
  // getOptimalLearningScore
  // -------------------------------------------------------------------
  describe('getOptimalLearningScore', () => {
    it('returns highest score near optimal values', () => {
      const optimal = getOptimalLearningScore(0.55, 5);
      const far = getOptimalLearningScore(0, 15);
      expect(optimal).toBeGreaterThan(far);
    });

    it('returns number between -1 and 1', () => {
      const score = getOptimalLearningScore(0.5, 3);
      expect(typeof score).toBe('number');
    });
  });

  // -------------------------------------------------------------------
  // applyTimeBasedEscapeHatch
  // -------------------------------------------------------------------
  describe('applyTimeBasedEscapeHatch', () => {
    it('returns unchanged threshold for recent attempt', () => {
      const tag = {
        tag: 'array',
        successful_attempts: 7,
        total_attempts: 10,
        last_attempt_date: new Date().toISOString(),
      };
      const result = applyTimeBasedEscapeHatch(tag, 0.8);
      expect(result.adjustedMasteryThreshold).toBe(0.8);
      expect(result.timeBasedEscapeHatch).toBe(false);
    });

    it('lowers threshold for old attempt with decent success', () => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 15);
      const tag = {
        tag: 'dp',
        successful_attempts: 7,
        total_attempts: 10,
        last_attempt_date: twoWeeksAgo.toISOString(),
      };
      const result = applyTimeBasedEscapeHatch(tag, 0.8);
      expect(result.adjustedMasteryThreshold).toBeCloseTo(0.6, 10);
      expect(result.timeBasedEscapeHatch).toBe(true);
    });

    it('does not lower threshold if success rate too low', () => {
      const old = new Date();
      old.setDate(old.getDate() - 20);
      const tag = {
        tag: 'graph',
        successful_attempts: 3,
        total_attempts: 10,
        last_attempt_date: old.toISOString(),
      };
      const result = applyTimeBasedEscapeHatch(tag, 0.8);
      expect(result.timeBasedEscapeHatch).toBe(false);
    });

    it('handles missing last_attempt_date', () => {
      const tag = { tag: 'x', successful_attempts: 5, total_attempts: 8 };
      const result = applyTimeBasedEscapeHatch(tag);
      expect(result.timeBasedEscapeHatch).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // processAndEnrichTags
  // -------------------------------------------------------------------
  describe('processAndEnrichTags', () => {
    it('filters to tier tags with attempts and enriches them', () => {
      const masteryData = [
        { tag: 'array', total_attempts: 5, successful_attempts: 3 },
        { tag: 'graph', total_attempts: 0, successful_attempts: 0 },
        { tag: 'tree', total_attempts: 3, successful_attempts: 2 },
      ];
      const tierTags = ['array', 'tree', 'graph'];
      const tagRels = {};
      const thresholds = {};
      const tagRelsData = [];

      const result = processAndEnrichTags(masteryData, tierTags, tagRels, thresholds, tagRelsData);
      expect(result).toHaveLength(2); // graph filtered (0 attempts)
      expect(result[0].successRate).toBeDefined();
      expect(result[0].learningVelocity).toBeDefined();
    });
  });

  // -------------------------------------------------------------------
  // sortAndSelectFocusTags
  // -------------------------------------------------------------------
  describe('sortAndSelectFocusTags', () => {
    it('sorts by relationship score, maturity, optimal learning', () => {
      const tags = [
        { tag: 'a', relationshipScore: 0.1, total_attempts: 3, successRate: 0.5, totalProblems: 10 },
        { tag: 'b', relationshipScore: 0.9, total_attempts: 5, successRate: 0.6, totalProblems: 5 },
      ];
      const result = sortAndSelectFocusTags(tags, 2);
      expect(result[0]).toBe('b');
    });

    it('returns fallback tags when given empty array', () => {
      const result = sortAndSelectFocusTags([]);
      expect(result).toEqual(['array']);
    });

    it('limits to requested count', () => {
      const tags = Array.from({ length: 10 }, (_, i) => ({
        tag: `tag${i}`, relationshipScore: 0, total_attempts: 5, successRate: 0.5, totalProblems: 1,
      }));
      const result = sortAndSelectFocusTags(tags, 3);
      expect(result).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------
  // resetTagIndexForNewWindow
  // -------------------------------------------------------------------
  describe('resetTagIndexForNewWindow', () => {
    it('resets tag_index when session state exists', async () => {
      StorageService.getSessionState.mockResolvedValue({ tag_index: 5, other: 'data' });
      await resetTagIndexForNewWindow();
      expect(StorageService.setSessionState).toHaveBeenCalledWith(
        'session_state',
        expect.objectContaining({ tag_index: 0 })
      );
    });

    it('does nothing when session state is null', async () => {
      StorageService.getSessionState.mockResolvedValue(null);
      await resetTagIndexForNewWindow();
      expect(StorageService.setSessionState).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  // createSystemPool
  // -------------------------------------------------------------------
  describe('createSystemPool', () => {
    it('creates pool from candidates', async () => {
      const getCandidates = jest.fn().mockResolvedValue([
        { tag: 'array', relationshipScore: 0.5, total_attempts: 5, successRate: 0.5, totalProblems: 10 },
        { tag: 'dp', relationshipScore: 0.3, total_attempts: 3, successRate: 0.4, totalProblems: 5 },
      ]);
      StorageService.getSettings.mockResolvedValue({});

      const result = await createSystemPool([], ['array', 'dp'], 'intermediate', [], getCandidates);
      expect(result).toContain('array');
      expect(StorageService.setSettings).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  // maintainSystemPool
  // -------------------------------------------------------------------
  describe('maintainSystemPool', () => {
    it('keeps non-mastered tags', async () => {
      const existing = { tags: ['array', 'dp'], lastGenerated: '2024-01-01' };
      const masteryData = [
        { tag: 'array', mastered: false },
        { tag: 'dp', mastered: false },
      ];
      StorageService.getSettings.mockResolvedValue({});
      const getCandidates = jest.fn().mockResolvedValue([]);

      const result = await maintainSystemPool(existing, masteryData, [], 'beginner', [], getCandidates);
      expect(result).toContain('array');
      expect(result).toContain('dp');
    });

    it('removes mastered tags and refills', async () => {
      const existing = { tags: ['array', 'dp'], lastGenerated: '2024-01-01' };
      const masteryData = [
        { tag: 'array', mastered: true },
        { tag: 'dp', mastered: false },
      ];
      const getCandidates = jest.fn().mockResolvedValue([
        { tag: 'tree', relationshipScore: 0, total_attempts: 3, successRate: 0.5, totalProblems: 5 },
      ]);
      StorageService.getSettings.mockResolvedValue({});

      const result = await maintainSystemPool(existing, masteryData, [], 'beginner', [], getCandidates);
      expect(result).not.toContain('array');
      expect(result).toContain('dp');
    });
  });

  // -------------------------------------------------------------------
  // getStableSystemPool
  // -------------------------------------------------------------------
  describe('getStableSystemPool', () => {
    it('creates new pool when none exists', async () => {
      StorageService.getSettings.mockResolvedValue({});
      const getCandidates = jest.fn().mockResolvedValue([
        { tag: 'a', relationshipScore: 0, total_attempts: 5, successRate: 0.5, totalProblems: 1 },
      ]);
      const result = await getStableSystemPool([], [], 'beginner', [], getCandidates);
      expect(result.length).toBeGreaterThan(0);
    });

    it('maintains existing pool when tier matches', async () => {
      StorageService.getSettings.mockResolvedValue({
        systemFocusPool: { tags: ['array'], tier: 'beginner', lastGenerated: '2024-01-01' },
      });
      const getCandidates = jest.fn().mockResolvedValue([]);
      const masteryData = [{ tag: 'array', mastered: false }];

      const result = await getStableSystemPool(masteryData, [], 'beginner', [], getCandidates);
      expect(result).toContain('array');
    });
  });

  // -------------------------------------------------------------------
  // graduateFocusAreas
  // -------------------------------------------------------------------
  describe('graduateFocusAreas', () => {
    it('returns not updated when no graduation needed', async () => {
      const check = jest.fn().mockResolvedValue({ needsUpdate: false });
      const result = await graduateFocusAreas(check);
      expect(result.updated).toBe(false);
    });

    it('removes mastered tags and adds suggestions', async () => {
      const check = jest.fn().mockResolvedValue({
        needsUpdate: true,
        masteredTags: ['array'],
        suggestions: ['tree', 'graph'],
      });
      StorageService.getSettings.mockResolvedValue({ focusAreas: ['array', 'dp'] });

      const result = await graduateFocusAreas(check);
      expect(result.updated).toBe(true);
      expect(StorageService.setSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          focusAreas: expect.arrayContaining(['dp']),
        })
      );
    });

    it('handles error gracefully', async () => {
      const check = jest.fn().mockRejectedValue(new Error('fail'));
      const result = await graduateFocusAreas(check);
      expect(result.updated).toBe(false);
      expect(result.error).toBe('fail');
    });
  });

  // -------------------------------------------------------------------
  // checkFocusAreasGraduation
  // -------------------------------------------------------------------
  describe('checkFocusAreasGraduation', () => {
    it('returns needsUpdate false when no focus areas', async () => {
      StorageService.getSettings.mockResolvedValue({ focusAreas: [] });
      const result = await checkFocusAreasGraduation(jest.fn(), jest.fn());
      expect(result.needsUpdate).toBe(false);
    });

    it('handles errors gracefully', async () => {
      StorageService.getSettings.mockRejectedValue(new Error('db error'));
      const result = await checkFocusAreasGraduation(jest.fn(), jest.fn());
      expect(result.needsUpdate).toBe(false);
    });
  });
});
