import { initializePatternLaddersForOnboarding } from "./problemladderService.js";
import { buildTagRelationships } from "../db/tag_relationships.js";
import { insertStandardProblems } from "../db/standard_problems.js"; // assuming this is where seeding is
import { insertStrategyData } from "../db/strategy_data.js";
import { buildProblemRelationships } from "../services/relationshipService.js";

import {
  getAllFromStore,
  addRecord,
  updateRecord,
  getRecord,
} from "../db/common.js";
import { databaseProxy } from "./databaseProxy.js";
import logger from "../utils/logger.js";

// Detect if we're in a content script context
const isContentScript = typeof window !== 'undefined' && window.location && window.location.href && window.location.href.includes('leetcode.com');

// Database helper functions that route to appropriate context
const dbGet = async (storeName, id) => {
  if (isContentScript) {
    return await databaseProxy.getRecord(storeName, id);
  }
  return await getRecord(storeName, id);
};

const dbAdd = async (storeName, record) => {
  if (isContentScript) {
    return await databaseProxy.addRecord(storeName, record);
  }
  return await addRecord(storeName, record);
};

const dbUpdate = async (storeName, id, record) => {
  if (isContentScript) {
    return await databaseProxy.updateRecord(storeName, id, record);
  }
  return await updateRecord(storeName, id, record);
};

const _dbGetAll = async (storeName) => {
  if (isContentScript) {
    return await databaseProxy.getAllFromStore(storeName);
  }
  return await getAllFromStore(storeName);
};

export async function onboardUserIfNeeded() {
  logger.info("... onboarding started");

  const [
    problemRelationships,
    standardProblems,
    userProblems,
    tagMastery,
    tagRelationships,
    strategyData,
  ] = await Promise.all([
    getAllFromStore("problem_relationships"),
    getAllFromStore("standard_problems"),
    getAllFromStore("problems"),
    getAllFromStore("tag_mastery"),
    getAllFromStore("tag_relationships"),
    getAllFromStore("strategy_data"),
  ]);

  const isMissingStandardData =
    standardProblems.length === 0 ||
    tagRelationships.length === 0 ||
    problemRelationships.length === 0 ||
    strategyData.length === 0;
  const isMissingUserData =
    userProblems.length === 0 || tagMastery.length === 0;

  if (!isMissingStandardData && !isMissingUserData) {
    logger.info("✅ Onboarding skipped — all data present.");
    return;
  }

  if (isMissingStandardData) {
    await seedStandardData();
  }

  if (isMissingUserData) {
    await seedUserData();
  }

  logger.info("... onboarding completed");
}

async function seedStandardData() {
  logger.info(
    "📦 Seeding standard problems, strategy data, and tag relationships..."
  );
  await seedStandardProblems();
  await seedStrategyData();
  await seedTagRelationships();
  await seedProblemRelationships();
}

async function seedUserData() {
  logger.info("🆕 Initializing user mastery data...");
  await initializePatternLaddersForOnboarding();
}

async function seedStandardProblems() {
  logger.info("📦 Inserting standard problems...");
  await insertStandardProblems();
}

async function seedStrategyData() {
  logger.info("📊 Inserting strategy data...");
  await insertStrategyData();
}

async function seedTagRelationships() {
  logger.info("🔗 Building tag relationships...");
  await buildTagRelationships();
}

async function seedProblemRelationships() {
  logger.info("🔁 Building problem relationships...");
  await buildProblemRelationships();
}

// UX Onboarding Functions
export async function checkOnboardingStatus() {
  try {
    logger.info("🔍 checkOnboardingStatus: Getting app onboarding record...");
    const appOnboardingRecord = await getRecord("settings", "app_onboarding");
    logger.info("📊 App onboarding record:", appOnboardingRecord);

    if (appOnboardingRecord) {
      return appOnboardingRecord;
    }

    // Create new app onboarding record
    const newAppOnboarding = {
      id: "app_onboarding",
      isCompleted: false,
      currentStep: 1,
      completedSteps: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
    };

    await addRecord("settings", newAppOnboarding);
    logger.info("✅ Created new app onboarding record");
    return newAppOnboarding;
  } catch (error) {
    logger.error("❌ Error checking app onboarding status:", error);
    // Return default app onboarding state
    return {
      id: "app_onboarding",
      isCompleted: false,
      currentStep: 1,
      completedSteps: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
    };
  }
}

