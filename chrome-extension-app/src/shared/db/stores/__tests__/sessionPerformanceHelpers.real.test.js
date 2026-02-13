/**
 * Real fake-indexeddb tests for sessionPerformanceHelpers.js
 *
 * Tests all exported helper functions: filterSessions, processAttempts,
 * calculateTagStrengths, calculateTimingFeedback, calculateTagIndexProgression.
 * processAttempts calls getAttemptsBySessionId which is mocked at the module boundary.
 */

// -- Mocks (before imports) --------------------------------------------------

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../attempts.js', () => ({
  getAttemptsBySessionId: jest.fn(),
}));

// -- Imports -----------------------------------------------------------------

import { getAttemptsBySessionId } from '../attempts.js';
import logger from '../../../utils/logging/logger.js';

import {
  filterSessions,
  processAttempts,
  calculateTagStrengths,
  calculateTimingFeedback,
  calculateTagIndexProgression,
} from '../sessionPerformanceHelpers.js';

// -- filterSessions ----------------------------------------------------------

describe('filterSessions', () => {
  const now = new Date('2026-02-10T12:00:00Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const sessions = [
    { id: 1, date: '2026-02-09T12:00:00Z' }, // 1 day ago
    { id: 2, date: '2026-02-05T12:00:00Z' }, // 5 days ago
    { id: 3, date: '2026-01-01T12:00:00Z' }, // ~40 days ago
    { id: 4, date: '2026-02-08T12:00:00Z' }, // 2 days ago
  ];

  it('filters sessions within the given daysBack window', () => {
    const result = filterSessions(sessions, 3, undefined);

    expect(result).toHaveLength(2);
    expect(result.map(s => s.id).sort()).toEqual([1, 4]);
  });

  it('includes all sessions when daysBack is large', () => {
    const result = filterSessions(sessions, 365, undefined);
    expect(result).toHaveLength(4);
  });

  it('returns empty when no sessions are within daysBack', () => {
    const result = filterSessions(sessions, 0.01, undefined);
    expect(result).toHaveLength(0);
  });

  it('returns the N most recent sessions when daysBack is falsy', () => {
    const result = filterSessions([...sessions], null, 2);

    expect(result).toHaveLength(2);
    // Sorted ascending by date, then takes the last 2
    expect(result.map(s => s.id)).toEqual([4, 1]);
  });

  it('returns all sessions when recentSessionsLimit exceeds array length', () => {
    const result = filterSessions([...sessions], null, 100);
    expect(result).toHaveLength(4);
  });

  it('uses created_date when date field is missing', () => {
    const sessionsWithCreatedDate = [
      { id: 1, created_date: '2026-02-09T12:00:00Z' },
      { id: 2, created_date: '2026-01-01T12:00:00Z' },
    ];
    const result = filterSessions(sessionsWithCreatedDate, 7, undefined);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});

// -- processAttempts ---------------------------------------------------------

describe('processAttempts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes attempts and calculates difficulty and tag statistics', async () => {
    getAttemptsBySessionId.mockResolvedValue([
      { id: 'a1', leetcode_id: 1, success: true, time_spent: 300 },
      { id: 'a2', leetcode_id: 2, success: false, time_spent: 600 },
    ]);

    const sessions = [
      {
        id: 's1',
        problems: [
          { id: 1, difficulty: 'Easy', tags: ['array', 'hash-table'] },
          { id: 2, difficulty: 'Medium', tags: ['dp'] },
        ],
      },
    ];

    const result = await processAttempts(sessions);

    expect(result.totalAttempts).toBe(2);
    expect(result.totalCorrect).toBe(1);
    expect(result.totalTime).toBe(900);
    expect(result.performance.easy.attempts).toBe(1);
    expect(result.performance.easy.correct).toBe(1);
    expect(result.performance.easy.time).toBe(300);
    expect(result.performance.medium.attempts).toBe(1);
    expect(result.performance.medium.correct).toBe(0);
    expect(result.performance.medium.time).toBe(600);
    expect(result.performance.hard.attempts).toBe(0);
    expect(result.tagStats.array.attempts).toBe(1);
    expect(result.tagStats.array.correct).toBe(1);
    expect(result.tagStats['hash-table'].attempts).toBe(1);
    expect(result.tagStats.dp.attempts).toBe(1);
    expect(result.tagStats.dp.correct).toBe(0);
  });

  it('skips sessions with no attempts', async () => {
    getAttemptsBySessionId.mockResolvedValue([]);

    const sessions = [
      { id: 's1', problems: [{ id: 1, difficulty: 'Easy', tags: [] }] },
    ];

    const result = await processAttempts(sessions);

    expect(result.totalAttempts).toBe(0);
    expect(result.totalCorrect).toBe(0);
    expect(result.totalTime).toBe(0);
  });

  it('handles multiple sessions', async () => {
    getAttemptsBySessionId
      .mockResolvedValueOnce([
        { id: 'a1', leetcode_id: 1, success: true, time_spent: 100 },
      ])
      .mockResolvedValueOnce([
        { id: 'a2', leetcode_id: 2, success: false, time_spent: 200 },
      ]);

    const sessions = [
      { id: 's1', problems: [{ id: 1, difficulty: 'Easy', tags: ['array'] }] },
      { id: 's2', problems: [{ id: 2, difficulty: 'Hard', tags: ['dp'] }] },
    ];

    const result = await processAttempts(sessions);

    expect(result.totalAttempts).toBe(2);
    expect(result.performance.easy.attempts).toBe(1);
    expect(result.performance.hard.attempts).toBe(1);
  });

  it('finds problems via string/number ID coercion', async () => {
    getAttemptsBySessionId.mockResolvedValue([
      { id: 'a1', leetcode_id: '1', success: true, time_spent: 100 },
    ]);

    const sessions = [
      { id: 's1', problems: [{ id: 1, difficulty: 'Easy', tags: [] }] },
    ];

    const result = await processAttempts(sessions);
    expect(result.totalAttempts).toBe(1);
  });

  it('throws when attempt references a non-existent problem', async () => {
    getAttemptsBySessionId.mockResolvedValue([
      { id: 'a1', leetcode_id: 999, success: true, time_spent: 100 },
    ]);

    const sessions = [
      { id: 's1', problems: [{ id: 1, difficulty: 'Easy', tags: [] }] },
    ];

    await expect(processAttempts(sessions)).rejects.toThrow(
      /no matching problem found/
    );
  });

  it('throws when problem is missing difficulty field', async () => {
    getAttemptsBySessionId.mockResolvedValue([
      { id: 'a1', leetcode_id: 1, success: true, time_spent: 100 },
    ]);

    const sessions = [
      { id: 's1', problems: [{ id: 1, tags: [] }] }, // no difficulty
    ];

    await expect(processAttempts(sessions)).rejects.toThrow(
      /missing difficulty field/
    );
  });

  it('throws when success is not a boolean', async () => {
    getAttemptsBySessionId.mockResolvedValue([
      { id: 'a1', leetcode_id: 1, success: 'yes', time_spent: 100 },
    ]);

    const sessions = [
      { id: 's1', problems: [{ id: 1, difficulty: 'Easy', tags: [] }] },
    ];

    await expect(processAttempts(sessions)).rejects.toThrow(
      /expected boolean/
    );
  });

  it('throws when time_spent is negative', async () => {
    getAttemptsBySessionId.mockResolvedValue([
      { id: 'a1', leetcode_id: 1, success: true, time_spent: -5 },
    ]);

    const sessions = [
      { id: 's1', problems: [{ id: 1, difficulty: 'Easy', tags: [] }] },
    ];

    await expect(processAttempts(sessions)).rejects.toThrow(
      /expected non-negative number/
    );
  });

  it('handles attempts with zero time_spent', async () => {
    getAttemptsBySessionId.mockResolvedValue([
      { id: 'a1', leetcode_id: 1, success: true, time_spent: 0 },
    ]);

    const sessions = [
      { id: 's1', problems: [{ id: 1, difficulty: 'Easy', tags: ['array'] }] },
    ];

    const result = await processAttempts(sessions);
    expect(result.totalTime).toBe(0);
    expect(result.performance.easy.time).toBe(0);
  });

  it('handles sessions with empty problems array', async () => {
    getAttemptsBySessionId.mockResolvedValue([]);

    const sessions = [{ id: 's1', problems: [] }];

    const result = await processAttempts(sessions);
    expect(result.totalAttempts).toBe(0);
  });
});

