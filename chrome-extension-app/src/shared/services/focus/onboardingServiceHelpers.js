/**
 * Onboarding Service Helpers - Constants, Defaults, and Debug Utilities
 */

import logger from "../../utils/logging/logger.js";

// Default screen progress template
export const DEFAULT_SCREEN_PROGRESS = {
  intro: false,
  cmButton: false,
  navigation: false,
  generator: false,
  statistics: false,
  settings: false,
  problemTimer: false,
  strategyHints: false,
};

// Default interaction progress template
export const DEFAULT_INTERACTION_PROGRESS = {
  clickedCMButton: false,
  openedMenu: false,
  visitedGenerator: false,
  visitedStatistics: false,
  usedTimer: false,
};

// Default page progress template
export const DEFAULT_PAGE_PROGRESS = {
  probgen: false,
  probtime: false,
  timer: false,
  probstat: false,
  settings: false,
  timer_mini_tour: false,
};

// Section to step mapping
export const SECTION_STEPS = {
  cmButton: 2,
  navigation: 3,
  generator: 4,
  statistics: 5,
  settings: 6,
  problemTimer: 7,
  strategyHints: 8,
};

/**
 * Create a new app onboarding record with defaults
 */
export function createDefaultAppOnboarding() {
  return {
    id: "app_onboarding",
    is_completed: false,
    current_step: 1,
    completed_steps: [],
    started_at: new Date().toISOString(),
    completed_at: null,
  };
}

/**
 * Create a new content onboarding record with defaults
 */
export function createDefaultContentOnboarding() {
  return {
    id: "content_onboarding",
    is_completed: false,
    current_step: 1,
    completed_steps: [],
    started_at: new Date().toISOString(),
    completed_at: null,
    screenProgress: { ...DEFAULT_SCREEN_PROGRESS },
    interactionProgress: { ...DEFAULT_INTERACTION_PROGRESS },
    page_progress: { ...DEFAULT_PAGE_PROGRESS },
    lastActiveStep: null,
    resumeData: null,
  };
}

/**
 * Create default page progress object
 */
export function createDefaultPageProgress() {
  return { ...DEFAULT_PAGE_PROGRESS };
}

/**
 * Get current URL safely - may not be available in background script context
 */
export function getCurrentUrlSafely() {
  try {
    return typeof window !== 'undefined' && window.location ? window.location.href : 'background-context';
  } catch (error) {
    return 'background-context';
  }
}

/**
 * Debug: Check onboarding status for all pages
 */
export async function debugCheckAllPagesStatus(checkPageTourStatus) {
  try {
    const pages = ['probgen', 'probtime', 'timer', 'probstat', 'settings'];
    const results = {};

    logger.info(`🔍 ONBOARDING AUDIT: Checking status for all ${pages.length} pages...`);

    for (const pageId of pages) {
      try {
        const status = await checkPageTourStatus(pageId);
        results[pageId] = status;
        logger.info(`📋 ${pageId}: ${status ? '✅ Completed' : '❌ Not completed'}`);
      } catch (error) {
        results[pageId] = `ERROR: ${error.message}`;
        logger.error(`❌ Error checking ${pageId}:`, error);
      }
    }

    logger.info(`📊 ONBOARDING AUDIT SUMMARY:`, results);
    return results;
  } catch (error) {
    logger.error(`❌ Error in debugCheckAllPagesStatus:`, error);
    throw error;
  }
}

/**
 * Debug: Get complete onboarding record
 */
export async function debugGetFullOnboardingRecord(checkContentOnboardingStatus) {
  try {
    logger.info(`📊 ONBOARDING DEBUG: Retrieving full onboarding record...`);
    const record = await checkContentOnboardingStatus();
    logger.info(`📋 Full onboarding record:`, record);
    return record;
  } catch (error) {
    logger.error(`❌ Error getting full onboarding record:`, error);
    throw error;
  }
}

/**
 * Debug: Test page tour completion
 */
export async function debugTestPageCompletion(pageId, checkPageTourStatus, markPageTourCompleted) {
  try {
    logger.info(`🧪 ONBOARDING TEST: Testing completion for page: ${pageId}`);

    const initialStatus = await checkPageTourStatus(pageId);
    logger.info(`📋 Initial status for ${pageId}: ${initialStatus}`);

    await markPageTourCompleted(pageId);

    const finalStatus = await checkPageTourStatus(pageId);
    logger.info(`📋 Final status for ${pageId}: ${finalStatus}`);

    const success = finalStatus === true;
    logger.info(`🧪 TEST RESULT: ${success ? '✅ PASSED' : '❌ FAILED'} - ${pageId} completion persistence`);

    return {
      pageId,
      initialStatus,
      finalStatus,
      success,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`❌ Error testing page completion for ${pageId}:`, error);
    throw error;
  }
}

/**
 * Debug: Test all pages completion
 */
export async function debugTestAllPagesCompletion(checkPageTourStatus, markPageTourCompleted) {
  try {
    const pages = ['probgen', 'probtime', 'timer', 'probstat', 'settings'];
    const results = [];

    logger.info(`🧪 ONBOARDING TEST SUITE: Testing completion persistence for all ${pages.length} pages...`);

    for (const pageId of pages) {
      try {
        const result = await debugTestPageCompletion(pageId, checkPageTourStatus, markPageTourCompleted);
        results.push(result);
      } catch (error) {
        results.push({
          pageId,
          error: error.message,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
    }

    const passedTests = results.filter(r => r.success).length;
    const failedTests = results.filter(r => !r.success).length;

    logger.info(`🧪 TEST SUITE COMPLETE: ${passedTests} passed, ${failedTests} failed`);
    logger.info(`📊 Detailed Results:`, results);

    return {
      summary: { passed: passedTests, failed: failedTests, total: results.length },
      results
    };
  } catch (error) {
    logger.error(`❌ Error in test suite:`, error);
    throw error;
  }
}

/**
 * Initialize debug console commands
 */
export function initializeDebugConsoleCommands(
  checkPageTourStatus,
  checkContentOnboardingStatus,
  markPageTourCompleted,
  resetAllPageTours,
  resetPageTour
) {
  if (typeof window !== 'undefined') {
    window.debugOnboarding = {
      checkAllPagesStatus: () => debugCheckAllPagesStatus(checkPageTourStatus),
      getFullRecord: () => debugGetFullOnboardingRecord(checkContentOnboardingStatus),
      testComplete: (pageId) => debugTestPageCompletion(pageId, checkPageTourStatus, markPageTourCompleted),
      testAllPages: () => debugTestAllPagesCompletion(checkPageTourStatus, markPageTourCompleted),
      resetAllTours: resetAllPageTours,
      resetPage: resetPageTour
    };
    logger.info(`🛠️ ONBOARDING DEBUG: Console commands available at window.debugOnboarding`);
    logger.info(`📚 Available commands:
    - await window.debugOnboarding.checkAllPagesStatus()  // Check status of all pages
    - await window.debugOnboarding.getFullRecord()        // Get complete record
    - await window.debugOnboarding.testComplete('timer')  // Test specific page
    - await window.debugOnboarding.testAllPages()         // Test all pages
    - await window.debugOnboarding.resetAllTours()        // Reset all tours
    - await window.debugOnboarding.resetPage('timer')     // Reset specific page`);
  }
}
