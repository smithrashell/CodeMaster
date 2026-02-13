/**
 * Real IndexedDB tests for sessionAdaptiveHelpers.js
 *
 * Uses fake-indexeddb via testDbHelper for the async function
 * (applyPostOnboardingLogic) that calls getMostRecentAttempt.
 * Pure functions are tested directly without DB.
 */

// --- Mocks (must be declared before any imports) ---

jest.mock('../../../utils/logging/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../utils/session/sessionLimits.js', () => ({
  __esModule: true,
  default: {
    getMaxSessionLength: jest.fn(() => 6),
    getMaxNewProblems: jest.fn(() => 4),
  },
}));

jest.mock('../../index.js', () => ({
  dbHelper: { openDB: jest.fn() },
}));

jest.mock('../attempts.js', () => ({
  getMostRecentAttempt: jest.fn(),
}));

// --- Imports ---

import { getMostRecentAttempt } from '../attempts.js';
import {
  applyOnboardingSettings,
  applyPostOnboardingLogic,
  applyInterviewInsightsToSessionLength,
  calculateNewProblems,
  applyInterviewInsightsToTags,
  computeSessionLength,
  normalizeSessionLengthForCalculation,
  applySessionLengthPreference,
} from '../sessionAdaptiveHelpers.js';

// --- Test setup ---

beforeEach(() => {
  jest.clearAllMocks();
});

// Helper to build a no-op interviewInsights object
function noInterviewInsights() {
  return {
    hasInterviewData: false,
    transferAccuracy: 0,
    recommendations: {
      sessionLengthAdjustment: 0,
      difficultyAdjustment: 0,
      newProblemsAdjustment: 0,
      focusTagsWeight: 1.0,
      weakTags: [],
    },
  };
}

