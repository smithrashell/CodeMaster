/**
 * Characterization tests for problemService.js functions
 *
 * These tests capture EXISTING behavior before refactoring:
 * - addReviewProblemsToSession (195 lines -> target: 130)
 * - addNewProblemsToSession
 * - Problem normalization logic
 *
 * Goal: Ensure refactoring preserves ALL current functionality
 */

import { ProblemService } from '../problemService';
import { ScheduleService } from '../scheduleService';
import { fetchProblemById } from '../../db/standard_problems';
import { fetchAllProblems } from '../../db/problems';
import logger from '../../utils/logger';

// Mock dependencies
jest.mock('../scheduleService');
jest.mock('../../db/standard_problems');
jest.mock('../../db/problems');
jest.mock('../../utils/logger');

describe('problemService - Characterization Tests for Refactoring', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // TEST GROUP 1: addReviewProblemsToSession
  // ==========================================

  describe('addReviewProblemsToSession - Problem Enrichment', () => {

    it('should enrich review problems with metadata from standard_problems', async () => {
      // Mock review problems from Leitner system (minimal data)
      const mockReviewProblems = [
        {
          leetcode_id: 1,
          box_level: 3,
          review_schedule: '2024-01-15',
          stability: 0.85,
          // Missing: difficulty, tags, slug, title
        }
      ];

      // Mock standard problem data (complete metadata)
      const mockStandardProblem = {
        id: 1,
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array', 'Hash Table'],
        slug: 'two-sum',
        url: 'https://leetcode.com/problems/two-sum'
      };

      ScheduleService.getDailyReviewSchedule.mockResolvedValue(mockReviewProblems);
      fetchProblemById.mockResolvedValue(mockStandardProblem);
      fetchAllProblems.mockResolvedValue([]);

      const _sessionProblems = [];
      const _sessionLength = 5;
      const _isOnboarding = false;
      const _allProblems = [];

      // Call the function through ProblemService (we'll need to export/test the helper)
      // For now, test through fetchAndAssembleSessionProblems
      const result = await ProblemService.fetchAndAssembleSessionProblems(
        sessionLength,
        0, // numberOfNewProblems
        ['Array'], // currentAllowedTags
        'Medium', // currentDifficultyCap
        [], // userFocusAreas
        isOnboarding
      );

      // Verify enrichment happened
      expect(result.length).toBeGreaterThan(0);
      const enrichedProblem = result[0];

      // Should have ALL metadata from standard_problems
      expect(enrichedProblem.title).toBe('Two Sum');
      expect(enrichedProblem.difficulty).toBe('Easy');
      expect(enrichedProblem.tags).toEqual(['Array', 'Hash Table']);
      expect(enrichedProblem.slug).toBe('two-sum');

      // Should preserve Leitner data
      expect(enrichedProblem.box_level).toBe(3);
      expect(enrichedProblem.stability).toBe(0.85);
    });

    it('should normalize problem fields (id, leetcode_id, slug consistency)', async () => {
      const mockReviewProblems = [
        {
          leetcode_id: 2,
          // No 'id' field initially
        }
      ];

      const mockStandardProblem = {
        id: 2,
        title: 'Add Two Numbers',
        difficulty: 'Medium',
        tags: ['Linked List'],
        slug: 'add-two-numbers'
      };

      ScheduleService.getDailyReviewSchedule.mockResolvedValue(mockReviewProblems);
      fetchProblemById.mockResolvedValue(mockStandardProblem);
      fetchAllProblems.mockResolvedValue([]);

      const result = await ProblemService.fetchAndAssembleSessionProblems(
        5, 0, ['Linked List'], 'Hard', [], false
      );

      const problem = result[0];

      // Should normalize: 'id' field should exist and match leetcode_id
      expect(problem.id).toBe(2);
      expect(problem.leetcode_id).toBe(2);

      // Should have slug for URL generation
      expect(problem.slug).toBeDefined();
      expect(problem.slug).toBe('add-two-numbers');
    });

    it('should add attempts array for frontend compatibility', async () => {
      const mockReviewProblems = [
        {
          leetcode_id: 3,
          attempt_stats: {
            total_attempts: 5,
            successful_attempts: 3,
            unsuccessful_attempts: 2
          }
        }
      ];

      const mockStandardProblem = {
        id: 3,
        title: 'Longest Substring',
        difficulty: 'Medium',
        tags: ['String'],
        slug: 'longest-substring'
      };

      ScheduleService.getDailyReviewSchedule.mockResolvedValue(mockReviewProblems);
      fetchProblemById.mockResolvedValue(mockStandardProblem);
      fetchAllProblems.mockResolvedValue([]);

      const result = await ProblemService.fetchAndAssembleSessionProblems(
        5, 0, ['String'], 'Medium', [], false
      );

      const problem = result[0];

      // Should convert attempt_stats to attempts array for frontend
      expect(problem.attempts).toBeDefined();
      expect(Array.isArray(problem.attempts)).toBe(true);
      expect(problem.attempts.length).toBeGreaterThan(0);
      expect(problem.attempts[0].count).toBe(5);
    });

    it('should skip review problems during onboarding', async () => {
      const mockReviewProblems = [
        { leetcode_id: 1, box_level: 2 }
      ];

      ScheduleService.getDailyReviewSchedule.mockResolvedValue(mockReviewProblems);
      fetchAllProblems.mockResolvedValue([]);

      await ProblemService.fetchAndAssembleSessionProblems(
        5,
        5, // numberOfNewProblems
        ['Array'],
        'Easy',
        [],
        true // isOnboarding = true
      );

      // Should NOT add review problems during onboarding
      expect(ScheduleService.getDailyReviewSchedule).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // TEST GROUP 2: Problem Priority Logic
  // ==========================================

  describe('addReviewProblemsToSession - Priority Logic', () => {

    it('should prioritize review problems up to session length', async () => {
      // Many review problems due
      const mockReviewProblems = Array.from({ length: 10 }, (_, i) => ({
        leetcode_id: i + 1,
        box_level: 2,
        review_schedule: '2024-01-01'
      }));

      // Mock standard problems for each
      fetchProblemById.mockImplementation((id) => Promise.resolve({
        id,
        title: `Problem ${id}`,
        difficulty: 'Medium',
        tags: ['Array'],
        slug: `problem-${id}`
      }));

      ScheduleService.getDailyReviewSchedule.mockResolvedValue(mockReviewProblems);
      fetchAllProblems.mockResolvedValue([]);

      const sessionLength = 5;
      const result = await ProblemService.fetchAndAssembleSessionProblems(
        sessionLength,
        5, // numberOfNewProblems
        ['Array'],
        'Medium',
        [],
        false
      );

      // Should limit review problems to session length
      // (All 5 slots filled with review problems, no room for new)
      expect(result.length).toBe(sessionLength);

      // Log should indicate review problems filled the session
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/Session filled entirely with review problems/)
      );
    });

    it('should leave room for new problems when fewer reviews are due', async () => {
      const mockReviewProblems = [
        { leetcode_id: 1, box_level: 2 },
        { leetcode_id: 2, box_level: 3 }
      ];

      fetchProblemById.mockImplementation((id) => Promise.resolve({
        id,
        title: `Problem ${id}`,
        difficulty: 'Medium',
        tags: ['Array'],
        slug: `problem-${id}`
      }));

      ScheduleService.getDailyReviewSchedule.mockResolvedValue(mockReviewProblems);
      fetchAllProblems.mockResolvedValue([]);

      const sessionLength = 5;
      const result = await ProblemService.fetchAndAssembleSessionProblems(
        sessionLength,
        3, // numberOfNewProblems
        ['Array'],
        'Medium',
        [],
        false
      );

      // Should have: 2 review + 3 new = 5 total (if new problems available)
      // Or at least 2 review problems
      expect(result.length).toBeGreaterThanOrEqual(2);

      // Log should indicate slots available for new problems
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/slots available for new problems|slots will be filled/)
      );
    });
  });

  // ==========================================
  // TEST GROUP 3: Edge Cases
  // ==========================================

  describe('addReviewProblemsToSession - Edge Cases', () => {

    it('should handle no review problems due', async () => {
      ScheduleService.getDailyReviewSchedule.mockResolvedValue([]);
      fetchAllProblems.mockResolvedValue([]);

      const result = await ProblemService.fetchAndAssembleSessionProblems(
        5, 5, ['Array'], 'Medium', [], false
      );

      // Should still return session (filled with new problems)
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // Log should indicate no review problems
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/No review problems due|will contain only new problems/)
      );
    });

    it('should handle missing standard_problem data gracefully', async () => {
      const mockReviewProblems = [
        { leetcode_id: 999, box_level: 2 } // Problem not in standard_problems
      ];

      ScheduleService.getDailyReviewSchedule.mockResolvedValue(mockReviewProblems);
      fetchProblemById.mockResolvedValue(null); // Not found
      fetchAllProblems.mockResolvedValue([]);

      const result = await ProblemService.fetchAndAssembleSessionProblems(
        5, 5, ['Array'], 'Medium', [], false
      );

      // Should not crash, should log error
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/Could not find problem 999/)
      );

      // Result should still be valid (exclude the problematic problem)
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter out invalid problems (no id or leetcode_id)', async () => {
      const mockReviewProblems = [
        { leetcode_id: 1, box_level: 2 }, // Valid
        { box_level: 3 }, // Invalid - no leetcode_id
        { leetcode_id: null, box_level: 1 }, // Invalid - null id
      ];

      fetchProblemById.mockImplementation((id) => {
        if (id === 1) {
          return Promise.resolve({
            id: 1,
            title: 'Valid Problem',
            difficulty: 'Easy',
            tags: ['Array'],
            slug: 'valid-problem'
          });
        }
        return Promise.resolve(null);
      });

      ScheduleService.getDailyReviewSchedule.mockResolvedValue(mockReviewProblems);
      fetchAllProblems.mockResolvedValue([]);

      const result = await ProblemService.fetchAndAssembleSessionProblems(
        5, 5, ['Array'], 'Easy', [], false
      );

      // Should filter out invalid problems
      const validProblems = result.filter(p => p.id === 1);
      expect(validProblems.length).toBeGreaterThan(0);

      // Should log filtering warnings
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  // ==========================================
  // TEST GROUP 4: Field Normalization
  // ==========================================

  describe('Problem Field Normalization', () => {

    it('should normalize leetcode_address to LeetCodeAddress', async () => {
      const mockReviewProblems = [
        {
          leetcode_id: 1,
          leetcode_address: 'https://leetcode.com/problems/two-sum' // snake_case
          // Should be normalized to LeetCodeAddress for frontend
        }
      ];

      fetchProblemById.mockResolvedValue({
        id: 1,
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array'],
        slug: 'two-sum'
      });

      ScheduleService.getDailyReviewSchedule.mockResolvedValue(mockReviewProblems);
      fetchAllProblems.mockResolvedValue([]);

      const result = await ProblemService.fetchAndAssembleSessionProblems(
        5, 0, ['Array'], 'Easy', [], false
      );

      const problem = result[0];

      // Should have PascalCase field for frontend compatibility
      expect(problem.LeetCodeAddress).toBe('https://leetcode.com/problems/two-sum');
    });

    it('should generate slug from title if missing', async () => {
      const mockReviewProblems = [
        {
          leetcode_id: 1,
          // No slug field
        }
      ];

      fetchProblemById.mockResolvedValue({
        id: 1,
        title: 'Two Sum Problem!', // Title with special chars
        difficulty: 'Easy',
        tags: ['Array'],
        // No slug
      });

      ScheduleService.getDailyReviewSchedule.mockResolvedValue(mockReviewProblems);
      fetchAllProblems.mockResolvedValue([]);

      const result = await ProblemService.fetchAndAssembleSessionProblems(
        5, 0, ['Array'], 'Easy', [], false
      );

      const problem = result[0];

      // Should generate slug from title
      expect(problem.slug).toBeDefined();
      expect(problem.slug).toBe('two-sum-problem'); // Normalized

      // Should log warning about generated slug
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/Generated slug from title/)
      );
    });
  });

  // ==========================================
  // TEST GROUP 5: Deduplication
  // ==========================================

  describe('Problem Deduplication', () => {

    it('should deduplicate problems by id/leetcode_id', async () => {
      // Simulate scenario where same problem appears twice
      const duplicateProblems = [
        { leetcode_id: 1, box_level: 2 },
        { leetcode_id: 1, box_level: 3 }, // Duplicate!
      ];

      fetchProblemById.mockResolvedValue({
        id: 1,
        title: 'Two Sum',
        difficulty: 'Easy',
        tags: ['Array'],
        slug: 'two-sum'
      });

      ScheduleService.getDailyReviewSchedule.mockResolvedValue(duplicateProblems);
      fetchAllProblems.mockResolvedValue([]);

      const result = await ProblemService.fetchAndAssembleSessionProblems(
        5, 0, ['Array'], 'Easy', [], false
      );

      // Should only include problem once
      const problemIds = result.map(p => p.id);
      const uniqueIds = [...new Set(problemIds)];
      expect(problemIds.length).toBe(uniqueIds.length);
    });
  });
});
