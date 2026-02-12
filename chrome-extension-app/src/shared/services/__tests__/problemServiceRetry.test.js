/**
 * Tests for problemServiceRetry.js
 * Covers addOrUpdateProblemWithRetry, getProblemByDescriptionWithRetry,
 * generateSessionWithRetry, and abort controller cancellation.
 */

// Mock logger first, before all other imports
jest.mock('../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock DB stores
jest.mock('../../db/stores/problems.js', () => ({
  getProblemWithRetry: jest.fn(),
  checkDatabaseForProblemWithRetry: jest.fn(),
  countProblemsByBoxLevelWithRetry: jest.fn(),
  fetchAllProblemsWithRetry: jest.fn(),
}));

jest.mock('../../db/stores/standard_problems.js', () => ({
  getProblemFromStandardProblems: jest.fn(),
}));

import {
  addOrUpdateProblemWithRetry,
  getProblemByDescriptionWithRetry,
  generateSessionWithRetry,
  createAbortController,
} from '../problem/problemServiceRetry.js';
import {
  getProblemWithRetry,
  checkDatabaseForProblemWithRetry,
} from '../../db/stores/problems.js';
import { getProblemFromStandardProblems } from '../../db/stores/standard_problems.js';

describe('addOrUpdateProblemWithRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls addOrUpdateProblem with contentScriptData and returns result', async () => {
    const mockData = { leetcode_id: 1, title: 'Two Sum' };
    const mockResult = { id: 'db-key-1' };
    const addOrUpdateProblem = jest.fn().mockResolvedValue(mockResult);
    const sendResponse = jest.fn();

    const result = await addOrUpdateProblemWithRetry(addOrUpdateProblem, mockData, sendResponse);

    expect(addOrUpdateProblem).toHaveBeenCalledWith(mockData);
    expect(result).toBe(mockResult);
  });

  it('calls sendResponse with success=true on successful add', async () => {
    const mockData = { leetcode_id: 1, title: 'Two Sum' };
    const mockResult = { id: 'db-key-1' };
    const addOrUpdateProblem = jest.fn().mockResolvedValue(mockResult);
    const sendResponse = jest.fn();

    await addOrUpdateProblemWithRetry(addOrUpdateProblem, mockData, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: mockResult,
      })
    );
  });

  it('calls sendResponse with success=false on error', async () => {
    const mockData = { leetcode_id: 1, title: 'Two Sum' };
    const addOrUpdateProblem = jest.fn().mockRejectedValue(new Error('DB write failed'));
    const sendResponse = jest.fn();

    await expect(
      addOrUpdateProblemWithRetry(addOrUpdateProblem, mockData, sendResponse)
    ).rejects.toThrow('DB write failed');

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('DB write failed'),
      })
    );
  });

  it('does not call sendResponse when sendResponse is null', async () => {
    const mockData = { leetcode_id: 1, title: 'Two Sum' };
    const addOrUpdateProblem = jest.fn().mockResolvedValue({ id: 'key' });

    // Should not throw
    await addOrUpdateProblemWithRetry(addOrUpdateProblem, mockData, null);
  });

  it('throws the original error after calling sendResponse with failure', async () => {
    const error = new Error('Constraint violation');
    const addOrUpdateProblem = jest.fn().mockRejectedValue(error);

    await expect(
      addOrUpdateProblemWithRetry(addOrUpdateProblem, {}, jest.fn())
    ).rejects.toThrow('Constraint violation');
  });
});

describe('getProblemByDescriptionWithRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns found=false when problem not in standard_problems', async () => {
    getProblemFromStandardProblems.mockResolvedValue(null);

    const result = await getProblemByDescriptionWithRetry('Two Sum', 'two-sum');
    expect(result.found).toBe(false);
    expect(result.problem).toBeNull();
  });

  it('returns found=true with full problem when in both stores', async () => {
    const standardProblem = { id: 1, title: 'Two Sum' };
    const fullProblem = { id: 1, title: 'Two Sum', box_level: 3, attempts: 5 };

    getProblemFromStandardProblems.mockResolvedValue(standardProblem);
    checkDatabaseForProblemWithRetry.mockResolvedValue(true);
    getProblemWithRetry.mockResolvedValue(fullProblem);

    const result = await getProblemByDescriptionWithRetry('Two Sum', 'two-sum');
    expect(result.found).toBe(true);
    expect(result.problem).toEqual(fullProblem);
  });

  it('returns found=true with standard problem when not in problems store', async () => {
    const standardProblem = { id: 2, title: 'Add Two Numbers' };

    getProblemFromStandardProblems.mockResolvedValue(standardProblem);
    checkDatabaseForProblemWithRetry.mockResolvedValue(false);

    const result = await getProblemByDescriptionWithRetry('Add Two Numbers', 'add-two-numbers');
    expect(result.found).toBe(true);
    expect(result.problem).toBe(standardProblem);
  });

  it('passes timeout and priority options to retry functions', async () => {
    const standardProblem = { id: 1 };
    const fullProblem = { id: 1, box_level: 2 };

    getProblemFromStandardProblems.mockResolvedValue(standardProblem);
    checkDatabaseForProblemWithRetry.mockResolvedValue(true);
    getProblemWithRetry.mockResolvedValue(fullProblem);

    await getProblemByDescriptionWithRetry('Two Sum', 'two-sum', {
      timeout: 3000,
      priority: 'high',
    });

    expect(checkDatabaseForProblemWithRetry).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ timeout: 3000, priority: 'high' })
    );
  });

  it('throws when an unexpected error occurs', async () => {
    getProblemFromStandardProblems.mockRejectedValue(new Error('Store unavailable'));

    await expect(
      getProblemByDescriptionWithRetry('Two Sum', 'two-sum')
    ).rejects.toThrow('Store unavailable');
  });
});

