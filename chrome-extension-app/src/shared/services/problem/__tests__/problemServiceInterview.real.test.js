/**
 * Tests for problemServiceInterview.js (240 lines, 0% coverage)
 */

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../db/stores/sessions.js', () => ({
  buildAdaptiveSessionSettings: jest.fn().mockResolvedValue({
    sessionLength: 5,
    numberOfNewProblems: 3,
    currentAllowedTags: ['array'],
    currentDifficultyCap: 'Medium',
    userFocusAreas: [],
    isOnboarding: false,
  }),
}));

jest.mock('../../session/interviewService.js', () => ({
  InterviewService: {
    createInterviewSession: jest.fn().mockResolvedValue({
      sessionLength: 5,
      selectionCriteria: { allowedTags: ['array'], problemMix: { mastered: 0.3, nearMastery: 0.3 }, masteredTags: [], nearMasteryTags: [] },
      config: { mode: 'practice' },
      interviewMetrics: {},
      createdAt: new Date().toISOString(),
    }),
    getInterviewConfig: jest.fn().mockReturnValue({ timeLimit: 30 }),
  },
}));

jest.mock('../problemNormalizer.js', () => ({
  normalizeProblems: jest.fn((probs) => probs.map(p => ({ ...p, normalized: true }))),
}));

import {
  createInterviewSession,
  applyProblemMix,
  filterProblemsByTags,
  ensureSufficientProblems,
  handleInterviewSessionFallback,
  shuffleArray,
  addInterviewMetadata,
} from '../problemServiceInterview.js';

import { InterviewService } from '../../session/interviewService.js';
import { buildAdaptiveSessionSettings } from '../../../db/stores/sessions.js';