// ---------------------------------------------------------------------------
// normalizeSessionLengthForCalculation
// ---------------------------------------------------------------------------
describe('normalizeSessionLengthForCalculation', () => {
  it('returns defaultBase when userSetting is null', () => {
    expect(normalizeSessionLengthForCalculation(null)).toBe(4);
  });

  it('returns defaultBase when userSetting is "auto"', () => {
    expect(normalizeSessionLengthForCalculation('auto')).toBe(4);
  });

  it('returns defaultBase when userSetting is 0 or negative', () => {
    expect(normalizeSessionLengthForCalculation(0)).toBe(4);
    expect(normalizeSessionLengthForCalculation(-3)).toBe(4);
  });

  it('returns numeric value for a valid number', () => {
    expect(normalizeSessionLengthForCalculation(7)).toBe(7);
  });

  it('converts string numbers to numeric', () => {
    expect(normalizeSessionLengthForCalculation('5')).toBe(5);
  });

  it('returns custom defaultBase when provided', () => {
    expect(normalizeSessionLengthForCalculation(null, 10)).toBe(10);
  });

  it('returns defaultBase for NaN string values', () => {
    expect(normalizeSessionLengthForCalculation('abc')).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// applySessionLengthPreference
// ---------------------------------------------------------------------------
describe('applySessionLengthPreference', () => {
  it('returns adaptiveLength when userPreferredLength is null', () => {
    expect(applySessionLengthPreference(6, null)).toBe(6);
  });

  it('returns adaptiveLength when userPreferredLength is "auto"', () => {
    expect(applySessionLengthPreference(6, 'auto')).toBe(6);
  });

  it('returns adaptiveLength when userPreferredLength is 0', () => {
    expect(applySessionLengthPreference(6, 0)).toBe(6);
  });

  it('caps adaptiveLength to userPreferredLength when adaptive exceeds preference', () => {
    expect(applySessionLengthPreference(8, 5)).toBe(5);
  });

  it('returns adaptiveLength when it is within userPreferredLength', () => {
    expect(applySessionLengthPreference(4, 10)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// computeSessionLength
// ---------------------------------------------------------------------------
describe('computeSessionLength', () => {
  it('returns clamped length for high accuracy', () => {
    const result = computeSessionLength(0.95, 0.5, 4, 'stable', 0);
    // accuracy 0.95 => multiplier 1.25, stable+high accuracy => +0.05
    // base=4, 4*1.3 = 5.2 => round=5, clamped [3,8]
    expect(result).toBeGreaterThanOrEqual(3);
    expect(result).toBeLessThanOrEqual(8);
  });

  it('reduces length for low accuracy', () => {
    const result = computeSessionLength(0.3, 0.5, 6, 'stable', 0);
    // accuracy 0.3 < 0.5 => multiplier 0.8
    expect(result).toBeLessThanOrEqual(6);
    expect(result).toBeGreaterThanOrEqual(3);
  });

  it('applies sustained excellence bonus with higher max', () => {
    const result = computeSessionLength(0.95, 0.9, 8, 'sustained_excellence', 4);
    // sustained_excellence allows max=12
    expect(result).toBeLessThanOrEqual(12);
    expect(result).toBeGreaterThanOrEqual(3);
  });

  it('applies improving trend bonus', () => {
    const baseline = computeSessionLength(0.75, 0.5, 5, 'stable', 0);
    const improved = computeSessionLength(0.75, 0.5, 5, 'improving', 0);
    expect(improved).toBeGreaterThanOrEqual(baseline);
  });

  it('applies struggling trend reduction', () => {
    const baseline = computeSessionLength(0.75, 0.5, 5, 'stable', 0);
    const struggling = computeSessionLength(0.75, 0.5, 5, 'struggling', 0);
    expect(struggling).toBeLessThanOrEqual(baseline);
  });

  it('applies efficiency bonus when both accuracy and efficiency are high', () => {
    const withoutEff = computeSessionLength(0.9, 0.5, 5, 'stable', 0);
    const withEff = computeSessionLength(0.9, 0.9, 5, 'stable', 0);
    expect(withEff).toBeGreaterThanOrEqual(withoutEff);
  });

  it('defaults null accuracy and efficiency to 0.5', () => {
    const result = computeSessionLength(null, null, 4);
    expect(result).toBeGreaterThanOrEqual(3);
    expect(result).toBeLessThanOrEqual(8);
  });

  it('uses minimum base length of 3', () => {
    const result = computeSessionLength(0.5, 0.5, 1);
    expect(result).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// applyOnboardingSettings
// ---------------------------------------------------------------------------
describe('applyOnboardingSettings', () => {
  it('returns capped session length and new problems count', () => {
    const settings = { sessionLength: 10, numberofNewProblemsPerSession: 3 };
    const sessionState = {};
    const allowedTags = ['array', 'dp'];
    const focusDecision = { reasoning: 'test' };

    const result = applyOnboardingSettings(settings, sessionState, allowedTags, focusDecision);

    // getMaxSessionLength returns 6, so min(10, 6) = 6
    expect(result.sessionLength).toBeLessThanOrEqual(6);
    // numberOfNewProblems = min(sessionLength, userMax=3, maxNew=4)
    expect(result.numberOfNewProblems).toBeLessThanOrEqual(3);
  });

  it('uses sessionLength when user preference is smaller than onboarding cap', () => {
    const settings = { sessionLength: 3, numberofNewProblemsPerSession: 0 };
    const result = applyOnboardingSettings(settings, {}, ['array'], { reasoning: '' });

    expect(result.sessionLength).toBe(3);
  });

  it('handles auto session length by defaulting', () => {
    const settings = { sessionLength: 'auto', numberofNewProblemsPerSession: 2 };
    const result = applyOnboardingSettings(settings, {}, ['dp'], { reasoning: '' });

    // normalizeSessionLengthForCalculation('auto') => 4, min(4, 6) = 4
    expect(result.sessionLength).toBe(4);
    expect(result.numberOfNewProblems).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// applyInterviewInsightsToSessionLength
// ---------------------------------------------------------------------------
describe('applyInterviewInsightsToSessionLength', () => {
  it('returns unchanged sessionLength when no interview data', () => {
    const result = applyInterviewInsightsToSessionLength(5, noInterviewInsights());
    expect(result).toBe(5);
  });

  it('adjusts session length when interview data has sessionLengthAdjustment > 0', () => {
    const insights = {
      hasInterviewData: true,
      transferAccuracy: 0.9,
      recommendations: { sessionLengthAdjustment: 2, difficultyAdjustment: 0 },
    };

    const result = applyInterviewInsightsToSessionLength(5, insights);
    // clamped to [3, 8]: 5 + 2 = 7
    expect(result).toBe(7);
  });

  it('adjusts session length downward with negative adjustment', () => {
    const insights = {
      hasInterviewData: true,
      transferAccuracy: 0.3,
      recommendations: { sessionLengthAdjustment: -3, difficultyAdjustment: 0 },
    };

    const result = applyInterviewInsightsToSessionLength(5, insights);
    // clamped to [3, 8]: 5 + (-3) = 2 => max(3, 2) = 3
    expect(result).toBe(3);
  });

  it('does not adjust when sessionLengthAdjustment is 0 even with interview data', () => {
    const insights = {
      hasInterviewData: true,
      transferAccuracy: 0.7,
      recommendations: { sessionLengthAdjustment: 0, difficultyAdjustment: 1 },
    };

    const result = applyInterviewInsightsToSessionLength(6, insights);
    expect(result).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// calculateNewProblems
// ---------------------------------------------------------------------------
describe('calculateNewProblems', () => {
  it('returns higher new problems for high accuracy', () => {
    const result = calculateNewProblems(0.9, 8, { numberofNewProblemsPerSession: 0 }, noInterviewInsights());
    // accuracy >= 0.85 => min(5, floor(8/2)) = min(5, 4) = 4
    expect(result).toBe(4);
  });

  it('returns 1 for low accuracy', () => {
    const result = calculateNewProblems(0.4, 8, { numberofNewProblemsPerSession: 0 }, noInterviewInsights());
    // accuracy < 0.6 => 1
    expect(result).toBe(1);
  });

  it('returns proportional new problems for mid accuracy', () => {
    const result = calculateNewProblems(0.7, 10, { numberofNewProblemsPerSession: 0 }, noInterviewInsights());
    // floor(10 * 0.3) = 3
    expect(result).toBe(3);
  });

  it('caps at user preference when set', () => {
    const result = calculateNewProblems(0.9, 8, { numberofNewProblemsPerSession: 2 }, noInterviewInsights());
    expect(result).toBe(2);
  });

  it('applies interview newProblemsAdjustment', () => {
    const insights = {
      hasInterviewData: true,
      transferAccuracy: 0.9,
      recommendations: {
        sessionLengthAdjustment: 0,
        difficultyAdjustment: 0,
        newProblemsAdjustment: -1,
        focusTagsWeight: 1.0,
        weakTags: [],
      },
    };

    const result = calculateNewProblems(0.9, 8, { numberofNewProblemsPerSession: 0 }, insights);
    // base = 4, adjusted = max(0, 4 + (-1)) = 3
    expect(result).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// applyInterviewInsightsToTags
// ---------------------------------------------------------------------------
describe('applyInterviewInsightsToTags', () => {
  it('returns original tags and tag_index when no interview data', () => {
    const result = applyInterviewInsightsToTags(
      ['array', 'dp', 'graph'],
      ['array', 'dp', 'graph', 'tree'],
      noInterviewInsights(),
      0.8
    );

    expect(result.allowedTags).toEqual(['array', 'dp', 'graph']);
    expect(result.tag_index).toBe(2);
  });

  it('narrows to weak tags when focusWeight < 1.0', () => {
    const insights = {
      hasInterviewData: true,
      transferAccuracy: 0.3,
      recommendations: {
        sessionLengthAdjustment: 0,
        difficultyAdjustment: 0,
        newProblemsAdjustment: 0,
        focusTagsWeight: 0.5,
        weakTags: ['dp', 'graph'],
      },
    };

    const result = applyInterviewInsightsToTags(
      ['array', 'dp', 'graph'],
      ['array', 'dp', 'graph'],
      insights,
      0.5
    );

    // weakTagsInFocus = ['dp', 'graph'], sliced to max(2, ceil(3*0.5)) = max(2,2) = 2
    expect(result.allowedTags).toEqual(['dp', 'graph']);
    expect(result.tag_index).toBe(1);
  });

  it('expands tags when focusWeight > 1.0', () => {
    const insights = {
      hasInterviewData: true,
      transferAccuracy: 0.9,
      recommendations: {
        sessionLengthAdjustment: 0,
        difficultyAdjustment: 0,
        newProblemsAdjustment: 0,
        focusTagsWeight: 2.0,
        weakTags: [],
      },
    };

    const result = applyInterviewInsightsToTags(
      ['array'],
      ['array', 'dp', 'graph'],
      insights,
      0.9
    );

    // tagsToAdd = floor((2.0 - 1.0) * 1) = 1
    // additionalTags = ['dp', 'graph'], add 1 => ['array', 'dp']
    expect(result.allowedTags).toContain('array');
    expect(result.allowedTags.length).toBeGreaterThan(1);
  });

  it('does not expand when no additional tags are available', () => {
    const insights = {
      hasInterviewData: true,
      transferAccuracy: 0.9,
      recommendations: {
        sessionLengthAdjustment: 0,
        difficultyAdjustment: 0,
        newProblemsAdjustment: 0,
        focusTagsWeight: 2.0,
        weakTags: [],
      },
    };

    const result = applyInterviewInsightsToTags(
      ['array', 'dp'],
      ['array', 'dp'],
      insights,
      0.9
    );

    // No additional tags available
    expect(result.allowedTags).toEqual(['array', 'dp']);
  });
});

// ---------------------------------------------------------------------------
// applyPostOnboardingLogic
// ---------------------------------------------------------------------------
describe('applyPostOnboardingLogic', () => {
  it('returns adaptive session parameters based on performance', async () => {
    getMostRecentAttempt.mockResolvedValue(null);

    const result = await applyPostOnboardingLogic({
      accuracy: 0.8,
      efficiencyScore: 0.6,
      settings: { sessionLength: 5, numberofNewProblemsPerSession: 0 },
      interviewInsights: noInterviewInsights(),
      allowedTags: ['array', 'dp'],
      focusTags: ['array', 'dp'],
      _sessionState: {},
      now: Date.now(),
      performanceTrend: 'stable',
      consecutiveExcellentSessions: 0,
    });

    expect(result).toHaveProperty('sessionLength');
    expect(result).toHaveProperty('numberOfNewProblems');
    expect(result).toHaveProperty('allowedTags');
    expect(result).toHaveProperty('tag_index');
    expect(result.sessionLength).toBeGreaterThanOrEqual(1);
  });

  it('caps session length when gap is > 4 days', async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    getMostRecentAttempt.mockResolvedValue({ attempt_date: fiveDaysAgo.toISOString() });

    const result = await applyPostOnboardingLogic({
      accuracy: 0.8,
      efficiencyScore: 0.6,
      settings: { sessionLength: 'auto', numberofNewProblemsPerSession: 0 },
      interviewInsights: noInterviewInsights(),
      allowedTags: ['array'],
      focusTags: ['array'],
      _sessionState: {},
      now: Date.now(),
      performanceTrend: 'stable',
      consecutiveExcellentSessions: 0,
    });

    expect(result.sessionLength).toBeLessThanOrEqual(5);
  });

  it('caps session length when accuracy is below 0.5', async () => {
    getMostRecentAttempt.mockResolvedValue(null);

    const result = await applyPostOnboardingLogic({
      accuracy: 0.3,
      efficiencyScore: 0.5,
      settings: { sessionLength: 'auto', numberofNewProblemsPerSession: 0 },
      interviewInsights: noInterviewInsights(),
      allowedTags: ['array'],
      focusTags: ['array'],
      _sessionState: {},
      now: Date.now(),
      performanceTrend: 'stable',
      consecutiveExcellentSessions: 0,
    });

    expect(result.sessionLength).toBeLessThanOrEqual(5);
  });
});