export async function updateOnboardingProgress(stepNumber) {
  const appOnboardingRecord = await getRecord("settings", "app_onboarding");
  if (!appOnboardingRecord) {
    throw new Error("App onboarding settings not found");
  }

  if (!appOnboardingRecord.completedSteps.includes(stepNumber)) {
    appOnboardingRecord.completedSteps.push(stepNumber);
  }

  appOnboardingRecord.currentStep = Math.min(stepNumber + 1, 4);

  await updateRecord("settings", "app_onboarding", appOnboardingRecord);
  return appOnboardingRecord;
}

export async function completeOnboarding() {
  const appOnboardingRecord = await getRecord("settings", "app_onboarding");
  if (!appOnboardingRecord) {
    throw new Error("App onboarding settings not found");
  }

  appOnboardingRecord.isCompleted = true;
  appOnboardingRecord.currentStep = 4;
  appOnboardingRecord.completedSteps = [1, 2, 3, 4];
  appOnboardingRecord.completedAt = new Date().toISOString();

  await updateRecord("settings", "app_onboarding", appOnboardingRecord);
  logger.info("✅ App onboarding completed");
  return appOnboardingRecord;
}

export async function resetOnboarding() {
  const resetRecord = {
    id: "app_onboarding",
    isCompleted: false,
    currentStep: 1,
    completedSteps: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  };

  await updateRecord("settings", "app_onboarding", resetRecord);
  return resetRecord;
}

// Content script specific onboarding functions
export async function checkContentOnboardingStatus() {
  try {
    logger.info("🔍 checkContentOnboardingStatus: Getting content onboarding record...", isContentScript ? "(via proxy)" : "(direct)");
    const contentOnboardingRecord = await dbGet(
      "settings",
      "content_onboarding"
    );
    logger.info("📊 Content onboarding record found:", contentOnboardingRecord);

    if (contentOnboardingRecord) {
      logger.info(`✅ Content onboarding status - isCompleted: ${contentOnboardingRecord.isCompleted}, currentStep: ${contentOnboardingRecord.currentStep}`);
      
      // Database integrity check - ensure required properties exist
      if (!contentOnboardingRecord.pageProgress) {
        logger.warn("🔧 Fixing missing pageProgress in content onboarding record");
        contentOnboardingRecord.pageProgress = {
          probgen: false,
          probtime: false,
          timer: false,
          probstat: false,
          settings: false,
        };
        await dbUpdate("settings", "content_onboarding", contentOnboardingRecord);
      }
      
      return contentOnboardingRecord;
    }

    // Create new content onboarding record
    logger.info("🆕 Creating new content onboarding record...");
    const newContentOnboarding = {
      id: "content_onboarding",
      isCompleted: false,
      currentStep: 1,
      completedSteps: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
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
      pageProgress: {
        probgen: false,
        probtime: false,
        timer: false,
        probstat: false,
        settings: false,
      },
      lastActiveStep: null,
      resumeData: null,
    };

    await dbAdd("settings", newContentOnboarding);
    logger.info("✅ Created new content onboarding record with isCompleted:", newContentOnboarding.isCompleted);
    return newContentOnboarding;
  } catch (error) {
    logger.error("❌ Error checking content onboarding status:", error);
    // Return default content onboarding state
    logger.info("🔄 Returning fallback content onboarding state with isCompleted: false");
    return {
      id: "content_onboarding",
      isCompleted: false,
      currentStep: 1,
      completedSteps: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
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
      pageProgress: {
        probgen: false,
        probtime: false,
        timer: false,
        probstat: false,
        settings: false,
      },
      lastActiveStep: null,
      resumeData: null,
    };
  }
}

export async function completeContentOnboarding() {
  const contentOnboardingRecord = await dbGet(
    "settings",
    "content_onboarding"
  );
  if (!contentOnboardingRecord) {
    throw new Error("Content onboarding settings not found");
  }

  contentOnboardingRecord.isCompleted = true;
  contentOnboardingRecord.currentStep = 10; // Updated total steps
  contentOnboardingRecord.completedSteps = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  contentOnboardingRecord.completedAt = new Date().toISOString();

  // Mark all screens as completed
  Object.keys(contentOnboardingRecord.screenProgress).forEach((key) => {
    contentOnboardingRecord.screenProgress[key] = true;
  });

  await dbUpdate("settings", "content_onboarding", contentOnboardingRecord);
  logger.info("✅ Content onboarding completed");
  return contentOnboardingRecord;
}

