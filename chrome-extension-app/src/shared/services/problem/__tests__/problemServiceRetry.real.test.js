/**
 * Tests for problemServiceRetry.js (254 lines, 0% coverage)
 */

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../db/stores/problems.js', () => ({
  getProblemWithRetry: jest.fn(),
  checkDatabaseForProblemWithRetry: jest.fn(),
  countProblemsByBoxLevelWithRetry: jest.fn(),
  fetchAllProblemsWithRetry: jest.fn(),
}));

jest.mock('../../../db/stores/standard_problems.js', () => ({
  getProblemFromStandardProblems: jest.fn(),
}));

import {
  addOrUpdateProblemWithRetry,
  getProblemByDescriptionWithRetry,
  getAllProblemsWithRetry,
  countProblemsByBoxLevelWithRetryService,
  createAbortController,
  generateSessionWithRetry,
} from '../problemServiceRetry.js';

import {
  getProblemWithRetry,
  checkDatabaseForProblemWithRetry,
  countProblemsByBoxLevelWithRetry,
  fetchAllProblemsWithRetry,
} from '../../../db/stores/problems.js';

import { getProblemFromStandardProblems } from '../../../db/stores/standard_problems.js';

describe('problemServiceRetry', () => {
  beforeEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------
  // addOrUpdateProblemWithRetry
  // -------------------------------------------------------------------
  describe('addOrUpdateProblemWithRetry', () => {
    it('calls addOrUpdateProblem and sends success response', async () => {
      const addFn = jest.fn().mockResolvedValue({ id: 1 });
      const sendResponse = jest.fn();
      const result = await addOrUpdateProblemWithRetry(addFn, { title: 'Two Sum' }, sendResponse);
      expect(result).toEqual({ id: 1 });
      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('sends error response on failure', async () => {
      const addFn = jest.fn().mockRejectedValue(new Error('db error'));
      const sendResponse = jest.fn();
      await expect(addOrUpdateProblemWithRetry(addFn, {}, sendResponse)).rejects.toThrow('db error');
      expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    });

    it('works without sendResponse', async () => {
      const addFn = jest.fn().mockResolvedValue({ id: 2 });
      const result = await addOrUpdateProblemWithRetry(addFn, {}, null);
      expect(result).toEqual({ id: 2 });
    });

    it('works without sendResponse on error', async () => {
      const addFn = jest.fn().mockRejectedValue(new Error('fail'));
      await expect(addOrUpdateProblemWithRetry(addFn, {}, null)).rejects.toThrow('fail');
    });
  });

  // -------------------------------------------------------------------
  // getProblemByDescriptionWithRetry
  // -------------------------------------------------------------------
  describe('getProblemByDescriptionWithRetry', () => {
    it('returns found problem from problems store', async () => {
      getProblemFromStandardProblems.mockResolvedValue({ id: 1, title: 'Two Sum' });
      checkDatabaseForProblemWithRetry.mockResolvedValue(true);
      getProblemWithRetry.mockResolvedValue({ id: 1, title: 'Two Sum', box_level: 3 });

      const result = await getProblemByDescriptionWithRetry('Two Sum', 'two-sum');
      expect(result.found).toBe(true);
      expect(result.problem.box_level).toBe(3);
    });

    it('returns standard problem when not in problems store', async () => {
      getProblemFromStandardProblems.mockResolvedValue({ id: 1, title: 'Two Sum' });
      checkDatabaseForProblemWithRetry.mockResolvedValue(false);

      const result = await getProblemByDescriptionWithRetry('Two Sum', 'two-sum');
      expect(result.found).toBe(true);
      expect(result.problem.id).toBe(1);
    });

    it('returns not found when not in standard_problems', async () => {
      getProblemFromStandardProblems.mockResolvedValue(null);
      const result = await getProblemByDescriptionWithRetry('Unknown', 'unknown');
      expect(result.found).toBe(false);
      expect(result.problem).toBeNull();
    });

    it('throws on error', async () => {
      getProblemFromStandardProblems.mockRejectedValue(new Error('db error'));
      await expect(getProblemByDescriptionWithRetry('test', 'test')).rejects.toThrow('db error');
    });

    it('passes options through', async () => {
      getProblemFromStandardProblems.mockResolvedValue({ id: 5 });
      checkDatabaseForProblemWithRetry.mockResolvedValue(true);
      getProblemWithRetry.mockResolvedValue({ id: 5, title: 'Test' });

      await getProblemByDescriptionWithRetry('desc', 'slug', { timeout: 3000, priority: 'high' });
      expect(checkDatabaseForProblemWithRetry).toHaveBeenCalledWith(5, expect.objectContaining({ timeout: 3000, priority: 'high' }));
    });
  });

  // -------------------------------------------------------------------
  // getAllProblemsWithRetry
  // -------------------------------------------------------------------
  describe('getAllProblemsWithRetry', () => {
    it('fetches all problems', async () => {
      fetchAllProblemsWithRetry.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const result = await getAllProblemsWithRetry();
      expect(result).toHaveLength(2);
    });

    it('passes options through', async () => {
      fetchAllProblemsWithRetry.mockResolvedValue([]);
      await getAllProblemsWithRetry({ timeout: 10000, streaming: true });
      expect(fetchAllProblemsWithRetry).toHaveBeenCalledWith(expect.objectContaining({ timeout: 10000, streaming: true }));
    });

    it('throws on error', async () => {
      fetchAllProblemsWithRetry.mockRejectedValue(new Error('timeout'));
      await expect(getAllProblemsWithRetry()).rejects.toThrow('timeout');
    });
  });

  // -------------------------------------------------------------------
  // countProblemsByBoxLevelWithRetryService
  // -------------------------------------------------------------------
  describe('countProblemsByBoxLevelWithRetryService', () => {
    it('returns box level counts', async () => {
      countProblemsByBoxLevelWithRetry.mockResolvedValue({ 1: 5, 2: 3, 3: 1 });
      const result = await countProblemsByBoxLevelWithRetryService();
      expect(result).toEqual({ 1: 5, 2: 3, 3: 1 });
    });

    it('throws on error', async () => {
      countProblemsByBoxLevelWithRetry.mockRejectedValue(new Error('err'));
      await expect(countProblemsByBoxLevelWithRetryService()).rejects.toThrow('err');
    });
  });

  // -------------------------------------------------------------------
  // createAbortController
  // -------------------------------------------------------------------
  describe('createAbortController', () => {
    it('returns an AbortController', () => {
      const ac = createAbortController();
      expect(ac).toBeInstanceOf(AbortController);
      expect(ac.signal.aborted).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // generateSessionWithRetry
  // -------------------------------------------------------------------
  describe('generateSessionWithRetry', () => {
    it('generates session from fetched problems', async () => {
      const getAllFn = jest.fn().mockResolvedValue([
        { id: 1, difficulty: 'Medium', tags: ['array'], review: '2024-01-01' },
        { id: 2, difficulty: 'Medium', tags: ['dp'], review: '2024-01-02' },
      ]);
      const result = await generateSessionWithRetry(getAllFn, { sessionLength: 2, difficulty: 'Medium' });
      expect(result).toHaveLength(2);
    });

    it('filters by difficulty', async () => {
      const getAllFn = jest.fn().mockResolvedValue([
        { id: 1, difficulty: 'Easy', tags: [], review: '2024-01-01' },
        { id: 2, difficulty: 'Hard', tags: [], review: '2024-01-02' },
      ]);
      const result = await generateSessionWithRetry(getAllFn, { sessionLength: 5, difficulty: 'Easy' });
      expect(result).toHaveLength(1);
      expect(result[0].difficulty).toBe('Easy');
    });

    it('filters by tags', async () => {
      const getAllFn = jest.fn().mockResolvedValue([
        { id: 1, difficulty: 'Easy', tags: ['array'], review: '2024-01-01' },
        { id: 2, difficulty: 'Easy', tags: ['tree'], review: '2024-01-02' },
      ]);
      const result = await generateSessionWithRetry(getAllFn, { sessionLength: 5, difficulty: 'Any', tags: ['array'] });
      expect(result).toHaveLength(1);
    });

    it('throws when aborted before start', async () => {
      const ac = new AbortController();
      ac.abort();
      await expect(generateSessionWithRetry(jest.fn(), {}, ac))
        .rejects.toThrow('cancelled before start');
    });

    it('calls onProgress when streaming', async () => {
      const onProgress = jest.fn();
      const getAllFn = jest.fn().mockResolvedValue([{ id: 1, difficulty: 'Easy', tags: [], review: '2024-01-01' }]);
      await generateSessionWithRetry(getAllFn, { sessionLength: 5, onProgress });
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'complete' }));
    });

    it('throws on fetch error', async () => {
      const getAllFn = jest.fn().mockRejectedValue(new Error('network error'));
      await expect(generateSessionWithRetry(getAllFn)).rejects.toThrow('network error');
    });
  });
});
