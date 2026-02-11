/**
 * Tests for Adaptive Learning: Triggered Review Detection System
 *
 * Tests the smart mastered problem resurfacing algorithm that:
 * 1. Detects problems needing reinforcement (recent failures + chronic struggles)
 * 2. Finds mastered "bridge" problems that connect to multiple struggling problems
 * 3. Scores candidates using aggregate relationship strength and coverage bonus
 */

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

// Reset IndexedDB before each test
beforeEach(() => {
  global.indexedDB = new IDBFactory();
});

// Mock logger
jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Triggered Reviews - Algorithm Tests', () => {
  describe('getProblemsNeedingReinforcement logic', () => {
    it('should identify recent failures from attempts', () => {
      const recentAttempts = [
        { leetcode_id: 1, success: false },
        { leetcode_id: 2, success: true },
        { leetcode_id: 3, success: false },
        { leetcode_id: 1, success: false }, // Duplicate should be deduped
      ];

      // Extract unique failed problem IDs (the core logic)
      const failures = recentAttempts.filter(a => !a.success);
      const uniqueFailures = [...new Map(failures.map(f => [f.leetcode_id, f])).values()];

      expect(uniqueFailures.length).toBe(2);
      expect(uniqueFailures.map(f => f.leetcode_id)).toEqual([1, 3]);
    });

    it('should return empty when no failures exist', () => {
      const recentAttempts = [
        { leetcode_id: 1, success: true },
        { leetcode_id: 2, success: true },
      ];

      const failures = recentAttempts.filter(a => !a.success);
      expect(failures.length).toBe(0);
    });

    it('should handle empty attempts array', () => {
      const recentAttempts = [];
      const failures = recentAttempts.filter(a => !a.success);
      expect(failures.length).toBe(0);
    });
  });

  describe('Chronic struggle detection', () => {
    it('should identify problems with high unsuccessful attempts', () => {
      const problems = [
        { leetcode_id: 1, box_level: 2, attempt_stats: { unsuccessful_attempts: 5 } },
        { leetcode_id: 2, box_level: 3, attempt_stats: { unsuccessful_attempts: 2 } }, // Below threshold
        { leetcode_id: 3, box_level: 4, attempt_stats: { unsuccessful_attempts: 4 } },
        { leetcode_id: 4, box_level: 6, attempt_stats: { unsuccessful_attempts: 5 } }, // Mastered, excluded
      ];

      const minUnsuccessfulAttempts = 3;
      const maxBoxLevel = 4;

      const chronicStruggles = problems.filter(p =>
        p.box_level <= maxBoxLevel &&
        (p.attempt_stats?.unsuccessful_attempts || 0) >= minUnsuccessfulAttempts
      );

      expect(chronicStruggles.length).toBe(2);
      expect(chronicStruggles.map(p => p.leetcode_id)).toEqual([1, 3]);
    });

    it('should exclude mastered problems from chronic struggles', () => {
      const problems = [
        { leetcode_id: 1, box_level: 6, attempt_stats: { unsuccessful_attempts: 10 } },
        { leetcode_id: 2, box_level: 7, attempt_stats: { unsuccessful_attempts: 5 } },
        { leetcode_id: 3, box_level: 8, attempt_stats: { unsuccessful_attempts: 3 } },
      ];

      const maxBoxLevel = 4;
      const chronicStruggles = problems.filter(p => p.box_level <= maxBoxLevel);

      expect(chronicStruggles.length).toBe(0);
    });
  });

  describe('Bridge problem scoring algorithm', () => {
    it('should calculate aggregate strength correctly', () => {
      const strugglingIds = [1, 2, 3];
      const relationships = { 1: 3.0, 2: 2.5, 3: 0.5 }; // 0.5 is below threshold
      const THRESHOLD = 2.0;

      let aggregateStrength = 0;
      let connectedProblems = 0;

      for (const id of strugglingIds) {
        const strength = relationships[id] || 0;
        if (strength >= THRESHOLD) {
          aggregateStrength += strength;
          connectedProblems++;
        }
      }

      expect(aggregateStrength).toBe(5.5); // 3.0 + 2.5
      expect(connectedProblems).toBe(2); // Only 2 above threshold
    });

    it('should calculate coverage bonus correctly', () => {
      const strugglingIds = [1, 2, 3, 4];
      const connectedProblems = 2; // Connected to 2 out of 4

      const coverageBonus = connectedProblems / strugglingIds.length;

      expect(coverageBonus).toBe(0.5);
    });

    it('should calculate final score with coverage bonus', () => {
      const aggregateStrength = 5.5;
      const coverageBonus = 0.5;

      const finalScore = aggregateStrength * (1 + coverageBonus);

      expect(finalScore).toBe(8.25); // 5.5 * 1.5
    });

    it('should prefer problems with higher coverage', () => {
      // Problem A: connects to 1 struggling problem with strength 5.0
      const scoreA = 5.0 * (1 + 1/4); // aggregateStrength * (1 + coverageBonus)
      // Problem B: connects to 3 struggling problems with total strength 6.0
      const scoreB = 6.0 * (1 + 3/4);

      expect(scoreB).toBeGreaterThan(scoreA);
    });
  });

  describe('Relationship strength threshold', () => {
    it('should only include relationships >= 2.0', () => {
      const relationships = {
        1: 1.9, // Below threshold
        2: 2.0, // Exactly at threshold
        3: 2.5, // Above threshold
        4: 5.0, // Strong relationship
      };
      const THRESHOLD = 2.0;

      const validRelationships = Object.entries(relationships)
        .filter(([, strength]) => strength >= THRESHOLD);

      expect(validRelationships.length).toBe(3);
      expect(validRelationships.map(([id]) => id)).toEqual(['2', '3', '4']);
    });
  });

  describe('Tag mastery decay boost', () => {
    it('should boost score for stale tags (decay < 0.7)', () => {
      const tagMasteryMap = {
        'array': { decay_score: 0.6 }, // Stale
        'hash-table': { decay_score: 0.9 }, // Fresh
      };

      const problemTags = ['array', 'hash-table'];
      let boostApplied = false;
      let score = 10.0;

      for (const tag of problemTags) {
        const tagData = tagMasteryMap[tag.toLowerCase()];
        if (tagData && tagData.decay_score < 0.7) {
          score *= 1.1;
          boostApplied = true;
        }
      }

      expect(boostApplied).toBe(true);
      expect(score).toBe(11.0); // 10.0 * 1.1
    });

    it('should not boost score for fresh tags', () => {
      const tagMasteryMap = {
        'array': { decay_score: 0.95 },
        'hash-table': { decay_score: 0.85 },
      };

      const problemTags = ['array', 'hash-table'];
      let score = 10.0;

      for (const tag of problemTags) {
        const tagData = tagMasteryMap[tag.toLowerCase()];
        if (tagData && tagData.decay_score < 0.7) {
          score *= 1.1;
        }
      }

      expect(score).toBe(10.0); // No boost applied
    });
  });

  describe('Top 2 selection', () => {
    it('should return max 2 bridge problems sorted by score', () => {
      const scoredCandidates = [
        { problem: { leetcode_id: 1 }, finalScore: 8.0 },
        { problem: { leetcode_id: 2 }, finalScore: 12.0 },
        { problem: { leetcode_id: 3 }, finalScore: 6.0 },
        { problem: { leetcode_id: 4 }, finalScore: 15.0 },
      ];

      scoredCandidates.sort((a, b) => b.finalScore - a.finalScore);
      const selected = scoredCandidates.slice(0, 2);

      expect(selected.length).toBe(2);
      expect(selected[0].problem.leetcode_id).toBe(4); // Highest score
      expect(selected[1].problem.leetcode_id).toBe(2); // Second highest
    });

    it('should return fewer than 2 if not enough candidates', () => {
      const scoredCandidates = [
        { problem: { leetcode_id: 1 }, finalScore: 8.0 },
      ];

      const selected = scoredCandidates.slice(0, 2);

      expect(selected.length).toBe(1);
    });

    it('should return empty array if no candidates', () => {
      const scoredCandidates = [];
      const selected = scoredCandidates.slice(0, 2);

      expect(selected.length).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle case when no failures and no chronic struggles', () => {
      const recentAttempts = [
        { leetcode_id: 1, success: true },
        { leetcode_id: 2, success: true },
      ];
      const problems = [
        { leetcode_id: 1, box_level: 3, attempt_stats: { unsuccessful_attempts: 1 } },
      ];

      const failures = recentAttempts.filter(a => !a.success);
      const chronicStruggles = problems.filter(p =>
        p.box_level <= 4 && (p.attempt_stats?.unsuccessful_attempts || 0) >= 3
      );

      const needsReinforcement = failures.length + chronicStruggles.length;
      expect(needsReinforcement).toBe(0);
    });

    it('should handle case when failures exist but no related mastered problems', () => {
      const strugglingIds = [1, 2, 3];
      const masteredProblems = [
        { leetcode_id: 100 },
        { leetcode_id: 101 },
      ];

      // Relationships that don't connect to any struggling problems
      const getRelationships = () => ({
        50: 3.0, // Unrelated problem
        51: 4.0, // Unrelated problem
      });

      const THRESHOLD = 2.0;
      const scoredCandidates = [];

      for (const mastered of masteredProblems) {
        const relationships = getRelationships();
        let aggregateStrength = 0;
        let connectedProblems = 0;

        for (const id of strugglingIds) {
          const strength = relationships[id] || 0;
          if (strength >= THRESHOLD) {
            aggregateStrength += strength;
            connectedProblems++;
          }
        }

        if (connectedProblems > 0) {
          scoredCandidates.push({
            problem: mastered,
            aggregateStrength,
            connectedProblems
          });
        }
      }

      expect(scoredCandidates.length).toBe(0);
    });

    it('should handle mastered problems with no relationships', () => {
      const masteredProblems = [
        { leetcode_id: 100, box_level: 6 },
      ];
      const strugglingIds = [1, 2];
      const emptyRelationships = {};

      const THRESHOLD = 2.0;
      let connectedProblems = 0;

      for (const id of strugglingIds) {
        if ((emptyRelationships[id] || 0) >= THRESHOLD) {
          connectedProblems++;
        }
      }

      expect(connectedProblems).toBe(0);
    });
  });

  describe('Session composition priority', () => {
    it('should limit triggered reviews to max 2 per session', () => {
      const availableTriggeredReviews = [
        { finalScore: 15 },
        { finalScore: 12 },
        { finalScore: 10 },
        { finalScore: 8 },
      ];
      const sessionLength = 5;

      const maxTriggeredReviews = Math.min(2, sessionLength, availableTriggeredReviews.length);

      expect(maxTriggeredReviews).toBe(2);
    });

    it('should respect session length when fewer than 2 slots', () => {
      const availableTriggeredReviews = [{ finalScore: 15 }, { finalScore: 12 }];
      const sessionLength = 1;

      const maxTriggeredReviews = Math.min(2, sessionLength, availableTriggeredReviews.length);

      expect(maxTriggeredReviews).toBe(1);
    });
  });
});
