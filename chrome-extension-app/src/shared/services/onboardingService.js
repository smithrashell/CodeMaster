import { initializePatternLaddersForOnboarding } from "./problemladderService.js";
import { buildTagRelationships } from "../db/tag_relationships.js";
import { insertStandardProblems } from "../db/standard_problems.js";
import { insertStrategyData } from "../db/strategy_data.js";
import { buildProblemRelationships } from "../services/relationshipService.js";
import { StorageService } from "./storageService.js";
import {
  getAllFromStore,
  addRecord,
  updateRecord,
  getRecord,
} from "../db/common.js";
import logger from "../utils/logger.js";
import {
  createDefaultAppOnboarding,
  createDefaultContentOnboarding,
  createDefaultPageProgress,
  getCurrentUrlSafely,
  SECTION_STEPS,
  initializeDebugConsoleCommands,
} from "./onboardingServiceHelpers.js";

// Direct snake_case field access - no backward compatibility needed

// Use direct database access - all extension contexts support IndexedDB
const dbGet = getRecord;
const dbAdd = addRecord;
const dbUpdate = updateRecord;
const _dbGetAll = getAllFromStore;

export async function onboardUserIfNeeded() {
  logger.info("... onboarding started");

  try {
    // Check data stores sequentially to avoid IndexedDB connection conflicts
    const problemRelationships = await getAllFromStore("problem_relationships");
    const standardProblems = await getAllFromStore("standard_problems");
    const userProblems = await getAllFromStore("problems");
    const tagMastery = await getAllFromStore("tag_mastery");
    const tagRelationships = await getAllFromStore("tag_relationships");
    const strategyData = await getAllFromStore("strategy_data");

    const isMissingStandardData =
      standardProblems.length === 0 ||
      tagRelationships.length === 0 ||
      problemRelationships.length === 0 ||
      strategyData.length === 0;
    const isMissingUserData =
      userProblems.length === 0 || tagMastery.length === 0;

    if (!isMissingStandardData && !isMissingUserData) {
      logger.info("✅ Onboarding skipped — all data present.");
      return { success: true, message: "All data present" };
    }

    if (isMissingStandardData) {
      await seedStandardData();
      
      // Validate critical data was loaded successfully
      const standardProblemsAfterSeed = await getAllFromStore("standard_problems");
      if (standardProblemsAfterSeed.length === 0) {
        logger.error("🚨 CRITICAL: Standard problems still empty after seeding!");
        // Still return success to not block UI, but log the critical issue
      } else {
        logger.info(`✅ Standard problems validation: ${standardProblemsAfterSeed.length} problems loaded`);
      }
    }

    if (isMissingUserData) {
      await seedUserData();
    }

    logger.info("✅ Onboarding completed successfully");
    return { success: true, message: "Onboarding completed" };

  } catch (error) {
    logger.error("❌ Error during onboarding:", error);
    
    // Return success to prevent blocking UI, but log the issue
    // Most onboarding failures are non-critical for basic functionality
    return { 
      success: true, 
      warning: true,
      message: `Onboarding completed with warnings: ${error.message}` 
    };
  }
}

