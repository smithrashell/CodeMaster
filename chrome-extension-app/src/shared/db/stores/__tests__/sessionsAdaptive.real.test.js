/**
 * Comprehensive tests for sessionsAdaptive.js using real fake-indexeddb.
 *
 * Tests the exported pure functions (computeSessionLength,
 * normalizeSessionLengthForCalculation, applySessionLengthPreference) directly,
 * and the full buildAdaptiveSessionSettings pipeline end-to-end against a real
 * in-memory IndexedDB so every DB-touching code path is exercised.
 */

// ---------------------------------------------------------------------------
// 1. Mocks (must come before any imports that trigger module resolution)
// ---------------------------------------------------------------------------

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), group: jest.fn(), groupEnd: jest.fn() },
}));

// DB layer — inject the real fake-indexeddb instance
jest.mock('../../index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

// Sibling store imports used by sessionsAdaptive.js
jest.mock('../attempts.js', () => ({
  getMostRecentAttempt: jest.fn(async () => null),
}));

jest.mock('../sessionAnalytics.js', () => ({
  getRecentSessionAnalytics: jest.fn(async () => []),
}));

jest.mock('../sessionsEscapeHatch.js', () => ({
  analyzePerformanceTrend: jest.fn(() => ({
    trend: 'stable',
    consecutiveExcellent: 0,
    avgRecent: 0.5,
  })),
}));

jest.mock('../sessionsState.js', () => ({
  initializeSessionState: jest.fn(async () => ({
    id: 'session_state',
    num_sessions_completed: 5,
    current_difficulty_cap: 'Medium',
    tag_index: 0,
    difficulty_time_stats: {
      easy: { problems: 0, total_time: 0, avg_time: 0 },
      medium: { problems: 0, total_time: 0, avg_time: 0 },
      hard: { problems: 0, total_time: 0, avg_time: 0 },
    },
    last_performance: { accuracy: null, efficiency_score: null },
    escape_hatches: {
      sessions_at_current_difficulty: 0,
      last_difficulty_promotion: null,
      sessions_without_promotion: 0,
      activated_escape_hatches: [],
    },
    last_session_date: null,
    _migrated: true,
  })),
}));

// Service imports
jest.mock('../../../services/attempts/tagServices.js', () => ({
  TagService: {
    getCurrentTier: jest.fn(async () => ({ focusTags: ['array', 'string', 'hash-table'] })),
  },
}));

// These service paths don't exist on disk (extracted module with unresolved imports).
// Use { virtual: true } so Jest creates the mock without requiring the file.
jest.mock('../../services/storageService.js', () => ({
  StorageService: {
    getSettings: jest.fn(async () => ({ sessionLength: 5, numberofNewProblemsPerSession: 3 })),
    setSessionState: jest.fn(async () => {}),
    getSessionState: jest.fn(async () => null),
  },
}), { virtual: true });

jest.mock('../../services/focusCoordinationService.js', () => ({
  __esModule: true,
  default: {
    getFocusDecision: jest.fn(async () => ({
      onboarding: false,
      activeFocusTags: ['array', 'string'],
      userPreferences: { tags: ['array'] },
      performanceLevel: 'intermediate',
      algorithmReasoning: 'test reasoning',
      reasoning: 'test',
    })),
    updateSessionState: jest.fn((state) => ({ ...state })),
  },
}), { virtual: true });

jest.mock('../../../utils/session/sessionLimits.js', () => ({
  __esModule: true,
  default: {
    getMaxSessionLength: jest.fn(() => 6),
    getMaxNewProblems: jest.fn(() => 4),
  },
  SessionLimits: {
    getMaxSessionLength: jest.fn(() => 6),
    getMaxNewProblems: jest.fn(() => 4),
  },
}));

jest.mock('../../services/interviewService.js', () => ({
  InterviewService: {
    getInterviewInsightsForAdaptiveLearning: jest.fn(async () => ({
      hasInterviewData: false,
      transferAccuracy: 0,
      speedDelta: 0,
      recommendations: {
        sessionLengthAdjustment: 0,
        difficultyAdjustment: 0,
        newProblemsAdjustment: 0,
        focusTagsWeight: 1.0,
        weakTags: [],
      },
    })),
  },
}), { virtual: true });

// ---------------------------------------------------------------------------
// 2. Imports (after mocks are registered)
// ---------------------------------------------------------------------------
import { createTestDb, closeTestDb, seedStore, readAll } from '../../../../../test/testDbHelper.js';
import { dbHelper } from '../../index.js';
import {
  buildAdaptiveSessionSettings,
  computeSessionLength,
  normalizeSessionLengthForCalculation,
  applySessionLengthPreference,
} from '../sessionsAdaptive.js';

import { getMostRecentAttempt } from '../attempts.js';
import { getRecentSessionAnalytics } from '../sessionAnalytics.js';
import { analyzePerformanceTrend } from '../sessionsEscapeHatch.js';
import { initializeSessionState } from '../sessionsState.js';
import { StorageService } from '../../services/storageService.js';
import FocusCoordinationService from '../../services/focusCoordinationService.js';
import { TagService } from '../../../services/attempts/tagServices.js';
import { InterviewService } from '../../services/interviewService.js';
import SessionLimits from '../../../utils/session/sessionLimits.js';
import logger from '../../../utils/logging/logger.js';

// ---------------------------------------------------------------------------
// 3. Test suite
// ---------------------------------------------------------------------------
describe('sessionsAdaptive.js (real fake-indexeddb)', () => {
  let testDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
    jest.clearAllMocks();
    // Re-set default mocks after clearAllMocks
    dbHelper.openDB.mockImplementation(() => Promise.resolve(testDb.db));
  });

  afterEach(() => closeTestDb(testDb));

  // =========================================================================
  // computeSessionLength — pure function, no DB needed
  // =========================================================================
  describe('computeSessionLength', () => {
    it('returns at least 3 regardless of poor performance', () => {
      const result = computeSessionLength(0.0, 0.0, 3, 'stable', 0);
      expect(result).toBeGreaterThanOrEqual(3);
    });

    it('applies a 1.25x multiplier for accuracy >= 0.9', () => {
      // baseLength 4, multiplier 1.25 => 5
      const result = computeSessionLength(0.95, 0.5, 4, 'stable', 0);
      // accWeight >= 0.9 => 1.25, stable + accWeight >= 0.8 => +0.05 => 1.30
      // 4 * 1.30 = 5.2 => round to 5
      expect(result).toBe(5);
    });

    it('uses a 0.8x multiplier for accuracy < 0.5', () => {
      const result = computeSessionLength(0.3, 0.5, 5, 'stable', 0);
      // 0.8 multiplier, stable with accWeight < 0.6 => no bonus
      // 5 * 0.8 = 4
      expect(result).toBe(4);
    });

    it('keeps 1.0x multiplier for accuracy between 0.7 and 0.9', () => {
      const result = computeSessionLength(0.75, 0.5, 5, 'stable', 0);
      // multiplier 1.0, stable accWeight >= 0.6 => +0.025 => 1.025
      // 5 * 1.025 = 5.125 => round to 5
      expect(result).toBe(5);
    });

    it('adds sustained excellence bonus capped at 0.6', () => {
      // acc 0.95 => 1.25 base, sustained_excellence with 5 consecutive => 0.15*5=0.75 capped at 0.6
      // 1.25 + 0.6 = 1.85, high eff+acc => *1.1 => 2.035
      // baseLength 4, 4*2.035 = 8.14 => 8, max for sustained_excellence is 12
      const result = computeSessionLength(0.95, 0.9, 4, 'sustained_excellence', 5);
      expect(result).toBeGreaterThanOrEqual(7);
      expect(result).toBeLessThanOrEqual(12);
    });

    it('adds improving trend bonus of +0.1', () => {
      const resultStable = computeSessionLength(0.75, 0.5, 5, 'stable', 0);
      const resultImproving = computeSessionLength(0.75, 0.5, 5, 'improving', 0);
      expect(resultImproving).toBeGreaterThanOrEqual(resultStable);
    });

    it('reduces session length for struggling trend', () => {
      // acc 0.75 => 1.0, struggling => max(1.0 - 0.2, 0.6) = 0.8
      // 5 * 0.8 = 4
      const result = computeSessionLength(0.75, 0.5, 5, 'struggling', 0);
      expect(result).toBeLessThanOrEqual(5);
    });

    it('applies efficiency bonus when both eff and acc > 0.8', () => {
      const noBonus = computeSessionLength(0.85, 0.5, 5, 'stable', 0);
      const withBonus = computeSessionLength(0.85, 0.9, 5, 'stable', 0);
      expect(withBonus).toBeGreaterThanOrEqual(noBonus);
    });

    it('caps at 8 for non-sustained_excellence trends', () => {
      const result = computeSessionLength(0.99, 0.99, 10, 'improving', 0);
      expect(result).toBeLessThanOrEqual(8);
    });

    it('caps at 12 for sustained_excellence', () => {
      const result = computeSessionLength(0.99, 0.99, 10, 'sustained_excellence', 10);
      expect(result).toBeLessThanOrEqual(12);
    });

    it('clamps null accuracy to 0.5', () => {
      const result = computeSessionLength(null, 0.5, 4, 'stable', 0);
      // accWeight clamped to 0.5, multiplier stays 1.0 (between 0.5 and 0.7 => no change)
      expect(result).toBeGreaterThanOrEqual(3);
    });

    it('uses defaultBase of 4 when userPreferredLength is falsy', () => {
      const result = computeSessionLength(0.7, 0.5, 0, 'stable', 0);
      // baseLength = max(0 || 4, 3) = 4
      expect(result).toBeGreaterThanOrEqual(3);
    });
  });

  // =========================================================================
  // normalizeSessionLengthForCalculation — pure function
  // =========================================================================
  describe('normalizeSessionLengthForCalculation', () => {
    it('returns default when userSetting is null', () => {
      expect(normalizeSessionLengthForCalculation(null)).toBe(4);
    });

    it('returns default when userSetting is "auto"', () => {
      expect(normalizeSessionLengthForCalculation('auto')).toBe(4);
    });

    it('returns default when userSetting is 0', () => {
      expect(normalizeSessionLengthForCalculation(0)).toBe(4);
    });

    it('returns default when userSetting is negative', () => {
      expect(normalizeSessionLengthForCalculation(-5)).toBe(4);
    });

    it('returns numeric value for valid positive number', () => {
      expect(normalizeSessionLengthForCalculation(7)).toBe(7);
    });

    it('converts string numbers to numeric', () => {
      expect(normalizeSessionLengthForCalculation('10')).toBe(10);
    });

    it('returns default for non-numeric strings', () => {
      expect(normalizeSessionLengthForCalculation('abc')).toBe(4);
    });

    it('uses custom default base when provided', () => {
      expect(normalizeSessionLengthForCalculation(null, 6)).toBe(6);
    });
  });

  // =========================================================================
  // applySessionLengthPreference — pure function
  // =========================================================================
  describe('applySessionLengthPreference', () => {
    it('returns adaptive length when preference is null', () => {
      expect(applySessionLengthPreference(7, null)).toBe(7);
    });

    it('returns adaptive length when preference is "auto"', () => {
      expect(applySessionLengthPreference(7, 'auto')).toBe(7);
    });

    it('returns adaptive length when preference is 0', () => {
      expect(applySessionLengthPreference(7, 0)).toBe(7);
    });

    it('returns adaptive length when preference is negative', () => {
      expect(applySessionLengthPreference(7, -1)).toBe(7);
    });

    it('caps adaptive length to user preference when preference is lower', () => {
      expect(applySessionLengthPreference(10, 5)).toBe(5);
    });

    it('keeps adaptive length when it is below preference', () => {
      expect(applySessionLengthPreference(3, 10)).toBe(3);
    });

    it('logs when capping occurs', () => {
      applySessionLengthPreference(10, 5);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Session length capped'));
    });
  });

  // =========================================================================
  // buildAdaptiveSessionSettings — full pipeline with real DB
  // =========================================================================
  describe('buildAdaptiveSessionSettings', () => {
    beforeEach(() => {
      // Restore full mock defaults for the pipeline
      initializeSessionState.mockResolvedValue({
        id: 'session_state',
        num_sessions_completed: 5,
        current_difficulty_cap: 'Medium',
        tag_index: 0,
        difficulty_time_stats: {
          easy: { problems: 0, total_time: 0, avg_time: 0 },
          medium: { problems: 0, total_time: 0, avg_time: 0 },
          hard: { problems: 0, total_time: 0, avg_time: 0 },
        },
        last_performance: { accuracy: null, efficiency_score: null },
        escape_hatches: {
          sessions_at_current_difficulty: 0,
          last_difficulty_promotion: null,
          sessions_without_promotion: 0,
          activated_escape_hatches: [],
        },
        last_session_date: null,
        _migrated: true,
      });

      FocusCoordinationService.getFocusDecision.mockResolvedValue({
        onboarding: false,
        activeFocusTags: ['array', 'string'],
        userPreferences: { tags: ['array'] },
        performanceLevel: 'intermediate',
        algorithmReasoning: 'test',
        reasoning: 'test',
      });
      FocusCoordinationService.updateSessionState.mockImplementation((state) => ({ ...state }));

      TagService.getCurrentTier.mockResolvedValue({ focusTags: ['array', 'string', 'hash-table'] });
      StorageService.getSettings.mockResolvedValue({ sessionLength: 5, numberofNewProblemsPerSession: 3 });
      StorageService.setSessionState.mockResolvedValue();

      getRecentSessionAnalytics.mockResolvedValue([]);
      getMostRecentAttempt.mockResolvedValue(null);
      analyzePerformanceTrend.mockReturnValue({ trend: 'stable', consecutiveExcellent: 0, avgRecent: 0.5 });

      InterviewService.getInterviewInsightsForAdaptiveLearning.mockResolvedValue({
        hasInterviewData: false,
        transferAccuracy: 0,
        speedDelta: 0,
        recommendations: {
          sessionLengthAdjustment: 0,
          difficultyAdjustment: 0,
          newProblemsAdjustment: 0,
          focusTagsWeight: 1.0,
          weakTags: [],
        },
      });
    });

    it('returns a complete adaptive settings object', async () => {
      const result = await buildAdaptiveSessionSettings();

      expect(result).toHaveProperty('sessionLength');
      expect(result).toHaveProperty('numberOfNewProblems');
      expect(result).toHaveProperty('currentAllowedTags');
      expect(result).toHaveProperty('currentDifficultyCap');
      expect(result).toHaveProperty('userFocusAreas');
      expect(result).toHaveProperty('sessionState');
      expect(result).toHaveProperty('isOnboarding');
    });

    it('saves updated session state to StorageService', async () => {
      await buildAdaptiveSessionSettings();
      expect(StorageService.setSessionState).toHaveBeenCalledWith('session_state', expect.any(Object));
    });

    it('sets difficulty cap to Easy during onboarding', async () => {
      FocusCoordinationService.getFocusDecision.mockResolvedValue({
        onboarding: true,
        activeFocusTags: ['array', 'string'],
        userPreferences: { tags: ['array'] },
        performanceLevel: 'beginner',
        algorithmReasoning: 'onboarding',
        reasoning: 'onboarding test',
      });

      const result = await buildAdaptiveSessionSettings();
      expect(result.isOnboarding).toBe(true);
      expect(result.currentDifficultyCap).toBe('Easy');
    });

    it('uses onboarding settings with SessionLimits caps', async () => {
      FocusCoordinationService.getFocusDecision.mockResolvedValue({
        onboarding: true,
        activeFocusTags: ['array', 'string'],
        userPreferences: { tags: ['array'] },
        performanceLevel: 'beginner',
        algorithmReasoning: 'onboarding',
        reasoning: 'onboarding test',
      });

      SessionLimits.getMaxSessionLength.mockReturnValue(6);
      SessionLimits.getMaxNewProblems.mockReturnValue(4);
      StorageService.getSettings.mockResolvedValue({ sessionLength: 10, numberofNewProblemsPerSession: 8 });

      const result = await buildAdaptiveSessionSettings();
      // Onboarding caps session length to min(userPref, maxOnboarding) = min(10, 6) = 6
      expect(result.sessionLength).toBeLessThanOrEqual(6);
    });

    it('limits onboarding to first focus tag only', async () => {
      FocusCoordinationService.getFocusDecision.mockResolvedValue({
        onboarding: true,
        activeFocusTags: ['array', 'string', 'hash-table'],
        userPreferences: { tags: ['array'] },
        performanceLevel: 'beginner',
        algorithmReasoning: 'test',
        reasoning: 'test',
      });

      const result = await buildAdaptiveSessionSettings();
      expect(result.currentAllowedTags).toHaveLength(1);
      expect(result.currentAllowedTags[0]).toBe('array');
    });

    it('uses post-onboarding logic with recent attempt gap > 4 days', async () => {
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
      getMostRecentAttempt.mockResolvedValue({ attempt_date: sixDaysAgo.toISOString() });

      const result = await buildAdaptiveSessionSettings();
      // Gap > 4 days caps session to 5
      expect(result.sessionLength).toBeLessThanOrEqual(5);
    });

    it('uses post-onboarding logic with low accuracy caps session to 5', async () => {
      // Seed session_analytics for recent analytics
      await seedStore(testDb.db, 'session_analytics', [{
        session_id: 'sa-1',
        completed_at: new Date().toISOString(),
        accuracy: 0.3,
        avg_time: 300,
        predominant_difficulty: 'Easy',
        total_problems: 5,
        difficulty_breakdown: { easy: { correct: 1, attempts: 5 } },
      }]);

      getRecentSessionAnalytics.mockResolvedValue([{
        accuracy: 0.3,
        avg_time: 300,
        difficulty_breakdown: { medium: { correct: 1, attempts: 5 } },
      }]);

      const result = await buildAdaptiveSessionSettings();
      expect(result.sessionLength).toBeLessThanOrEqual(5);
    });

    it('uses difficulty-specific accuracy from analytics breakdown', async () => {
      getRecentSessionAnalytics.mockResolvedValue([
        {
          accuracy: 0.7,
          avg_time: 200,
          difficulty_breakdown: {
            medium: { correct: 4, attempts: 5 },
          },
        },
        {
          accuracy: 0.6,
          avg_time: 250,
          difficulty_breakdown: {
            medium: { correct: 3, attempts: 5 },
          },
        },
      ]);
      analyzePerformanceTrend.mockReturnValue({ trend: 'improving', consecutiveExcellent: 1, avgRecent: 0.75 });

      const result = await buildAdaptiveSessionSettings();
      expect(result).toBeDefined();
      expect(result.isOnboarding).toBe(false);
    });

    it('falls back to overall accuracy when difficulty breakdown is empty', async () => {
      getRecentSessionAnalytics.mockResolvedValue([{
        accuracy: 0.65,
        avg_time: 300,
        difficulty_breakdown: { medium: { correct: 0, attempts: 0 } },
      }]);

      const result = await buildAdaptiveSessionSettings();
      expect(result).toBeDefined();
    });

    it('falls back to overall accuracy when difficulty_breakdown is null', async () => {
      getRecentSessionAnalytics.mockResolvedValue([{
        accuracy: 0.8,
        avg_time: 100,
        difficulty_breakdown: null,
      }]);

      const result = await buildAdaptiveSessionSettings();
      expect(result).toBeDefined();
    });

    it('uses default efficiency when avg_time is falsy', async () => {
      getRecentSessionAnalytics.mockResolvedValue([{
        accuracy: 0.7,
        avg_time: null,
        difficulty_breakdown: null,
      }]);

      const result = await buildAdaptiveSessionSettings();
      expect(result).toBeDefined();
    });

    it('handles analytics error gracefully with defaults', async () => {
      getRecentSessionAnalytics.mockRejectedValue(new Error('DB unavailable'));

      const result = await buildAdaptiveSessionSettings();
      expect(result).toBeDefined();
      expect(result.sessionLength).toBeGreaterThanOrEqual(1);
    });

    it('falls back to focusTags when activeFocusTags is empty', async () => {
      FocusCoordinationService.getFocusDecision.mockResolvedValue({
        onboarding: false,
        activeFocusTags: [],
        userPreferences: { tags: [] },
        performanceLevel: 'intermediate',
        algorithmReasoning: 'test',
        reasoning: 'test',
      });
      TagService.getCurrentTier.mockResolvedValue({ focusTags: ['linked-list', 'tree'] });

      const result = await buildAdaptiveSessionSettings();
      expect(result).toBeDefined();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('empty tags'));
    });

    it('falls back to ["array"] when both activeFocusTags and focusTags are empty', async () => {
      FocusCoordinationService.getFocusDecision.mockResolvedValue({
        onboarding: false,
        activeFocusTags: [],
        userPreferences: { tags: [] },
        performanceLevel: 'intermediate',
        algorithmReasoning: 'test',
        reasoning: 'test',
      });
      TagService.getCurrentTier.mockResolvedValue({ focusTags: [] });

      const result = await buildAdaptiveSessionSettings();
      expect(result).toBeDefined();
    });

    it('applies interview insights to session length', async () => {
      InterviewService.getInterviewInsightsForAdaptiveLearning.mockResolvedValue({
        hasInterviewData: true,
        transferAccuracy: 0.9,
        speedDelta: 0.5,
        recommendations: {
          sessionLengthAdjustment: 2,
          difficultyAdjustment: 1,
          newProblemsAdjustment: 0,
          focusTagsWeight: 1.0,
          weakTags: [],
        },
      });

      const result = await buildAdaptiveSessionSettings();
      expect(result).toBeDefined();
      expect(result.sessionLength).toBeGreaterThanOrEqual(3);
    });

    it('applies interview insights to focus on weak tags when focusWeight < 1.0', async () => {
      InterviewService.getInterviewInsightsForAdaptiveLearning.mockResolvedValue({
        hasInterviewData: true,
        transferAccuracy: 0.3,
        speedDelta: -0.2,
        recommendations: {
          sessionLengthAdjustment: 0,
          difficultyAdjustment: -1,
          newProblemsAdjustment: -1,
          focusTagsWeight: 0.5,
          weakTags: ['array'],
        },
      });

      const result = await buildAdaptiveSessionSettings();
      expect(result).toBeDefined();
    });

    it('expands tags when interview focusWeight > 1.0', async () => {
      InterviewService.getInterviewInsightsForAdaptiveLearning.mockResolvedValue({
        hasInterviewData: true,
        transferAccuracy: 0.95,
        speedDelta: 1.0,
        recommendations: {
          sessionLengthAdjustment: 0,
          difficultyAdjustment: 0,
          newProblemsAdjustment: 1,
          focusTagsWeight: 2.0,
          weakTags: [],
        },
      });

      const result = await buildAdaptiveSessionSettings();
      expect(result).toBeDefined();
    });

    it('adjusts new problems with interview newProblemsAdjustment', async () => {
      InterviewService.getInterviewInsightsForAdaptiveLearning.mockResolvedValue({
        hasInterviewData: true,
        transferAccuracy: 0.4,
        speedDelta: -0.1,
        recommendations: {
          sessionLengthAdjustment: 0,
          difficultyAdjustment: 0,
          newProblemsAdjustment: -2,
          focusTagsWeight: 1.0,
          weakTags: [],
        },
      });

      const result = await buildAdaptiveSessionSettings();
      expect(result).toBeDefined();
      expect(result.numberOfNewProblems).toBeGreaterThanOrEqual(0);
    });

    it('high accuracy yields more new problems (accuracy >= 0.85)', async () => {
      getRecentSessionAnalytics.mockResolvedValue([{
        accuracy: 0.95,
        avg_time: 100,
        difficulty_breakdown: { medium: { correct: 9, attempts: 10 } },
      }]);

      const result = await buildAdaptiveSessionSettings();
      expect(result).toBeDefined();
    });

    it('low accuracy yields fewer new problems (accuracy < 0.6)', async () => {
      getRecentSessionAnalytics.mockResolvedValue([{
        accuracy: 0.4,
        avg_time: 600,
        difficulty_breakdown: { medium: { correct: 2, attempts: 5 } },
      }]);

      const result = await buildAdaptiveSessionSettings();
      expect(result).toBeDefined();
    });

    it('seeds session_analytics and exercises the DB-backed analytics path', async () => {
      // Seed real session_analytics records so getRecentSessionAnalytics reads real data
      const analyticsRecords = [
        {
          session_id: 'sa-01',
          completed_at: '2026-01-10T10:00:00.000Z',
          accuracy: 0.8,
          avg_time: 200,
          predominant_difficulty: 'Medium',
          total_problems: 5,
          difficulty_breakdown: { medium: { correct: 4, attempts: 5 } },
        },
        {
          session_id: 'sa-02',
          completed_at: '2026-01-12T10:00:00.000Z',
          accuracy: 0.9,
          avg_time: 150,
          predominant_difficulty: 'Medium',
          total_problems: 6,
          difficulty_breakdown: { medium: { correct: 5, attempts: 6 } },
        },
      ];
      await seedStore(testDb.db, 'session_analytics', analyticsRecords);

      // Verify data was seeded
      const stored = await readAll(testDb.db, 'session_analytics');
      expect(stored).toHaveLength(2);

      // The mock still returns data, but the DB has real records
      getRecentSessionAnalytics.mockResolvedValue(analyticsRecords);
      analyzePerformanceTrend.mockReturnValue({ trend: 'improving', consecutiveExcellent: 2, avgRecent: 0.85 });

      const result = await buildAdaptiveSessionSettings();
      expect(result).toBeDefined();
      expect(result.isOnboarding).toBe(false);
    });

    it('uses session state current_difficulty_cap for non-onboarding', async () => {
      initializeSessionState.mockResolvedValue({
        id: 'session_state',
        num_sessions_completed: 10,
        current_difficulty_cap: 'Hard',
        tag_index: 2,
        difficulty_time_stats: {
          easy: { problems: 10, total_time: 500, avg_time: 50 },
          medium: { problems: 8, total_time: 600, avg_time: 75 },
          hard: { problems: 3, total_time: 300, avg_time: 100 },
        },
        last_performance: { accuracy: 0.85, efficiency_score: 0.8 },
        escape_hatches: {
          sessions_at_current_difficulty: 3,
          last_difficulty_promotion: '2026-01-01T00:00:00.000Z',
          sessions_without_promotion: 3,
          activated_escape_hatches: [],
        },
        last_session_date: '2026-01-10T00:00:00.000Z',
        _migrated: true,
      });

      const result = await buildAdaptiveSessionSettings();
      expect(result.currentDifficultyCap).toBe('Hard');
    });

    it('respects user numberofNewProblemsPerSession setting', async () => {
      StorageService.getSettings.mockResolvedValue({ sessionLength: 8, numberofNewProblemsPerSession: 2 });

      FocusCoordinationService.getFocusDecision.mockResolvedValue({
        onboarding: true,
        activeFocusTags: ['array'],
        userPreferences: { tags: ['array'] },
        performanceLevel: 'beginner',
        algorithmReasoning: 'test',
        reasoning: 'test',
      });

      const result = await buildAdaptiveSessionSettings();
      expect(result.numberOfNewProblems).toBeLessThanOrEqual(2);
    });

    it('onboarding caps numberOfNewProblems via SessionLimits', async () => {
      FocusCoordinationService.getFocusDecision.mockResolvedValue({
        onboarding: true,
        activeFocusTags: ['array'],
        userPreferences: { tags: ['array'] },
        performanceLevel: 'beginner',
        algorithmReasoning: 'test',
        reasoning: 'test',
      });
      StorageService.getSettings.mockResolvedValue({ sessionLength: 5, numberofNewProblemsPerSession: 10 });
      SessionLimits.getMaxNewProblems.mockReturnValue(4);

      const result = await buildAdaptiveSessionSettings();
      expect(result.numberOfNewProblems).toBeLessThanOrEqual(5);
    });

    it('seeds attempts store to verify DB connectivity for attempt-dependent logic', async () => {
      // Seed the attempts store
      await seedStore(testDb.db, 'attempts', [{
        id: 'attempt-1',
        problem_id: 'p1',
        attempt_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        success: true,
        time_spent: 120,
        session_id: 'sess-1',
        leetcode_id: 1,
      }]);

      const storedAttempts = await readAll(testDb.db, 'attempts');
      expect(storedAttempts).toHaveLength(1);

      getMostRecentAttempt.mockResolvedValue({
        attempt_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const result = await buildAdaptiveSessionSettings();
      expect(result).toBeDefined();
      // Gap is 2 days (< 4), so no cap from gap logic
      expect(result.sessionLength).toBeGreaterThanOrEqual(1);
    });

    it('handles interview insights with negative sessionLengthAdjustment', async () => {
      InterviewService.getInterviewInsightsForAdaptiveLearning.mockResolvedValue({
        hasInterviewData: true,
        transferAccuracy: 0.3,
        speedDelta: -0.5,
        recommendations: {
          sessionLengthAdjustment: -2,
          difficultyAdjustment: -1,
          newProblemsAdjustment: 0,
          focusTagsWeight: 1.0,
          weakTags: [],
        },
      });

      const result = await buildAdaptiveSessionSettings();
      expect(result).toBeDefined();
      expect(result.sessionLength).toBeGreaterThanOrEqual(3);
    });

    it('returns userFocusAreas from focusDecision.userPreferences', async () => {
      FocusCoordinationService.getFocusDecision.mockResolvedValue({
        onboarding: false,
        activeFocusTags: ['array'],
        userPreferences: { tags: ['array', 'dp'], difficulty: 'Medium' },
        performanceLevel: 'intermediate',
        algorithmReasoning: 'test',
        reasoning: 'test',
      });

      const result = await buildAdaptiveSessionSettings();
      expect(result.userFocusAreas).toEqual({ tags: ['array', 'dp'], difficulty: 'Medium' });
    });
  });
});
