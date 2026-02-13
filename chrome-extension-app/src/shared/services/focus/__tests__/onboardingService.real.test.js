/**
 * onboardingService comprehensive tests.
 *
 * All external dependencies (DB stores, StorageService, helper imports)
 * are mocked so we can exercise every exported function in isolation.
 */

// ---------------------------------------------------------------------------
// 1. Mocks (hoisted before imports)
// ---------------------------------------------------------------------------
jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock('../../problem/problemladderService.js', () => ({
  initializePatternLaddersForOnboarding: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../db/stores/tag_relationships.js', () => ({
  buildTagRelationships: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../db/stores/standard_problems.js', () => ({
  insertStandardProblems: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../db/stores/strategy_data.js', () => ({
  insertStrategyData: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../relationshipService.js', () => ({
  buildProblemRelationships: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../storage/storageService.js', () => ({
  StorageService: {
    getSettings: jest.fn().mockResolvedValue({}),
    setSettings: jest.fn().mockResolvedValue({ status: 'success' }),
  },
}));

jest.mock('../../../db/core/common.js', () => ({
  getAllFromStore: jest.fn().mockResolvedValue([]),
  addRecord: jest.fn().mockResolvedValue(undefined),
  updateRecord: jest.fn().mockResolvedValue(undefined),
  getRecord: jest.fn().mockResolvedValue(null),
}));

// Mock the helpers module - keep SECTION_STEPS and factory functions real-like
jest.mock('../onboardingServiceHelpers.js', () => ({
  createDefaultAppOnboarding: jest.fn(() => ({
    id: 'app_onboarding',
    is_completed: false,
    current_step: 1,
    completed_steps: [],
    started_at: new Date().toISOString(),
    completed_at: null,
  })),
  createDefaultContentOnboarding: jest.fn(() => ({
    id: 'content_onboarding',
    is_completed: false,
    current_step: 1,
    completed_steps: [],
    started_at: new Date().toISOString(),
    completed_at: null,
    screenProgress: {
      intro: false,
      cmButton: false,
      navigation: false,
      generator: false,
      statistics: false,
      settings: false,
      problemTimer: false,
      strategyHints: false,
    },
    interactionProgress: {
      clickedCMButton: false,
      openedMenu: false,
      visitedGenerator: false,
      visitedStatistics: false,
      usedTimer: false,
    },
    page_progress: {
      probgen: false,
      probtime: false,
      timer: false,
      probstat: false,
      settings: false,
      timer_mini_tour: false,
    },
    lastActiveStep: null,
    resumeData: null,
  })),
  createDefaultPageProgress: jest.fn(() => ({
    probgen: false,
    probtime: false,
    timer: false,
    probstat: false,
    settings: false,
    timer_mini_tour: false,
  })),
  getCurrentUrlSafely: jest.fn(() => 'http://localhost/test'),
  SECTION_STEPS: {
    cmButton: 2,
    navigation: 3,
    generator: 4,
    statistics: 5,
    settings: 6,
    problemTimer: 7,
    strategyHints: 8,
  },
  initializeDebugConsoleCommands: jest.fn(),
}));

// ---------------------------------------------------------------------------
// 2. Imports (run after mocks are applied)
// ---------------------------------------------------------------------------
import {
  onboardUserIfNeeded,
  checkOnboardingStatus,
  updateOnboardingProgress,
  completeOnboarding,
  resetOnboarding,
  checkContentOnboardingStatus,
  completeContentOnboarding,
  updateContentOnboardingStep,
  getResumeStep,
  skipToSection,
  resetContentOnboarding,
  checkPageTourStatus,
  markPageTourCompleted,
  resetPageTour,
  resetAllPageTours,
} from '../onboardingService.js';

