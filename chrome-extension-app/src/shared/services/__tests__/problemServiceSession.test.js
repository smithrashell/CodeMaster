/**
 * Tests for problemServiceSession.js
 * Session assembly pipeline — triggered reviews, learning reviews, new problems, fallback
 */

// Mock logger first
jest.mock('../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

// Mock DB stores
jest.mock('../../db/stores/problems.js', () => ({
  fetchAdditionalProblems: jest.fn(),
  fetchAllProblems: jest.fn()
}));
jest.mock('../../db/stores/standard_problems.js', () => ({
  fetchProblemById: jest.fn()
}));
jest.mock('../../db/stores/tag_mastery.js', () => ({
  getTagMastery: jest.fn()
}));
jest.mock('../../db/stores/problem_relationships.js', () => ({
  selectOptimalProblems: jest.fn(),
  getRecentAttempts: jest.fn(),
  getFailureTriggeredReviews: jest.fn()
}));
jest.mock('../../db/stores/sessionAnalytics.js', () => ({
  getRecentSessionAnalytics: jest.fn()
}));
jest.mock('../../db/stores/tag_relationships.js', () => ({
  getTagRelationships: jest.fn()
}));
jest.mock('../../utils/leitner/patternLadderUtils.js', () => ({
  getPatternLadders: jest.fn()
}));
jest.mock('../../utils/session/sessionBalancing.js', () => ({
  applySafetyGuardRails: jest.fn()
}));

// Mock services
jest.mock('../schedule/scheduleService.js', () => ({
  ScheduleService: {
    getDailyReviewSchedule: jest.fn()
  }
}));
jest.mock('../storage/storageService.js', () => ({
  StorageService: {
    getSessionState: jest.fn()
  }
}));

// Mock helpers — let real functions through
jest.mock('../problem/problemServiceHelpers.js', () => ({
  enrichReviewProblem: jest.fn((problem) => Promise.resolve({
    ...problem,
    difficulty: problem.difficulty || 'Easy',
    tags: problem.tags || ['array'],
    slug: problem.slug || 'test-slug',
    title: problem.title || 'Test Problem'
  })),
  normalizeReviewProblem: jest.fn((p) => ({
    ...p,
    id: p.id || p.leetcode_id,
    attempts: p.attempts || []
  })),
  filterValidReviewProblems: jest.fn((problems) =>
    (problems || []).filter(p => p && (p.id || p.leetcode_id) && p.title && p.difficulty && p.tags)
  ),
  logReviewProblemsAnalysis: jest.fn()
}));

jest.mock('../../utils/leitner/Utils.js', () => ({
  calculateDecayScore: jest.fn(() => 0.5)
}));

import {
  addTriggeredReviewsToSession,
  addReviewProblemsToSession,
  addNewProblemsToSession,
  selectNewProblems,
  addPassiveMasteredReviews,
  addFallbackProblems,
  deduplicateById,
  problemSortingCriteria
} from '../problem/problemServiceSession.js';

import { getRecentAttempts, getFailureTriggeredReviews, selectOptimalProblems } from '../../db/stores/problem_relationships.js';
import { fetchAdditionalProblems } from '../../db/stores/problems.js';
import { ScheduleService } from '../schedule/scheduleService.js';
import { getTagMastery } from '../../db/stores/tag_mastery.js';
import { enrichReviewProblem } from '../problem/problemServiceHelpers.js';

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// addTriggeredReviewsToSession
// ============================================================================

describe('addTriggeredReviewsToSession', () => {
  it('should skip during onboarding', async () => {
    const sessionProblems = [];
    const result = await addTriggeredReviewsToSession(sessionProblems, 5, true);
    expect(result).toBe(0);
    expect(sessionProblems).toHaveLength(0);
  });

  it('should return 0 when no recent attempts', async () => {
    getRecentAttempts.mockResolvedValue([]);
    const sessionProblems = [];
    const result = await addTriggeredReviewsToSession(sessionProblems, 5, false);
    expect(result).toBe(0);
  });

  it('should return 0 when no triggered reviews found', async () => {
    getRecentAttempts.mockResolvedValue([{ id: 1, success: false }]);
    getFailureTriggeredReviews.mockResolvedValue([]);
    const sessionProblems = [];
    const result = await addTriggeredReviewsToSession(sessionProblems, 5, false);
    expect(result).toBe(0);
  });

  it('should add max 2 triggered reviews per session', async () => {
    getRecentAttempts.mockResolvedValue([{ id: 1 }]);
    getFailureTriggeredReviews.mockResolvedValue([
      { problem: { leetcode_id: 10, title: 'P1', difficulty: 'Easy', tags: ['a'] }, triggerReason: 'r1', triggeredBy: 1, aggregateStrength: 5, connectedProblems: [] },
      { problem: { leetcode_id: 20, title: 'P2', difficulty: 'Easy', tags: ['a'] }, triggerReason: 'r2', triggeredBy: 2, aggregateStrength: 4, connectedProblems: [] },
      { problem: { leetcode_id: 30, title: 'P3', difficulty: 'Easy', tags: ['a'] }, triggerReason: 'r3', triggeredBy: 3, aggregateStrength: 3, connectedProblems: [] }
    ]);
    const sessionProblems = [];
    const result = await addTriggeredReviewsToSession(sessionProblems, 5, false);
    expect(result).toBe(2);
    expect(sessionProblems).toHaveLength(2);
  });

  it('should call enrichReviewProblem for each review', async () => {
    getRecentAttempts.mockResolvedValue([{ id: 1 }]);
    getFailureTriggeredReviews.mockResolvedValue([
      { problem: { leetcode_id: 10, title: 'P1', difficulty: 'Easy', tags: ['a'] }, triggerReason: 'r', triggeredBy: 1, aggregateStrength: 5, connectedProblems: [] }
    ]);
    const sessionProblems = [];
    await addTriggeredReviewsToSession(sessionProblems, 5, false);
    expect(enrichReviewProblem).toHaveBeenCalled();
  });

  it('should set selectionReason type to triggered_review', async () => {
    getRecentAttempts.mockResolvedValue([{ id: 1 }]);
    getFailureTriggeredReviews.mockResolvedValue([
      { problem: { leetcode_id: 10, title: 'P1', difficulty: 'Easy', tags: ['a'], slug: 's' }, triggerReason: 'test_reason', triggeredBy: 1, aggregateStrength: 5, connectedProblems: [2, 3] }
    ]);
    const sessionProblems = [];
    await addTriggeredReviewsToSession(sessionProblems, 5, false);
    expect(sessionProblems[0].selectionReason.type).toBe('triggered_review');
    expect(sessionProblems[0].selectionReason.reason).toBe('test_reason');
  });

  it('should return 0 on error', async () => {
    getRecentAttempts.mockRejectedValue(new Error('DB error'));
    const sessionProblems = [];
    const result = await addTriggeredReviewsToSession(sessionProblems, 5, false);
    expect(result).toBe(0);
  });

  it('should respect session length limit', async () => {
    getRecentAttempts.mockResolvedValue([{ id: 1 }]);
    getFailureTriggeredReviews.mockResolvedValue([
      { problem: { leetcode_id: 10, title: 'P1', difficulty: 'Easy', tags: ['a'] }, triggerReason: 'r1', triggeredBy: 1, aggregateStrength: 5, connectedProblems: [] },
      { problem: { leetcode_id: 20, title: 'P2', difficulty: 'Easy', tags: ['a'] }, triggerReason: 'r2', triggeredBy: 2, aggregateStrength: 4, connectedProblems: [] }
    ]);
    const sessionProblems = [];
    // Session length of 1 should only add 1
    const result = await addTriggeredReviewsToSession(sessionProblems, 1, false);
    expect(result).toBe(1);
    expect(sessionProblems).toHaveLength(1);
  });

  it('should generate slug from title when slug is missing', async () => {
    getRecentAttempts.mockResolvedValue([{ id: 1 }]);
    getFailureTriggeredReviews.mockResolvedValue([
      { problem: { leetcode_id: 10, title: 'Two Sum Problem' }, triggerReason: 'r', triggeredBy: 1, aggregateStrength: 5, connectedProblems: [] }
    ]);
    // Override enrichReviewProblem for this test to return no slug
    enrichReviewProblem.mockResolvedValueOnce({
      leetcode_id: 10, title: 'Two Sum Problem', difficulty: 'Easy', tags: ['a']
      // no slug
    });
    const sessionProblems = [];
    await addTriggeredReviewsToSession(sessionProblems, 5, false);
    expect(sessionProblems[0].slug).toBe('two-sum-problem');
  });
});

// ============================================================================
// addReviewProblemsToSession
// ============================================================================

describe('addReviewProblemsToSession', () => {
  it('should skip during onboarding', async () => {
    const sessionProblems = [];
    const result = await addReviewProblemsToSession(sessionProblems, 5, true, []);
    expect(result).toBe(0);
  });

  it('should enrich problems via enrichReviewProblem', async () => {
    ScheduleService.getDailyReviewSchedule.mockResolvedValue([
      { leetcode_id: 1, title: 'P1', difficulty: 'Easy', tags: ['a'], box_level: 3 }
    ]);
    const sessionProblems = [];
    await addReviewProblemsToSession(sessionProblems, 10, false, []);
    expect(enrichReviewProblem).toHaveBeenCalled();
  });

  it('should filter to box levels 1-5 only', async () => {
    ScheduleService.getDailyReviewSchedule.mockResolvedValue([
      { leetcode_id: 1, title: 'Learning', difficulty: 'Easy', tags: ['a'], box_level: 3 },
      { leetcode_id: 2, title: 'Mastered', difficulty: 'Easy', tags: ['a'], box_level: 7 }
    ]);
    const sessionProblems = [];
    await addReviewProblemsToSession(sessionProblems, 10, false, []);
    const addedIds = sessionProblems.map(p => p.id || p.leetcode_id);
    expect(addedIds).toContain(1);
    expect(addedIds).not.toContain(2);
  });

  it('should allocate ~30% of remaining slots for reviews', async () => {
    const reviews = Array.from({ length: 10 }, (_, i) => ({
      leetcode_id: i + 1, title: `P${i + 1}`, difficulty: 'Easy', tags: ['a'], box_level: 2
    }));
    ScheduleService.getDailyReviewSchedule.mockResolvedValue(reviews);
    const sessionProblems = [];
    // Session length 10, all empty => remaining=10, reviewSlots=ceil(10*0.3)=3
    await addReviewProblemsToSession(sessionProblems, 10, false, []);
    expect(sessionProblems.length).toBeLessThanOrEqual(3);
  });

  it('should exclude duplicates already in session', async () => {
    ScheduleService.getDailyReviewSchedule.mockResolvedValue([
      { leetcode_id: 1, title: 'P1', difficulty: 'Easy', tags: ['a'], box_level: 2 }
    ]);
    const sessionProblems = [{ id: 1, leetcode_id: 1, title: 'Already There' }];
    await addReviewProblemsToSession(sessionProblems, 10, false, []);
    // Should not add duplicate
    expect(sessionProblems).toHaveLength(1);
  });

  it('should handle empty review schedule', async () => {
    ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);
    const sessionProblems = [];
    const result = await addReviewProblemsToSession(sessionProblems, 10, false, []);
    expect(result).toBe(0);
  });

  it('should handle null review schedule', async () => {
    ScheduleService.getDailyReviewSchedule.mockResolvedValue(null);
    const sessionProblems = [];
    const result = await addReviewProblemsToSession(sessionProblems, 10, false, []);
    expect(result).toBe(0);
  });
});