describe('generateSessionWithRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildProblems = (count = 10) =>
    Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: `Problem ${i + 1}`,
      difficulty: 'Medium',
      tags: ['Array'],
      review: new Date(Date.now() - i * 86400000).toISOString(),
    }));

  it('returns problems sliced to sessionLength', async () => {
    const allProblems = buildProblems(10);
    const getAllProblemsWithRetryFn = jest.fn().mockResolvedValue(allProblems);

    const result = await generateSessionWithRetry(getAllProblemsWithRetryFn, {
      sessionLength: 3,
    });

    expect(result.length).toBe(3);
  });

  it('filters by difficulty when specified', async () => {
    const problems = [
      ...buildProblems(3).map(p => ({ ...p, difficulty: 'Easy' })),
      ...buildProblems(3).map(p => ({ ...p, difficulty: 'Hard' })),
    ];
    const getAllProblemsWithRetryFn = jest.fn().mockResolvedValue(problems);

    const result = await generateSessionWithRetry(getAllProblemsWithRetryFn, {
      sessionLength: 10,
      difficulty: 'Easy',
    });

    result.forEach(p => expect(p.difficulty).toBe('Easy'));
  });

  it('does not filter when difficulty is "Any"', async () => {
    const problems = [
      { id: 1, difficulty: 'Easy', tags: [], review: new Date().toISOString() },
      { id: 2, difficulty: 'Hard', tags: [], review: new Date().toISOString() },
    ];
    const getAllProblemsWithRetryFn = jest.fn().mockResolvedValue(problems);

    const result = await generateSessionWithRetry(getAllProblemsWithRetryFn, {
      sessionLength: 10,
      difficulty: 'Any',
    });

    expect(result.length).toBe(2);
  });

  it('filters by tags when specified', async () => {
    const problems = [
      { id: 1, difficulty: 'Medium', tags: ['Array'], review: new Date().toISOString() },
      { id: 2, difficulty: 'Medium', tags: ['Tree'], review: new Date().toISOString() },
      { id: 3, difficulty: 'Medium', tags: ['Array', 'Hash Table'], review: new Date().toISOString() },
    ];
    const getAllProblemsWithRetryFn = jest.fn().mockResolvedValue(problems);

    const result = await generateSessionWithRetry(getAllProblemsWithRetryFn, {
      sessionLength: 10,
      tags: ['Array'],
    });

    expect(result.length).toBe(2);
    result.forEach(p => expect(p.tags).toContain('Array'));
  });

  it('sorts problems by review date (oldest first)', async () => {
    const now = Date.now();
    // Use difficulty:'Any' to skip difficulty filtering so all 3 problems survive
    const problems = [
      { id: 1, difficulty: 'Easy', tags: [], review: new Date(now - 1 * 86400000).toISOString() },
      { id: 2, difficulty: 'Easy', tags: [], review: new Date(now - 3 * 86400000).toISOString() },
      { id: 3, difficulty: 'Easy', tags: [], review: new Date(now - 2 * 86400000).toISOString() },
    ];
    const getAllProblemsWithRetryFn = jest.fn().mockResolvedValue(problems);

    const result = await generateSessionWithRetry(getAllProblemsWithRetryFn, {
      sessionLength: 3,
      difficulty: 'Any',
    });

    expect(result[0].id).toBe(2); // Oldest
    expect(result[1].id).toBe(3);
    expect(result[2].id).toBe(1); // Newest
  });

  it('throws "cancelled before start" when abort signal is already aborted', async () => {
    const abortController = new AbortController();
    abortController.abort();

    const getAllProblemsWithRetryFn = jest.fn();

    await expect(
      generateSessionWithRetry(getAllProblemsWithRetryFn, {}, abortController)
    ).rejects.toThrow('cancelled before start');
  });

  it('throws "cancelled after data loading" when aborted after data loads', async () => {
    const abortController = new AbortController();

    const getAllProblemsWithRetryFn = jest.fn().mockImplementation(async () => {
      // Abort during the data load
      abortController.abort();
      return buildProblems(5);
    });

    await expect(
      generateSessionWithRetry(getAllProblemsWithRetryFn, { sessionLength: 3 }, abortController)
    ).rejects.toThrow('cancelled');
  });

  it('calls onProgress with stage=complete after successful generation', async () => {
    const problems = buildProblems(5);
    const getAllProblemsWithRetryFn = jest.fn().mockResolvedValue(problems);
    const onProgress = jest.fn();

    await generateSessionWithRetry(getAllProblemsWithRetryFn, {
      sessionLength: 3,
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'complete' })
    );
  });

  it('throws and logs error for non-cancellation errors', async () => {
    const getAllProblemsWithRetryFn = jest.fn().mockRejectedValue(
      new Error('Database read failed')
    );

    await expect(
      generateSessionWithRetry(getAllProblemsWithRetryFn, { sessionLength: 3 })
    ).rejects.toThrow('Database read failed');
  });

  it('uses default params (sessionLength=5) when no params given', async () => {
    const problems = buildProblems(10);
    const getAllProblemsWithRetryFn = jest.fn().mockResolvedValue(problems);

    const result = await generateSessionWithRetry(getAllProblemsWithRetryFn);
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

describe('createAbortController', () => {
  it('returns an AbortController instance', () => {
    const controller = createAbortController();
    expect(controller).toBeInstanceOf(AbortController);
  });

  it('returned controller has a signal that is not initially aborted', () => {
    const controller = createAbortController();
    expect(controller.signal.aborted).toBe(false);
  });

  it('signal becomes aborted after calling abort()', () => {
    const controller = createAbortController();
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });
});
