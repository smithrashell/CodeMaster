/**
 * 🧪 Unit Tests for Individual Functions
 * These should run in Jest/Vitest, NOT in the browser service worker
 *
 * Focus: Testing pure functions and isolated logic
 */

import { calculateOptimalPathScore } from '../db/problem_relationships.js';
import { calculateTagSimilarity } from '../db/tag_mastery.js';
import { FocusCoordinationService } from '../services/focusCoordinationService.js';

// ============================================================================
// ALGORITHM UNIT TESTS - Should run in Jest/Vitest
// ============================================================================

describe('Problem Relationship Algorithms', () => {
  describe('calculateOptimalPathScore', () => {
    it('should score problems based on relationship strength', async () => {
      const problem = { id: 1001, tags: ['array'], difficulty: 'Easy' };
      const mockCachedData = {
        recentSuccesses: [{ leetcode_id: 1000, tags: ['array'] }],
        relationshipMap: new Map([['1000-1001', 4.5]]),
        isPlateauing: false
      };

      const score = await calculateOptimalPathScore(problem, null, mockCachedData);
      expect(score).toBeGreaterThan(1.0);
    });

    it('should boost hard problems during plateau', async () => {
      const hardProblem = { id: 1001, tags: ['array'], difficulty: 'Hard' };
      const easyProblem = { id: 1002, tags: ['array'], difficulty: 'Easy' };

      const plateauData = {
        recentSuccesses: [],
        relationshipMap: new Map(),
        isPlateauing: true
      };

      const hardScore = await calculateOptimalPathScore(hardProblem, null, plateauData);
      const easyScore = await calculateOptimalPathScore(easyProblem, null, plateauData);

      expect(hardScore).toBeGreaterThan(easyScore);
    });
  });

  describe('calculateTagSimilarity', () => {
    it('should return higher similarity for overlapping tags', () => {
      const similarity = calculateTagSimilarity({
        tags1: ['array', 'two-pointers'],
        tags2: ['array', 'hash-table'],
        tagGraph: new Map(),
        tagMastery: {},
        difficulty1: 'Easy',
        difficulty2: 'Easy'
      });

      expect(similarity).toBeGreaterThan(0);
    });

    it('should return 0 for completely different tags', () => {
      const similarity = calculateTagSimilarity({
        tags1: ['array'],
        tags2: ['tree'],
        tagGraph: new Map(),
        tagMastery: {},
        difficulty1: 'Easy',
        difficulty2: 'Easy'
      });

      expect(similarity).toBe(0);
    });
  });
});

describe('Focus Coordination Algorithms', () => {
  describe('calculateOptimalTagCount', () => {
    it('should return 1 for poor performance', () => {
      const performance = { accuracy: 0.4, efficiency: 0.3 };
      const tagCount = FocusCoordinationService.calculateOptimalTagCount(performance, {});
      expect(tagCount).toBe(1);
    });

    it('should return more tags for excellent performance', () => {
      const performance = { accuracy: 0.9, efficiency: 0.8 };
      const tagCount = FocusCoordinationService.calculateOptimalTagCount(performance, {});
      expect(tagCount).toBeGreaterThan(1);
    });
  });

  describe('isOnboarding', () => {
    it('should return true for new users', () => {
      const sessionState = { num_sessions_completed: 0 };
      const isOnboarding = FocusCoordinationService.isOnboarding(sessionState);
      expect(isOnboarding).toBe(true);
    });

    it('should return false for experienced users', () => {
      const sessionState = { num_sessions_completed: 10 };
      const isOnboarding = FocusCoordinationService.isOnboarding(sessionState);
      expect(isOnboarding).toBe(false);
    });
  });
});

// ============================================================================
// CONFIGURATION VALIDATION TESTS
// ============================================================================

describe('System Configuration', () => {
  it('should have valid FOCUS_CONFIG constants', () => {
    expect(FocusCoordinationService.FOCUS_CONFIG).toBeDefined();
    expect(FocusCoordinationService.FOCUS_CONFIG.onboarding.sessionCount).toBeGreaterThan(0);
    expect(FocusCoordinationService.FOCUS_CONFIG.limits.totalTags).toBeGreaterThan(0);
  });
});

export { };