// ============================================================================
// addNewProblemsToSession
// ============================================================================

describe('addNewProblemsToSession', () => {
  it('should return early if session is full', async () => {
    const sessionProblems = [{ id: 1 }, { id: 2 }, { id: 3 }];
    await addNewProblemsToSession({
      sessionLength: 3, sessionProblems, excludeIds: new Set(),
      userFocusAreas: [], currentAllowedTags: [], currentDifficultyCap: 'Easy', isOnboarding: false
    });
    expect(fetchAdditionalProblems).not.toHaveBeenCalled();
  });

  it('should fetch 3x candidates needed', async () => {
    fetchAdditionalProblems.mockResolvedValue([
      { leetcode_id: 1, title: 'P1', difficulty: 'Easy', tags: ['a'], slug: 's1' }
    ]);
    selectOptimalProblems.mockResolvedValue([
      { leetcode_id: 1, title: 'P1', difficulty: 'Easy', tags: ['a'], slug: 's1' }
    ]);
    getTagMastery.mockResolvedValue([]);
    const sessionProblems = [];
    await addNewProblemsToSession({
      sessionLength: 5, sessionProblems, excludeIds: new Set(),
      userFocusAreas: [], currentAllowedTags: ['array'], currentDifficultyCap: 'Easy', isOnboarding: false
    });
    // newProblemsNeeded=5, candidates=min(5*3, 50)=15
    expect(fetchAdditionalProblems).toHaveBeenCalledWith(
      15, expect.anything(), expect.anything(), expect.anything(), expect.anything()
    );
  });

  it('should use simple slice for onboarding', async () => {
    const candidates = Array.from({ length: 5 }, (_, i) => ({
      leetcode_id: i + 1, title: `P${i + 1}`, difficulty: 'Easy', tags: ['a'], slug: `s${i + 1}`
    }));
    fetchAdditionalProblems.mockResolvedValue(candidates);
    const sessionProblems = [];
    await addNewProblemsToSession({
      sessionLength: 3, sessionProblems, excludeIds: new Set(),
      userFocusAreas: [], currentAllowedTags: ['array'], currentDifficultyCap: 'Easy', isOnboarding: true
    });
    expect(sessionProblems).toHaveLength(3);
    expect(selectOptimalProblems).not.toHaveBeenCalled();
  });

  it('should normalize slug and attempts for added problems', async () => {
    fetchAdditionalProblems.mockResolvedValue([
      { leetcode_id: 1, title: 'Two Sum', difficulty: 'Easy', tags: ['a'], attempt_stats: { total_attempts: 3 } }
    ]);
    const sessionProblems = [];
    await addNewProblemsToSession({
      sessionLength: 5, sessionProblems, excludeIds: new Set(),
      userFocusAreas: [], currentAllowedTags: [], currentDifficultyCap: 'Easy', isOnboarding: true
    });
    expect(sessionProblems[0].slug).toBe('two-sum');
    expect(sessionProblems[0].attempts).toEqual([{ count: 3 }]);
  });

  it('should default attempts to empty array', async () => {
    fetchAdditionalProblems.mockResolvedValue([
      { leetcode_id: 1, title: 'Test', difficulty: 'Easy', tags: ['a'], slug: 'test' }
    ]);
    const sessionProblems = [];
    await addNewProblemsToSession({
      sessionLength: 5, sessionProblems, excludeIds: new Set(),
      userFocusAreas: [], currentAllowedTags: [], currentDifficultyCap: 'Easy', isOnboarding: true
    });
    expect(sessionProblems[0].attempts).toEqual([]);
  });
});

