/**
 * Tests for strategyServiceHelpers.js (93 lines, 0% coverage)
 * Pure helper functions, constants, and utility exports.
 */

jest.mock('../../../shared/utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import {
  FALLBACK_STRATEGIES,
  HINT_CONFIG,
  COMMON_TAGS,
  CONTEXTUAL_COMBINATIONS,
  createContextualHints,
  createNormalizedTagPair,
  extractKeyword,
  generateContextualTip,
  extractStrategyText,
  addContextualHintIfValid,
  processContextualHints,
  processGeneralHintForTag,
  processGeneralHints,
} from '../strategyServiceHelpers.js';

describe('strategyServiceHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------
  describe('constants', () => {
    it('FALLBACK_STRATEGIES has expected tags', () => {
      expect(FALLBACK_STRATEGIES).toHaveProperty('array');
      expect(FALLBACK_STRATEGIES).toHaveProperty('hash table');
      expect(FALLBACK_STRATEGIES).toHaveProperty('sorting');
      expect(FALLBACK_STRATEGIES).toHaveProperty('string');
      expect(FALLBACK_STRATEGIES).toHaveProperty('tree');
    });

    it('HINT_CONFIG has difficulty configs', () => {
      expect(HINT_CONFIG.DIFFICULTY_CONFIG).toHaveProperty('Easy');
      expect(HINT_CONFIG.DIFFICULTY_CONFIG).toHaveProperty('Medium');
      expect(HINT_CONFIG.DIFFICULTY_CONFIG).toHaveProperty('Hard');
      expect(HINT_CONFIG.DIFFICULTY_CONFIG.Easy.maxHints).toBe(3);
      expect(HINT_CONFIG.DIFFICULTY_CONFIG.Hard.maxHints).toBe(4);
    });

    it('COMMON_TAGS has expected entries', () => {
      expect(COMMON_TAGS).toContain('array');
      expect(COMMON_TAGS).toContain('tree');
      expect(COMMON_TAGS.length).toBeGreaterThan(0);
    });

    it('CONTEXTUAL_COMBINATIONS has expected pairs', () => {
      expect(CONTEXTUAL_COMBINATIONS['array+hash table']).toBeDefined();
      expect(CONTEXTUAL_COMBINATIONS['tree+depth-first search']).toBeDefined();
    });
  });

  // -------------------------------------------------------------------
  // createContextualHints
  // -------------------------------------------------------------------
  describe('createContextualHints', () => {
    it('returns contextual hints when strategies match problem tags', () => {
      const strategyData = {
        strategies: [
          { when: 'hash table', tip: 'Use hash map for O(1) lookup' },
          { when: 'sorting', tip: 'Sort first' },
        ],
      };
      const hints = createContextualHints('array', strategyData, ['array', 'hash table']);
      expect(hints).toHaveLength(1);
      expect(hints[0].type).toBe('contextual');
      expect(hints[0].primaryTag).toBe('array');
      expect(hints[0].relatedTag).toBe('hash table');
      expect(hints[0].relevance).toBe(1.5);
    });

    it('returns empty array when no strategies property', () => {
      const hints = createContextualHints('array', {}, ['array', 'hash table']);
      expect(hints).toEqual([]);
    });

    it('returns empty array when single tag', () => {
      const strategyData = {
        strategies: [{ when: 'hash table', tip: 'Use hash map' }],
      };
      const hints = createContextualHints('array', strategyData, ['array']);
      expect(hints).toEqual([]);
    });
  });

  // -------------------------------------------------------------------
  // createNormalizedTagPair
  // -------------------------------------------------------------------
  describe('createNormalizedTagPair', () => {
    it('returns sorted pair key', () => {
      expect(createNormalizedTagPair('zebra', 'apple')).toBe('apple+zebra');
    });

    it('handles same tag', () => {
      expect(createNormalizedTagPair('array', 'array')).toBe('array+array');
    });
  });

  // -------------------------------------------------------------------
  // extractKeyword
  // -------------------------------------------------------------------
  describe('extractKeyword', () => {
    it('extracts known keyword from strategy text', () => {
      expect(extractKeyword('Use two pointers to solve this')).toBe('two pointers');
    });

    it('extracts hash map keyword', () => {
      expect(extractKeyword('Consider using a hash map for lookups')).toBe('hash map');
    });

    it('extracts DFS keyword', () => {
      expect(extractKeyword('Apply DFS traversal')).toBe('DFS');
    });

    it('returns systematic approach when no keyword found', () => {
      expect(extractKeyword('Think about the problem carefully')).toBe('systematic approach');
    });

    it('is case-insensitive', () => {
      expect(extractKeyword('Use BINARY SEARCH to find target')).toBe('binary search');
    });
  });

  // -------------------------------------------------------------------
  // generateContextualTip
  // -------------------------------------------------------------------
  describe('generateContextualTip', () => {
    it('returns predefined contextual tip when combination exists', () => {
      const result = generateContextualTip(
        'array',
        'hash table',
        { strategy: 'Use pointers' },
        { strategy: 'Use lookups' }
      );
      expect(result.quality).toBe(2.0);
      expect(result.tip).toBe(CONTEXTUAL_COMBINATIONS['array+hash table']);
    });

    it('returns reverse order match', () => {
      const result = generateContextualTip(
        'hash table',
        'array',
        { strategy: 'Use lookups' },
        { strategy: 'Use pointers' }
      );
      expect(result.quality).toBe(2.0);
    });

    it('generates generic tip when no combination exists', () => {
      const result = generateContextualTip(
        'linked list',
        'graph',
        { strategy: 'Use recursion for linked lists' },
        { strategy: 'Use BFS for graph traversal' }
      );
      expect(result.quality).toBe(1.0);
      expect(result.tip).toContain('linked list');
      expect(result.tip).toContain('graph');
    });
  });

  // -------------------------------------------------------------------
  // extractStrategyText
  // -------------------------------------------------------------------
  describe('extractStrategyText', () => {
    it('extracts from strategy.strategy', () => {
      const result = extractStrategyText('array', { strategy: 'Use two pointers' });
      expect(result.strategyText).toBe('Use two pointers');
      expect(result.debugSource).toBe('strategy.strategy');
    });

    it('falls back to strategy.overview', () => {
      const result = extractStrategyText('array', { overview: 'Arrays are sequences' });
      expect(result.strategyText).toBe('Arrays are sequences');
      expect(result.debugSource).toBe('strategy.overview');
    });

    it('handles string strategy', () => {
      const result = extractStrategyText('array', 'Use two pointers');
      expect(result.strategyText).toBe('Use two pointers');
      expect(result.debugSource).toBe('strategy_is_string');
    });

    it('handles null strategy', () => {
      const result = extractStrategyText('array', null);
      expect(result.strategyText).toBeNull();
      expect(result.debugSource).toBe('no_strategy_object');
    });

    it('handles strategy with no valid text properties', () => {
      const result = extractStrategyText('array', { related: ['sorting'] });
      expect(result.strategyText).toBeNull();
      expect(result.debugSource).toBe('no_valid_text_property');
    });
  });

  // -------------------------------------------------------------------
  // addContextualHintIfValid
  // -------------------------------------------------------------------
  describe('addContextualHintIfValid', () => {
    it('adds contextual hint when both strategies are valid', () => {
      const hints = [];
      const strategiesData = {
        array: { strategy: 'Use two pointers' },
        'hash table': { strategy: 'Use hash map' },
      };
      addContextualHintIfValid('array', 'hash table', strategiesData, hints);
      expect(hints).toHaveLength(1);
      expect(hints[0].type).toBe('contextual');
      expect(hints[0].primaryTag).toBe('array');
      expect(hints[0].relatedTag).toBe('hash table');
    });

    it('does nothing when primary strategy is missing', () => {
      const hints = [];
      addContextualHintIfValid('missing', 'hash table', { 'hash table': { strategy: 'x' } }, hints);
      expect(hints).toHaveLength(0);
    });

    it('does nothing when related strategy is missing', () => {
      const hints = [];
      addContextualHintIfValid('array', 'missing', { array: { strategy: 'x' } }, hints);
      expect(hints).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------
  // processContextualHints
  // -------------------------------------------------------------------
  describe('processContextualHints', () => {
    it('processes all unique tag combinations', () => {
      const hints = [];
      const strategiesData = {
        array: { strategy: 'Use two pointers' },
        'hash table': { strategy: 'Use hash map' },
        sorting: { strategy: 'Sort first' },
      };
      processContextualHints(['array', 'hash table', 'sorting'], strategiesData, hints);
      // Combinations: array+hash table, array+sorting, hash table+sorting
      expect(hints).toHaveLength(3);
    });

    it('skips duplicate combinations', () => {
      const hints = [];
      const strategiesData = {
        array: { strategy: 'Use two pointers' },
        'hash table': { strategy: 'Use hash map' },
      };
      processContextualHints(['array', 'hash table'], strategiesData, hints);
      expect(hints).toHaveLength(1);
    });

    it('handles errors in individual hint creation gracefully', () => {
      const hints = [];
      // This should not throw even with bad data
      processContextualHints(['array', 'hash table'], {}, hints);
      expect(hints).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------
  // processGeneralHintForTag
  // -------------------------------------------------------------------
  describe('processGeneralHintForTag', () => {
    it('adds general hint for tag with strategy', () => {
      const hints = [];
      const strategiesData = {
        array: { strategy: 'Use two pointers or sliding window' },
      };
      processGeneralHintForTag('array', strategiesData, hints);
      expect(hints).toHaveLength(1);
      expect(hints[0].type).toBe('general');
      expect(hints[0].primaryTag).toBe('array');
    });

    it('skips tag without strategy text', () => {
      const hints = [];
      processGeneralHintForTag('missing', {}, hints);
      expect(hints).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------
  // processGeneralHints
  // -------------------------------------------------------------------
  describe('processGeneralHints', () => {
    it('processes general hints for all tags', () => {
      const hints = [];
      const strategiesData = {
        array: { strategy: 'Use two pointers' },
        tree: { strategy: 'Use DFS or BFS' },
      };
      processGeneralHints(['array', 'tree'], strategiesData, hints);
      expect(hints).toHaveLength(2);
    });

    it('handles empty tags array', () => {
      const hints = [];
      processGeneralHints([], {}, hints);
      expect(hints).toHaveLength(0);
    });
  });
});
