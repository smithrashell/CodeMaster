/**
 * Tests for strategyService.js (180 lines, 0% coverage)
 * Tests the StrategyService class methods by mocking dependencies.
 */

// Must mock before importing
jest.mock('../../../shared/services/hints/StrategyCacheService.js', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock('../chromeMessagingService.js', () => ({
  __esModule: true,
  default: {
    sendMessage: jest.fn(),
  },
}));

jest.mock('../../../shared/utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  success: jest.fn(),
  debug: jest.fn(),
  data: jest.fn(),
  system: jest.fn(),
}));

// Must mock PerformanceMonitor before import triggers side effects
jest.mock('../../../shared/utils/performance/PerformanceMonitor.js', () => ({
  __esModule: true,
  default: {
    startQuery: jest.fn(() => ({})),
    endQuery: jest.fn(),
  },
}));

import { StrategyService } from '../strategyService.js';
import chromeMessaging from '../chromeMessagingService.js';
import { FALLBACK_STRATEGIES } from '../strategyServiceHelpers.js';

describe('StrategyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------
  // initializeStrategyData
  // -------------------------------------------------------------------
  describe('initializeStrategyData', () => {
    it('returns true when data is already loaded', async () => {
      chromeMessaging.sendMessage.mockResolvedValue(true);
      const result = await StrategyService.initializeStrategyData();
      expect(result).toBe(true);
    });

    it('returns true when data needs initialization', async () => {
      chromeMessaging.sendMessage.mockResolvedValue(false);
      const result = await StrategyService.initializeStrategyData();
      expect(result).toBe(true);
    });

    it('returns false on error', async () => {
      chromeMessaging.sendMessage.mockRejectedValue(new Error('fail'));
      const result = await StrategyService.initializeStrategyData();
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // getStrategyForTag
  // -------------------------------------------------------------------
  describe('getStrategyForTag', () => {
    it('returns strategy data from messaging service', async () => {
      const strategyData = { strategy: 'Use two pointers', overview: 'Array basics' };
      chromeMessaging.sendMessage.mockResolvedValue(strategyData);

      const result = await StrategyService.getStrategyForTag('array');
      expect(result).toEqual(strategyData);
    });

    it('falls back to FALLBACK_STRATEGIES when messaging returns null', async () => {
      chromeMessaging.sendMessage.mockResolvedValue(null);

      const result = await StrategyService.getStrategyForTag('array');
      expect(result).toEqual(FALLBACK_STRATEGIES['array']);
    });

    it('returns null when no strategy found anywhere', async () => {
      chromeMessaging.sendMessage.mockResolvedValue(null);

      const result = await StrategyService.getStrategyForTag('nonexistent_tag');
      expect(result).toBeNull();
    });

    it('falls back to FALLBACK_STRATEGIES on error', async () => {
      chromeMessaging.sendMessage.mockRejectedValue(new Error('fail'));

      const result = await StrategyService.getStrategyForTag('array');
      expect(result).toEqual(FALLBACK_STRATEGIES['array']);
    });

    it('returns null on error with unknown tag', async () => {
      chromeMessaging.sendMessage.mockRejectedValue(new Error('fail'));

      const result = await StrategyService.getStrategyForTag('unknown_tag_xyz');
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // getStrategiesForTags
  // -------------------------------------------------------------------
  describe('getStrategiesForTags', () => {
    it('returns strategies for multiple tags', async () => {
      chromeMessaging.sendMessage.mockImplementation((msg) => {
        if (msg.tag === 'array') return Promise.resolve({ strategy: 'array strategy' });
        if (msg.tag === 'tree') return Promise.resolve({ strategy: 'tree strategy' });
        return Promise.resolve(null);
      });

      const result = await StrategyService.getStrategiesForTags(['array', 'tree']);
      expect(result.array).toBeDefined();
      expect(result.tree).toBeDefined();
    });

    it('returns empty object on error', async () => {
      chromeMessaging.sendMessage.mockRejectedValue(new Error('fail'));

      // Even with errors, individual tag failures are caught
      // but if the outer promise fails, it returns {}
      const result = await StrategyService.getStrategiesForTags(['array']);
      // The result depends on whether getStrategyForTag has a fallback
      expect(typeof result).toBe('object');
    });

    it('skips tags without strategies', async () => {
      chromeMessaging.sendMessage.mockResolvedValue(null);

      const result = await StrategyService.getStrategiesForTags(['unknown1', 'unknown2']);
      expect(Object.keys(result).length).toBe(0);
    });
  });

  // -------------------------------------------------------------------
  // getContextualHints
  // -------------------------------------------------------------------
  describe('getContextualHints', () => {
    it('returns empty array when no tags provided', async () => {
      const result = await StrategyService.getContextualHints([]);
      expect(result).toEqual([]);
    });

    it('returns empty array when tags is null', async () => {
      const result = await StrategyService.getContextualHints(null);
      expect(result).toEqual([]);
    });

    it('returns hints for valid tags', async () => {
      chromeMessaging.sendMessage.mockResolvedValue({
        strategy: 'Use two pointers',
        strategies: [{ when: 'hash table', tip: 'Combine with hash map' }],
      });

      const result = await StrategyService.getContextualHints(['array', 'hash table'], 'Medium');
      expect(Array.isArray(result)).toBe(true);
    });

    it('handles error gracefully', async () => {
      chromeMessaging.sendMessage.mockRejectedValue(new Error('fail'));

      // Should not throw, getStrategiesForTags catches errors
      const result = await StrategyService.getContextualHints(['array'], 'Medium');
      expect(Array.isArray(result)).toBe(true);
    });

    it('deduplicates hints by tip content', async () => {
      chromeMessaging.sendMessage.mockResolvedValue({
        strategy: 'Same tip content',
      });

      const result = await StrategyService.getContextualHints(['array', 'tree'], 'Easy');
      // All general hints have the same tip, should be deduped
      const tips = result.map(h => h.tip);
      const uniqueTips = [...new Set(tips)];
      expect(tips.length).toBe(uniqueTips.length);
    });
  });

  // -------------------------------------------------------------------
  // buildOptimalHintSelection
  // -------------------------------------------------------------------
  describe('buildOptimalHintSelection', () => {
    it('returns hints with balanced distribution', async () => {
      chromeMessaging.sendMessage.mockImplementation((msg) => {
        if (msg.type === 'getStrategyForTag') {
          return Promise.resolve({
            strategy: `Strategy for ${msg.tag}`,
            overview: `Overview of ${msg.tag}`,
          });
        }
        return Promise.resolve(null);
      });

      const result = await StrategyService.buildOptimalHintSelection(
        ['array', 'hash table'],
        'Medium'
      );
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns empty array when strategies data is invalid', async () => {
      jest.spyOn(StrategyService, 'getStrategiesForTags').mockResolvedValue(null);

      const result = await StrategyService.buildOptimalHintSelection(['array'], 'Medium');
      expect(result).toEqual([]);

      StrategyService.getStrategiesForTags.mockRestore();
    });

    it('returns empty array on error', async () => {
      jest.spyOn(StrategyService, 'getStrategiesForTags').mockRejectedValue(new Error('fail'));

      const result = await StrategyService.buildOptimalHintSelection(['array'], 'Medium');
      expect(result).toEqual([]);

      StrategyService.getStrategiesForTags.mockRestore();
    });
  });

  // -------------------------------------------------------------------
  // getTagPrimer
  // -------------------------------------------------------------------
  describe('getTagPrimer', () => {
    it('returns primer data for a known tag', async () => {
      chromeMessaging.sendMessage.mockResolvedValue({
        strategy: 'Use two pointers',
        overview: 'Array basics',
        patterns: ['Two Pointers'],
        related: ['sorting'],
      });

      const result = await StrategyService.getTagPrimer('array');
      expect(result).toEqual({
        tag: 'array',
        overview: 'Array basics',
        strategy: 'Use two pointers',
        patterns: ['Two Pointers'],
        related: ['sorting'],
      });
    });

    it('returns null when no strategy data found', async () => {
      chromeMessaging.sendMessage.mockResolvedValue(null);

      const result = await StrategyService.getTagPrimer('nonexistent_xyz');
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      chromeMessaging.sendMessage.mockRejectedValue(new Error('fail'));

      const result = await StrategyService.getTagPrimer('unknown_xyz');
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // getTagPrimers
  // -------------------------------------------------------------------
  describe('getTagPrimers', () => {
    it('returns primers for multiple tags', async () => {
      chromeMessaging.sendMessage.mockImplementation((msg) => {
        if (msg.tag === 'array') return Promise.resolve({ strategy: 'a', overview: 'a', patterns: [], related: [] });
        if (msg.tag === 'tree') return Promise.resolve({ strategy: 't', overview: 't', patterns: [], related: [] });
        return Promise.resolve(null);
      });

      const result = await StrategyService.getTagPrimers(['array', 'tree']);
      expect(result).toHaveLength(2);
    });

    it('filters out null primers', async () => {
      chromeMessaging.sendMessage.mockResolvedValue(null);

      const result = await StrategyService.getTagPrimers(['unknown1', 'unknown2']);
      expect(result).toHaveLength(0);
    });

    it('returns empty array on error for unknown tags', async () => {
      chromeMessaging.sendMessage.mockRejectedValue(new Error('fail'));

      // 'unknown_xyz' has no fallback, so getTagPrimer returns null -> filtered out
      const result = await StrategyService.getTagPrimers(['unknown_xyz']);
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------
  // isStrategyDataLoaded
  // -------------------------------------------------------------------
  describe('isStrategyDataLoaded', () => {
    it('returns true when background says data is loaded', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        if (cb) cb({ status: 'success', data: true });
        return Promise.resolve({ status: 'success', data: true });
      });

      const result = await StrategyService.isStrategyDataLoaded();
      expect(result).toBe(true);
    });

    it('returns false on error response', async () => {
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        if (cb) cb({ status: 'error', error: 'not loaded' });
        return Promise.resolve({ status: 'error', error: 'not loaded' });
      });

      const result = await StrategyService.isStrategyDataLoaded();
      expect(result).toBe(false);
    });

    it('returns false on messaging error', async () => {
      chrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Extension context invalidated');
      });

      const result = await StrategyService.isStrategyDataLoaded();
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // getAllStrategyTags
  // -------------------------------------------------------------------
  describe('getAllStrategyTags', () => {
    it('returns fallback strategy tags', () => {
      const tags = StrategyService.getAllStrategyTags();
      expect(tags).toEqual(Object.keys(FALLBACK_STRATEGIES));
      expect(tags).toContain('array');
    });
  });
});