async function seedStandardData() {
  logger.info(
    "📦 Seeding standard problems, strategy data, and tag relationships..."
  );
  
  // Seed each data type independently - don't fail if one fails
  const results = {
    standardProblems: false,
    strategyData: false,
    tagRelationships: false,
    problemRelationships: false
  };
  
  try {
    await seedStandardProblems();
    results.standardProblems = true;
    logger.info("✅ Standard problems seeded successfully");
  } catch (error) {
    logger.error("❌ Failed to seed standard problems:", error);
  }
  
  try {
    await seedStrategyData();
    results.strategyData = true;
    logger.info("✅ Strategy data seeded successfully");
  } catch (error) {
    logger.error("❌ Failed to seed strategy data:", error);
  }
  
  try {
    await seedTagRelationships();
    results.tagRelationships = true;
    logger.info("✅ Tag relationships seeded successfully");
  } catch (error) {
    logger.error("❌ Failed to seed tag relationships:", error);
  }
  
  try {
    await seedProblemRelationships();
    results.problemRelationships = true;
    logger.info("✅ Problem relationships seeded successfully");
  } catch (error) {
    logger.error("❌ Failed to seed problem relationships:", error);
  }
  
  // Log summary of what was seeded successfully
  const successCount = Object.values(results).filter(Boolean).length;
  logger.info(`📦 Seeding summary: ${successCount}/4 data types seeded successfully`);
  
  // Always try to seed standard problems if it failed - this is critical
  if (!results.standardProblems) {
    logger.warn("🚨 CRITICAL: Standard problems not seeded - retrying once...");
    try {
      await seedStandardProblems();
      logger.info("✅ Standard problems seeded successfully on retry");
    } catch (retryError) {
      logger.error("❌ CRITICAL: Failed to seed standard problems on retry:", retryError);
    }
  }
}

async function seedUserData() {
  logger.info("🆕 Initializing user data...");

  // Initialize user settings with defaults
  await initializeUserSettings();

  // Initialize pattern ladders - tag mastery records created organically on first attempt
  await initializePatternLaddersForOnboarding();
}

/**
 * Initialize default user settings during onboarding
 */
async function initializeUserSettings() {
  try {
    // Check if settings already exist
    const existingSettings = await StorageService.getSettings();

    // If settings exist and have the theme property, they're already initialized
    // Note: StorageService.getSettings() auto-initializes settings now, so this is mostly a backup
    if (existingSettings && existingSettings.theme && existingSettings.focusAreas) {
      logger.info("✅ User settings already exist, skipping onboarding initialization");
      return;
    }

    // Create default settings
    const defaultSettings = {
      adaptive: true,
      sessionLength: 5,
      numberofNewProblemsPerSession: 2,
      limit: "off",
      reminder: { value: false, label: "6" },
      theme: "light",
      focusAreas: [], // Empty by default - system will recommend based on learning state
      timerDisplay: "mm:ss",
      breakReminders: { enabled: false, interval: 25 },
      notifications: { sound: false, browser: false, visual: true },
      sessionsPerWeek: 5,
      reviewRatio: 40,
      accessibility: {
        screenReader: {
          enabled: false,
          verboseDescriptions: true,
          announceNavigation: true,
          readFormLabels: true
        },
        keyboard: {
          enhancedFocus: true,
          skipToContent: true,
          focusTrapping: true,
          customShortcuts: false
        },
        motor: {
          largerTargets: false,
          extendedHover: false,
          reducedMotion: false,
          stickyHover: false
        },
        visual: {
          highContrast: false,
          reducedAnimations: false,
          largerText: false,
          colorBlindFriendly: false
        }
      }
    };

    // Save the default settings
    const result = await StorageService.setSettings(defaultSettings);

    if (result.status === "success") {
      logger.info("✅ User settings initialized successfully");
      logger.info(`🎯 Default focus areas set to: [${defaultSettings.focusAreas.join(', ')}]`);
    } else {
      logger.error("❌ Failed to initialize user settings:", result);
    }
  } catch (error) {
    logger.error("❌ Error initializing user settings:", error);
    // Don't throw - onboarding should continue even if settings fail
  }
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

    const newAppOnboarding = createDefaultAppOnboarding();
    await addRecord("settings", newAppOnboarding);
    logger.info("✅ Created new app onboarding record");
    return newAppOnboarding;
  } catch (error) {
    logger.error("❌ Error checking app onboarding status:", error);
    return createDefaultAppOnboarding();
  }
}

export async function updateOnboardingProgress(stepNumber) {
  const appOnboardingRecord = await getRecord("settings", "app_onboarding");
  if (!appOnboardingRecord) {
    throw new Error("App onboarding settings not found");
  }

  if (!appOnboardingRecord.completed_steps.includes(stepNumber)) {
    appOnboardingRecord.completed_steps.push(stepNumber);
  }

  appOnboardingRecord.current_step = Math.min(stepNumber + 1, 4);

  await updateRecord("settings", "app_onboarding", appOnboardingRecord);
  return appOnboardingRecord;
}

