// Background script helper functions
// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../shared/db/index.js";
import { TagService } from "../shared/services/tagServices.js";
import { StorageService } from "../shared/services/storageService.js";
import { onboardUserIfNeeded } from "../shared/services/onboardingService.js";

// Timeout wrapper utility
export const withTimeout = (promise, timeoutMs, operationName = 'Operation') => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

// Stub: cleanupStalledSessions - automatic cleanup removed per Issue #193
export const cleanupStalledSessions = () => {
  console.log('✅ Session cleanup: Manual only (automatic cleanup disabled per Issue #193)');
  return { cleaned: 0, actions: [] };
};

// Strategy Map data aggregation function
export const getStrategyMapData = async () => {
  try {
    const currentTierData = await TagService.getCurrentTier();
    const _learningState = await TagService.getCurrentLearningState();

    const db = await dbHelper.openDB();

    const tagRelationships = await new Promise((resolve, reject) => {
      const tx = db.transaction("tag_relationships", "readonly");
      const store = tx.objectStore("tag_relationships");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const tagMastery = await new Promise((resolve, reject) => {
      const tx = db.transaction("tag_mastery", "readonly");
      const store = tx.objectStore("tag_mastery");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const tierData = {};
    const tiers = ["Core Concept", "Fundamental Technique", "Advanced Technique"];

    tiers.forEach((tier) => {
      const tierTags = tagRelationships
        .filter((tag) => tag.classification === tier)
        .map((tag) => {
          const masteryInfo = tagMastery.find((m) => m.tag === tag.id) || {};
          const successRate =
            masteryInfo.totalAttempts > 0
              ? masteryInfo.successfulAttempts / masteryInfo.totalAttempts
              : 0;

          return {
            tag: tag.id,
            mastery: successRate,
            unlocked: successRate > 0 || tier === "Core Concept",
            attempts: masteryInfo.totalAttempts || 0,
            successful: masteryInfo.successfulAttempts || 0,
          };
        });

      tierData[tier] = tierTags;
    });

    return {
      currentTier: currentTierData.classification || "Core Concept",
      focusTags: currentTierData.focusTags || [],
      tierData,
      masteryData: tagMastery,
    };
  } catch (error) {
    console.error("❌ Error getting Strategy Map data:", error);
    throw error;
  }
};

// Initialize database and onboarding during extension installation
export const initializeInstallationOnboarding = async function() {
  try {
    console.log("🎯 Installation onboarding: Starting database initialization...");

    try {
      await chrome.action.setBadgeText({ text: '...' });
      await chrome.action.setBadgeBackgroundColor({ color: '#FFA500' });
      await chrome.action.setTitle({ title: 'CodeMaster - Setting up database...' });
    } catch (badgeError) {
      console.warn("⚠️ Could not set initial loading badge:", badgeError);
    }

    const result = await onboardUserIfNeeded();

    if (result.success) {
      await StorageService.set('installation_onboarding_complete', {
        completed: true,
        timestamp: new Date().toISOString(),
        version: chrome.runtime.getManifest().version
      });

      try {
        await chrome.action.setBadgeText({ text: '' });
        await chrome.action.setTitle({ title: 'CodeMaster - Algorithm Learning Assistant' });
      } catch (badgeError) {
        console.warn("⚠️ Could not clear loading badge:", badgeError);
      }

      console.log("✅ Installation onboarding completed successfully");
      if (result.warning) {
        console.warn("⚠️ Installation onboarding completed with warnings:", result.message);
      }
    } else {
      console.error("❌ Installation onboarding failed:", result.message);

      try {
        await chrome.action.setBadgeText({ text: '!' });
        await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
        await chrome.action.setTitle({ title: 'CodeMaster - Setup failed. Click to try again.' });
      } catch (badgeError) {
        console.warn("⚠️ Could not set error badge:", badgeError);
      }
    }

  } catch (error) {
    console.error("❌ Error during installation onboarding:", error);

    await StorageService.set('installation_onboarding_complete', {
      completed: true,
      timestamp: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      error: error.message
    });

    try {
      await chrome.action.setBadgeText({ text: '' });
      await chrome.action.setTitle({ title: 'CodeMaster - Algorithm Learning Assistant' });
    } catch (badgeError) {
      console.warn("⚠️ Could not clear badge after error:", badgeError);
    }

    console.warn("⚠️ Installation onboarding marked complete despite error to avoid blocking extension");
  }
};

// Initialize the complete consistency system
export const initializeConsistencySystem = function() {
  try {
    console.log("🔧 Initializing system (automatic cleanup disabled per Issue #193)...");
    console.log("🚀 Starting installation-time onboarding...");
    initializeInstallationOnboarding();
    console.log("✅ System initialization complete");
  } catch (error) {
    console.error("❌ Error initializing system:", error);
    console.warn("⚠️ Some features may not work properly");
  }
};

// Background script health monitoring
export const createBackgroundScriptHealth = (activeRequests, requestQueue, isProcessingRef) => ({
  startTime: Date.now(),
  requestCount: 0,
  timeoutCount: 0,

  recordRequest() {
    this.requestCount++;
  },

  recordTimeout(duration) {
    this.timeoutCount++;
    console.warn(`⏰ Request timeout recorded: ${duration}ms (total timeouts: ${this.timeoutCount})`);
  },

  emergencyReset() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.timeoutCount = 0;
    console.info("🔄 Background script health monitor reset");
  },

  getHealthReport() {
    const uptime = Date.now() - this.startTime;
    return {
      uptime,
      requestCount: this.requestCount,
      timeoutCount: this.timeoutCount,
      activeRequests: Object.keys(activeRequests).length,
      queueLength: requestQueue.length,
      isProcessing: isProcessingRef.value
    };
  }
});

// Setup development testing functions
export const setupDevTestFunctions = (services) => {
  if (process.env.NODE_ENV !== 'production') {
    globalThis.testSimple = function() {
      console.log('✅ Simple test function works!');
      return { success: true, message: 'Simple test completed' };
    };

    globalThis.testAsync = function() {
      console.log('✅ Async test function works!');
      return { success: true, message: 'Async test completed' };
    };

    // Expose core services globally for testing access
    Object.entries(services).forEach(([name, service]) => {
      globalThis[name] = service;
    });

    console.log('🧪 Test functions available:', {
      testSimple: typeof globalThis.testSimple,
      testAsync: typeof globalThis.testAsync
    });
  }
};
