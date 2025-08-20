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

const dbGetAll = async (storeName) => {
  if (isContentScript) {
    return await databaseProxy.getAllFromStore(storeName);
  }
  return await getAllFromStore(storeName);
};

export async function onboardUserIfNeeded() {
  console.log("... onboarding started");

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
    console.log("✅ Onboarding skipped — all data present.");
    return;
  }

  if (isMissingStandardData) {
    await seedStandardData();
  }

  if (isMissingUserData) {
    await seedUserData();
  }

  console.log("... onboarding completed");
}

async function seedStandardData() {
  console.log(
    "📦 Seeding standard problems, strategy data, and tag relationships..."
  );
  await seedStandardProblems();
  await seedStrategyData();
  await seedTagRelationships();
  await seedProblemRelationships();
}

async function seedUserData() {
  console.log("🆕 Initializing user mastery data...");
  await initializePatternLaddersForOnboarding();
}

async function seedStandardProblems() {
  console.log("📦 Inserting standard problems...");
  await insertStandardProblems();
}

async function seedStrategyData() {
  console.log("📊 Inserting strategy data...");
  await insertStrategyData();
}

async function seedTagRelationships() {
  console.log("🔗 Building tag relationships...");
  await buildTagRelationships();
}

async function seedProblemRelationships() {
  console.log("🔁 Building problem relationships...");
  await buildProblemRelationships();
}

// UX Onboarding Functions
export async function checkOnboardingStatus() {
  try {
    console.log("🔍 checkOnboardingStatus: Getting app onboarding record...");
    const appOnboardingRecord = await getRecord("settings", "app_onboarding");
    console.log("📊 App onboarding record:", appOnboardingRecord);

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
    console.log("✅ Created new app onboarding record");
    return newAppOnboarding;
  } catch (error) {
    console.error("❌ Error checking app onboarding status:", error);
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
  console.log("✅ App onboarding completed");
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
    console.log("🔍 checkContentOnboardingStatus: Getting content onboarding record...", isContentScript ? "(via proxy)" : "(direct)");
    const contentOnboardingRecord = await dbGet(
      "settings",
      "content_onboarding"
    );
    console.log("📊 Content onboarding record found:", contentOnboardingRecord);

    if (contentOnboardingRecord) {
      console.log(`✅ Content onboarding status - isCompleted: ${contentOnboardingRecord.isCompleted}, currentStep: ${contentOnboardingRecord.currentStep}`);
      
      // Database integrity check - ensure required properties exist
      if (!contentOnboardingRecord.pageProgress) {
        console.warn("🔧 Fixing missing pageProgress in content onboarding record");
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
    console.log("🆕 Creating new content onboarding record...");
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
    console.log("✅ Created new content onboarding record with isCompleted:", newContentOnboarding.isCompleted);
    return newContentOnboarding;
  } catch (error) {
    console.error("❌ Error checking content onboarding status:", error);
    // Return default content onboarding state
    console.log("🔄 Returning fallback content onboarding state with isCompleted: false");
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
  console.log("✅ Content onboarding completed");
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
    contentOnboardingRecord.screenProgress.hasOwnProperty(screenKey)
  ) {
    contentOnboardingRecord.screenProgress[screenKey] = true;
  }

  // Update interaction progress if provided
  if (
    interactionKey &&
    contentOnboardingRecord.interactionProgress.hasOwnProperty(interactionKey)
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
    console.log("🔄 Content onboarding reset complete - isCompleted:", resetRecord.isCompleted);
    return resetRecord;
  } catch (error) {
    console.error("❌ Error resetting content onboarding:", error);
    throw error;
  }
}

// Page-specific tour functions
export async function checkPageTourStatus(pageId) {
  try {
    const contentOnboardingRecord = await checkContentOnboardingStatus();
    
    // Initialize pageProgress if it doesn't exist
    if (!contentOnboardingRecord.pageProgress) {
      contentOnboardingRecord.pageProgress = {
        probgen: false,
        probtime: false,
        timer: false,
        probstat: false,
        settings: false,
      };
      await dbUpdate("settings", "content_onboarding", contentOnboardingRecord);
    }
    
    return contentOnboardingRecord.pageProgress[pageId] || false;
  } catch (error) {
    console.error(`❌ Error checking page tour status for ${pageId}:`, error);
    return false; // Default to not completed if error
  }
}

export async function markPageTourCompleted(pageId) {
  try {
    const contentOnboardingRecord = await checkContentOnboardingStatus();
    
    // Initialize pageProgress if it doesn't exist
    if (!contentOnboardingRecord.pageProgress) {
      contentOnboardingRecord.pageProgress = {
        probgen: false,
        probtime: false,
        timer: false,
        probstat: false,
        settings: false,
      };
    }
    
    // Mark the specific page tour as completed
    contentOnboardingRecord.pageProgress[pageId] = true;
    contentOnboardingRecord.lastActiveStep = `page_${pageId}_completed`;
    
    await dbUpdate("settings", "content_onboarding", contentOnboardingRecord);
    console.log(`✅ Page tour completed for: ${pageId}`);
    return contentOnboardingRecord;
  } catch (error) {
    console.error(`❌ Error marking page tour completed for ${pageId}:`, error);
    throw error;
  }
}

export async function resetPageTour(pageId) {
  try {
    const contentOnboardingRecord = await checkContentOnboardingStatus();
    
    if (contentOnboardingRecord.pageProgress) {
      contentOnboardingRecord.pageProgress[pageId] = false;
      await dbUpdate("settings", "content_onboarding", contentOnboardingRecord);
      console.log(`🔄 Page tour reset for: ${pageId}`);
    }
    
    return contentOnboardingRecord;
  } catch (error) {
    console.error(`❌ Error resetting page tour for ${pageId}:`, error);
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
    console.log("🔄 All page tours reset");
    return contentOnboardingRecord;
  } catch (error) {
    console.error("❌ Error resetting all page tours:", error);
    throw error;
  }
}
