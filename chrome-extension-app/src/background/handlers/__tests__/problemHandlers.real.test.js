/**
 * problemHandlers.real.test.js
 *
 * Comprehensive tests for all exported handler functions in problemHandlers.js.
 * Every external service/DB dependency is mocked so we exercise handler logic
 * (parameter parsing, response shaping, error handling) in isolation.
 */

// ---------------------------------------------------------------------------
// 1. Mocks (hoisted before imports)
// ---------------------------------------------------------------------------
jest.mock('../../../shared/services/problem/problemService.js', () => ({
  ProblemService: {
    getProblemByDescription: jest.fn(),
    countProblemsByBoxLevel: jest.fn(),
    countProblemsByBoxLevelWithRetry: jest.fn(),
    addOrUpdateProblemWithRetry: jest.fn(),
    getAllProblems: jest.fn(),
  },
}));

jest.mock('../../../shared/services/attempts/attemptsService.js', () => ({
  AttemptsService: {
    getProblemAttemptStats: jest.fn(),
  },
}));

jest.mock('../../../shared/db/stores/problems.js', () => ({
  getProblemWithOfficialDifficulty: jest.fn(),
}));

jest.mock('../../../shared/db/stores/problem_relationships.js', () => ({
  weakenRelationshipsForSkip: jest.fn(),
  hasRelationshipsToAttempted: jest.fn(),
  findPrerequisiteProblem: jest.fn(),
}));

jest.mock('../../../shared/services/session/sessionService.js', () => ({
  SessionService: {
    skipProblem: jest.fn(),
  },
}));

jest.mock('../../../shared/db/stores/sessions.js', () => ({
  getLatestSession: jest.fn(),
}));

// ---------------------------------------------------------------------------
// 2. Imports
// ---------------------------------------------------------------------------
import {
  handleGetProblemByDescription,
  handleCountProblemsByBoxLevel,
  handleAddProblem,
  handleProblemSubmitted,
  handleSkipProblem,
  handleGetAllProblems,
  handleGetProblemById,
  handleGetProblemAttemptStats,
  problemHandlers,
} from '../problemHandlers.js';

import { ProblemService } from '../../../shared/services/problem/problemService.js';
import { AttemptsService } from '../../../shared/services/attempts/attemptsService.js';
import { getProblemWithOfficialDifficulty } from '../../../shared/db/stores/problems.js';
import {
  weakenRelationshipsForSkip,
  hasRelationshipsToAttempted,
  findPrerequisiteProblem,
} from '../../../shared/db/stores/problem_relationships.js';
import { SessionService } from '../../../shared/services/session/sessionService.js';
import { getLatestSession } from '../../../shared/db/stores/sessions.js';

// ---------------------------------------------------------------------------
// 3. Test helpers
// ---------------------------------------------------------------------------
const makeSendResponse = () => jest.fn();
const makeFinishRequest = () => jest.fn();
const noDeps = {};

