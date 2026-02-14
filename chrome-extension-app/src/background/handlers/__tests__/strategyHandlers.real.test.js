/**
 * strategyHandlers.real.test.js
 *
 * Comprehensive tests for all exported handler functions in strategyHandlers.js.
 * Every external DB/service dependency is mocked.
 */

// ---------------------------------------------------------------------------
// 1. Mocks (hoisted)
// ---------------------------------------------------------------------------
jest.mock('../../../shared/db/stores/strategy_data.js', () => ({
  getStrategyForTag: jest.fn(),
  isStrategyDataLoaded: jest.fn(),
}));

jest.mock('../../../shared/db/core/common.js', () => ({
  getAllFromStore: jest.fn(),
  getRecord: jest.fn(),
  addRecord: jest.fn(),
  updateRecord: jest.fn(),
  deleteRecord: jest.fn(),
}));

jest.mock('../../../shared/db/stores/problem_relationships.js', () => ({
  buildRelationshipMap: jest.fn(),
}));

jest.mock('../../../shared/db/stores/problems.js', () => ({
  fetchAllProblems: jest.fn(),
}));

jest.mock('../../../shared/db/stores/standard_problems.js', () => ({
  getAllStandardProblems: jest.fn(),
}));

jest.mock('../../../shared/services/focus/relationshipService.js', () => ({
  buildProblemRelationships: jest.fn(),
}));

// ---------------------------------------------------------------------------
// 2. Imports
// ---------------------------------------------------------------------------
import { strategyHandlers } from '../strategyHandlers.js';

import { getStrategyForTag, isStrategyDataLoaded } from '../../../shared/db/stores/strategy_data.js';
import { getAllFromStore, getRecord, addRecord, updateRecord, deleteRecord } from '../../../shared/db/core/common.js';
import { buildRelationshipMap } from '../../../shared/db/stores/problem_relationships.js';
import { fetchAllProblems } from '../../../shared/db/stores/problems.js';
import { getAllStandardProblems } from '../../../shared/db/stores/standard_problems.js';
import { buildProblemRelationships } from '../../../shared/services/focus/relationshipService.js';

// ---------------------------------------------------------------------------
// 3. Helpers
// ---------------------------------------------------------------------------
const sr = () => jest.fn();
const fr = () => jest.fn();
const flush = () => new Promise((r) => setTimeout(r, 0));
const noDeps = {};