export async function completeOnboarding() {
  const appOnboardingRecord = await getRecord("settings", "app_onboarding");
  if (!appOnboardingRecord) {
    throw new Error("App onboarding settings not found");
  }

  appOnboardingRecord.is_completed = true;
  appOnboardingRecord.current_step = 4;
  appOnboardingRecord.completed_steps = [1, 2, 3, 4];
  appOnboardingRecord.completed_at = new Date().toISOString();

  await updateRecord("settings", "app_onboarding", appOnboardingRecord);
  logger.info("✅ App onboarding completed");
  return appOnboardingRecord;
}

export async function resetOnboarding() {
  const resetRecord = createDefaultAppOnboarding();
  await updateRecord("settings", "app_onboarding", resetRecord);
  return resetRecord;
}

// Content script specific onboarding functions
export async function checkContentOnboardingStatus() {
  try {
    logger.info("🔍 checkContentOnboardingStatus: Getting content onboarding record... (direct access)");
    const contentOnboardingRecord = await dbGet("settings", "content_onboarding");
    logger.info("📊 Content onboarding record found:", contentOnboardingRecord);

    if (contentOnboardingRecord) {
      logger.info(`✅ Content onboarding status - is_completed: ${contentOnboardingRecord.is_completed}, current_step: ${contentOnboardingRecord.current_step}`);

      if (!contentOnboardingRecord.page_progress) {
        logger.warn("🔧 Fixing missing pageProgress in content onboarding record");
        contentOnboardingRecord.page_progress = createDefaultPageProgress();
        await dbUpdate("settings", "content_onboarding", contentOnboardingRecord);
      }

      return contentOnboardingRecord;
    }

    logger.info("🆕 Creating new content onboarding record...");
    const newContentOnboarding = createDefaultContentOnboarding();

    await dbAdd("settings", newContentOnboarding);
    logger.info("✅ Created new content onboarding record with is_completed:", newContentOnboarding.is_completed);
    return newContentOnboarding;
  } catch (error) {
    logger.error("❌ Error checking content onboarding status:", error);
    logger.info("🔄 Returning fallback content onboarding state with is_completed: false");
    return createDefaultContentOnboarding();
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

  contentOnboardingRecord.is_completed = true;
  contentOnboardingRecord.current_step = 9; // Back to original 8 steps 
  contentOnboardingRecord.completed_steps = [1, 2, 3, 4, 5, 6, 7, 8];
  contentOnboardingRecord.completed_at = new Date().toISOString();

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
  if (!contentOnboardingRecord.completed_steps.includes(stepNumber)) {
    contentOnboardingRecord.completed_steps.push(stepNumber);
  }
  contentOnboardingRecord.current_step = Math.min(stepNumber + 1, 9);
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
    currentUrl: getCurrentUrlSafely(),
    screenKey,
    interactionKey,
  };

  await dbUpdate("settings", "content_onboarding", contentOnboardingRecord);
  return contentOnboardingRecord;
}