// -- calculateTagStrengths ---------------------------------------------------

describe('calculateTagStrengths', () => {
  it('classifies tags as strong when accuracy >= 0.8', () => {
    const tagStats = {
      array: { attempts: 5, correct: 4, time: 500 },
    };
    const unmasteredSet = new Set();

    const result = calculateTagStrengths(tagStats, unmasteredSet);

    expect(result.strongTags).toContain('array');
    expect(result.weakTags).not.toContain('array');
  });

  it('classifies tags as weak when accuracy < 0.7', () => {
    const tagStats = {
      dp: { attempts: 10, correct: 5, time: 1000 },
    };
    const unmasteredSet = new Set(['dp']);

    const result = calculateTagStrengths(tagStats, unmasteredSet);

    expect(result.weakTags).toContain('dp');
    expect(result.strongTags).not.toContain('dp');
  });

  it('classifies tags as neither strong nor weak when accuracy is between 0.7 and 0.8', () => {
    const tagStats = {
      graph: { attempts: 10, correct: 7, time: 2000 }, // acc = 0.7 exactly
    };
    const unmasteredSet = new Set();

    const result = calculateTagStrengths(tagStats, unmasteredSet);

    expect(result.strongTags).not.toContain('graph');
    expect(result.weakTags).not.toContain('graph');
  });

  it('skips tags with zero attempts and logs warning', () => {
    const tagStats = {
      tree: { attempts: 0, correct: 0, time: 0 },
    };
    const unmasteredSet = new Set();

    const result = calculateTagStrengths(tagStats, unmasteredSet);

    expect(result.strongTags).toEqual([]);
    expect(result.weakTags).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('zero attempts')
    );
  });

  it('handles multiple tags correctly', () => {
    const tagStats = {
      array: { attempts: 10, correct: 9, time: 1000 },     // strong (0.9)
      dp: { attempts: 10, correct: 3, time: 1000 },         // weak (0.3)
      graph: { attempts: 10, correct: 7, time: 1000 },      // neither (0.7)
      tree: { attempts: 5, correct: 4, time: 500 },         // strong (0.8)
    };
    const unmasteredSet = new Set(['dp', 'graph']);

    const result = calculateTagStrengths(tagStats, unmasteredSet);

    expect(result.strongTags.sort()).toEqual(['array', 'tree']);
    expect(result.weakTags).toEqual(['dp']);
  });

  it('returns empty arrays when tagStats is empty', () => {
    const result = calculateTagStrengths({}, new Set());
    expect(result.strongTags).toEqual([]);
    expect(result.weakTags).toEqual([]);
  });
});