// ---------------------------------------------------------------------------
// 4. Tests
// ---------------------------------------------------------------------------
describe('strategyHandlers', () => {
  afterEach(() => jest.clearAllMocks());

  // -----------------------------------------------------------------------
  // getStrategyForTag
  // -----------------------------------------------------------------------
  describe('getStrategyForTag', () => {
    it('returns strategy data on success', async () => {
      const strategy = { tag: 'Array', steps: ['step1'] };
      getStrategyForTag.mockResolvedValue(strategy);

      const sendResponse = sr();
      const finishRequest = fr();
      const result = strategyHandlers.getStrategyForTag(
        { tag: 'Array' }, noDeps, sendResponse, finishRequest
      );
      expect(result).toBe(true);
      await flush();

      expect(getStrategyForTag).toHaveBeenCalledWith('Array');
      expect(sendResponse).toHaveBeenCalledWith({ status: 'success', data: strategy });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns null when strategy not found', async () => {
      getStrategyForTag.mockResolvedValue(null);

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.getStrategyForTag({ tag: 'Unknown' }, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ status: 'success', data: null });
    });

    it('returns error on failure', async () => {
      getStrategyForTag.mockRejectedValue(new Error('db error'));

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.getStrategyForTag({ tag: 'Fail' }, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ status: 'error', error: 'db error' });
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getStrategiesForTags
  // -----------------------------------------------------------------------
  describe('getStrategiesForTags', () => {
    it('returns strategies for multiple tags', async () => {
      getStrategyForTag
        .mockResolvedValueOnce({ tag: 'Array', steps: [] })
        .mockResolvedValueOnce(null) // not found
        .mockResolvedValueOnce({ tag: 'Tree', steps: [] });

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.getStrategiesForTags(
        { tags: ['Array', 'Graph', 'Tree'] }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        status: 'success',
        data: {
          Array: { tag: 'Array', steps: [] },
          Tree: { tag: 'Tree', steps: [] },
        },
      });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('continues when individual tag strategy fails', async () => {
      getStrategyForTag
        .mockResolvedValueOnce({ tag: 'A', steps: [] })
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ tag: 'C', steps: [] });

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.getStrategiesForTags(
        { tags: ['A', 'B', 'C'] }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        status: 'success',
        data: expect.objectContaining({ A: expect.any(Object), C: expect.any(Object) }),
      });
    });

    it('returns empty data when all fail individually', async () => {
      getStrategyForTag.mockRejectedValue(new Error('all fail'));

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.getStrategiesForTags(
        { tags: ['X', 'Y'] }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ status: 'success', data: {} });
    });
  });

  // -----------------------------------------------------------------------
  // isStrategyDataLoaded
  // -----------------------------------------------------------------------
  describe('isStrategyDataLoaded', () => {
    it('returns true when data is loaded', async () => {
      isStrategyDataLoaded.mockResolvedValue(true);

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.isStrategyDataLoaded({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ status: 'success', data: true });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns false when data not loaded', async () => {
      isStrategyDataLoaded.mockResolvedValue(false);

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.isStrategyDataLoaded({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ status: 'success', data: false });
    });

    it('returns error on failure', async () => {
      isStrategyDataLoaded.mockRejectedValue(new Error('check fail'));

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.isStrategyDataLoaded({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ status: 'error', error: 'check fail' });
    });
  });

  // -----------------------------------------------------------------------
  // getSimilarProblems
  // -----------------------------------------------------------------------
  describe('getSimilarProblems', () => {
    it('returns similar problems based on relationship map', async () => {
      const relMap = new Map();
      relMap.set(1, { 2: 0.8, 3: 0.5, 1: 1.0 }); // includes self-reference
      buildRelationshipMap.mockResolvedValue(relMap);
      fetchAllProblems.mockResolvedValue([]);
      getAllStandardProblems.mockResolvedValue([
        { id: 2, title: 'Problem 2', difficulty: 'Easy', slug: 'prob-2' },
        { id: 3, title: 'Problem 3', difficulty: 'Medium', slug: 'prob-3' },
      ]);

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.getSimilarProblems(
        { problemId: 1, limit: 5 }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        similarProblems: [
          { id: 2, title: 'Problem 2', difficulty: 'Easy', slug: 'prob-2', strength: 0.8 },
          { id: 3, title: 'Problem 3', difficulty: 'Medium', slug: 'prob-3', strength: 0.5 },
        ],
      });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns empty when relationship map is empty', async () => {
      buildRelationshipMap.mockResolvedValue(new Map());
      fetchAllProblems.mockResolvedValue([]);
      getAllStandardProblems.mockResolvedValue([]);

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.getSimilarProblems(
        { problemId: 1 }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        similarProblems: [],
        debug: { message: 'Problem relationships not initialized', mapSize: 0 },
      });
    });

    it('returns empty when no relationships exist for the problem', async () => {
      const relMap = new Map();
      relMap.set(999, { 2: 0.5 });
      buildRelationshipMap.mockResolvedValue(relMap);
      fetchAllProblems.mockResolvedValue([]);
      getAllStandardProblems.mockResolvedValue([]);

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.getSimilarProblems(
        { problemId: 1 }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ similarProblems: [] });
    });

    it('respects limit parameter', async () => {
      const rels = {};
      for (let i = 2; i <= 10; i++) rels[i] = 1 / i;
      const relMap = new Map();
      relMap.set(1, rels);
      buildRelationshipMap.mockResolvedValue(relMap);
      fetchAllProblems.mockResolvedValue([]);
      const stdProblems = [];
      for (let i = 2; i <= 10; i++) {
        stdProblems.push({ id: i, title: `P${i}`, difficulty: 'Easy', slug: `p${i}` });
      }
      getAllStandardProblems.mockResolvedValue(stdProblems);

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.getSimilarProblems(
        { problemId: 1, limit: 3 }, noDeps, sendResponse, finishRequest
      );
      await flush();

      const result = sendResponse.mock.calls[0][0];
      expect(result.similarProblems.length).toBeLessThanOrEqual(3);
    });

    it('handles errors gracefully', async () => {
      buildRelationshipMap.mockRejectedValue(new Error('db err'));

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.getSimilarProblems(
        { problemId: 1 }, noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ similarProblems: [] });
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // rebuildProblemRelationships
  // -----------------------------------------------------------------------
  describe('rebuildProblemRelationships', () => {
    it('rebuilds successfully', async () => {
      buildProblemRelationships.mockResolvedValue();

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.rebuildProblemRelationships({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(buildProblemRelationships).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        message: 'Problem relationships rebuilt successfully',
      });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns error on failure', async () => {
      buildProblemRelationships.mockRejectedValue(new Error('rebuild fail'));

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.rebuildProblemRelationships({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'rebuild fail',
      });
    });
  });

  // -----------------------------------------------------------------------
  // DATABASE_OPERATION
  // -----------------------------------------------------------------------
  describe('DATABASE_OPERATION', () => {
    it('handles getRecord', async () => {
      getRecord.mockResolvedValue({ id: 1, name: 'test' });

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.DATABASE_OPERATION(
        { operation: 'getRecord', params: { storeName: 'problems', id: 1 } },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(getRecord).toHaveBeenCalledWith('problems', 1);
      expect(sendResponse).toHaveBeenCalledWith({ data: { id: 1, name: 'test' } });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('handles addRecord', async () => {
      addRecord.mockResolvedValue(42);

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.DATABASE_OPERATION(
        { operation: 'addRecord', params: { storeName: 'problems', record: { title: 'x' } } },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(addRecord).toHaveBeenCalledWith('problems', { title: 'x' });
      expect(sendResponse).toHaveBeenCalledWith({ data: 42 });
    });

    it('handles updateRecord', async () => {
      updateRecord.mockResolvedValue({ updated: true });

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.DATABASE_OPERATION(
        {
          operation: 'updateRecord',
          params: { storeName: 'problems', id: 1, record: { title: 'updated' } },
        },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(updateRecord).toHaveBeenCalledWith('problems', 1, { title: 'updated' });
      expect(sendResponse).toHaveBeenCalledWith({ data: { updated: true } });
    });

    it('handles deleteRecord', async () => {
      deleteRecord.mockResolvedValue(undefined);

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.DATABASE_OPERATION(
        { operation: 'deleteRecord', params: { storeName: 'problems', id: 1 } },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(deleteRecord).toHaveBeenCalledWith('problems', 1);
      expect(sendResponse).toHaveBeenCalledWith({ data: undefined });
    });

    it('handles getAllFromStore', async () => {
      getAllFromStore.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.DATABASE_OPERATION(
        { operation: 'getAllFromStore', params: { storeName: 'problems' } },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(getAllFromStore).toHaveBeenCalledWith('problems');
      expect(sendResponse).toHaveBeenCalledWith({ data: [{ id: 1 }, { id: 2 }] });
    });

    it('returns error for unknown operation', async () => {
      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.DATABASE_OPERATION(
        { operation: 'invalidOp', params: { storeName: 'problems' } },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({
        error: 'Unknown database operation: invalidOp',
      });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns error on db failure', async () => {
      getRecord.mockRejectedValue(new Error('connection lost'));

      const sendResponse = sr();
      const finishRequest = fr();
      strategyHandlers.DATABASE_OPERATION(
        { operation: 'getRecord', params: { storeName: 'problems', id: 1 } },
        noDeps, sendResponse, finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'connection lost' });
    });
  });
});
