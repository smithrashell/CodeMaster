/**
 * Tests for onboardingServiceHelpers.js (68 lines, 0% coverage)
 */

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import {
  DEFAULT_SCREEN_PROGRESS,
  DEFAULT_INTERACTION_PROGRESS,
  DEFAULT_PAGE_PROGRESS,
  SECTION_STEPS,
  createDefaultAppOnboarding,
  createDefaultContentOnboarding,
  createDefaultPageProgress,
  getCurrentUrlSafely,
  debugCheckAllPagesStatus,
  debugGetFullOnboardingRecord,
  debugTestPageCompletion,
  debugTestAllPagesCompletion,
  initializeDebugConsoleCommands,
} from '../onboardingServiceHelpers.js';

describe('onboardingServiceHelpers', () => {
  describe('constants', () => {
    it('DEFAULT_SCREEN_PROGRESS has correct keys', () => {
      expect(DEFAULT_SCREEN_PROGRESS).toHaveProperty('intro');
      expect(DEFAULT_SCREEN_PROGRESS).toHaveProperty('generator');
      expect(DEFAULT_SCREEN_PROGRESS).toHaveProperty('settings');
    });

    it('DEFAULT_INTERACTION_PROGRESS has correct keys', () => {
      expect(DEFAULT_INTERACTION_PROGRESS).toHaveProperty('clickedCMButton');
      expect(DEFAULT_INTERACTION_PROGRESS).toHaveProperty('usedTimer');
    });

    it('DEFAULT_PAGE_PROGRESS has correct keys', () => {
      expect(DEFAULT_PAGE_PROGRESS).toHaveProperty('probgen');
      expect(DEFAULT_PAGE_PROGRESS).toHaveProperty('timer');
    });

    it('SECTION_STEPS maps correctly', () => {
      expect(SECTION_STEPS.cmButton).toBe(2);
      expect(SECTION_STEPS.strategyHints).toBe(8);
    });
  });

  describe('createDefaultAppOnboarding', () => {
    it('returns correct default structure', () => {
      const result = createDefaultAppOnboarding();
      expect(result.id).toBe('app_onboarding');
      expect(result.is_completed).toBe(false);
      expect(result.current_step).toBe(1);
      expect(result.completed_steps).toEqual([]);
      expect(result.started_at).toBeDefined();
    });
  });

  describe('createDefaultContentOnboarding', () => {
    it('returns correct default structure', () => {
      const result = createDefaultContentOnboarding();
      expect(result.id).toBe('content_onboarding');
      expect(result.is_completed).toBe(false);
      expect(result.screenProgress).toBeDefined();
      expect(result.interactionProgress).toBeDefined();
      expect(result.page_progress).toBeDefined();
    });
  });

  describe('createDefaultPageProgress', () => {
    it('returns copy of DEFAULT_PAGE_PROGRESS', () => {
      const result = createDefaultPageProgress();
      expect(result).toEqual(DEFAULT_PAGE_PROGRESS);
      expect(result).not.toBe(DEFAULT_PAGE_PROGRESS); // separate copy
    });
  });

  describe('getCurrentUrlSafely', () => {
    it('returns URL from window.location in jsdom', () => {
      const url = getCurrentUrlSafely();
      expect(typeof url).toBe('string');
    });
  });

  describe('debugCheckAllPagesStatus', () => {
    it('checks all 5 pages', async () => {
      const checkFn = jest.fn().mockResolvedValue(true);
      const result = await debugCheckAllPagesStatus(checkFn);
      expect(checkFn).toHaveBeenCalledTimes(5);
      expect(result.probgen).toBe(true);
      expect(result.timer).toBe(true);
    });

    it('handles per-page errors', async () => {
      const checkFn = jest.fn().mockRejectedValue(new Error('fail'));
      const result = await debugCheckAllPagesStatus(checkFn);
      expect(result.probgen).toContain('ERROR');
    });
  });

  describe('debugGetFullOnboardingRecord', () => {
    it('returns the onboarding record', async () => {
      const checkFn = jest.fn().mockResolvedValue({ id: 'content_onboarding' });
      const result = await debugGetFullOnboardingRecord(checkFn);
      expect(result.id).toBe('content_onboarding');
    });

    it('throws on error', async () => {
      const checkFn = jest.fn().mockRejectedValue(new Error('fail'));
      await expect(debugGetFullOnboardingRecord(checkFn)).rejects.toThrow('fail');
    });
  });

  describe('debugTestPageCompletion', () => {
    it('tests page completion cycle', async () => {
      const checkFn = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const markFn = jest.fn().mockResolvedValue(undefined);
      const result = await debugTestPageCompletion('timer', checkFn, markFn);
      expect(result.pageId).toBe('timer');
      expect(result.success).toBe(true);
    });
  });

  describe('debugTestAllPagesCompletion', () => {
    it('tests all pages', async () => {
      const checkFn = jest.fn().mockResolvedValue(true);
      const markFn = jest.fn().mockResolvedValue(undefined);
      const result = await debugTestAllPagesCompletion(checkFn, markFn);
      expect(result.summary.total).toBe(5);
      expect(result.summary.passed).toBe(5);
    });

    it('handles per-page errors', async () => {
      const checkFn = jest.fn().mockRejectedValue(new Error('fail'));
      const markFn = jest.fn();
      const result = await debugTestAllPagesCompletion(checkFn, markFn);
      expect(result.summary.failed).toBe(5);
    });
  });

  describe('initializeDebugConsoleCommands', () => {
    it('attaches debug commands to window', () => {
      initializeDebugConsoleCommands(jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn());
      expect(window.debugOnboarding).toBeDefined();
      expect(typeof window.debugOnboarding.checkAllPagesStatus).toBe('function');
      expect(typeof window.debugOnboarding.testAllPages).toBe('function');
    });
  });
});