export async function getResumeStep() {
  const progress = await checkContentOnboardingStatus();

  if (progress.is_completed) {
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

  return progress.current_step || 1;
}

export async function skipToSection(sectionKey) {
  const stepNumber = SECTION_STEPS[sectionKey];
  if (stepNumber) {
    return await updateContentOnboardingStep(stepNumber - 1, sectionKey);
  }
  return await checkContentOnboardingStatus();
}

export async function resetContentOnboarding() {
  try {
    const resetRecord = createDefaultContentOnboarding();
    await dbUpdate("settings", "content_onboarding", resetRecord);
    logger.info("🔄 Content onboarding reset complete - is_completed:", resetRecord.is_completed);
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
    
    // Use direct database access to avoid recursive Chrome messaging
    const contentOnboardingRecord = await dbGet("settings", "content_onboarding");
    logger.info(`📊 ONBOARDING DEBUG: Retrieved onboarding record:`, contentOnboardingRecord);
    
    // If no record exists, return false (not completed)
    if (!contentOnboardingRecord) {
      logger.info(`❌ ONBOARDING DEBUG: No onboarding record found, returning false for ${pageId}`);
      return false;
    }
    
    // Get pageProgress directly from database record
    let pageProgress = contentOnboardingRecord.page_progress;
    
    if (!pageProgress) {
      logger.info(`🔧 ONBOARDING DEBUG: Initializing missing pageProgress for ${pageId}`);
      pageProgress = createDefaultPageProgress();
      contentOnboardingRecord.page_progress = pageProgress;
      await dbUpdate("settings", "content_onboarding", contentOnboardingRecord);
      logger.info(`✅ ONBOARDING DEBUG: pageProgress initialized`);
    }
    
    const is_completed = pageProgress[pageId] || false;
    logger.info(`📋 ONBOARDING DEBUG: Page ${pageId} completion status: ${is_completed}`);
    logger.info(`📋 ONBOARDING DEBUG: All page statuses:`, pageProgress);
    return is_completed;
  } catch (error) {
    logger.error(`❌ Error checking page tour status for ${pageId}:`, error);
    return false; // Default to not completed if error
  }
}

export async function markPageTourCompleted(pageId) {
  try {
    logger.info(`🎯 ONBOARDING DEBUG: Marking page tour completed for: ${pageId}`);
    logger.info("📞 ONBOARDING DEBUG: Using direct DB access");
    
    // Use direct database access to avoid recursive Chrome messaging
    let contentOnboardingRecord = await dbGet("settings", "content_onboarding");
    logger.info(`📊 ONBOARDING DEBUG: Current record before update:`, contentOnboardingRecord);
    
    if (!contentOnboardingRecord) {
      logger.info(`🆕 ONBOARDING DEBUG: Creating new onboarding record for page completion`);
      contentOnboardingRecord = createDefaultContentOnboarding();
      await dbAdd("settings", contentOnboardingRecord);
    }
    
    let pageProgress = contentOnboardingRecord.page_progress;

    if (!pageProgress) {
      logger.info(`🔧 ONBOARDING DEBUG: Initializing pageProgress for completion`);
      pageProgress = createDefaultPageProgress();
      contentOnboardingRecord.page_progress = pageProgress;
    }
    
    // Mark the specific page tour as completed
    const previousStatus = pageProgress[pageId];
    pageProgress[pageId] = true;
    contentOnboardingRecord.page_progress = pageProgress; // Ensure we're storing with snake_case field name
    contentOnboardingRecord.lastActiveStep = `page_${pageId}_completed`;
    
    logger.info(`📝 ONBOARDING DEBUG: ${pageId} status changed from ${previousStatus} to true`);
    logger.info(`📝 ONBOARDING DEBUG: Updated pageProgress:`, pageProgress);
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
    // Use direct database access to avoid recursive Chrome messaging
    const contentOnboardingRecord = await dbGet("settings", "content_onboarding");
    
    if (contentOnboardingRecord) {
      let pageProgress = contentOnboardingRecord.page_progress || {};
      pageProgress[pageId] = false;
      contentOnboardingRecord.page_progress = pageProgress;
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
    const contentOnboardingRecord = await dbGet("settings", "content_onboarding");

    if (contentOnboardingRecord) {
      contentOnboardingRecord.page_progress = createDefaultPageProgress();
      await dbUpdate("settings", "content_onboarding", contentOnboardingRecord);
      logger.info("🔄 All page tours reset");
    }

    return contentOnboardingRecord;
  } catch (error) {
    logger.error("❌ Error resetting all page tours:", error);
    throw error;
  }
}

// Initialize debug console commands
initializeDebugConsoleCommands(
  checkPageTourStatus,
  checkContentOnboardingStatus,
  markPageTourCompleted,
  resetAllPageTours,
  resetPageTour
);
