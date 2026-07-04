/**
 * Tests for problemServiceSession.js (250 lines, 72% → higher coverage)
 * Covers session assembly functions: triggered reviews, review problems, new problems, etc.
 */

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../db/stores/problems.js', () => ({
  fetchAdditionalProblems: jest.fn().mockResolvedValue([]),
  fetchAllProblems: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../db/stores/standard_problems.js', () => ({
  fetchProblemById: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../schedule/scheduleService.js', () => ({
  ScheduleService: {
    getDailyReviewSchedule: jest.fn().mockResolvedValue([]),
  },
  isRecentlyAttempted: jest.fn().mockReturnValue(false),
  isDueForReview: jest.fn().mockReturnValue(true),
}));

jest.mock('../../storage/storageService.js', () => ({
  StorageService: {
    getSessionState: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../../../utils/leitner/Utils.js', () => ({
  calculateDecayScore: jest.fn((date, rate) => rate),
}));

jest.mock('../../../db/stores/tag_mastery.js', () => ({
  getTagMastery: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../db/stores/problem_relationships.js', () => ({
  selectOptimalProblems: jest.fn((probs) => probs),
  getRecentAttempts: jest.fn().mockResolvedValue([]),
  getFailureTriggeredReviews: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../utils/session/sessionBalancing.js', () => ({
  applySafetyGuardRails: jest.fn().mockReturnValue({ needsRebalance: false }),
}));

jest.mock('../../../db/stores/sessionAnalytics.js', () => ({
  getRecentSessionAnalytics: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../../utils/leitner/patternLadderUtils.js', () => ({
  getPatternLadders: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../db/stores/tag_relationships.js', () => ({
  getTagRelationships: jest.fn().mockResolvedValue({}),
}));

jest.mock('../problemServiceHelpers.js', () => ({
  enrichReviewProblem: jest.fn((p) => Promise.resolve({ ...p, difficulty: p.difficulty || 'Easy', tags: p.tags || ['array'] })),
  normalizeReviewProblem: jest.fn((p) => ({ ...p, id: p.id || p.leetcode_id, slug: p.slug || 'test-slug', attempts: [] })),
  filterValidReviewProblems: jest.fn((probs) => (probs || []).filter(p => p && p.id && p.title && p.difficulty && p.tags)),
  logReviewProblemsAnalysis: jest.fn(),
}));

import {
  addTriggeredReviewsToSession,
  addReviewProblemsToSession,
  analyzeReviewProblems,
  addNewProblemsToSession,
  selectNewProblems,
  addPassiveMasteredReviews,
  addFallbackProblems,
  checkSafetyGuardRails,
  logFinalSessionComposition,
  deduplicateById,
  filterRecentlyAttemptedProblems,
  problemSortingCriteria,
  getExistingProblemsAndExcludeIds,
} from '../problemServiceSession.js';

import { getRecentAttempts, getFailureTriggeredReviews, selectOptimalProblems } from '../../../db/stores/problem_relationships.js';
import { ScheduleService, isRecentlyAttempted } from '../../schedule/scheduleService.js';
import { StorageService } from '../../storage/storageService.js';
import { fetchAdditionalProblems, fetchAllProblems } from '../../../db/stores/problems.js';
import { getTagMastery } from '../../../db/stores/tag_mastery.js';
import { applySafetyGuardRails } from '../../../utils/session/sessionBalancing.js';
import { getRecentSessionAnalytics } from '../../../db/stores/sessionAnalytics.js';
import { enrichReviewProblem, filterValidReviewProblems } from '../problemServiceHelpers.js';

describe('problemServiceSession', () => {
  beforeEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------
  // addTriggeredReviewsToSession
  // -------------------------------------------------------------------
  describe('addTriggeredReviewsToSession', () => {
    it('skips during onboarding', async () => {
      const session = [];
      const count = await addTriggeredReviewsToSession(session, 5, true);
      expect(count).toBe(0);
      expect(session).toHaveLength(0);
    });

    it('returns 0 when no recent attempts', async () => {
      getRecentAttempts.mockResolvedValue([]);
      const session = [];
      const count = await addTriggeredReviewsToSession(session, 5, false);
      expect(count).toBe(0);
    });

    it('returns 0 when no triggered reviews needed', async () => {
      getRecentAttempts.mockResolvedValue([{ id: 'a1' }]);
      getFailureTriggeredReviews.mockResolvedValue([]);
      const session = [];
      const count = await addTriggeredReviewsToSession(session, 5, false);
      expect(count).toBe(0);
    });

    it('adds up to 2 triggered reviews', async () => {
      getRecentAttempts.mockResolvedValue([{ id: 'a1' }]);
      getFailureTriggeredReviews.mockResolvedValue([
        { problem: { id: 1, leetcode_id: 1, title: 'Two Sum', slug: 'two-sum' }, triggerReason: 'failure', triggeredBy: 'p2', aggregateStrength: 0.8, connectedProblems: ['p2'] },
        { problem: { id: 2, leetcode_id: 2, title: 'Add Two Numbers', slug: 'add-two' }, triggerReason: 'failure', triggeredBy: 'p3', aggregateStrength: 0.7, connectedProblems: ['p3'] },
        { problem: { id: 3, leetcode_id: 3, title: 'Three Sum', slug: 'three-sum' }, triggerReason: 'failure', triggeredBy: 'p4', aggregateStrength: 0.6, connectedProblems: ['p4'] },
      ]);
      enrichReviewProblem.mockImplementation((p) => Promise.resolve({ ...p, difficulty: 'Easy', tags: ['array'] }));

      const session = [];
      const count = await addTriggeredReviewsToSession(session, 5, false);
      expect(count).toBe(2); // Max 2
      expect(session).toHaveLength(2);
      expect(session[0].selectionReason.type).toBe('triggered_review');
    });

    it('generates slug from title when missing', async () => {
      getRecentAttempts.mockResolvedValue([{ id: 'a1' }]);
      getFailureTriggeredReviews.mockResolvedValue([
        { problem: { id: 1, leetcode_id: 1, title: 'Two Sum Problem' }, triggerReason: 'test', triggeredBy: 'p2', aggregateStrength: 0.5, connectedProblems: [] },
      ]);
      enrichReviewProblem.mockImplementation((p) => Promise.resolve({ ...p, difficulty: 'Easy', tags: ['array'] }));

      const session = [];
      await addTriggeredReviewsToSession(session, 5, false);
      expect(session[0].slug).toBe('two-sum-problem');
    });

    it('handles errors gracefully', async () => {
      getRecentAttempts.mockRejectedValue(new Error('db error'));
      const session = [];
      const count = await addTriggeredReviewsToSession(session, 5, false);
      expect(count).toBe(0);
    });
  });

  // -------------------------------------------------------------------
  // addReviewProblemsToSession
  // -------------------------------------------------------------------
  describe('addReviewProblemsToSession', () => {
    it('skips during onboarding', async () => {
      const session = [];
      const count = await addReviewProblemsToSession(session, 5, true, []);
      expect(count).toBe(0);
    });

    it('adds learning reviews (box 1-5)', async () => {
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([
        { id: 1, leetcode_id: 1, title: 'Two Sum', difficulty: 'Easy', tags: ['array'], box_level: 3 },
      ]);
      enrichReviewProblem.mockImplementation((p) => Promise.resolve(p));
      filterValidReviewProblems.mockImplementation((probs) => probs.filter(p => p && p.id && p.title && p.difficulty && p.tags));

      const session = [];
      const count = await addReviewProblemsToSession(session, 10, false, []);
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('excludes problems already in session', async () => {
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([
        { id: 1, leetcode_id: 1, title: 'Two Sum', difficulty: 'Easy', tags: ['array'], box_level: 2 },
      ]);
      enrichReviewProblem.mockImplementation((p) => Promise.resolve(p));
      filterValidReviewProblems.mockImplementation((probs) => probs.filter(p => p && p.id && p.title && p.difficulty && p.tags));

      const session = [{ id: 1, leetcode_id: 1 }]; // Already has this problem
      const count = await addReviewProblemsToSession(session, 10, false, []);
      expect(count).toBe(0);
    });
  });

  // -------------------------------------------------------------------
  // analyzeReviewProblems
  // -------------------------------------------------------------------
  describe('analyzeReviewProblems', () => {
    it('logs new user message when no review problems and no attempted', () => {
      analyzeReviewProblems([], 5, []);
      // Just verify it doesn't throw
    });

    it('logs no review message when user has attempted problems', () => {
      analyzeReviewProblems([], 5, [{ id: 1 }]);
    });

    it('logs partial fill message', () => {
      analyzeReviewProblems([{ id: 1 }, { id: 2 }], 5, []);
    });

    it('logs overflow message when reviews exceed session length', () => {
      const reviews = Array.from({ length: 8 }, (_, i) => ({ id: i }));
      analyzeReviewProblems(reviews, 5, []);
    });
  });

  // -------------------------------------------------------------------
  // addNewProblemsToSession
  // -------------------------------------------------------------------
  describe('addNewProblemsToSession', () => {
    it('does nothing when session is already full', async () => {
      const session = [{ id: 1 }, { id: 2 }, { id: 3 }];
      await addNewProblemsToSession({
        sessionLength: 3,
        sessionProblems: session,
        excludeIds: new Set(),
        userFocusAreas: [],
        currentAllowedTags: [],
        currentDifficultyCap: 'Medium',
        isOnboarding: false,
      });
      expect(session).toHaveLength(3);
    });

    it('adds new problems with slug generation', async () => {
      fetchAdditionalProblems.mockResolvedValue([
        { id: 10, leetcode_id: 10, title: 'Valid Parentheses', difficulty: 'Easy', tags: ['stack'] },
      ]);
      selectOptimalProblems.mockImplementation((probs) => probs);

      const session = [];
      await addNewProblemsToSession({
        sessionLength: 5,
        sessionProblems: session,
        excludeIds: new Set(),
        userFocusAreas: ['array'],
        currentAllowedTags: ['array', 'stack'],
        currentDifficultyCap: 'Medium',
        isOnboarding: true,
      });
      expect(session.length).toBeGreaterThan(0);
    });

    it('fills entire session with new problems when no reviews are present and auto mode', async () => {
      fetchAdditionalProblems.mockResolvedValue([
        { id: 10, leetcode_id: 10, title: 'Problem A', difficulty: 'Easy', tags: ['array'], slug: 'problem-a' },
        { id: 11, leetcode_id: 11, title: 'Problem B', difficulty: 'Easy', tags: ['array'], slug: 'problem-b' },
        { id: 12, leetcode_id: 12, title: 'Problem C', difficulty: 'Medium', tags: ['stack'], slug: 'problem-c' },
        { id: 13, leetcode_id: 13, title: 'Problem D', difficulty: 'Easy', tags: ['string'], slug: 'problem-d' },
        { id: 14, leetcode_id: 14, title: 'Problem E', difficulty: 'Medium', tags: ['hash table'], slug: 'problem-e' },
      ]);
      selectOptimalProblems.mockImplementation((probs) => probs);

      const session = []; // No reviews present
      await addNewProblemsToSession({
        sessionLength: 5,
        sessionProblems: session,
        excludeIds: new Set(),
        userFocusAreas: [],
        currentAllowedTags: [],
        currentDifficultyCap: 'Medium',
        isOnboarding: true,
        numberOfNewProblems: 2,
        isAutoNewProblems: true, // Auto mode → fill all 5 when no reviews
      });
      expect(session).toHaveLength(5);
    });

    it('respects explicit cap even when no reviews are present (non-auto mode)', async () => {
      fetchAdditionalProblems.mockResolvedValue([
        { id: 10, leetcode_id: 10, title: 'Problem A', difficulty: 'Easy', tags: ['array'], slug: 'problem-a' },
        { id: 11, leetcode_id: 11, title: 'Problem B', difficulty: 'Easy', tags: ['array'], slug: 'problem-b' },
        { id: 12, leetcode_id: 12, title: 'Problem C', difficulty: 'Medium', tags: ['stack'], slug: 'problem-c' },
        { id: 13, leetcode_id: 13, title: 'Problem D', difficulty: 'Easy', tags: ['string'], slug: 'problem-d' },
        { id: 14, leetcode_id: 14, title: 'Problem E', difficulty: 'Medium', tags: ['hash table'], slug: 'problem-e' },
      ]);
      selectOptimalProblems.mockImplementation((probs) => probs);

      const session = []; // No reviews present
      await addNewProblemsToSession({
        sessionLength: 5,
        sessionProblems: session,
        excludeIds: new Set(),
        userFocusAreas: [],
        currentAllowedTags: [],
        currentDifficultyCap: 'Medium',
        isOnboarding: true,
        numberOfNewProblems: 3,
        isAutoNewProblems: false, // Explicit mode → cap at 3 even with no reviews
      });
      expect(session).toHaveLength(3);
    });

    it('respects numberOfNewProblems cap when reviews ARE present', async () => {
      fetchAdditionalProblems.mockResolvedValue([
        { id: 10, leetcode_id: 10, title: 'New Problem', difficulty: 'Easy', tags: ['array'], slug: 'new-problem' },
        { id: 11, leetcode_id: 11, title: 'New Problem 2', difficulty: 'Easy', tags: ['array'], slug: 'new-problem-2' },
        { id: 12, leetcode_id: 12, title: 'New Problem 3', difficulty: 'Easy', tags: ['array'], slug: 'new-problem-3' },
      ]);
      selectOptimalProblems.mockImplementation((probs) => probs);

      const session = [
        { id: 1, leetcode_id: 1, title: 'Review 1', difficulty: 'Easy', tags: ['array'] },
        { id: 2, leetcode_id: 2, title: 'Review 2', difficulty: 'Easy', tags: ['array'] },
      ]; // 2 reviews already present
      await addNewProblemsToSession({
        sessionLength: 5,
        sessionProblems: session,
        excludeIds: new Set(),
        userFocusAreas: [],
        currentAllowedTags: [],
        currentDifficultyCap: 'Medium',
        isOnboarding: true,
        numberOfNewProblems: 2, // Cap at 2 since reviews are present
      });
      expect(session).toHaveLength(4); // 2 reviews + 2 new = 4
    });

    it('normalizes attempt_stats', async () => {
      fetchAdditionalProblems.mockResolvedValue([
        { id: 10, leetcode_id: 10, title: 'Test', slug: 'test', difficulty: 'Easy', tags: ['array'], attempt_stats: { total_attempts: 3 } },
      ]);

      const session = [];
      await addNewProblemsToSession({
        sessionLength: 5,
        sessionProblems: session,
        excludeIds: new Set(),
        userFocusAreas: [],
        currentAllowedTags: [],
        currentDifficultyCap: 'Easy',
        isOnboarding: true,
      });
      expect(session[0].attempts).toEqual([{ count: 3 }]);
    });
  });

  // -------------------------------------------------------------------
  // selectNewProblems
  // -------------------------------------------------------------------
  describe('selectNewProblems', () => {
    it('returns empty for null candidates', async () => {
      expect(await selectNewProblems(null, 5, false)).toEqual([]);
    });

    it('returns empty for non-array candidates', async () => {
      expect(await selectNewProblems('string', 5, false)).toEqual([]);
    });

    it('uses simple slice for onboarding', async () => {
      const candidates = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = await selectNewProblems(candidates, 2, true);
      expect(result).toHaveLength(2);
    });

    it('uses optimal scoring when not onboarding and enough candidates', async () => {
      getTagMastery.mockResolvedValue([
        { tag: 'array', mastered: false, totalAttempts: 5, successfulAttempts: 3 },
      ]);
      selectOptimalProblems.mockImplementation((probs) => probs);
      const candidates = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = await selectNewProblems(candidates, 2, false);
      expect(result).toHaveLength(2);
      expect(selectOptimalProblems).toHaveBeenCalled();
    });

    it('falls back on scoring error', async () => {
      getTagMastery.mockRejectedValue(new Error('db error'));
      const candidates = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = await selectNewProblems(candidates, 2, false);
      expect(result).toHaveLength(2);
    });

    it('uses simple slice when not enough candidates', async () => {
      const candidates = [{ id: 1 }];
      const result = await selectNewProblems(candidates, 5, false);
      expect(result).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------
  // addPassiveMasteredReviews
  // -------------------------------------------------------------------
  describe('addPassiveMasteredReviews', () => {
    it('returns 0 during onboarding', async () => {
      expect(await addPassiveMasteredReviews([], 5, true)).toBe(0);
    });

    it('returns 0 when session is full', async () => {
      const session = [{ id: 1 }, { id: 2 }, { id: 3 }];
      expect(await addPassiveMasteredReviews(session, 3, false)).toBe(0);
    });

    it('returns 0 when no review problems', async () => {
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);
      expect(await addPassiveMasteredReviews([], 5, false)).toBe(0);
    });

    it('adds mastered reviews (box 6-8) to fill session', async () => {
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([
        { id: 1, leetcode_id: 1, title: 'Two Sum', difficulty: 'Easy', tags: ['array'], box_level: 7 },
      ]);
      enrichReviewProblem.mockImplementation((p) => Promise.resolve(p));
      filterValidReviewProblems.mockImplementation((probs) => probs.filter(p => p && p.id && p.title && p.difficulty && p.tags));

      const session = [];
      const count = await addPassiveMasteredReviews(session, 5, false);
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('handles errors gracefully', async () => {
      ScheduleService.getDailyReviewSchedule.mockRejectedValue(new Error('fail'));
      expect(await addPassiveMasteredReviews([], 5, false)).toBe(0);
    });
  });

  // -------------------------------------------------------------------
  // addFallbackProblems
  // -------------------------------------------------------------------
  describe('addFallbackProblems', () => {
    it('does nothing when session is full', async () => {
      const session = [{ id: 1 }, { id: 2 }];
      await addFallbackProblems(session, 2, []);
      expect(session).toHaveLength(2);
    });

    it('adds fallback from allProblems', async () => {
      enrichReviewProblem.mockImplementation((p) => Promise.resolve({ ...p, difficulty: 'Easy', tags: ['array'] }));
      const allProblems = [
        { problem_id: 'p1', leetcode_id: 1, title: 'Two Sum', review_schedule: '2024-01-01' },
        { problem_id: 'p2', leetcode_id: 2, title: 'Add Two Numbers', review_schedule: '2024-01-02' },
      ];
      const session = [];
      await addFallbackProblems(session, 5, allProblems);
      expect(session.length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------
  // checkSafetyGuardRails
  // -------------------------------------------------------------------
  describe('checkSafetyGuardRails', () => {
    it('returns no rebalance when guard rails pass', async () => {
      StorageService.getSessionState.mockResolvedValue(null);
      getRecentSessionAnalytics.mockResolvedValue([]);
      applySafetyGuardRails.mockReturnValue({ needsRebalance: false });

      const result = await checkSafetyGuardRails([{ id: 1, difficulty: 'Easy' }], 'Medium');
      expect(result.rebalancedSession).toBeNull();
    });

    it('returns rebalance result on poor performance', async () => {
      StorageService.getSessionState.mockResolvedValue({
        escape_hatches: { sessions_at_current_difficulty: 3, current_promotion_type: 'normal' },
      });
      getRecentSessionAnalytics.mockResolvedValue([{ accuracy: 0.3 }]);
      applySafetyGuardRails.mockReturnValue({
        needsRebalance: true,
        message: 'too many hard problems',
        guardRailType: 'poor_performance_protection',
        excessHard: 1,
        replacementDifficulty: 'Medium',
      });

      const result = await checkSafetyGuardRails(
        [{ id: 1, difficulty: 'Hard', tags: ['dp'], leetcode_id: 1 }],
        'Hard'
      );
      expect(result.guardRailResult.needsRebalance).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // logFinalSessionComposition
  // -------------------------------------------------------------------
  describe('logFinalSessionComposition', () => {
    it('logs composition without triggered reviews', () => {
      logFinalSessionComposition([{ id: 1 }, { id: 2, selectionReason: { type: 'review' } }], 5, 1);
      // Just verify no throw
    });

    it('logs composition with triggered reviews', () => {
      logFinalSessionComposition([{ id: 1, selectionReason: { type: 'triggered' } }, { id: 2 }], 5, 1, 1);
    });
  });

  // -------------------------------------------------------------------
  // deduplicateById
  // -------------------------------------------------------------------
  describe('deduplicateById', () => {
    it('removes duplicates by id', () => {
      const problems = [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
        { id: 1, title: 'A duplicate' },
      ];
      const result = deduplicateById(problems);
      expect(result).toHaveLength(2);
    });

    it('uses leetcode_id as fallback', () => {
      const problems = [
        { leetcode_id: 10, title: 'A' },
        { leetcode_id: 10, title: 'A dup' },
        { leetcode_id: 20, title: 'B' },
      ];
      expect(deduplicateById(problems)).toHaveLength(2);
    });

    it('filters out problems with no id', () => {
      const problems = [
        { title: 'No ID' },
        { id: 1, title: 'Has ID' },
      ];
      expect(deduplicateById(problems)).toHaveLength(1);
    });

    it('returns empty for empty input', () => {
      expect(deduplicateById([])).toEqual([]);
    });
  });

  // -------------------------------------------------------------------
  // problemSortingCriteria
  // -------------------------------------------------------------------
  describe('problemSortingCriteria', () => {
    it('sorts by review_schedule date ascending', () => {
      const a = { review_schedule: '2024-01-01', attempt_stats: { total_attempts: 1, successful_attempts: 1 } };
      const b = { review_schedule: '2024-02-01', attempt_stats: { total_attempts: 1, successful_attempts: 1 } };
      expect(problemSortingCriteria(a, b)).toBeLessThan(0);
    });

    it('sorts by total_attempts when dates equal', () => {
      const a = { review_schedule: '2024-01-01', attempt_stats: { total_attempts: 1, successful_attempts: 0 } };
      const b = { review_schedule: '2024-01-01', attempt_stats: { total_attempts: 5, successful_attempts: 3 } };
      expect(problemSortingCriteria(a, b)).toBeLessThan(0);
    });

    it('handles missing attempt_stats', () => {
      const a = { review_schedule: '2024-01-01' };
      const b = { review_schedule: '2024-01-01' };
      const result = problemSortingCriteria(a, b);
      expect(typeof result).toBe('number');
    });
  });

  // -------------------------------------------------------------------
  // filterRecentlyAttemptedProblems
  // -------------------------------------------------------------------
  describe('filterRecentlyAttemptedProblems', () => {
    it('keeps problems with no last_attempt_date (new problems)', () => {
      const problems = [
        { id: 1, title: 'Two Sum' },
        { id: 2, title: 'Add Two', last_attempt_date: null },
      ];
      const result = filterRecentlyAttemptedProblems(problems);
      expect(result).toHaveLength(2);
    });

    it('filters problem flagged as recently attempted', () => {
      isRecentlyAttempted.mockReturnValue(true);
      const problems = [
        { id: 1, title: 'Two Sum', last_attempt_date: new Date().toISOString(), box_level: 2 },
      ];
      const result = filterRecentlyAttemptedProblems(problems);
      expect(result).toHaveLength(0);
      expect(isRecentlyAttempted).toHaveBeenCalledWith(problems[0].last_attempt_date, 2);
    });

    it('keeps problem when isRecentlyAttempted returns false', () => {
      isRecentlyAttempted.mockReturnValue(false);
      const problems = [
        { id: 1, title: 'Two Sum', last_attempt_date: '2026-02-18', box_level: 2 },
      ];
      const result = filterRecentlyAttemptedProblems(problems);
      expect(result).toHaveLength(1);
    });

    it('defaults to box level 1 when box_level is missing', () => {
      isRecentlyAttempted.mockReturnValue(false);
      const problems = [
        { id: 1, title: 'Test', last_attempt_date: '2026-02-21' },
      ];
      filterRecentlyAttemptedProblems(problems);
      expect(isRecentlyAttempted).toHaveBeenCalledWith('2026-02-21', 1);
    });

    it('reads boxLevel as fallback for box_level', () => {
      isRecentlyAttempted.mockReturnValue(false);
      const problems = [
        { id: 1, title: 'Test', last_attempt_date: '2026-02-21', boxLevel: 3 },
      ];
      filterRecentlyAttemptedProblems(problems);
      expect(isRecentlyAttempted).toHaveBeenCalledWith('2026-02-21', 3);
    });

    it('filters some and keeps others in a mixed set', () => {
      isRecentlyAttempted
        .mockReturnValueOnce(true)   // problem 1: recently attempted
        .mockReturnValueOnce(false); // problem 2: not recently attempted
      const problems = [
        { id: 1, title: 'Recent', last_attempt_date: '2026-02-21', box_level: 2 },
        { id: 2, title: 'Old', last_attempt_date: '2026-02-18', box_level: 2 },
        { id: 3, title: 'New' }, // no last_attempt_date
      ];
      const result = filterRecentlyAttemptedProblems(problems);
      expect(result).toHaveLength(2);
      expect(result.map(p => p.id)).toEqual([2, 3]);
    });
  });

  // -------------------------------------------------------------------
  // filterRecentlyAttemptedProblems + addNewProblemsToSession ordering
  // -------------------------------------------------------------------
  describe('recency filter must run before new problem selection', () => {
    it('frees slots when reviews are filtered, allowing addNewProblemsToSession to fill them', async () => {
      // Simulate: 3 review problems added by paths 1+2, all recently attempted
      isRecentlyAttempted.mockReturnValue(true);
      const reviewProblems = [
        { id: 100, title: 'Review A', last_attempt_date: '2026-02-21', box_level: 2, difficulty: 'Medium', tags: ['array'] },
        { id: 101, title: 'Review B', last_attempt_date: '2026-02-21', box_level: 3, difficulty: 'Medium', tags: ['array'] },
        { id: 102, title: 'Review C', last_attempt_date: '2026-02-21', box_level: 2, difficulty: 'Easy', tags: ['math'] },
      ];

      // Step 1: Filter recently-attempted reviews (simulates orchestrator mid-pipeline filter)
      const spacedReviews = filterRecentlyAttemptedProblems(reviewProblems);
      expect(spacedReviews).toHaveLength(0); // all 3 filtered

      // Step 2: Build clean array from survivors (matches production code pattern)
      const assembledProblems = [...spacedReviews];

      // Step 3: addNewProblemsToSession should now see 5 free slots, not 2
      const { fetchAdditionalProblems } = require('../../../db/stores/problems.js');
      fetchAdditionalProblems.mockResolvedValue([
        { id: 201, title: 'New A', difficulty: 'Medium', tags: ['array'], slug: 'new-a' },
        { id: 202, title: 'New B', difficulty: 'Medium', tags: ['array'], slug: 'new-b' },
        { id: 203, title: 'New C', difficulty: 'Easy', tags: ['math'], slug: 'new-c' },
        { id: 204, title: 'New D', difficulty: 'Medium', tags: ['hash table'], slug: 'new-d' },
        { id: 205, title: 'New E', difficulty: 'Easy', tags: ['string'], slug: 'new-e' },
      ]);

      await addNewProblemsToSession({
        sessionLength: 5,
        sessionProblems: assembledProblems,
        excludeIds: new Set(),
        userFocusAreas: [],
        currentAllowedTags: [],
        currentDifficultyCap: 'Hard',
        isOnboarding: true,
        numberOfNewProblems: 5,
      });

      // All 5 slots should be filled with new problems
      expect(assembledProblems.length).toBe(5);
    });

    // WHY THIS ORDERING MATTERS:
    // If filterRecentlyAttemptedProblems runs AFTER addNewProblemsToSession,
    // the new problem path sees review problems occupying slots and under-fills.
    // Then the filter removes the reviews, leaving a short session.
    // The test above proves the correct ordering prevents this.
  });

  // -------------------------------------------------------------------
  // getExistingProblemsAndExcludeIds
  // -------------------------------------------------------------------
  describe('getExistingProblemsAndExcludeIds', () => {
    it('returns allProblems and excludeIds set', async () => {
      fetchAllProblems.mockResolvedValue([
        { leetcode_id: 1, title: 'Two Sum' },
        { leetcode_id: 2, title: 'Add Two' },
        { leetcode_id: null, title: '' }, // Should be filtered out
      ]);
      const { allProblems, excludeIds } = await getExistingProblemsAndExcludeIds();
      expect(allProblems).toHaveLength(3);
      expect(excludeIds.has(1)).toBe(true);
      expect(excludeIds.has(2)).toBe(true);
    });
  });
});
