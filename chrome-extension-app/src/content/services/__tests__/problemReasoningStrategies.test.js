/**
 * Tests for Problem Reasoning Strategies
 *
 * These tests ensure that problem classification (new vs. review) works correctly
 * and prevents regression of issue #151 where attempted problems showed as "new"
 */

import {
  SpacedRepetitionStrategy,
  PerformanceRecoveryStrategy,
  NewProblemStrategy,
  ReviewProblemStrategy,
  ReasoningStrategyManager
} from '../problemReasoningStrategies.js';

describe('NewProblemStrategy', () => {
  let strategy;

  beforeEach(() => {
    strategy = new NewProblemStrategy();
  });

  describe('applies()', () => {
    it('should identify problems with no attempt_stats as new', () => {
      const problem = {
        leetcode_id: 1,
        title: "Two Sum",
        // No attempt_stats
      };

      expect(strategy.applies(problem, {}, {})).toBe(true);
    });

    it('should identify problems with null attempt_stats as new', () => {
      const problem = {
        leetcode_id: 1,
        title: "Two Sum",
        attempt_stats: null
      };

      expect(strategy.applies(problem, {}, {})).toBe(true);
    });

    it('should identify problems with zero attempts as new (edge case)', () => {
      const problem = {
        leetcode_id: 1,
        title: "Two Sum",
        attempt_stats: {
          total_attempts: 0,
          successful_attempts: 0,
          unsuccessful_attempts: 0
        }
      };

      expect(strategy.applies(problem, {}, {})).toBe(true);
    });

    it('should NOT identify problems with 1+ attempts as new', () => {
      const problem = {
        leetcode_id: 9,
        title: "Palindrome Number",
        attempt_stats: {
          total_attempts: 2,
          successful_attempts: 2,
          unsuccessful_attempts: 0
        },
        last_attempt_date: "2025-10-29T11:43:11.035Z"
      };

      expect(strategy.applies(problem, {}, {})).toBe(false);
    });

    it('should NOT identify problems with unsuccessful attempts as new', () => {
      const problem = {
        leetcode_id: 10,
        title: "Regular Expression Matching",
        attempt_stats: {
          total_attempts: 3,
          successful_attempts: 0,
          unsuccessful_attempts: 3
        },
        last_attempt_date: "2025-10-28T11:43:11.035Z"
      };

      expect(strategy.applies(problem, {}, {})).toBe(false);
    });
  });

  describe('generateReason()', () => {
    it('should generate reason for new problem without crashing', () => {
      const problem = {
        leetcode_id: 1,
        title: "Two Sum",
        tags: ["Array", "Hash Table"],
        difficulty: "Easy"
      };

      const reason = strategy.generateReason(problem, {}, {});

      expect(reason).toBeDefined();
      expect(reason.type).toBe('new_problem');
      expect(reason.shortText).toContain('New');
      expect(reason.fullText).toBeDefined();
    });
  });
});