// Enhanced checkpoint management functions
export async function updateContentOnboardingStep(
  stepNumber,
  screenKey = null,
  interactionKey = null
) {
  const contentOnboardingRecord = await dbGet(
    "settings",
    "content_onboarding"
  );
  if (!contentOnboardingRecord) {
    throw new Error("Content onboarding settings not found");
  }

  // Update step progress
  if (!contentOnboardingRecord.completedSteps.includes(stepNumber)) {
    contentOnboardingRecord.completedSteps.push(stepNumber);
  }
  contentOnboardingRecord.currentStep = Math.min(stepNumber + 1, 10);
  contentOnboardingRecord.lastActiveStep = stepNumber;

  // Update screen progress if provided
  if (
    screenKey &&
    Object.prototype.hasOwnProperty.call(contentOnboardingRecord.screenProgress, screenKey)
  ) {
    contentOnboardingRecord.screenProgress[screenKey] = true;
  }

  // Update interaction progress if provided
  if (
    interactionKey &&
    Object.prototype.hasOwnProperty.call(contentOnboardingRecord.interactionProgress, interactionKey)
  ) {
    contentOnboardingRecord.interactionProgress[interactionKey] = true;
  }

  contentOnboardingRecord.resumeData = {
    timestamp: new Date().toISOString(),
    currentUrl: window.location.href,
    screenKey,
    interactionKey,
  };

  await dbUpdate("settings", "content_onboarding", contentOnboardingRecord);
  return contentOnboardingRecord;
}

export async function getResumeStep() {
  const progress = await checkContentOnboardingStatus();

  if (progress.isCompleted) {
    return null;
  }

  // Determine appropriate resume step based on progress
  const completedScreens = Object.keys(progress.screenProgress).filter(
    (key) => progress.screenProgress[key]
  );

  if (completedScreens.length === 0) {
    return 1; // Start from beginning
  }

  // Return next logical step based on completed screens
  if (!progress.screenProgress.cmButton) return 2;
  if (!progress.screenProgress.navigation) return 3;
  if (!progress.screenProgress.generator) return 4;
  if (!progress.screenProgress.statistics) return 5;
  if (!progress.screenProgress.settings) return 6;
  if (!progress.screenProgress.problemTimer) return 7;
  if (!progress.screenProgress.strategyHints) return 8;

  return progress.currentStep || 1;
}

export async function skipToSection(sectionKey) {
  const sectionSteps = {
    cmButton: 2,
    navigation: 3,
    generator: 4,
    statistics: 5,
    settings: 6,
    problemTimer: 7,
    strategyHints: 8,
  };

  const stepNumber = sectionSteps[sectionKey];
  if (stepNumber) {
    return await updateContentOnboardingStep(stepNumber - 1, sectionKey);
  }

  return await checkContentOnboardingStatus();
}

export async function resetContentOnboarding() {
  try {
    const resetRecord = {
      id: "content_onboarding",
      isCompleted: false,
      currentStep: 1,
      completedSteps: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
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
      pageProgress: {
        probgen: false,
        probtime: false,
        timer: false,
        probstat: false,
        settings: false,
      },
      lastActiveStep: null,
      resumeData: null,
    };

    await dbUpdate("settings", "content_onboarding", resetRecord);
    logger.info("🔄 Content onboarding reset complete - isCompleted:", resetRecord.isCompleted);
    return resetRecord;
  } catch (error) {
    logger.error("❌ Error resetting content onboarding:", error);
    throw error;
  }
}

// Page-specific tour functions
export async function checkPageTourStatus(pageId) {
  try {
    logger.info(`🔍 ONBOARDING DEBUG: Checking tour status for page: ${pageId}`);
    const contentOnboardingRecord = await checkContentOnboardingStatus();
    logger.info(`📊 ONBOARDING DEBUG: Retrieved onboarding record:`, contentOnboardingRecord);
    
    // Initialize pageProgress if it doesn't exist
    if (!contentOnboardingRecord.pageProgress) {
      logger.info(`🔧 ONBOARDING DEBUG: Initializing missing pageProgress for ${pageId}`);
      contentOnboardingRecord.pageProgress = {
        probgen: false,
        probtime: false,
        timer: false,
        probstat: false,
        settings: false,
      };
      await dbUpdate("settings", "content_onboarding", contentOnboardingRecord);
      logger.info(`✅ ONBOARDING DEBUG: pageProgress initialized`);
    }
    
    const isCompleted = contentOnboardingRecord.pageProgress[pageId] || false;
    logger.info(`📋 ONBOARDING DEBUG: Page ${pageId} completion status: ${isCompleted}`);
    logger.info(`📋 ONBOARDING DEBUG: All page statuses:`, contentOnboardingRecord.pageProgress);
    return isCompleted;
  } catch (error) {
    logger.error(`❌ Error checking page tour status for ${pageId}:`, error);
    return false; // Default to not completed if error
  }
}

