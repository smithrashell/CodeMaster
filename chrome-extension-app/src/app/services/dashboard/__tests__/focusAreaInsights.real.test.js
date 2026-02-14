/**
 * Tests for focusAreaInsights.js (88 lines, 0% coverage)
 * Pure functions for generating insights and recommendations.
 */

import {
  integrateFocusAreaSessionAnalytics,
  generateFocusAreaInsights,
  generateFocusAreaRecommendations,
  cleanupAnalyticsCache,
} from '../focusAreaInsights.js';

describe('focusAreaInsights', () => {
  // -------------------------------------------------------------------
  // integrateFocusAreaSessionAnalytics
  // -------------------------------------------------------------------
  describe('integrateFocusAreaSessionAnalytics', () => {
    it('integrates session analytics for focus areas', () => {
      const problemTagsMap = new Map([
        ['p1', ['array']],
        ['p2', ['tree']],
      ]);
      const sessions = [
        { problems: [{ id: 'p1' }], duration: 1800, date: '2024-01-01', successRate: 0.8 },
        { problems: [{ id: 'p1' }, { id: 'p2' }], duration: 2400, date: '2024-01-02', successRate: 0.6 },
      ];

      const result = integrateFocusAreaSessionAnalytics(['array', 'tree'], sessions, problemTagsMap);

      expect(result.array.totalSessions).toBe(2);
      expect(result.array.averageProblemsPerSession).toBeGreaterThan(0);
      expect(result.array.averageSessionDuration).toBeGreaterThan(0);
      expect(result.tree.totalSessions).toBe(1);
    });

    it('returns zero metrics for focus area with no sessions', () => {
      const result = integrateFocusAreaSessionAnalytics(
        ['graph'],
        [],
        new Map()
      );

      expect(result.graph.totalSessions).toBe(0);
      expect(result.graph.averageProblemsPerSession).toBe(0);
      expect(result.graph.averageSessionDuration).toBe(0);
      expect(result.graph.recentActivity).toEqual([]);
    });

    it('handles sessions without problems', () => {
      const sessions = [{ duration: 1800, date: '2024-01-01', successRate: 0.5 }];
      const result = integrateFocusAreaSessionAnalytics(['array'], sessions, new Map());

      expect(result.array.totalSessions).toBe(0);
    });
  });

  // -------------------------------------------------------------------
  // generateFocusAreaInsights
  // -------------------------------------------------------------------
  describe('generateFocusAreaInsights', () => {
    it('returns no-data message for empty performance', () => {
      const insights = generateFocusAreaInsights({}, {}, {});
      expect(insights).toContain('No focus areas data available for analysis.');
    });

    it('returns no-attempts message when all areas have 0 attempts', () => {
      const performance = {
        array: { totalAttempts: 0, successRate: 0, recentTrend: 'no-data', averageTime: 0 },
      };
      const insights = generateFocusAreaInsights(performance, {}, {});
      expect(insights).toContain('No attempts data available for focus areas analysis.');
    });

    it('identifies best performing area', () => {
      const performance = {
        array: { totalAttempts: 10, successRate: 0.9, recentTrend: 'stable', averageTime: 800 },
        tree: { totalAttempts: 10, successRate: 0.3, recentTrend: 'declining', averageTime: 2000 },
      };
      const insights = generateFocusAreaInsights(performance, {}, {});
      expect(insights.some(i => i.includes('Excellent performance in array'))).toBe(true);
    });

    it('identifies worst performing area', () => {
      const performance = {
        array: { totalAttempts: 10, successRate: 0.9, recentTrend: 'stable', averageTime: 800 },
        tree: { totalAttempts: 10, successRate: 0.3, recentTrend: 'declining', averageTime: 2000 },
      };
      const insights = generateFocusAreaInsights(performance, {}, {});
      expect(insights.some(i => i.includes('tree needs attention'))).toBe(true);
    });

    it('identifies improving areas', () => {
      const performance = {
        array: { totalAttempts: 10, successRate: 0.6, recentTrend: 'improving', averageTime: 1000 },
      };
      const insights = generateFocusAreaInsights(performance, {}, {});
      expect(insights.some(i => i.includes('Showing improvement'))).toBe(true);
    });

    it('identifies declining areas', () => {
      const performance = {
        array: { totalAttempts: 10, successRate: 0.6, recentTrend: 'declining', averageTime: 1000 },
      };
      const insights = generateFocusAreaInsights(performance, {}, {});
      expect(insights.some(i => i.includes('decline detected'))).toBe(true);
    });

    it('suggests increasing practice frequency', () => {
      const performance = {
        array: { totalAttempts: 2, successRate: 0.6, recentTrend: 'stable', averageTime: 1000 },
      };
      const insights = generateFocusAreaInsights(performance, {}, {});
      expect(insights.some(i => i.includes('increasing practice frequency'))).toBe(true);
    });

    it('praises great practice consistency', () => {
      const performance = {
        array: { totalAttempts: 25, successRate: 0.6, recentTrend: 'stable', averageTime: 1000 },
      };
      const insights = generateFocusAreaInsights(performance, {}, {});
      expect(insights.some(i => i.includes('Great practice consistency'))).toBe(true);
    });

    it('identifies fast problem solving areas', () => {
      const performance = {
        array: { totalAttempts: 10, successRate: 0.6, recentTrend: 'stable', averageTime: 500 },
      };
      const insights = generateFocusAreaInsights(performance, {}, {});
      expect(insights.some(i => i.includes('Quick problem solving'))).toBe(true);
    });

    it('identifies slow problem solving areas', () => {
      const performance = {
        array: { totalAttempts: 10, successRate: 0.6, recentTrend: 'stable', averageTime: 2000 },
      };
      const insights = generateFocusAreaInsights(performance, {}, {});
      expect(insights.some(i => i.includes('Spending significant time'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------
  // generateFocusAreaRecommendations
  // -------------------------------------------------------------------
  describe('generateFocusAreaRecommendations', () => {
    it('returns setup recommendation when no focus areas', () => {
      const recs = generateFocusAreaRecommendations({}, {}, {});
      expect(recs).toHaveLength(1);
      expect(recs[0].category).toBe('setup');
    });

    it('generates improvement recommendation for struggling areas', () => {
      const performance = {
        array: {
          totalAttempts: 10,
          successRate: 0.3,
          averageTime: 1000,
          difficultyBreakdown: {
            Easy: { attempts: 5, successes: 2 },
            Medium: { attempts: 3, successes: 0 },
            Hard: { attempts: 2, successes: 0 },
          },
        },
      };
      const recs = generateFocusAreaRecommendations(performance, {}, {});
      expect(recs.some(r => r.category === 'improvement')).toBe(true);
    });

    it('generates speed recommendation for slow but successful areas', () => {
      const performance = {
        array: {
          totalAttempts: 10,
          successRate: 0.8,
          averageTime: 2400,
          difficultyBreakdown: {
            Easy: { attempts: 5, successes: 4 },
            Medium: { attempts: 3, successes: 2 },
            Hard: { attempts: 2, successes: 1 },
          },
        },
      };
      const recs = generateFocusAreaRecommendations(performance, {}, {});
      expect(recs.some(r => r.category === 'speed')).toBe(true);
    });

    it('generates advanced recommendation for excellent areas', () => {
      const performance = {
        array: {
          totalAttempts: 10,
          successRate: 0.9,
          averageTime: 600,
          difficultyBreakdown: {
            Easy: { attempts: 3, successes: 3 },
            Medium: { attempts: 4, successes: 3 },
            Hard: { attempts: 3, successes: 3 },
          },
        },
      };
      const recs = generateFocusAreaRecommendations(performance, {}, {});
      expect(recs.some(r => r.category === 'advanced')).toBe(true);
    });

    it('generates consistency recommendation', () => {
      const performance = {
        array: {
          totalAttempts: 5,
          successRate: 0.6,
          averageTime: 1000,
          difficultyBreakdown: {
            Easy: { attempts: 3, successes: 2 },
            Medium: { attempts: 1, successes: 0 },
            Hard: { attempts: 1, successes: 0 },
          },
        },
      };
      const learningState = {
        tags: { array: { currentStreak: 1 } },
      };
      const recs = generateFocusAreaRecommendations(performance, {}, learningState);
      expect(recs.some(r => r.category === 'consistency')).toBe(true);
    });

    it('generates balance recommendation for easy-heavy areas', () => {
      const performance = {
        array: {
          totalAttempts: 10,
          successRate: 0.7,
          averageTime: 1000,
          difficultyBreakdown: {
            Easy: { attempts: 9, successes: 8 },
            Medium: { attempts: 1, successes: 1 },
            Hard: { attempts: 0, successes: 0 },
          },
        },
      };
      const recs = generateFocusAreaRecommendations(performance, {}, {});
      expect(recs.some(r => r.category === 'balance')).toBe(true);
    });

    it('sorts recommendations by priority and limits to 8', () => {
      // Create many areas to generate lots of recommendations
      const performance = {};
      const learningState = { tags: {} };
      for (let i = 0; i < 20; i++) {
        const tag = `tag${i}`;
        performance[tag] = {
          totalAttempts: 10,
          successRate: 0.3,
          averageTime: 2000,
          difficultyBreakdown: {
            Easy: { attempts: 8, successes: 2 },
            Medium: { attempts: 1, successes: 0 },
            Hard: { attempts: 1, successes: 0 },
          },
        };
        learningState.tags[tag] = { currentStreak: 0 };
      }
      const recs = generateFocusAreaRecommendations(performance, {}, learningState);
      expect(recs.length).toBeLessThanOrEqual(8);
      // First recommendation should be high priority
      if (recs.length > 1) {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        expect(priorityOrder[recs[0].priority]).toBeGreaterThanOrEqual(priorityOrder[recs[recs.length - 1].priority]);
      }
    });
  });

  // -------------------------------------------------------------------
  // cleanupAnalyticsCache
  // -------------------------------------------------------------------
  describe('cleanupAnalyticsCache', () => {
    it('does nothing when cache is under limit', () => {
      const cache = new Map();
      cache.set('a', { timestamp: Date.now() });
      cleanupAnalyticsCache(cache, 5);
      expect(cache.size).toBe(1);
    });

    it('trims cache to maxEntries when over limit', () => {
      const cache = new Map();
      for (let i = 0; i < 25; i++) {
        cache.set(`key${i}`, { timestamp: Date.now() - (25 - i) * 1000 });
      }
      cleanupAnalyticsCache(cache, 10);
      expect(cache.size).toBe(10);
    });

    it('keeps most recent entries', () => {
      const cache = new Map();
      cache.set('old', { timestamp: 1000 });
      cache.set('new', { timestamp: 9999 });
      cache.set('mid', { timestamp: 5000 });
      cleanupAnalyticsCache(cache, 2);
      expect(cache.has('new')).toBe(true);
      expect(cache.has('mid')).toBe(true);
      expect(cache.has('old')).toBe(false);
    });
  });
});
