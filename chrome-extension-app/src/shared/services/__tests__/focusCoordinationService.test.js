/**
 * CRITICAL RISK TEST: FocusCoordinationService - Session State Synchronization
 * Tests the critical onboarding->post-onboarding transition that affects session quality
 */

import { FocusCoordinationService } from '../focusCoordinationService';
import { TagService } from '../tagServices';
import { StorageService } from '../storageService';

// Mock all dependencies
jest.mock('../tagServices');
jest.mock('../storageService');
jest.mock('../../utils/escapeHatchUtils', () => ({
  detectApplicableEscapeHatches: jest.fn()
}));

describe('FocusCoordinationService - Session State Synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock default TagService response
    TagService.getCurrentTier.mockResolvedValue({
      focusTags: ['array', 'hash-table', 'stack'],
      masteryData: [],
      allTagsInCurrentTier: ['array', 'hash-table', 'stack', 'queue', 'linked-list']
    });

    TagService.checkFocusAreasGraduation.mockResolvedValue({
      needsUpdate: false
    });

    // Mock default settings
    StorageService.getSettings.mockResolvedValue({
      focusAreas: []
    });
  });

  describe('Onboarding Transition Bug Fix', () => {
    it('should correctly detect post-onboarding state when session count >= 3', async () => {
      // ARRANGE: User has completed 3 sessions (should be post-onboarding)
      const sessionState = {
        num_sessions_completed: 3,
        last_performance: { accuracy: 0.7, efficiency_score: 0.6 }
      };

      StorageService.getSessionState.mockResolvedValue(sessionState);

      const { detectApplicableEscapeHatches } = require('../../utils/escapeHatchUtils');
      detectApplicableEscapeHatches.mockResolvedValue({
        sessionBased: { applicable: false },
        attemptBased: [],
        timeBased: [],
        recommendations: []
      });

      // ACT: Get focus decision
      const result = await FocusCoordinationService.getFocusDecision('session_state');

      // ASSERT: Should be post-onboarding with multiple tags
      expect(result.onboarding).toBe(false);
      expect(result.activeFocusTags.length).toBeGreaterThan(1);
      expect(result.activeFocusTags).not.toEqual(['array']); // Should not fallback to single tag
    });

    it('should still use onboarding mode when session count < 3', async () => {
      // ARRANGE: User has completed only 2 sessions (should be onboarding)
      const sessionState = {
        num_sessions_completed: 2,
        last_performance: { accuracy: 0.7, efficiency_score: 0.6 }
      };

      StorageService.getSessionState.mockResolvedValue(sessionState);

      const { detectApplicableEscapeHatches } = require('../../utils/escapeHatchUtils');
      detectApplicableEscapeHatches.mockResolvedValue({
        sessionBased: { applicable: false },
        attemptBased: [],
        timeBased: [],
        recommendations: []
      });

      // ACT: Get focus decision
      const result = await FocusCoordinationService.getFocusDecision('session_state');

      // ASSERT: Should be onboarding with single tag
      expect(result.onboarding).toBe(true);
      expect(result.activeFocusTags.length).toBe(1);
    });

    it('should handle missing session state gracefully', async () => {
      // ARRANGE: Session state is null/undefined (new user)
      StorageService.getSessionState.mockResolvedValue(null);

      const { detectApplicableEscapeHatches } = require('../../utils/escapeHatchUtils');
      detectApplicableEscapeHatches.mockResolvedValue({
        sessionBased: { applicable: false },
        attemptBased: [],
        timeBased: [],
        recommendations: []
      });

      // ACT: Get focus decision
      const result = await FocusCoordinationService.getFocusDecision('session_state');

      // ASSERT: Should default to onboarding
      expect(result.onboarding).toBe(true);
      expect(result.activeFocusTags.length).toBe(1);
    });

    it('should use correct session state key passed as parameter', async () => {
      // ARRANGE: Test with different session state key
      const customSessionState = {
        num_sessions_completed: 5,
        last_performance: { accuracy: 0.8, efficiency_score: 0.7 }
      };

      StorageService.getSessionState.mockResolvedValue(customSessionState);

      const { detectApplicableEscapeHatches } = require('../../utils/escapeHatchUtils');
      detectApplicableEscapeHatches.mockResolvedValue({
        sessionBased: { applicable: false },
        attemptBased: [],
        timeBased: [],
        recommendations: []
      });

      // ACT: Call with custom key
      await FocusCoordinationService.getFocusDecision('custom_session_key');

      // ASSERT: Should have called getSessionState with the correct key
      expect(StorageService.getSessionState).toHaveBeenCalledWith('custom_session_key');
    });
  });

  describe('Performance-Based Tag Expansion', () => {
    it('should expand to multiple tags for good performance post-onboarding', async () => {
      // ARRANGE: Post-onboarding user with good performance
      const sessionState = {
        num_sessions_completed: 5,
        last_performance: { accuracy: 0.8, efficiency_score: 0.7 }
      };

      StorageService.getSessionState.mockResolvedValue(sessionState);

      const { detectApplicableEscapeHatches } = require('../../utils/escapeHatchUtils');
      detectApplicableEscapeHatches.mockResolvedValue({
        sessionBased: { applicable: false },
        attemptBased: [],
        timeBased: [],
        recommendations: []
      });

      // ACT: Get focus decision
      const result = await FocusCoordinationService.getFocusDecision('session_state');

      // ASSERT: Should expand to multiple tags based on excellent performance
      expect(result.onboarding).toBe(false);
      expect(result.activeFocusTags.length).toBeGreaterThanOrEqual(2);
      expect(result.performanceLevel).toBe('excellent');
    });

    it('should limit to fewer tags for developing performance', async () => {
      // ARRANGE: Post-onboarding user with developing performance
      const sessionState = {
        num_sessions_completed: 4,
        last_performance: { accuracy: 0.5, efficiency_score: 0.4 }
      };

      StorageService.getSessionState.mockResolvedValue(sessionState);

      const { detectApplicableEscapeHatches } = require('../../utils/escapeHatchUtils');
      detectApplicableEscapeHatches.mockResolvedValue({
        sessionBased: { applicable: false },
        attemptBased: [],
        timeBased: [],
        recommendations: []
      });

      // ACT: Get focus decision
      const result = await FocusCoordinationService.getFocusDecision('session_state');

      // ASSERT: Should use fewer tags for developing performance
      expect(result.onboarding).toBe(false);
      expect(result.activeFocusTags.length).toBeLessThanOrEqual(2);
      expect(result.performanceLevel).toBe('developing');
    });
  });

  describe('Error Handling', () => {
    it('should return failsafe decision when service throws error', async () => {
      // ARRANGE: StorageService throws error
      StorageService.getSessionState.mockRejectedValue(new Error('Storage error'));

      // ACT: Get focus decision
      const result = await FocusCoordinationService.getFocusDecision('session_state');

      // ASSERT: Should return failsafe decision
      expect(result.activeFocusTags).toEqual(['array']);
      expect(result.onboarding).toBe(true);
      expect(result.algorithmReasoning).toBe('Failsafe: Single focus area for stability');
    });

    it('should return failsafe decision when TagService fails', async () => {
      // ARRANGE: TagService throws error
      TagService.getCurrentTier.mockRejectedValue(new Error('Tag service error'));
      StorageService.getSessionState.mockResolvedValue({ num_sessions_completed: 3 });

      // ACT: Get focus decision
      const result = await FocusCoordinationService.getFocusDecision('session_state');

      // ASSERT: Should return failsafe decision
      expect(result.activeFocusTags).toEqual(['array']);
      expect(result.onboarding).toBe(true);
    });
  });
});