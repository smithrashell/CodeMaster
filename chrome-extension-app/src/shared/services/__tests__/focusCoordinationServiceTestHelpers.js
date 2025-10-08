/**
 * Test helpers for FocusCoordinationService tests
 */

/**
 * Sets up mocks for a session state scenario
 */
export function setupSessionStateMocks(StorageService, sessionState) {
  StorageService.getSessionState.mockResolvedValue(sessionState);
}

/**
 * Sets up escape hatch mocks with no applicable hatches
 */
export function setupEscapeHatchMocks() {
  const { detectApplicableEscapeHatches } = require('../../utils/escapeHatchUtils');
  detectApplicableEscapeHatches.mockResolvedValue({
    sessionBased: { applicable: false },
    attemptBased: [],
    timeBased: [],
    recommendations: []
  });
}

/**
 * Creates a session state object for testing
 */
export function createSessionState(numSessions, accuracy = 0.7, efficiencyScore = 0.6) {
  return {
    num_sessions_completed: numSessions,
    last_performance: { accuracy, efficiency_score: efficiencyScore }
  };
}

/**
 * Asserts post-onboarding state with multiple tags
 */
export function assertPostOnboardingState(result) {
  expect(result.onboarding).toBe(false);
  expect(result.activeFocusTags.length).toBeGreaterThan(1);
  expect(result.activeFocusTags).not.toEqual(['array']);
}

/**
 * Asserts onboarding state with single tag
 */
export function assertOnboardingState(result) {
  expect(result.onboarding).toBe(true);
  expect(result.activeFocusTags.length).toBe(1);
}

/**
 * Asserts failsafe decision
 */
export function assertFailsafeDecision(result) {
  expect(result.activeFocusTags).toEqual(['array']);
  expect(result.onboarding).toBe(true);
}