describe('ReviewProblemStrategy', () => {
  let strategy;

  beforeEach(() => {
    strategy = new ReviewProblemStrategy();
  });

  describe('applies()', () => {
    it('should identify problems with 1+ attempts as review', () => {
      const problem = {
        leetcode_id: 9,
        title: "Palindrome Number",
        attempt_stats: {
          total_attempts: 2,
          successful_attempts: 2,
          unsuccessful_attempts: 0
        },
        last_attempt_date: "2025-10-29T11:43:11.035Z"
      };

      expect(strategy.applies(problem, {}, {})).toBe(true);
    });

    it('should NOT identify problems with no attempt_stats as review', () => {
      const problem = {
        leetcode_id: 1,
        title: "Two Sum"
        // No attempt_stats
      };

      expect(strategy.applies(problem, {}, {})).toBe(false);
    });

    it('should NOT identify problems with zero attempts as review', () => {
      const problem = {
        leetcode_id: 1,
        title: "Two Sum",
        attempt_stats: {
          total_attempts: 0,
          successful_attempts: 0,
          unsuccessful_attempts: 0
        }
      };

      expect(strategy.applies(problem, {}, {})).toBe(false);
    });

    it('should identify problems with only unsuccessful attempts as review', () => {
      const problem = {
        leetcode_id: 10,
        title: "Regular Expression Matching",
        attempt_stats: {
          total_attempts: 3,
          successful_attempts: 0,
          unsuccessful_attempts: 3
        },
        last_attempt_date: "2025-10-28T11:43:11.035Z"
      };

      expect(strategy.applies(problem, {}, {})).toBe(true);
    });
  });

  describe('generateReason()', () => {
    it('should generate reason with correct attempt count', () => {
      const problem = {
        leetcode_id: 9,
        title: "Palindrome Number",
        attempt_stats: {
          total_attempts: 2,
          successful_attempts: 2,
          unsuccessful_attempts: 0
        },
        last_attempt_date: "2025-10-29T11:43:11.035Z"
      };

      const reason = strategy.generateReason(problem, {}, {});

      expect(reason).toBeDefined();
      expect(reason.type).toBe('review_problem');
      expect(reason.details.totalAttempts).toBe(2);
      expect(reason.shortText).toContain('2 attempts');
    });

    it('should handle singular "attempt" for 1 attempt', () => {
      const problem = {
        leetcode_id: 5,
        title: "Longest Palindromic Substring",
        attempt_stats: {
          total_attempts: 1,
          successful_attempts: 1,
          unsuccessful_attempts: 0
        },
        last_attempt_date: "2025-10-29T11:43:11.035Z"
      };

      const reason = strategy.generateReason(problem, {}, {});

      expect(reason.shortText).toContain('1 attempt');
      expect(reason.shortText).not.toContain('1 attempts');
    });

    it('should not crash when attempt_stats is missing (defensive)', () => {
      const problem = {
        leetcode_id: 1,
        title: "Two Sum"
        // No attempt_stats
      };

      expect(() => strategy.generateReason(problem, {}, {})).not.toThrow();

      const reason = strategy.generateReason(problem, {}, {});
      expect(reason.details.totalAttempts).toBe(0);
    });
  });

  describe('calculateDaysSinceLastAttempt()', () => {
    it('should calculate days correctly for recent attempt', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const problem = {
        leetcode_id: 9,
        last_attempt_date: yesterday.toISOString()
      };

      const days = strategy.calculateDaysSinceLastAttempt(problem);

      expect(days).toBe(1);
    });

    it('should calculate days correctly for old attempt', () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const problem = {
        leetcode_id: 9,
        last_attempt_date: tenDaysAgo.toISOString()
      };

      const days = strategy.calculateDaysSinceLastAttempt(problem);

      expect(days).toBe(10);
    });

    it('should return 0 when last_attempt_date is missing', () => {
      const problem = {
        leetcode_id: 1,
        title: "Two Sum"
        // No last_attempt_date
      };

      const days = strategy.calculateDaysSinceLastAttempt(problem);

      expect(days).toBe(0);
    });

    it('should return 0 for invalid date string', () => {
      const problem = {
        leetcode_id: 9,
        last_attempt_date: "invalid-date-string"
      };

      const days = strategy.calculateDaysSinceLastAttempt(problem);

      expect(days).toBe(0);
    });

    it('should never return negative days', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const problem = {
        leetcode_id: 9,
        last_attempt_date: tomorrow.toISOString()
      };

      const days = strategy.calculateDaysSinceLastAttempt(problem);

      expect(days).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('SpacedRepetitionStrategy', () => {
  let strategy;

  beforeEach(() => {
    strategy = new SpacedRepetitionStrategy();
  });

  describe('applies()', () => {
    it('should apply for problems attempted 7+ days ago', () => {
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const problem = {
        leetcode_id: 9,
        attempt_stats: {
          total_attempts: 2,
          successful_attempts: 2,
          unsuccessful_attempts: 0
        },
        last_attempt_date: eightDaysAgo.toISOString()
      };

      expect(strategy.applies(problem, {}, {})).toBe(true);
    });

    it('should NOT apply for problems attempted less than 7 days ago', () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const problem = {
        leetcode_id: 9,
        attempt_stats: {
          total_attempts: 2,
          successful_attempts: 2,
          unsuccessful_attempts: 0
        },
        last_attempt_date: fiveDaysAgo.toISOString()
      };

      expect(strategy.applies(problem, {}, {})).toBe(false);
    });

    it('should NOT apply for new problems (no attempts)', () => {
      const problem = {
        leetcode_id: 1,
        title: "Two Sum"
        // No attempt_stats
      };

      expect(strategy.applies(problem, {}, {})).toBe(false);
    });
  });

  describe('generateReason()', () => {
    it('should not crash with valid attempt_stats', () => {
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const problem = {
        leetcode_id: 9,
        attempt_stats: {
          total_attempts: 2,
          successful_attempts: 2,
          unsuccessful_attempts: 0
        },
        last_attempt_date: eightDaysAgo.toISOString()
      };

      expect(() => strategy.generateReason(problem, {}, {})).not.toThrow();

      const reason = strategy.generateReason(problem, {}, {});
      expect(reason.type).toBe('spaced_repetition');
      expect(reason.details.previousAttempts).toBe(2);
      expect(reason.details.daysSinceLastAttempt).toBe(8);
    });

    it('should not crash when attempt_stats is missing (defensive)', () => {
      const problem = {
        leetcode_id: 1,
        title: "Two Sum"
        // No attempt_stats
      };

      expect(() => strategy.generateReason(problem, {}, {})).not.toThrow();

      const reason = strategy.generateReason(problem, {}, {});
      expect(reason.details.previousAttempts).toBe(0);
    });
  });
});

describe('PerformanceRecoveryStrategy', () => {
  let strategy;

  beforeEach(() => {
    strategy = new PerformanceRecoveryStrategy();
  });

  describe('applies()', () => {
    it('should apply when 50%+ attempts are failures', () => {
      const problem = {
        leetcode_id: 10,
        attempt_stats: {
          total_attempts: 4,
          successful_attempts: 1,
          unsuccessful_attempts: 3  // 75% failure rate
        },
        last_attempt_date: "2025-10-28T11:43:11.035Z"
      };

      expect(strategy.applies(problem, {}, {})).toBe(true);
    });

    it('should apply when exactly 50% attempts are failures', () => {
      const problem = {
        leetcode_id: 10,
        attempt_stats: {
          total_attempts: 4,
          successful_attempts: 2,
          unsuccessful_attempts: 2  // 50% failure rate
        },
        last_attempt_date: "2025-10-28T11:43:11.035Z"
      };

      expect(strategy.applies(problem, {}, {})).toBe(true);
    });

    it('should NOT apply when less than 50% attempts are failures', () => {
      const problem = {
        leetcode_id: 9,
        attempt_stats: {
          total_attempts: 4,
          successful_attempts: 3,
          unsuccessful_attempts: 1  // 25% failure rate
        },
        last_attempt_date: "2025-10-29T11:43:11.035Z"
      };

      expect(strategy.applies(problem, {}, {})).toBe(false);
    });

    it('should NOT apply for new problems', () => {
      const problem = {
        leetcode_id: 1,
        title: "Two Sum"
        // No attempt_stats
      };

      expect(strategy.applies(problem, {}, {})).toBe(false);
    });

    it('should require at least 2 attempts', () => {
      const problem = {
        leetcode_id: 5,
        attempt_stats: {
          total_attempts: 1,
          successful_attempts: 0,
          unsuccessful_attempts: 1  // 100% failure but only 1 attempt
        },
        last_attempt_date: "2025-10-29T11:43:11.035Z"
      };

      expect(strategy.applies(problem, {}, {})).toBe(false);
    });
  });

  describe('countRecentFailures()', () => {
    it('should return unsuccessful_attempts count', () => {
      const problem = {
        leetcode_id: 10,
        attempt_stats: {
          total_attempts: 5,
          successful_attempts: 2,
          unsuccessful_attempts: 3
        }
      };

      const failures = strategy.countRecentFailures(problem);

      expect(failures).toBe(3);
    });

    it('should return 0 when no attempt_stats', () => {
      const problem = {
        leetcode_id: 1,
        title: "Two Sum"
      };

      const failures = strategy.countRecentFailures(problem);

      expect(failures).toBe(0);
    });

    it('should return 0 when unsuccessful_attempts is missing', () => {
      const problem = {
        leetcode_id: 9,
        attempt_stats: {
          total_attempts: 2,
          successful_attempts: 2
          // No unsuccessful_attempts field
        }
      };

      const failures = strategy.countRecentFailures(problem);

      expect(failures).toBe(0);
    });
  });

  describe('getLastSuccessDate()', () => {
    it('should return last_attempt_date when there are successful attempts', () => {
      const problem = {
        leetcode_id: 9,
        attempt_stats: {
          total_attempts: 2,
          successful_attempts: 1,
          unsuccessful_attempts: 1
        },
        last_attempt_date: "2025-10-29T11:43:11.035Z"
      };

      const date = strategy.getLastSuccessDate(problem);

      expect(date).toBe("2025-10-29T11:43:11.035Z");
    });

    it('should return null when no successful attempts', () => {
      const problem = {
        leetcode_id: 10,
        attempt_stats: {
          total_attempts: 3,
          successful_attempts: 0,
          unsuccessful_attempts: 3
        },
        last_attempt_date: "2025-10-28T11:43:11.035Z"
      };

      const date = strategy.getLastSuccessDate(problem);

      expect(date).toBe(null);
    });

    it('should return null when no attempt_stats', () => {
      const problem = {
        leetcode_id: 1,
        title: "Two Sum"
      };

      const date = strategy.getLastSuccessDate(problem);

      expect(date).toBe(null);
    });
  });
});

describe('ReasoningStrategyManager', () => {
  let manager;

  beforeEach(() => {
    manager = new ReasoningStrategyManager();
  });

  describe('Strategy Priority and Selection', () => {
    it('should select NewProblemStrategy for problems with no attempts', () => {
      const problem = {
        leetcode_id: 1,
        title: "Two Sum",
        tags: ["Array", "Hash Table"],
        difficulty: "Easy"
      };

      const reason = manager.generateReason(problem, {}, {});

      expect(reason.type).toBe('new_problem');
    });

    it('should select ReviewProblemStrategy for problems with attempts', () => {
      const problem = {
        leetcode_id: 9,
        attempt_stats: {
          total_attempts: 2,
          successful_attempts: 2,
          unsuccessful_attempts: 0
        },
        last_attempt_date: "2025-10-29T11:43:11.035Z"
      };

      const reason = manager.generateReason(problem, {}, {});

      // Should be review_problem or higher priority strategy
      expect(['spaced_repetition', 'performance_recovery', 'review_problem']).toContain(reason.type);
    });

    it('should prefer SpacedRepetitionStrategy over ReviewProblemStrategy', () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const problem = {
        leetcode_id: 9,
        attempt_stats: {
          total_attempts: 2,
          successful_attempts: 2,
          unsuccessful_attempts: 0
        },
        last_attempt_date: tenDaysAgo.toISOString()
      };

      const reason = manager.generateReason(problem, {}, {});

      expect(reason.type).toBe('spaced_repetition');
    });

    it('should not crash for edge case problems', () => {
      const edgeCases = [
        { leetcode_id: 1 }, // No fields
        { leetcode_id: 2, attempt_stats: null }, // Null attempt_stats
        { leetcode_id: 3, attempt_stats: {} }, // Empty attempt_stats
        { leetcode_id: 4, last_attempt_date: "invalid" }, // Invalid date
      ];

      edgeCases.forEach(problem => {
        expect(() => manager.generateReason(problem, {}, {})).not.toThrow();
      });
    });
  });

  describe('Regression Test for Issue #151', () => {
    it('should NEVER classify attempted problems as new', () => {
      const attemptedProblems = [
        {
          leetcode_id: 9,
          title: "Palindrome Number",
          attempt_stats: {
            total_attempts: 2,
            successful_attempts: 2,
            unsuccessful_attempts: 0
          },
          last_attempt_date: "2025-10-29T11:43:11.035Z"
        },
        {
          leetcode_id: 10,
          title: "Regular Expression Matching",
          attempt_stats: {
            total_attempts: 1,
            successful_attempts: 0,
            unsuccessful_attempts: 1
          },
          last_attempt_date: "2025-10-28T11:43:11.035Z"
        },
        {
          leetcode_id: 15,
          title: "3Sum",
          attempt_stats: {
            total_attempts: 5,
            successful_attempts: 3,
            unsuccessful_attempts: 2
          },
          last_attempt_date: "2025-10-20T11:43:11.035Z"
        }
      ];

      attemptedProblems.forEach(problem => {
        const reason = manager.generateReason(problem, {}, {});

        // These should NEVER be classified as new_problem
        expect(reason.type).not.toBe('new_problem');

        // They should be one of the review-related types
        expect([
          'spaced_repetition',
          'performance_recovery',
          'review_problem',
          'tag_weakness',
          'difficulty_progression',
          'pattern_reinforcement',
          'general'
        ]).toContain(reason.type);
      });
    });

    it('should ONLY classify problems with no attempt_stats as new', () => {
      const newProblems = [
        {
          leetcode_id: 1,
          title: "Two Sum",
          tags: ["Array"],
          difficulty: "Easy"
        },
        {
          leetcode_id: 2,
          title: "Add Two Numbers",
          tags: ["Linked List"],
          difficulty: "Medium",
          attempt_stats: null
        },
        {
          leetcode_id: 3,
          title: "Longest Substring Without Repeating Characters",
          tags: ["Hash Table"],
          difficulty: "Medium",
          attempt_stats: {
            total_attempts: 0,
            successful_attempts: 0,
            unsuccessful_attempts: 0
          }
        }
      ];

      newProblems.forEach(problem => {
        const reason = manager.generateReason(problem, {}, {});

        // These should eventually resolve to new_problem
        // (unless caught by higher priority strategies like tag_weakness)
        expect([
          'new_problem',
          'tag_weakness',
          'new_tag_introduction',
          'difficulty_progression',
          'pattern_reinforcement',
          'general'
        ]).toContain(reason.type);
      });
    });
  });
});
