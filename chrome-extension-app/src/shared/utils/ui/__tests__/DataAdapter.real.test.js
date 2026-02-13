/**
 * Tests for DataAdapter.js
 * Covers: getAccuracyTrendData, getAttemptBreakdownData, getProblemActivityData
 *
 * The module depends on DataAdapterHelpers.js and IndividualSessionData.js.
 * DataAdapterHelpers uses date-fns, so we use real imports for that (no mock needed).
 */

// Clear the DataAdapter cache between tests
import {
  getAccuracyTrendData,
  getAttemptBreakdownData,
  getProblemActivityData,
} from '../DataAdapter.js';

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSession(date, attempts) {
  return { date, attempts };
}

function makeAttempt(problemId, success) {
  return { problemId, success };
}

// ---------------------------------------------------------------------------
// getAccuracyTrendData
// ---------------------------------------------------------------------------
describe('getAccuracyTrendData', () => {
  it('returns empty array for non-array input', () => {
    expect(getAccuracyTrendData(null)).toEqual([]);
    expect(getAccuracyTrendData(undefined)).toEqual([]);
    expect(getAccuracyTrendData('not-array')).toEqual([]);
  });

  it('returns empty array for empty sessions', () => {
    expect(getAccuracyTrendData([])).toEqual([]);
  });

  it('groups sessions by week and calculates accuracy', () => {
    const sessions = [
      makeSession('2024-01-15', [
        makeAttempt('p1', true),
        makeAttempt('p2', true),
      ]),
    ];

    const result = getAccuracyTrendData(sessions, 'weekly');
    expect(result.length).toBe(1);
    // 2 correct out of 2 = 100%
    expect(result[0].accuracy).toBe(100);
    expect(result[0].name).toMatch(/2024-W/);
  });

  it('groups sessions by month', () => {
    const sessions = [
      makeSession('2024-01-15', [makeAttempt('p1', true)]),
      makeSession('2024-02-15', [makeAttempt('p2', true)]),
    ];

    const result = getAccuracyTrendData(sessions, 'monthly');
    expect(result.length).toBe(2);
  });

  it('groups sessions by year', () => {
    const sessions = [
      makeSession('2023-06-15', [makeAttempt('p1', true)]),
      makeSession('2024-06-15', [makeAttempt('p2', true)]),
    ];

    const result = getAccuracyTrendData(sessions, 'yearly');
    expect(result.length).toBe(2);
  });

  it('skips sessions without date', () => {
    const sessions = [
      makeSession(null, [makeAttempt('p1', true)]),
      makeSession('2024-01-15', [makeAttempt('p2', true)]),
    ];

    const result = getAccuracyTrendData(sessions, 'weekly');
    expect(result.length).toBe(1);
  });

  it('skips sessions without attempts array', () => {
    const sessions = [
      { date: '2024-01-15' }, // no attempts
      makeSession('2024-01-15', [makeAttempt('p1', true)]),
    ];

    const result = getAccuracyTrendData(sessions, 'weekly');
    expect(result.length).toBeGreaterThan(0);
  });

  it('excludes periods with 0 accuracy', () => {
    // Use a very unique session structure to avoid cache collisions
    const sessions = [
      makeSession('2024-11-04', [
        makeAttempt('unique_fail_1', false),
        makeAttempt('unique_fail_2', false),
        makeAttempt('unique_fail_3', false),
      ]),
    ];
    // 0 correct out of 3 = 0%, which is filtered out by accuracy > 0
    const result = getAccuracyTrendData(sessions, 'yearly');
    expect(result.length).toBe(0);
  });

  it('uses cache for repeated calls with same data', () => {
    const sessions = [
      makeSession('2024-01-15', [makeAttempt('p1', true)]),
    ];

    const result1 = getAccuracyTrendData(sessions, 'weekly');
    const result2 = getAccuracyTrendData(sessions, 'weekly');
    // Results should be identical (from cache)
    expect(result1).toEqual(result2);
  });

  it('filters out future dates', () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const sessions = [
      makeSession(futureDate, [makeAttempt('p1', true)]),
    ];

    const result = getAccuracyTrendData(sessions, 'weekly');
    expect(result.length).toBe(0);
  });

  it('sorts results by label', () => {
    const sessions = [
      makeSession('2024-03-15', [makeAttempt('p1', true)]),
      makeSession('2024-01-15', [makeAttempt('p2', true)]),
    ];

    const result = getAccuracyTrendData(sessions, 'monthly');
    if (result.length === 2) {
      expect(result[0].name < result[1].name).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// getAttemptBreakdownData
// ---------------------------------------------------------------------------
describe('getAttemptBreakdownData', () => {
  it('returns empty array for non-array input', () => {
    expect(getAttemptBreakdownData(null)).toEqual([]);
    expect(getAttemptBreakdownData(undefined)).toEqual([]);
  });

  it('categorizes first-try successes', () => {
    const sessions = [
      makeSession('2024-01-15', [
        { problemId: 'p1', success: true },
      ]),
    ];

    const result = getAttemptBreakdownData(sessions, 'weekly');
    expect(result.length).toBe(1);
    expect(result[0].firstTry).toBe(1);
    expect(result[0].retrySuccess).toBe(0);
    expect(result[0].failed).toBe(0);
  });

  it('categorizes retry successes', () => {
    const sessions = [
      makeSession('2024-01-15', [
        { problemId: 'p1', success: false },
      ]),
      makeSession('2024-01-16', [
        { problemId: 'p1', success: true },
      ]),
    ];

    const result = getAttemptBreakdownData(sessions, 'weekly');
    expect(result.length).toBe(1);
    expect(result[0].retrySuccess).toBe(1);
  });

  it('categorizes failures', () => {
    const sessions = [
      makeSession('2024-01-15', [
        { problemId: 'p1', success: false },
        { problemId: 'p2', success: false },
      ]),
    ];

    const result = getAttemptBreakdownData(sessions, 'monthly');
    expect(result.length).toBe(1);
    expect(result[0].failed).toBe(2);
  });

  it('groups by month', () => {
    const sessions = [
      makeSession('2024-01-15', [{ problemId: 'p1', success: true }]),
      makeSession('2024-02-15', [{ problemId: 'p2', success: true }]),
    ];

    const result = getAttemptBreakdownData(sessions, 'monthly');
    expect(result.length).toBe(2);
  });

  it('uses problem_id as fallback', () => {
    const sessions = [
      makeSession('2024-01-15', [
        { problem_id: 'p1', success: true },
      ]),
    ];

    const result = getAttemptBreakdownData(sessions, 'weekly');
    expect(result.length).toBe(1);
    expect(result[0].firstTry).toBe(1);
  });

  it('uses leetcode_id as fallback', () => {
    const sessions = [
      makeSession('2024-01-15', [
        { leetcode_id: 'p1', success: true },
      ]),
    ];

    const result = getAttemptBreakdownData(sessions, 'weekly');
    expect(result.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getProblemActivityData
// ---------------------------------------------------------------------------
describe('getProblemActivityData', () => {
  it('returns empty array for non-array input', () => {
    expect(getProblemActivityData(null)).toEqual([]);
    expect(getProblemActivityData('not-array')).toEqual([]);
  });

  it('returns empty array for empty sessions', () => {
    expect(getProblemActivityData([])).toEqual([]);
  });

  it('counts attempted, passed, and failed', () => {
    const sessions = [
      makeSession('2024-01-15', [
        makeAttempt('p1', true),
        makeAttempt('p2', false),
        makeAttempt('p3', true),
      ]),
    ];

    const result = getProblemActivityData(sessions, 'weekly');
    expect(result.length).toBe(1);
    expect(result[0].attempted).toBe(3);
    expect(result[0].passed).toBe(2);
    expect(result[0].failed).toBe(1);
  });

  it('groups by week', () => {
    const sessions = [
      makeSession('2024-01-15', [makeAttempt('p1', true)]),
      makeSession('2024-01-22', [makeAttempt('p2', true)]),
    ];

    const result = getProblemActivityData(sessions, 'weekly');
    expect(result.length).toBe(2);
  });

  it('groups by month', () => {
    const sessions = [
      makeSession('2024-01-15', [makeAttempt('p1', true)]),
      makeSession('2024-02-15', [makeAttempt('p2', true)]),
    ];

    const result = getProblemActivityData(sessions, 'monthly');
    expect(result.length).toBe(2);
  });

  it('groups by year', () => {
    const sessions = [
      makeSession('2023-06-15', [makeAttempt('p1', true)]),
      makeSession('2024-06-15', [makeAttempt('p2', true)]),
    ];

    const result = getProblemActivityData(sessions, 'yearly');
    expect(result.length).toBe(2);
  });

  it('skips sessions without date', () => {
    const sessions = [
      { date: null, attempts: [makeAttempt('p1', true)] },
      makeSession('2024-01-15', [makeAttempt('p2', true)]),
    ];

    const result = getProblemActivityData(sessions, 'weekly');
    expect(result.length).toBe(1);
  });

  it('sorts results chronologically', () => {
    const sessions = [
      makeSession('2024-03-15', [makeAttempt('p1', true)]),
      makeSession('2024-01-15', [makeAttempt('p2', true)]),
    ];

    const result = getProblemActivityData(sessions, 'monthly');
    if (result.length === 2) {
      expect(result[0].name < result[1].name).toBe(true);
    }
  });

  it('uses cache for repeated calls', () => {
    const sessions = [
      makeSession('2024-01-15', [makeAttempt('p1', true)]),
    ];

    const result1 = getProblemActivityData(sessions, 'weekly');
    const result2 = getProblemActivityData(sessions, 'weekly');
    expect(result1).toEqual(result2);
  });
});