// Flush microtasks and queued promises
const flush = () => new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// 4. Tests
// ---------------------------------------------------------------------------
describe('problemHandlers', () => {
  afterEach(() => jest.clearAllMocks());

  // -----------------------------------------------------------------------
  // handleGetProblemByDescription
  // -----------------------------------------------------------------------
  describe('handleGetProblemByDescription', () => {
    it('calls ProblemService.getProblemByDescription and sends result', async () => {
      const problem = { id: 1, title: 'Two Sum' };
      ProblemService.getProblemByDescription.mockResolvedValue(problem);

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      const result = handleGetProblemByDescription(
        { description: 'two sum', slug: 'two-sum' },
        noDeps,
        sendResponse,
        finishRequest
      );

      expect(result).toBe(true);
      await flush();

      expect(ProblemService.getProblemByDescription).toHaveBeenCalledWith('two sum', 'two-sum');
      expect(sendResponse).toHaveBeenCalledWith(problem);
      expect(finishRequest).toHaveBeenCalled();
    });

    it('sends error when service rejects', async () => {
      ProblemService.getProblemByDescription.mockRejectedValue(new Error('not found'));

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleGetProblemByDescription(
        { description: 'x', slug: 'x' },
        noDeps,
        sendResponse,
        finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'not found' });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('sends fallback error message when error has no message', async () => {
      ProblemService.getProblemByDescription.mockRejectedValue(new Error());

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleGetProblemByDescription(
        { description: 'x', slug: 'x' },
        noDeps,
        sendResponse,
        finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });

  // -----------------------------------------------------------------------
  // handleCountProblemsByBoxLevel
  // -----------------------------------------------------------------------
  describe('handleCountProblemsByBoxLevel', () => {
    it('uses normal count when forceRefresh is false', async () => {
      const counts = { box1: 5, box2: 3 };
      ProblemService.countProblemsByBoxLevel.mockResolvedValue(counts);

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleCountProblemsByBoxLevel({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(ProblemService.countProblemsByBoxLevel).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ status: 'success', data: counts });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('uses retry variant when forceRefresh is true', async () => {
      const counts = { box1: 10 };
      ProblemService.countProblemsByBoxLevelWithRetry.mockResolvedValue(counts);

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleCountProblemsByBoxLevel(
        { forceRefresh: true },
        noDeps,
        sendResponse,
        finishRequest
      );
      await flush();

      expect(ProblemService.countProblemsByBoxLevelWithRetry).toHaveBeenCalledWith({
        priority: 'high',
      });
      expect(sendResponse).toHaveBeenCalledWith({ status: 'success', data: counts });
    });

    it('sends error on rejection', async () => {
      ProblemService.countProblemsByBoxLevel.mockRejectedValue(new Error('db error'));

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleCountProblemsByBoxLevel({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ status: 'error', message: 'db error' });
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // handleAddProblem
  // -----------------------------------------------------------------------
  describe('handleAddProblem', () => {
    it('calls addOrUpdateProblemWithRetry and sends response via callback', async () => {
      ProblemService.addOrUpdateProblemWithRetry.mockImplementation((_data, cb) => {
        cb({ status: 'ok' });
        return Promise.resolve();
      });

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleAddProblem(
        { contentScriptData: { title: 'Two Sum' } },
        noDeps,
        sendResponse,
        finishRequest
      );
      await flush();

      expect(ProblemService.addOrUpdateProblemWithRetry).toHaveBeenCalledWith(
        { title: 'Two Sum' },
        expect.any(Function)
      );
      expect(sendResponse).toHaveBeenCalledWith({ status: 'ok' });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('sends error when service rejects', async () => {
      ProblemService.addOrUpdateProblemWithRetry.mockRejectedValue(new Error('add fail'));

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleAddProblem(
        { contentScriptData: {} },
        noDeps,
        sendResponse,
        finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('add fail') })
      );
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // handleProblemSubmitted
  // -----------------------------------------------------------------------
  describe('handleProblemSubmitted', () => {
    it('queries tabs and sends problemSubmitted message to http/https tabs', () => {
      const tabs = [
        { id: 1, url: 'https://leetcode.com/problems/two-sum' },
        { id: 2, url: 'http://localhost:3000' },
        { id: 3, url: 'chrome://extensions' },
      ];
      chrome.tabs.query.mockImplementation((_q, cb) => cb(tabs));

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      const result = handleProblemSubmitted({}, noDeps, sendResponse, finishRequest);

      expect(result).toBe(true);
      expect(chrome.tabs.query).toHaveBeenCalledWith({}, expect.any(Function));
      // Should send to tab 1 and 2 (http/https) but not tab 3 (chrome://)
      expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'problemSubmitted' }, expect.any(Function));
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, { type: 'problemSubmitted' }, expect.any(Function));
      expect(sendResponse).toHaveBeenCalledWith({
        status: 'success',
        message: 'Problem submission notification sent',
      });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('handles tabs with no url property', () => {
      const tabs = [{ id: 1 }, { id: 2, url: null }];
      chrome.tabs.query.mockImplementation((_q, cb) => cb(tabs));

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleProblemSubmitted({}, noDeps, sendResponse, finishRequest);

      expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // handleSkipProblem
  // -----------------------------------------------------------------------
  describe('handleSkipProblem', () => {
    it('returns error when no leetcodeId is provided', async () => {
      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleSkipProblem({}, noDeps, sendResponse, finishRequest);
      // synchronous path
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid problem ID' })
      );
      expect(finishRequest).toHaveBeenCalled();
    });

    it('extracts leetcodeId from request.leetcodeId', async () => {
      hasRelationshipsToAttempted.mockResolvedValue(false);
      getLatestSession.mockResolvedValue({ problems: [{ leetcode_id: 1 }, { leetcode_id: 2 }] });
      SessionService.skipProblem.mockResolvedValue();

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleSkipProblem(
        { leetcodeId: 42, skipReason: 'not_relevant' },
        noDeps,
        sendResponse,
        finishRequest
      );
      await flush();

      expect(hasRelationshipsToAttempted).toHaveBeenCalledWith(42);
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ freeSkip: true, skipReason: 'not_relevant' })
      );
      expect(finishRequest).toHaveBeenCalled();
    });

    it('extracts leetcodeId from request.problemData', async () => {
      hasRelationshipsToAttempted.mockResolvedValue(false);
      getLatestSession.mockResolvedValue({ problems: [{}, {}] });
      SessionService.skipProblem.mockResolvedValue();

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleSkipProblem(
        { problemData: { leetcode_id: 99 }, skipReason: 'other' },
        noDeps,
        sendResponse,
        finishRequest
      );
      await flush();

      expect(hasRelationshipsToAttempted).toHaveBeenCalledWith(99);
    });

    it('defaults to "other" for invalid skip reason', async () => {
      hasRelationshipsToAttempted.mockResolvedValue(false);
      getLatestSession.mockResolvedValue({ problems: [{}, {}] });
      SessionService.skipProblem.mockResolvedValue();

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleSkipProblem(
        { leetcodeId: 1, skipReason: 'invalid_reason' },
        noDeps,
        sendResponse,
        finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ skipReason: 'other' })
      );
    });

    it('handles too_difficult with relationships - weakens graph', async () => {
      hasRelationshipsToAttempted.mockResolvedValue(true);
      weakenRelationshipsForSkip.mockResolvedValue({ updated: 3 });
      getLatestSession.mockResolvedValue({ problems: [{}, {}] });
      SessionService.skipProblem.mockResolvedValue();

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleSkipProblem(
        { leetcodeId: 5, skipReason: 'too_difficult' },
        noDeps,
        sendResponse,
        finishRequest
      );
      await flush();

      expect(weakenRelationshipsForSkip).toHaveBeenCalledWith(5);
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ graphUpdated: true, freeSkip: false })
      );
    });

    it('handles too_difficult - keeps last problem in session', async () => {
      hasRelationshipsToAttempted.mockResolvedValue(false);
      getLatestSession.mockResolvedValue({ problems: [{ leetcode_id: 5 }] });

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleSkipProblem(
        { leetcodeId: 5, skipReason: 'too_difficult' },
        noDeps,
        sendResponse,
        finishRequest
      );
      await flush();

      expect(SessionService.skipProblem).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ kept: true, lastProblem: true })
      );
    });

    it('handles dont_understand with prerequisite found', async () => {
      hasRelationshipsToAttempted.mockResolvedValue(true);
      const prereq = { title: 'Prerequisite Problem', leetcode_id: 100 };
      findPrerequisiteProblem.mockResolvedValue(prereq);
      getLatestSession.mockResolvedValue({ problems: [{ leetcode_id: 5 }, { leetcode_id: 6 }] });
      SessionService.skipProblem.mockResolvedValue();

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleSkipProblem(
        { leetcodeId: 5, skipReason: 'dont_understand' },
        noDeps,
        sendResponse,
        finishRequest
      );
      await flush();

      expect(findPrerequisiteProblem).toHaveBeenCalledWith(5, [5, 6]);
      expect(SessionService.skipProblem).toHaveBeenCalledWith(5, prereq);
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ prerequisite: prereq, replaced: true })
      );
    });

    it('handles dont_understand - no prerequisite, last problem kept', async () => {
      hasRelationshipsToAttempted.mockResolvedValue(true);
      findPrerequisiteProblem.mockResolvedValue(null);
      getLatestSession.mockResolvedValue({ problems: [{ leetcode_id: 5 }] });

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleSkipProblem(
        { leetcodeId: 5, skipReason: 'dont_understand' },
        noDeps,
        sendResponse,
        finishRequest
      );
      await flush();

      expect(SessionService.skipProblem).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ kept: true, lastProblem: true, replaced: false })
      );
    });

    it('handles dont_understand - no prerequisite, not last problem', async () => {
      hasRelationshipsToAttempted.mockResolvedValue(true);
      findPrerequisiteProblem.mockResolvedValue(null);
      getLatestSession.mockResolvedValue({ problems: [{ leetcode_id: 5 }, { leetcode_id: 6 }] });
      SessionService.skipProblem.mockResolvedValue();

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleSkipProblem(
        { leetcodeId: 5, skipReason: 'dont_understand' },
        noDeps,
        sendResponse,
        finishRequest
      );
      await flush();

      expect(SessionService.skipProblem).toHaveBeenCalledWith(5);
    });

    it('handles not_relevant with multiple problems', async () => {
      hasRelationshipsToAttempted.mockResolvedValue(false);
      getLatestSession.mockResolvedValue({ problems: [{}, {}] });
      SessionService.skipProblem.mockResolvedValue();

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleSkipProblem(
        { leetcodeId: 10, skipReason: 'not_relevant' },
        noDeps,
        sendResponse,
        finishRequest
      );
      await flush();

      expect(SessionService.skipProblem).toHaveBeenCalledWith(10);
    });

    it('handles not_relevant - keeps last problem', async () => {
      hasRelationshipsToAttempted.mockResolvedValue(false);
      getLatestSession.mockResolvedValue({ problems: [{ leetcode_id: 10 }] });

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleSkipProblem(
        { leetcodeId: 10, skipReason: 'not_relevant' },
        noDeps,
        sendResponse,
        finishRequest
      );
      await flush();

      expect(SessionService.skipProblem).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ kept: true, lastProblem: true })
      );
    });

    it('sends error response when async logic throws', async () => {
      hasRelationshipsToAttempted.mockRejectedValue(new Error('db down'));

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleSkipProblem(
        { leetcodeId: 1, skipReason: 'other' },
        noDeps,
        sendResponse,
        finishRequest
      );
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'db down' })
      );
      expect(finishRequest).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // handleGetAllProblems
  // -----------------------------------------------------------------------
  describe('handleGetAllProblems', () => {
    it('resolves with all problems', async () => {
      const problems = [{ id: 1 }, { id: 2 }];
      ProblemService.getAllProblems.mockResolvedValue(problems);

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleGetAllProblems({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith(problems);
      expect(finishRequest).toHaveBeenCalled();
    });

    it('sends error on rejection', async () => {
      ProblemService.getAllProblems.mockRejectedValue(new Error('fail'));

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleGetAllProblems({}, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ error: 'Failed to retrieve problems' });
    });
  });

  // -----------------------------------------------------------------------
  // handleGetProblemById
  // -----------------------------------------------------------------------
  describe('handleGetProblemById', () => {
    it('returns problem data on success', async () => {
      const data = { id: 42, title: 'Two Sum' };
      getProblemWithOfficialDifficulty.mockResolvedValue(data);

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleGetProblemById({ problemId: 42 }, noDeps, sendResponse, finishRequest);
      await flush();

      expect(getProblemWithOfficialDifficulty).toHaveBeenCalledWith(42);
      expect(sendResponse).toHaveBeenCalledWith({ success: true, data });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns error on failure', async () => {
      getProblemWithOfficialDifficulty.mockRejectedValue(new Error('not found'));

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleGetProblemById({ problemId: 999 }, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'not found' });
    });
  });

  // -----------------------------------------------------------------------
  // handleGetProblemAttemptStats
  // -----------------------------------------------------------------------
  describe('handleGetProblemAttemptStats', () => {
    it('returns stats on success', async () => {
      const stats = { attempts: 3, solved: true };
      AttemptsService.getProblemAttemptStats.mockResolvedValue(stats);

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleGetProblemAttemptStats({ problemId: 42 }, noDeps, sendResponse, finishRequest);
      await flush();

      expect(AttemptsService.getProblemAttemptStats).toHaveBeenCalledWith(42);
      expect(sendResponse).toHaveBeenCalledWith({ success: true, data: stats });
      expect(finishRequest).toHaveBeenCalled();
    });

    it('returns error on failure', async () => {
      AttemptsService.getProblemAttemptStats.mockRejectedValue(new Error('stats fail'));

      const sendResponse = makeSendResponse();
      const finishRequest = makeFinishRequest();
      handleGetProblemAttemptStats({ problemId: 1 }, noDeps, sendResponse, finishRequest);
      await flush();

      expect(sendResponse).toHaveBeenCalledWith({ success: false, error: 'stats fail' });
    });
  });

  // -----------------------------------------------------------------------
  // problemHandlers registry
  // -----------------------------------------------------------------------
  describe('problemHandlers registry', () => {
    it('maps all handler names to functions', () => {
      expect(Object.keys(problemHandlers)).toEqual([
        'getProblemByDescription',
        'countProblemsByBoxLevel',
        'addProblem',
        'problemSubmitted',
        'skipProblem',
        'getAllProblems',
        'getProblemById',
        'getProblemAttemptStats',
      ]);

      Object.values(problemHandlers).forEach((fn) => {
        expect(typeof fn).toBe('function');
      });
    });
  });
});