// -- calculateTimingFeedback -------------------------------------------------

describe('calculateTimingFeedback', () => {
  it('returns "tooFast" when average time is below minimum threshold', () => {
    const performance = {
      easy: { attempts: 5, correct: 5, time: 500 },   // avg 100 < 600
      medium: { attempts: 0, correct: 0, time: 0 },
      hard: { attempts: 0, correct: 0, time: 0 },
    };

    const result = calculateTimingFeedback(performance);

    expect(result.Easy).toBe('tooFast');
    expect(result.Medium).toBe('noData');
    expect(result.Hard).toBe('noData');
  });

  it('returns "tooSlow" when average time exceeds maximum threshold', () => {
    const performance = {
      easy: { attempts: 2, correct: 2, time: 5000 },    // avg 2500 > 900
      medium: { attempts: 2, correct: 1, time: 10000 },  // avg 5000 > 1500
      hard: { attempts: 2, correct: 0, time: 10000 },    // avg 5000 > 2100
    };

    const result = calculateTimingFeedback(performance);

    expect(result.Easy).toBe('tooSlow');
    expect(result.Medium).toBe('tooSlow');
    expect(result.Hard).toBe('tooSlow');
  });

  it('returns "onTarget" when average time is within expected range', () => {
    const performance = {
      easy: { attempts: 2, correct: 2, time: 1500 },     // avg 750 in [600, 900]
      medium: { attempts: 2, correct: 1, time: 2600 },    // avg 1300 in [1200, 1500]
      hard: { attempts: 2, correct: 0, time: 4000 },      // avg 2000 in [1800, 2100]
    };

    const result = calculateTimingFeedback(performance);

    expect(result.Easy).toBe('onTarget');
    expect(result.Medium).toBe('onTarget');
    expect(result.Hard).toBe('onTarget');
  });

  it('returns "noData" when attempts is zero', () => {
    const performance = {
      easy: { attempts: 0, correct: 0, time: 0 },
      medium: { attempts: 0, correct: 0, time: 0 },
      hard: { attempts: 0, correct: 0, time: 0 },
    };

    const result = calculateTimingFeedback(performance);

    expect(result.Easy).toBe('noData');
    expect(result.Medium).toBe('noData');
    expect(result.Hard).toBe('noData');
  });

  it('returns "noData" when performance data for a difficulty is missing', () => {
    const performance = {};

    const result = calculateTimingFeedback(performance);

    expect(result.Easy).toBe('noData');
    expect(result.Medium).toBe('noData');
    expect(result.Hard).toBe('noData');
  });

  it('handles exact boundary values', () => {
    const performance = {
      easy: { attempts: 1, correct: 1, time: 600 },     // avg 600 = min => onTarget
      medium: { attempts: 1, correct: 0, time: 1500 },   // avg 1500 = max => onTarget
      hard: { attempts: 1, correct: 0, time: 1799 },     // avg 1799 < 1800 => tooFast
    };

    const result = calculateTimingFeedback(performance);

    expect(result.Easy).toBe('onTarget');
    expect(result.Medium).toBe('onTarget');
    expect(result.Hard).toBe('tooFast');
  });
});