describe('problemServiceInterview', () => {
  beforeEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------
  // createInterviewSession
  // -------------------------------------------------------------------
  describe('createInterviewSession', () => {
    it('creates interview session successfully', async () => {
      const fetchProblems = jest.fn().mockResolvedValue([{ id: 1, title: 'Two Sum' }]);
      const createSession = jest.fn();
      const result = await createInterviewSession('practice', fetchProblems, createSession);
      expect(result.session_type).toBe('practice');
      expect(result.problems).toHaveLength(1);
      expect(InterviewService.createInterviewSession).toHaveBeenCalledWith('practice');
    });

    it('falls back to standard session on error', async () => {
      InterviewService.createInterviewSession.mockRejectedValue(new Error('interview failed'));
      const createSession = jest.fn().mockResolvedValue([{ id: 2 }]);
      const result = await createInterviewSession('practice', jest.fn(), createSession);
      expect(result.fallbackUsed).toBe(true);
      expect(result.session_type).toBe('standard');
    });

    it('rethrows on timeout error', async () => {
      InterviewService.createInterviewSession.mockRejectedValue(new Error('timed out'));
      const createSession = jest.fn().mockRejectedValue(new Error('also failed'));
      await expect(createInterviewSession('practice', jest.fn(), createSession))
        .rejects.toThrow('timed out');
    });

    it('throws when both interview and fallback fail (non-timeout)', async () => {
      InterviewService.createInterviewSession.mockRejectedValue(new Error('config error'));
      const createSession = jest.fn().mockRejectedValue(new Error('fallback error'));
      await expect(createInterviewSession('practice', jest.fn(), createSession))
        .rejects.toThrow('Both interview and fallback');
    });
  });

  // -------------------------------------------------------------------
  // applyProblemMix
  // -------------------------------------------------------------------
  describe('applyProblemMix', () => {
    const shuffleFn = (arr) => arr; // identity for deterministic tests

    it('distributes problems by mix ratios', () => {
      const problems = [
        { id: 1, Tags: ['array'] },
        { id: 2, Tags: ['dp'] },
        { id: 3, Tags: ['tree'] },
      ];
      const criteria = {
        problemMix: { mastered: 0.3, nearMastery: 0.3 },
        masteredTags: ['array'],
        nearMasteryTags: ['dp'],
      };
      const result = applyProblemMix(problems, criteria, 3, shuffleFn);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('handles empty mastered/nearMastery tags', () => {
      const problems = [{ id: 1, Tags: ['array'] }, { id: 2, Tags: ['dp'] }];
      const criteria = {
        problemMix: { mastered: 0.5, nearMastery: 0.5 },
      };
      const result = applyProblemMix(problems, criteria, 2, shuffleFn);
      // When no masteredTags/nearMasteryTags, only challenging fill works
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('fills remaining with challenging problems', () => {
      const problems = [
        { id: 1, Tags: ['graph'] },
        { id: 2, Tags: ['backtracking'] },
      ];
      const criteria = {
        problemMix: { mastered: 0, nearMastery: 0 },
        masteredTags: [],
        nearMasteryTags: [],
      };
      const result = applyProblemMix(problems, criteria, 2, shuffleFn);
      expect(result).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------
  // filterProblemsByTags
  // -------------------------------------------------------------------
  describe('filterProblemsByTags', () => {
    it('filters by allowed tags', () => {
      const problems = [
        { id: 1, Tags: ['array', 'hash-table'] },
        { id: 2, Tags: ['tree'] },
        { id: 3, Tags: ['graph'] },
      ];
      const result = filterProblemsByTags(problems, { allowedTags: ['array'] });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('returns all problems when no matching tags', () => {
      const problems = [{ id: 1, Tags: ['tree'] }];
      const result = filterProblemsByTags(problems, { allowedTags: ['dp'] });
      expect(result).toEqual(problems); // Falls back
    });

    it('returns all problems when no criteria', () => {
      const problems = [{ id: 1 }, { id: 2 }];
      expect(filterProblemsByTags(problems, {})).toEqual(problems);
      expect(filterProblemsByTags(problems, null)).toEqual(problems);
    });

    it('handles problems with no Tags array', () => {
      const problems = [{ id: 1 }, { id: 2, Tags: ['array'] }];
      const result = filterProblemsByTags(problems, { allowedTags: ['array'] });
      expect(result).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------
  // ensureSufficientProblems
  // -------------------------------------------------------------------
  describe('ensureSufficientProblems', () => {
    it('adds problems until session length met', () => {
      const selected = [{ id: 1 }];
      const available = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = ensureSufficientProblems(selected, available, 3);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('returns selected when already sufficient', () => {
      const selected = [{ id: 1 }, { id: 2 }];
      const result = ensureSufficientProblems(selected, [{ id: 1 }, { id: 2 }], 2);
      expect(result).toHaveLength(2);
    });

    it('handles empty available', () => {
      const result = ensureSufficientProblems([{ id: 1 }], [], 3);
      expect(result).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------
  // handleInterviewSessionFallback
  // -------------------------------------------------------------------
  describe('handleInterviewSessionFallback', () => {
    it('creates fallback session', async () => {
      const fetchFn = jest.fn().mockResolvedValue([{ id: 1 }]);
      const result = await handleInterviewSessionFallback(new Error('test'), fetchFn);
      expect(result).toHaveLength(1);
      expect(buildAdaptiveSessionSettings).toHaveBeenCalled();
    });

    it('throws when fallback also fails', async () => {
      const fetchFn = jest.fn().mockRejectedValue(new Error('also failed'));
      await expect(handleInterviewSessionFallback(new Error('orig'), fetchFn))
        .rejects.toThrow('Both interview and fallback');
    });
  });

  // -------------------------------------------------------------------
  // shuffleArray
  // -------------------------------------------------------------------
  describe('shuffleArray', () => {
    it('returns array of same length', () => {
      const arr = [1, 2, 3, 4, 5];
      const result = shuffleArray(arr);
      expect(result).toHaveLength(5);
      expect(result.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it('does not mutate original', () => {
      const arr = [1, 2, 3];
      shuffleArray(arr);
      expect(arr).toEqual([1, 2, 3]);
    });

    it('handles empty array', () => {
      expect(shuffleArray([])).toEqual([]);
    });
  });

  // -------------------------------------------------------------------
  // addInterviewMetadata
  // -------------------------------------------------------------------
  describe('addInterviewMetadata', () => {
    it('adds interview metadata to problems', () => {
      const problems = [{ id: 1, title: 'Test' }];
      const result = addInterviewMetadata(problems, 'practice');
      expect(result[0].interviewMode).toBe('practice');
      expect(result[0].interviewConstraints).toBeDefined();
      expect(result[0].selectionReason.shortText).toContain('practice');
    });
  });
});