import { getAllFromStore, addRecord, updateRecord, getRecord } from '../../../db/core/common.js';
import { StorageService } from '../../storage/storageService.js';
import { insertStandardProblems } from '../../../db/stores/standard_problems.js';
import { insertStrategyData } from '../../../db/stores/strategy_data.js';
import { buildTagRelationships } from '../../../db/stores/tag_relationships.js';
import { buildProblemRelationships } from '../relationshipService.js';
import { initializePatternLaddersForOnboarding } from '../../problem/problemladderService.js';
import { createDefaultContentOnboarding, createDefaultPageProgress } from '../onboardingServiceHelpers.js';

// ---------------------------------------------------------------------------
// 3. Tests
// ---------------------------------------------------------------------------
describe('onboardingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // onboardUserIfNeeded
  // =========================================================================
  describe('onboardUserIfNeeded', () => {
    it('should skip onboarding when all data is present', async () => {
      getAllFromStore.mockResolvedValue([{ id: 1 }]);

      const result = await onboardUserIfNeeded();

      expect(result).toEqual({ success: true, message: 'All data present' });
    });

    it('should seed standard data when standard data is missing', async () => {
      // First 6 calls: problem_relationships, standard_problems, problems, tag_mastery, tag_relationships, strategy_data
      // standard_problems empty triggers seedStandardData
      getAllFromStore
        .mockResolvedValueOnce([])  // problem_relationships - empty
        .mockResolvedValueOnce([])  // standard_problems - empty
        .mockResolvedValueOnce([{ id: 1 }])  // problems - present
        .mockResolvedValueOnce([{ id: 1 }])  // tag_mastery - present
        .mockResolvedValueOnce([])  // tag_relationships - empty
        .mockResolvedValueOnce([])  // strategy_data - empty
        // After seeding, validation call
        .mockResolvedValueOnce([{ id: 1 }]); // standard_problems after seed

      const result = await onboardUserIfNeeded();

      expect(result).toEqual({ success: true, message: 'Onboarding completed' });
      expect(insertStandardProblems).toHaveBeenCalled();
      expect(insertStrategyData).toHaveBeenCalled();
      expect(buildTagRelationships).toHaveBeenCalled();
      expect(buildProblemRelationships).toHaveBeenCalled();
    });

    it('should seed user data when user data is missing', async () => {
      getAllFromStore
        .mockResolvedValueOnce([{ id: 1 }])  // problem_relationships
        .mockResolvedValueOnce([{ id: 1 }])  // standard_problems
        .mockResolvedValueOnce([])            // problems - empty
        .mockResolvedValueOnce([])            // tag_mastery - empty
        .mockResolvedValueOnce([{ id: 1 }])  // tag_relationships
        .mockResolvedValueOnce([{ id: 1 }]); // strategy_data

      const result = await onboardUserIfNeeded();

      expect(result).toEqual({ success: true, message: 'Onboarding completed' });
      expect(initializePatternLaddersForOnboarding).toHaveBeenCalled();
    });

    it('should seed both standard and user data when both are missing', async () => {
      getAllFromStore
        .mockResolvedValueOnce([])  // problem_relationships
        .mockResolvedValueOnce([])  // standard_problems
        .mockResolvedValueOnce([])  // problems
        .mockResolvedValueOnce([])  // tag_mastery
        .mockResolvedValueOnce([])  // tag_relationships
        .mockResolvedValueOnce([])  // strategy_data
        // After seeding validation
        .mockResolvedValueOnce([{ id: 1 }]); // standard_problems after seed

      const result = await onboardUserIfNeeded();

      expect(result).toEqual({ success: true, message: 'Onboarding completed' });
      expect(insertStandardProblems).toHaveBeenCalled();
      expect(initializePatternLaddersForOnboarding).toHaveBeenCalled();
    });

    it('should return success with warning on error', async () => {
      getAllFromStore.mockRejectedValue(new Error('DB error'));

      const result = await onboardUserIfNeeded();

      expect(result.success).toBe(true);
      expect(result.warning).toBe(true);
      expect(result.message).toContain('DB error');
    });

    it('should log critical error when standard problems are still empty after seeding', async () => {
      const logger = (await import('../../../utils/logging/logger.js')).default;
      getAllFromStore
        .mockResolvedValueOnce([])  // problem_relationships
        .mockResolvedValueOnce([])  // standard_problems
        .mockResolvedValueOnce([{ id: 1 }])  // problems
        .mockResolvedValueOnce([{ id: 1 }])  // tag_mastery
        .mockResolvedValueOnce([])  // tag_relationships
        .mockResolvedValueOnce([])  // strategy_data
        // Validation after seed - still empty
        .mockResolvedValueOnce([]); // standard_problems after seed - still empty!

      await onboardUserIfNeeded();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Standard problems still empty after seeding')
      );
    });

    it('should retry standard problems seeding if first attempt fails', async () => {
      getAllFromStore
        .mockResolvedValueOnce([])  // problem_relationships
        .mockResolvedValueOnce([])  // standard_problems
        .mockResolvedValueOnce([{ id: 1 }])  // problems
        .mockResolvedValueOnce([{ id: 1 }])  // tag_mastery
        .mockResolvedValueOnce([{ id: 1 }])  // tag_relationships
        .mockResolvedValueOnce([{ id: 1 }])  // strategy_data
        // Validation after seed
        .mockResolvedValueOnce([{ id: 1 }]);

      // First insertStandardProblems call fails, second succeeds
      insertStandardProblems
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(undefined);

      const result = await onboardUserIfNeeded();

      expect(result.success).toBe(true);
      // insertStandardProblems should be called twice (initial + retry)
      expect(insertStandardProblems).toHaveBeenCalledTimes(2);
    });

    it('should initialize user settings when user data is missing', async () => {
      getAllFromStore
        .mockResolvedValueOnce([{ id: 1 }])  // problem_relationships
        .mockResolvedValueOnce([{ id: 1 }])  // standard_problems
        .mockResolvedValueOnce([])            // problems
        .mockResolvedValueOnce([])            // tag_mastery
        .mockResolvedValueOnce([{ id: 1 }])  // tag_relationships
        .mockResolvedValueOnce([{ id: 1 }]); // strategy_data

      await onboardUserIfNeeded();

      expect(StorageService.getSettings).toHaveBeenCalled();
      expect(StorageService.setSettings).toHaveBeenCalled();
    });

    it('should skip settings initialization when settings already exist', async () => {
      StorageService.getSettings.mockResolvedValue({
        theme: 'dark',
        focusAreas: ['arrays'],
      });

      getAllFromStore
        .mockResolvedValueOnce([{ id: 1 }])  // problem_relationships
        .mockResolvedValueOnce([{ id: 1 }])  // standard_problems
        .mockResolvedValueOnce([])            // problems
        .mockResolvedValueOnce([])            // tag_mastery
        .mockResolvedValueOnce([{ id: 1 }])  // tag_relationships
        .mockResolvedValueOnce([{ id: 1 }]); // strategy_data

      await onboardUserIfNeeded();

      expect(StorageService.getSettings).toHaveBeenCalled();
      // setSettings should NOT be called since settings already exist
      expect(StorageService.setSettings).not.toHaveBeenCalled();
    });

    it('should handle settings initialization failure gracefully', async () => {
      StorageService.getSettings.mockRejectedValue(new Error('Storage error'));

      getAllFromStore
        .mockResolvedValueOnce([{ id: 1 }])  // problem_relationships
        .mockResolvedValueOnce([{ id: 1 }])  // standard_problems
        .mockResolvedValueOnce([])            // problems
        .mockResolvedValueOnce([])            // tag_mastery
        .mockResolvedValueOnce([{ id: 1 }])  // tag_relationships
        .mockResolvedValueOnce([{ id: 1 }]); // strategy_data

      // Should not throw - settings failure is non-critical
      const result = await onboardUserIfNeeded();
      expect(result.success).toBe(true);
    });

    it('should log failure when setSettings returns non-success status', async () => {
      const logger = (await import('../../../utils/logging/logger.js')).default;
      StorageService.getSettings.mockResolvedValue({});
      StorageService.setSettings.mockResolvedValue({ status: 'error' });

      getAllFromStore
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ id: 1 }]);

      await onboardUserIfNeeded();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize user settings'),
        expect.anything()
      );
    });
  });

  // =========================================================================
  // checkOnboardingStatus
  // =========================================================================
  describe('checkOnboardingStatus', () => {
    it('should return existing app onboarding record', async () => {
      const existingRecord = {
        id: 'app_onboarding',
        is_completed: true,
        current_step: 4,
      };
      getRecord.mockResolvedValue(existingRecord);

      const result = await checkOnboardingStatus();

      expect(result).toEqual(existingRecord);
      expect(getRecord).toHaveBeenCalledWith('settings', 'app_onboarding');
    });

    it('should create and return new record when none exists', async () => {
      getRecord.mockResolvedValue(null);

      const result = await checkOnboardingStatus();

      expect(result.id).toBe('app_onboarding');
      expect(result.is_completed).toBe(false);
      expect(addRecord).toHaveBeenCalledWith('settings', expect.objectContaining({
        id: 'app_onboarding',
      }));
    });

    it('should return default record on error', async () => {
      getRecord.mockRejectedValue(new Error('DB error'));

      const result = await checkOnboardingStatus();

      expect(result.id).toBe('app_onboarding');
      expect(result.is_completed).toBe(false);
    });
  });

  // =========================================================================
  // updateOnboardingProgress
  // =========================================================================
  describe('updateOnboardingProgress', () => {
    it('should update progress for a step', async () => {
      getRecord.mockResolvedValue({
        id: 'app_onboarding',
        completed_steps: [],
        current_step: 1,
      });

      const result = await updateOnboardingProgress(2);

      expect(result.completed_steps).toContain(2);
      expect(result.current_step).toBe(3);
      expect(updateRecord).toHaveBeenCalledWith('settings', 'app_onboarding', expect.anything());
    });

    it('should not duplicate completed steps', async () => {
      getRecord.mockResolvedValue({
        id: 'app_onboarding',
        completed_steps: [2],
        current_step: 3,
      });

      const result = await updateOnboardingProgress(2);

      expect(result.completed_steps).toEqual([2]);
    });

    it('should cap current_step at 4', async () => {
      getRecord.mockResolvedValue({
        id: 'app_onboarding',
        completed_steps: [1, 2, 3],
        current_step: 3,
      });

      const result = await updateOnboardingProgress(4);

      expect(result.current_step).toBe(4);
    });

    it('should throw when no onboarding record exists', async () => {
      getRecord.mockResolvedValue(null);

      await expect(updateOnboardingProgress(1)).rejects.toThrow(
        'App onboarding settings not found'
      );
    });
  });

  // =========================================================================
  // completeOnboarding
  // =========================================================================
  describe('completeOnboarding', () => {
    it('should mark onboarding as completed', async () => {
      getRecord.mockResolvedValue({
        id: 'app_onboarding',
        is_completed: false,
        completed_steps: [1, 2],
      });

      const result = await completeOnboarding();

      expect(result.is_completed).toBe(true);
      expect(result.current_step).toBe(4);
      expect(result.completed_steps).toEqual([1, 2, 3, 4]);
      expect(result.completed_at).toBeDefined();
      expect(updateRecord).toHaveBeenCalled();
    });

    it('should throw when no onboarding record exists', async () => {
      getRecord.mockResolvedValue(null);

      await expect(completeOnboarding()).rejects.toThrow(
        'App onboarding settings not found'
      );
    });
  });

  // =========================================================================
  // resetOnboarding
  // =========================================================================
  describe('resetOnboarding', () => {
    it('should reset onboarding to defaults', async () => {
      const result = await resetOnboarding();

      expect(result.id).toBe('app_onboarding');
      expect(result.is_completed).toBe(false);
      expect(result.current_step).toBe(1);
      expect(updateRecord).toHaveBeenCalledWith('settings', 'app_onboarding', expect.anything());
    });
  });

  // =========================================================================
  // checkContentOnboardingStatus
  // =========================================================================
  describe('checkContentOnboardingStatus', () => {
    it('should return existing content onboarding record', async () => {
      const existingRecord = {
        id: 'content_onboarding',
        is_completed: false,
        current_step: 3,
        page_progress: { probgen: true },
      };
      getRecord.mockResolvedValue(existingRecord);

      const result = await checkContentOnboardingStatus();

      expect(result).toEqual(existingRecord);
    });

    it('should fix missing page_progress in existing record', async () => {
      const existingRecord = {
        id: 'content_onboarding',
        is_completed: false,
        current_step: 3,
        // page_progress is missing
      };
      getRecord.mockResolvedValue(existingRecord);

      const result = await checkContentOnboardingStatus();

      expect(result.page_progress).toBeDefined();
      expect(updateRecord).toHaveBeenCalled();
    });

    it('should create new record when none exists', async () => {
      getRecord.mockResolvedValue(null);

      const result = await checkContentOnboardingStatus();

      expect(result.id).toBe('content_onboarding');
      expect(result.is_completed).toBe(false);
      expect(addRecord).toHaveBeenCalledWith('settings', expect.objectContaining({
        id: 'content_onboarding',
      }));
    });

    it('should return default on error', async () => {
      getRecord.mockRejectedValue(new Error('DB error'));

      const result = await checkContentOnboardingStatus();

      expect(result.id).toBe('content_onboarding');
      expect(result.is_completed).toBe(false);
    });
  });

  // =========================================================================
  // completeContentOnboarding
  // =========================================================================
  describe('completeContentOnboarding', () => {
    it('should mark content onboarding as completed', async () => {
      getRecord.mockResolvedValue({
        id: 'content_onboarding',
        is_completed: false,
        current_step: 3,
        completed_steps: [1, 2, 3],
        screenProgress: {
          intro: false,
          cmButton: false,
          navigation: false,
          generator: false,
          statistics: false,
          settings: false,
          problemTimer: false,
          strategyHints: false,
        },
      });

      const result = await completeContentOnboarding();

      expect(result.is_completed).toBe(true);
      expect(result.current_step).toBe(9);
      expect(result.completed_steps).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(result.completed_at).toBeDefined();
      // All screens should be marked completed
      Object.values(result.screenProgress).forEach((val) => {
        expect(val).toBe(true);
      });
    });

    it('should throw when no record exists', async () => {
      getRecord.mockResolvedValue(null);

      await expect(completeContentOnboarding()).rejects.toThrow(
        'Content onboarding settings not found'
      );
    });
  });

  // =========================================================================
  // updateContentOnboardingStep
  // =========================================================================
  describe('updateContentOnboardingStep', () => {
    const mockContentRecord = () => ({
      id: 'content_onboarding',
      is_completed: false,
      current_step: 1,
      completed_steps: [],
      lastActiveStep: null,
      screenProgress: {
        intro: false,
        cmButton: false,
        navigation: false,
        generator: false,
        statistics: false,
        settings: false,
        problemTimer: false,
        strategyHints: false,
      },
      interactionProgress: {
        clickedCMButton: false,
        openedMenu: false,
        visitedGenerator: false,
        visitedStatistics: false,
        usedTimer: false,
      },
      resumeData: null,
    });

    it('should update step progress', async () => {
      getRecord.mockResolvedValue(mockContentRecord());

      const result = await updateContentOnboardingStep(3);

      expect(result.completed_steps).toContain(3);
      expect(result.current_step).toBe(4);
      expect(result.lastActiveStep).toBe(3);
      expect(result.resumeData).toBeDefined();
      expect(result.resumeData.screenKey).toBeNull();
    });

    it('should not duplicate completed steps', async () => {
      const record = mockContentRecord();
      record.completed_steps = [3];
      getRecord.mockResolvedValue(record);

      const result = await updateContentOnboardingStep(3);

      expect(result.completed_steps).toEqual([3]);
    });

    it('should cap current_step at 9', async () => {
      const record = mockContentRecord();
      record.completed_steps = [1, 2, 3, 4, 5, 6, 7, 8];
      getRecord.mockResolvedValue(record);

      const result = await updateContentOnboardingStep(9);

      expect(result.current_step).toBe(9);
    });

    it('should update screen progress when screenKey provided', async () => {
      getRecord.mockResolvedValue(mockContentRecord());

      const result = await updateContentOnboardingStep(2, 'cmButton');

      expect(result.screenProgress.cmButton).toBe(true);
    });

    it('should update interaction progress when interactionKey provided', async () => {
      getRecord.mockResolvedValue(mockContentRecord());

      const result = await updateContentOnboardingStep(2, null, 'clickedCMButton');

      expect(result.interactionProgress.clickedCMButton).toBe(true);
    });

    it('should ignore invalid screenKey', async () => {
      getRecord.mockResolvedValue(mockContentRecord());

      const result = await updateContentOnboardingStep(2, 'nonExistentScreen');

      expect(result.screenProgress).not.toHaveProperty('nonExistentScreen');
    });

    it('should ignore invalid interactionKey', async () => {
      getRecord.mockResolvedValue(mockContentRecord());

      const result = await updateContentOnboardingStep(2, null, 'nonExistentInteraction');

      expect(result.interactionProgress).not.toHaveProperty('nonExistentInteraction');
    });

    it('should set resumeData with timestamp and URL', async () => {
      getRecord.mockResolvedValue(mockContentRecord());

      const result = await updateContentOnboardingStep(2, 'cmButton', 'clickedCMButton');

      expect(result.resumeData.timestamp).toBeDefined();
      expect(result.resumeData.currentUrl).toBeDefined();
      expect(result.resumeData.screenKey).toBe('cmButton');
      expect(result.resumeData.interactionKey).toBe('clickedCMButton');
    });

    it('should throw when no record exists', async () => {
      getRecord.mockResolvedValue(null);

      await expect(updateContentOnboardingStep(1)).rejects.toThrow(
        'Content onboarding settings not found'
      );
    });
  });

  // =========================================================================
  // getResumeStep
  // =========================================================================
  describe('getResumeStep', () => {
    it('should return null when onboarding is completed', async () => {
      getRecord.mockResolvedValue({
        id: 'content_onboarding',
        is_completed: true,
        current_step: 9,
        completed_steps: [1, 2, 3, 4, 5, 6, 7, 8],
        page_progress: {},
        screenProgress: {},
      });

      const result = await getResumeStep();
      expect(result).toBeNull();
    });

    it('should return 1 when no screens are completed', async () => {
      getRecord.mockResolvedValue({
        id: 'content_onboarding',
        is_completed: false,
        current_step: 1,
        completed_steps: [],
        page_progress: {},
        screenProgress: {
          intro: false,
          cmButton: false,
          navigation: false,
          generator: false,
          statistics: false,
          settings: false,
          problemTimer: false,
          strategyHints: false,
        },
      });

      const result = await getResumeStep();
      expect(result).toBe(1);
    });

    it('should return 2 when cmButton is not completed', async () => {
      getRecord.mockResolvedValue({
        id: 'content_onboarding',
        is_completed: false,
        current_step: 1,
        completed_steps: [1],
        page_progress: {},
        screenProgress: {
          intro: true,
          cmButton: false,
          navigation: false,
          generator: false,
          statistics: false,
          settings: false,
          problemTimer: false,
          strategyHints: false,
        },
      });

      const result = await getResumeStep();
      expect(result).toBe(2);
    });

    it('should return 3 when navigation is not completed', async () => {
      getRecord.mockResolvedValue({
        id: 'content_onboarding',
        is_completed: false,
        current_step: 2,
        completed_steps: [1, 2],
        page_progress: {},
        screenProgress: {
          intro: true,
          cmButton: true,
          navigation: false,
          generator: false,
          statistics: false,
          settings: false,
          problemTimer: false,
          strategyHints: false,
        },
      });

      const result = await getResumeStep();
      expect(result).toBe(3);
    });

    it('should return step for each uncompleted screen in order', async () => {
      const baseRecord = {
        id: 'content_onboarding',
        is_completed: false,
        current_step: 1,
        completed_steps: [],
        page_progress: {},
      };

      // Test each screen path step 4-8
      const screens = ['generator', 'statistics', 'settings', 'problemTimer', 'strategyHints'];
      const expectedSteps = [4, 5, 6, 7, 8];

      for (let i = 0; i < screens.length; i++) {
        jest.clearAllMocks();
        const screenProgress = {
          intro: true,
          cmButton: true,
          navigation: true,
          generator: false,
          statistics: false,
          settings: false,
          problemTimer: false,
          strategyHints: false,
        };
        // Mark all screens before this one as completed
        for (let j = 0; j < i; j++) {
          screenProgress[screens[j]] = true;
        }

        getRecord.mockResolvedValue({
          ...baseRecord,
          screenProgress,
        });

        const result = await getResumeStep();
        expect(result).toBe(expectedSteps[i]);
      }
    });

    it('should return current_step when all screens are completed', async () => {
      getRecord.mockResolvedValue({
        id: 'content_onboarding',
        is_completed: false,
        current_step: 5,
        completed_steps: [1, 2, 3, 4, 5, 6, 7],
        page_progress: {},
        screenProgress: {
          intro: true,
          cmButton: true,
          navigation: true,
          generator: true,
          statistics: true,
          settings: true,
          problemTimer: true,
          strategyHints: true,
        },
      });

      const result = await getResumeStep();
      expect(result).toBe(5);
    });
  });

  // =========================================================================
  // skipToSection
  // =========================================================================
  describe('skipToSection', () => {
    it('should skip to a valid section', async () => {
      getRecord.mockResolvedValue({
        id: 'content_onboarding',
        is_completed: false,
        current_step: 1,
        completed_steps: [],
        lastActiveStep: null,
        screenProgress: {
          intro: false,
          cmButton: false,
          navigation: false,
          generator: false,
          statistics: false,
          settings: false,
          problemTimer: false,
          strategyHints: false,
        },
        interactionProgress: {
          clickedCMButton: false,
          openedMenu: false,
          visitedGenerator: false,
          visitedStatistics: false,
          usedTimer: false,
        },
        resumeData: null,
      });

      const result = await skipToSection('generator');

      // generator is step 4, so updateContentOnboardingStep(3, 'generator')
      expect(result.completed_steps).toContain(3);
      expect(result.screenProgress.generator).toBe(true);
    });

    it('should return status when invalid section provided', async () => {
      getRecord.mockResolvedValue({
        id: 'content_onboarding',
        is_completed: false,
        current_step: 1,
        completed_steps: [],
        page_progress: {},
        screenProgress: {
          intro: false,
          cmButton: false,
          navigation: false,
          generator: false,
          statistics: false,
          settings: false,
          problemTimer: false,
          strategyHints: false,
        },
      });

      const result = await skipToSection('invalidSection');

      // Should just return checkContentOnboardingStatus result
      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // resetContentOnboarding
  // =========================================================================
  describe('resetContentOnboarding', () => {
    it('should reset content onboarding to defaults', async () => {
      const result = await resetContentOnboarding();

      expect(result.id).toBe('content_onboarding');
      expect(result.is_completed).toBe(false);
      expect(updateRecord).toHaveBeenCalledWith('settings', 'content_onboarding', expect.anything());
    });

    it('should throw on error', async () => {
      updateRecord.mockRejectedValueOnce(new Error('DB error'));

      await expect(resetContentOnboarding()).rejects.toThrow('DB error');
    });
  });

  // =========================================================================
  // checkPageTourStatus
  // =========================================================================
  describe('checkPageTourStatus', () => {
    it('should return false when no record exists', async () => {
      getRecord.mockResolvedValue(null);

      const result = await checkPageTourStatus('probgen');
      expect(result).toBe(false);
    });

    it('should return completion status for a page', async () => {
      getRecord.mockResolvedValue({
        id: 'content_onboarding',
        page_progress: { probgen: true, probtime: false },
      });

      expect(await checkPageTourStatus('probgen')).toBe(true);
      getRecord.mockResolvedValue({
        id: 'content_onboarding',
        page_progress: { probgen: true, probtime: false },
      });
      expect(await checkPageTourStatus('probtime')).toBe(false);
    });

    it('should initialize missing page_progress', async () => {
      getRecord.mockResolvedValue({
        id: 'content_onboarding',
        // page_progress is missing
      });

      const result = await checkPageTourStatus('probgen');

      expect(result).toBe(false);
      expect(updateRecord).toHaveBeenCalled();
    });

    it('should return false on error', async () => {
      getRecord.mockRejectedValue(new Error('DB error'));

      const result = await checkPageTourStatus('probgen');
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // markPageTourCompleted
  // =========================================================================
  describe('markPageTourCompleted', () => {
    it('should mark a page tour as completed', async () => {
      getRecord.mockResolvedValue({
        id: 'content_onboarding',
        page_progress: { probgen: false, probtime: false },
      });

      const result = await markPageTourCompleted('probgen');

      expect(result.page_progress.probgen).toBe(true);
      expect(result.lastActiveStep).toBe('page_probgen_completed');
      expect(updateRecord).toHaveBeenCalled();
    });

    it('should create new record if none exists', async () => {
      getRecord.mockResolvedValue(null);

      const result = await markPageTourCompleted('probgen');

      expect(addRecord).toHaveBeenCalled();
      expect(result.page_progress.probgen).toBe(true);
    });

    it('should initialize page_progress if missing', async () => {
      getRecord.mockResolvedValue({
        id: 'content_onboarding',
        // page_progress is missing
      });

      const result = await markPageTourCompleted('probgen');

      expect(result.page_progress).toBeDefined();
      expect(result.page_progress.probgen).toBe(true);
    });

    it('should throw on error', async () => {
      getRecord.mockRejectedValue(new Error('DB error'));

      await expect(markPageTourCompleted('probgen')).rejects.toThrow('DB error');
    });
  });

  // =========================================================================
  // resetPageTour
  // =========================================================================
  describe('resetPageTour', () => {
    it('should reset a specific page tour', async () => {
      getRecord.mockResolvedValue({
        id: 'content_onboarding',
        page_progress: { probgen: true, probtime: true },
      });

      const result = await resetPageTour('probgen');

      expect(result.page_progress.probgen).toBe(false);
      expect(updateRecord).toHaveBeenCalled();
    });

    it('should handle missing record gracefully', async () => {
      getRecord.mockResolvedValue(null);

      const result = await resetPageTour('probgen');
      expect(result).toBeNull();
    });

    it('should create page_progress if missing', async () => {
      getRecord.mockResolvedValue({
        id: 'content_onboarding',
      });

      const result = await resetPageTour('probgen');
      expect(result.page_progress.probgen).toBe(false);
    });

    it('should throw on error', async () => {
      getRecord.mockRejectedValue(new Error('DB error'));

      await expect(resetPageTour('probgen')).rejects.toThrow('DB error');
    });
  });

  // =========================================================================
  // resetAllPageTours
  // =========================================================================
  describe('resetAllPageTours', () => {
    it('should reset all page tours to defaults', async () => {
      getRecord.mockResolvedValue({
        id: 'content_onboarding',
        page_progress: { probgen: true, probtime: true, timer: true },
      });

      const result = await resetAllPageTours();

      expect(result.page_progress.probgen).toBe(false);
      expect(result.page_progress.probtime).toBe(false);
      expect(result.page_progress.timer).toBe(false);
      expect(updateRecord).toHaveBeenCalled();
    });

    it('should handle missing record gracefully', async () => {
      getRecord.mockResolvedValue(null);

      const result = await resetAllPageTours();
      expect(result).toBeNull();
    });

    it('should throw on error', async () => {
      getRecord.mockRejectedValue(new Error('DB error'));

      await expect(resetAllPageTours()).rejects.toThrow('DB error');
    });
  });
});