// -- calculateTagIndexProgression --------------------------------------------

describe('calculateTagIndexProgression', () => {
  it('expands by +1 tag on good accuracy (>= 0.75)', () => {
    const sessionState = { sessionsAtCurrentTagCount: 0 };

    const result = calculateTagIndexProgression(0.8, 0.3, 0, 5, sessionState);

    expect(result).toBe(2); // 0+1 => count=1, +1 => 2
  });

  it('expands by +1 tag on good efficiency (>= 0.6)', () => {
    const sessionState = { sessionsAtCurrentTagCount: 0 };

    const result = calculateTagIndexProgression(0.5, 0.7, 0, 5, sessionState);

    expect(result).toBe(2);
  });

  it('expands by +2 tags on excellent accuracy and sufficient accuracy', () => {
    const sessionState = { sessionsAtCurrentTagCount: 0 };

    const result = calculateTagIndexProgression(0.95, 0.85, 0, 5, sessionState);

    // excellent accuracy (>=0.9) AND excellent efficiency (>=0.8) AND accuracy >= 0.7
    // => canExpandQuickly => +2
    expect(result).toBe(3); // 0+1 => count=1, +2 => 3
  });

  it('expands by +2 on stagnation (5+ sessions at current count with decent performance)', () => {
    const sessionState = { sessionsAtCurrentTagCount: 5 };

    const result = calculateTagIndexProgression(0.65, 0.3, 0, 5, sessionState);

    // stagnation: 5 sessions at same count AND accuracy >= 0.6
    // => canExpandByStagnation => +2
    expect(result).toBe(3);
  });

  it('does not expand when accuracy and efficiency are both poor', () => {
    const sessionState = { sessionsAtCurrentTagCount: 0 };

    const result = calculateTagIndexProgression(0.3, 0.2, 0, 5, sessionState);

    expect(result).toBe(1); // no expansion, stays at currentTagIndex + 1
  });

  it('clamps to focusTagsLength when expansion would exceed it', () => {
    const sessionState = { sessionsAtCurrentTagCount: 0 };

    const result = calculateTagIndexProgression(0.95, 0.85, 3, 4, sessionState);

    // currentTagIndex=3 => count=4, +2 => 6, but clamped to focusTagsLength=4
    expect(result).toBe(4);
  });

  it('ensures minimum count of 1', () => {
    const sessionState = { sessionsAtCurrentTagCount: 0 };

    const result = calculateTagIndexProgression(0.1, 0.1, 0, 5, sessionState);

    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('tracks sessionsAtCurrentTagCount correctly when count stays the same', () => {
    const sessionState = { sessionsAtCurrentTagCount: 2, lastTagCount: 1 };

    calculateTagIndexProgression(0.3, 0.2, 0, 5, sessionState);

    // count = 1, previousTagCount = 1, same => increment
    expect(sessionState.sessionsAtCurrentTagCount).toBe(3);
    expect(sessionState.lastTagCount).toBe(1);
  });

  it('resets sessionsAtCurrentTagCount when count changes', () => {
    const sessionState = { sessionsAtCurrentTagCount: 3, lastTagCount: 1 };

    calculateTagIndexProgression(0.8, 0.3, 0, 5, sessionState);

    // count changes from 1 to 2 => reset
    expect(sessionState.sessionsAtCurrentTagCount).toBe(0);
    expect(sessionState.lastTagCount).toBe(2);
  });

  it('initializes sessionsAtCurrentTagCount if missing', () => {
    const sessionState = {};

    calculateTagIndexProgression(0.3, 0.2, 0, 5, sessionState);

    expect(sessionState.sessionsAtCurrentTagCount).toBeDefined();
  });

  it('logs tag progression info', () => {
    const sessionState = { sessionsAtCurrentTagCount: 0 };

    calculateTagIndexProgression(0.5, 0.5, 1, 5, sessionState);

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Tag progression')
    );
  });
});