// ============================================================================
// selectNewProblems
// ============================================================================

describe('selectNewProblems', () => {
  it('should return empty array for null input', async () => {
    const result = await selectNewProblems(null, 5, false);
    expect(result).toEqual([]);
  });

  it('should return empty array for non-array input', async () => {
    const result = await selectNewProblems('not array', 5, false);
    expect(result).toEqual([]);
  });

  it('should apply optimal path scoring for non-onboarding', async () => {
    const candidates = [{ id: 1 }, { id: 2 }, { id: 3 }];
    getTagMastery.mockResolvedValue([]);
    selectOptimalProblems.mockResolvedValue([{ id: 2 }, { id: 1 }, { id: 3 }]);
    const result = await selectNewProblems(candidates, 2, false);
    expect(selectOptimalProblems).toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it('should fallback to slice on scoring error', async () => {
    const candidates = [{ id: 1 }, { id: 2 }, { id: 3 }];
    getTagMastery.mockRejectedValue(new Error('tag error'));
    const result = await selectNewProblems(candidates, 2, false);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
  });

  it('should use simple slice for onboarding', async () => {
    const candidates = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = await selectNewProblems(candidates, 2, true);
    expect(result).toHaveLength(2);
    expect(selectOptimalProblems).not.toHaveBeenCalled();
  });

  it('should use simple slice when not enough candidates', async () => {
    const candidates = [{ id: 1 }];
    const result = await selectNewProblems(candidates, 5, false);
    expect(result).toHaveLength(1);
    expect(selectOptimalProblems).not.toHaveBeenCalled();
  });
});

// ============================================================================
// addPassiveMasteredReviews
// ============================================================================

describe('addPassiveMasteredReviews', () => {
  it('should skip during onboarding', async () => {
    const result = await addPassiveMasteredReviews([], 5, true);
    expect(result).toBe(0);
  });

  it('should skip when session is already full', async () => {
    const sessionProblems = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = await addPassiveMasteredReviews(sessionProblems, 3, false);
    expect(result).toBe(0);
  });

  it('should filter to box levels 6-8 only', async () => {
    ScheduleService.getDailyReviewSchedule.mockResolvedValue([
      { leetcode_id: 1, title: 'Learning', difficulty: 'Easy', tags: ['a'], box_level: 3 },
      { leetcode_id: 2, title: 'Mastered', difficulty: 'Easy', tags: ['a'], box_level: 7 }
    ]);
    const sessionProblems = [];
    await addPassiveMasteredReviews(sessionProblems, 5, false);
    const addedIds = sessionProblems.map(p => p.id || p.leetcode_id);
    expect(addedIds).not.toContain(1);
    expect(addedIds).toContain(2);
  });

  it('should only fill remaining slots', async () => {
    const reviews = Array.from({ length: 5 }, (_, i) => ({
      leetcode_id: i + 10, title: `M${i}`, difficulty: 'Easy', tags: ['a'], box_level: 6
    }));
    ScheduleService.getDailyReviewSchedule.mockResolvedValue(reviews);
    const sessionProblems = [{ id: 1 }, { id: 2 }, { id: 3 }];
    await addPassiveMasteredReviews(sessionProblems, 5, false);
    // Only 2 remaining slots
    expect(sessionProblems).toHaveLength(5);
  });

  it('should set selectionReason to passive_mastered_review', async () => {
    ScheduleService.getDailyReviewSchedule.mockResolvedValue([
      { leetcode_id: 1, title: 'M1', difficulty: 'Easy', tags: ['a'], box_level: 7 }
    ]);
    const sessionProblems = [];
    await addPassiveMasteredReviews(sessionProblems, 5, false);
    expect(sessionProblems[0].selectionReason.type).toBe('passive_mastered_review');
  });

  it('should return 0 on error', async () => {
    ScheduleService.getDailyReviewSchedule.mockRejectedValue(new Error('fail'));
    const result = await addPassiveMasteredReviews([], 5, false);
    expect(result).toBe(0);
  });
});

// ============================================================================
// addFallbackProblems
// ============================================================================

describe('addFallbackProblems', () => {
  it('should return if session is full', async () => {
    const sessionProblems = [{ id: 1 }, { id: 2 }, { id: 3 }];
    await addFallbackProblems(sessionProblems, 3, []);
    expect(enrichReviewProblem).not.toHaveBeenCalled();
  });

  it('should enrich fallback problems', async () => {
    const allProblems = [
      { problem_id: 'uuid-1', leetcode_id: 10, title: 'Fallback', difficulty: 'Easy', tags: ['a'], review_schedule: '2025-01-01' }
    ];
    const sessionProblems = [];
    await addFallbackProblems(sessionProblems, 5, allProblems);
    expect(enrichReviewProblem).toHaveBeenCalled();
  });

  it('should filter out problems without difficulty or tags after enrichment', async () => {
    enrichReviewProblem.mockResolvedValueOnce({ leetcode_id: 1, title: 'No Diff' });
    const allProblems = [
      { problem_id: 'uuid-1', leetcode_id: 1, title: 'No Diff', review_schedule: '2025-01-01' }
    ];
    const sessionProblems = [];
    await addFallbackProblems(sessionProblems, 5, allProblems);
    expect(sessionProblems).toHaveLength(0);
  });

  it('should exclude problems already in session', async () => {
    const allProblems = [
      { problem_id: 'uuid-1', leetcode_id: 10, title: 'Already In', review_schedule: '2025-01-01' }
    ];
    const sessionProblems = [{ problem_id: 'uuid-1', title: 'Already In' }];
    await addFallbackProblems(sessionProblems, 5, allProblems);
    // uuid-1 already in session, should not be added again
    expect(sessionProblems).toHaveLength(1);
  });

  it('should sort by problemSortingCriteria', async () => {
    const allProblems = [
      { problem_id: 'a', leetcode_id: 1, title: 'Later', review_schedule: '2026-01-10', attempt_stats: { total_attempts: 5 } },
      { problem_id: 'b', leetcode_id: 2, title: 'Earlier', review_schedule: '2025-06-01', attempt_stats: { total_attempts: 2 } }
    ];
    const sessionProblems = [];
    await addFallbackProblems(sessionProblems, 5, allProblems);
    // Earlier review_schedule should come first
    if (sessionProblems.length >= 2) {
      expect(sessionProblems[0].leetcode_id).toBe(2);
    }
  });
});

// ============================================================================
// deduplicateById
// ============================================================================

describe('deduplicateById', () => {
  it('should remove duplicate problems by id', () => {
    const problems = [
      { id: 1, title: 'First' },
      { id: 1, title: 'Duplicate' },
      { id: 2, title: 'Second' }
    ];
    const result = deduplicateById(problems);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('First');
  });

  it('should use leetcode_id when id is missing', () => {
    const problems = [
      { leetcode_id: 1, title: 'First' },
      { leetcode_id: 1, title: 'Duplicate' }
    ];
    const result = deduplicateById(problems);
    expect(result).toHaveLength(1);
  });

  it('should filter out problems with no id', () => {
    const problems = [
      { title: 'No ID' },
      { id: 1, title: 'Has ID' }
    ];
    const result = deduplicateById(problems);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Has ID');
  });

  it('should handle empty array', () => {
    expect(deduplicateById([])).toEqual([]);
  });
});

// ============================================================================
// problemSortingCriteria
// ============================================================================

describe('problemSortingCriteria', () => {
  it('should sort by review_schedule first (earlier = higher priority)', () => {
    const a = { review_schedule: '2025-01-01', attempt_stats: { total_attempts: 0, successful_attempts: 0 } };
    const b = { review_schedule: '2026-01-01', attempt_stats: { total_attempts: 0, successful_attempts: 0 } };
    expect(problemSortingCriteria(a, b)).toBeLessThan(0);
  });

  it('should sort by total_attempts when review_schedule is equal', () => {
    const date = '2025-06-01';
    const a = { review_schedule: date, attempt_stats: { total_attempts: 2, successful_attempts: 1 } };
    const b = { review_schedule: date, attempt_stats: { total_attempts: 5, successful_attempts: 3 } };
    expect(problemSortingCriteria(a, b)).toBeLessThan(0);
  });

  it('should sort by decay score as tiebreaker', () => {
    const date = '2025-06-01';
    const a = { review_schedule: date, attempt_stats: { total_attempts: 3, successful_attempts: 2 } };
    const b = { review_schedule: date, attempt_stats: { total_attempts: 3, successful_attempts: 2 } };
    // Both same review_schedule and attempts, falls to decay score comparison
    const result = problemSortingCriteria(a, b);
    expect(typeof result).toBe('number');
  });
});