export async function markPageTourCompleted(pageId) {
  try {
    logger.info(`🎯 ONBOARDING DEBUG: Marking page tour completed for: ${pageId}`);
    logger.info(`📞 ONBOARDING DEBUG: Using ${isContentScript ? 'databaseProxy' : 'direct DB'} context`);
    
    const contentOnboardingRecord = await checkContentOnboardingStatus();
    logger.info(`📊 ONBOARDING DEBUG: Current record before update:`, contentOnboardingRecord);
    
    // Initialize pageProgress if it doesn't exist
    if (!contentOnboardingRecord.pageProgress) {
      logger.info(`🔧 ONBOARDING DEBUG: Initializing pageProgress for completion`);
      contentOnboardingRecord.pageProgress = {
        probgen: false,
        probtime: false,
        timer: false,
        probstat: false,
        settings: false,
      };
    }
    
    // Mark the specific page tour as completed
    const previousStatus = contentOnboardingRecord.pageProgress[pageId];
    contentOnboardingRecord.pageProgress[pageId] = true;
    contentOnboardingRecord.lastActiveStep = `page_${pageId}_completed`;
    
    logger.info(`📝 ONBOARDING DEBUG: ${pageId} status changed from ${previousStatus} to true`);
    logger.info(`📝 ONBOARDING DEBUG: Updated pageProgress:`, contentOnboardingRecord.pageProgress);
    logger.info(`💾 ONBOARDING DEBUG: Attempting to save to database...`);
    
    await dbUpdate("settings", "content_onboarding", contentOnboardingRecord);
    logger.info(`✅ ONBOARDING DEBUG: Page tour completed and saved for: ${pageId}`);
    return contentOnboardingRecord;
  } catch (error) {
    logger.error(`❌ ONBOARDING DEBUG: Error marking page tour completed for ${pageId}:`, error);
    throw error;
  }
}

export async function resetPageTour(pageId) {
  try {
    const contentOnboardingRecord = await checkContentOnboardingStatus();
    
    if (contentOnboardingRecord.pageProgress) {
      contentOnboardingRecord.pageProgress[pageId] = false;
      await dbUpdate("settings", "content_onboarding", contentOnboardingRecord);
      logger.info(`🔄 Page tour reset for: ${pageId}`);
    }
    
    return contentOnboardingRecord;
  } catch (error) {
    logger.error(`❌ Error resetting page tour for ${pageId}:`, error);
    throw error;
  }
}

export async function resetAllPageTours() {
  try {
    const contentOnboardingRecord = await checkContentOnboardingStatus();
    
    contentOnboardingRecord.pageProgress = {
      probgen: false,
      probtime: false,
      timer: false,
      probstat: false,
      settings: false,
    };
    
    await dbUpdate("settings", "content_onboarding", contentOnboardingRecord);
    logger.info("🔄 All page tours reset");
    return contentOnboardingRecord;
  } catch (error) {
    logger.error("❌ Error resetting all page tours:", error);
    throw error;
  }
}

// Debug Console Commands
// Available in browser console for testing onboarding system

/**
 * Debug: Check onboarding status for all pages
 * Usage: await window.debugOnboarding.checkAllPagesStatus()
 */
export async function debugCheckAllPagesStatus() {
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
 * Usage: await window.debugOnboarding.getFullRecord()
 */
export async function debugGetFullOnboardingRecord() {
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
 * Usage: await window.debugOnboarding.testComplete('timer')
 */
export async function debugTestPageCompletion(pageId) {
  try {
    logger.info(`🧪 ONBOARDING TEST: Testing completion for page: ${pageId}`);
    
    // Check initial status
    const initialStatus = await checkPageTourStatus(pageId);
    logger.info(`📋 Initial status for ${pageId}: ${initialStatus}`);
    
    // Mark as completed
    await markPageTourCompleted(pageId);
    
    // Verify completion
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
 * Usage: await window.debugOnboarding.testAllPages()
 */
export async function debugTestAllPagesCompletion() {
  try {
    const pages = ['probgen', 'probtime', 'timer', 'probstat', 'settings'];
    const results = [];
    
    logger.info(`🧪 ONBOARDING TEST SUITE: Testing completion persistence for all ${pages.length} pages...`);
    
    for (const pageId of pages) {
      try {
        const result = await debugTestPageCompletion(pageId);
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

// Initialize debug console commands
if (typeof window !== 'undefined') {
  window.debugOnboarding = {
    checkAllPagesStatus: debugCheckAllPagesStatus,
    getFullRecord: debugGetFullOnboardingRecord,
    testComplete: debugTestPageCompletion,
    testAllPages: debugTestAllPagesCompletion,
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
