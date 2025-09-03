// Keep critical services as static imports
import { StorageService } from "../src/shared/services/storageService.js";
import { ProblemService } from "../src/shared/services/problemService.js";
import { SessionService } from "../src/shared/services/sessionService.js";
import { adaptiveLimitsService } from "../src/shared/services/adaptiveLimitsService.js";
import { NavigationService } from "../src/shared/services/navigationService.js";
import { TagService } from "../src/shared/services/tagServices.js";
import { HintInteractionService } from "../src/shared/services/hintInteractionService.js";
import { AlertingService } from "../src/shared/services/AlertingService.js";
import { backupIndexedDB, getBackupFile } from "../src/shared/db/backupDB.js";
import { onboardUserIfNeeded } from "../src/shared/services/onboardingService.js";
import { getStrategyForTag } from "../src/shared/db/strategy_data.js";
import { getProblem } from "../src/shared/db/problems.js";
import FocusCoordinationService from "../src/shared/services/focusCoordinationService.js";
import { InterviewService } from "../src/shared/services/interviewService.js";

// Lazy import heavy dashboard services only
let getDashboardStatistics, getFocusAreaAnalytics, getLearningProgressData, getGoalsData,
    getStatsData, getSessionHistoryData, getProductivityInsightsData, getTagMasteryData,
    getLearningPathData, getMistakeAnalysisData, clearFocusAreaAnalyticsCache,
    getInterviewAnalyticsData, getSessionMetrics;

import { connect } from "chrome-extension-hot-reload";

connect(); // handles app and popup

// Lazy loading helper for dashboard services (biggest bundle size contributor)
const lazyLoadDashboard = async () => {
  if (!getDashboardStatistics) {
    const module = await import("../src/app/services/dashboardService.js");
    ({ getDashboardStatistics, getFocusAreaAnalytics, getLearningProgressData, getGoalsData,
       getStatsData, getSessionHistoryData, getProductivityInsightsData, getTagMasteryData,
       getLearningPathData, getMistakeAnalysisData, clearFocusAreaAnalyticsCache,
       getInterviewAnalyticsData, getSessionMetrics } = module);
  }
  return { getDashboardStatistics, getFocusAreaAnalytics, getLearningProgressData, getGoalsData,
           getStatsData, getSessionHistoryData, getProductivityInsightsData, getTagMasteryData,
           getLearningPathData, getMistakeAnalysisData, getInterviewAnalyticsData, getSessionMetrics };
};

// Mark this as background script context for database access
if (typeof globalThis !== 'undefined') {
  globalThis.IS_BACKGROUND_SCRIPT_CONTEXT = true;
}

// Service Worker Lifecycle Management for Manifest V3
// Add proper installation and activation handlers
self.addEventListener('install', (event) => {
  console.log('🔧 SERVICE WORKER: Installing background script...');
  // Skip waiting to activate immediately
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('🔧 SERVICE WORKER: Activated background script...');
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
});

// Add startup message to confirm service worker is running
// Track background script startup time for health monitoring
global.backgroundStartTime = Date.now();
console.log('🚀 SERVICE WORKER: Background script loaded and ready for messages');

// Emergency cleanup on background script startup
console.log('🔧 Performing startup cleanup...');
// Clear any potential mutex locks from previous instance
setTimeout(() => {
  // Import SessionService and reset mutex if available
  if (typeof SessionService !== 'undefined' && SessionService.resetSessionCreationMutex) {
    const resetResult = SessionService.resetSessionCreationMutex();
    console.log('🔧 Startup mutex reset:', resetResult);
  }
  
  // Clear request queue from potential previous instance
  activeRequests = {};
  requestQueue = [];
  isProcessing = false;
  
  console.log('✅ Background script startup cleanup completed');
}, 100); // Small delay to ensure imports are loaded

// Helper function to add timeout protection to async operations
const withTimeout = (promise, timeoutMs, operationName = 'Operation') => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};

let activeRequests = {};
let requestQueue = [];
let isProcessing = false;

// Simplified background script health monitoring
const backgroundScriptHealth = {
  startTime: Date.now(),
  requestCount: 0,
  
  recordRequest() {
    this.requestCount++;
  },
  
  getHealthReport() {
    const uptime = Date.now() - this.startTime;
    return {
      uptime,
      requestCount: this.requestCount,
      activeRequests: Object.keys(activeRequests).length,
      queueLength: requestQueue.length,
      isProcessing
    };
  }
};

// Add response caching to prevent repeated expensive queries
const responseCache = new Map();
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

const getCachedResponse = (key) => {
  const item = responseCache.get(key);
  if (!item) return null;

  if (Date.now() > item.expiry) {
    responseCache.delete(key);
    return null;
  }

  return item.data;
};

const setCachedResponse = (key, data) => {
  responseCache.set(key, {
    data,
    expiry: Date.now() + CACHE_EXPIRY,
  });

  // Clean cache if it gets too large
  if (responseCache.size > 100) {
    const now = Date.now();
    for (const [k, item] of responseCache.entries()) {
      if (now > item.expiry) {
        responseCache.delete(k);
      }
    }
  }
};

// Universal cache key generation for different request types
const generateCacheKey = (request) => {
  switch (request.type) {
    // Problem-related operations
    case 'getProblemByDescription': 
      return `problem_slug_${request.slug}`;
    case 'saveHintInteraction': 
      return request.data?.problemId ? `problem_ctx_${request.data.problemId}` : null;
    
    // Dashboard data operations - simplified keys since no filters are passed
    case 'getStatsData': 
      return 'stats_data';
    case 'getSessionHistoryData': 
      return 'sessions_data';
    case 'getTagMasteryData': 
      return 'mastery_data';
    case 'getLearningProgressData': 
      return 'progress_data';
    case 'getProductivityInsightsData': 
      return 'productivity_data';
    case 'getLearningPathData': 
      return 'learning_path_data';
    case 'getMistakeAnalysisData': 
      return 'mistakes_data';
    case 'getInterviewAnalyticsData': 
      return 'interview_data';
    case 'getHintAnalyticsData': 
      return 'hints_data';
    case 'getFocusAreasData':
      return `focus_areas_data`;
    
    // Strategy operations
    case 'getStrategyForTag': 
      return `strategy_${request.tag}`;
    
    // Settings operations (short TTL)
    case 'getSettings': 
      return `settings_${request.key || 'all'}`;
    case 'getStorage': 
      return `storage_${request.key}`;
    
    // Non-cacheable operations (return null)
    case 'setSettings':
    case 'setStorage': 
    case 'removeStorage':
    case 'addProblem':
    case 'backupIndexedDB':
    case 'createSession':
    case 'graduateFocusAreas':
    default: 
      return null; // Not cacheable
  }
};

// Universal cache wrapper for all background script requests
const handleRequest = async (request, sender, sendResponse) => {
  const cacheKey = generateCacheKey(request);
  
  // Check cache for cacheable requests
  if (cacheKey) {
    const cached = getCachedResponse(cacheKey);
    if (cached) {
      console.log(`🔥 Cache HIT: ${request.type} - ${cacheKey}`);
      sendResponse(cached);
      return;
    }
    console.log(`💾 Cache MISS: ${request.type} - ${cacheKey}`);
  }
  
  // For non-cacheable requests or cache misses, execute original handler
  // Wrap sendResponse to capture responses for caching
  let capturedResponse = null;
  const wrappedSendResponse = (response) => {
    capturedResponse = response;
    
    // Cache successful responses for cacheable requests
    if (cacheKey && response && !response.error) {
      setCachedResponse(cacheKey, response);
      console.log(`✅ Cached: ${request.type} - ${cacheKey}`);
    }
    
    sendResponse(response);
  };
  
  // Execute original handler with wrapped sendResponse
  return handleRequestOriginal(request, sender, wrappedSendResponse);
};

const processNextRequest = () => {
  if (requestQueue.length === 0) {
    isProcessing = false;
    return;
  }
  isProcessing = true;
  const { request, sender, sendResponse } = requestQueue.shift();
  handleRequest(request, sender, sendResponse).finally(() => {
    processNextRequest();
  });
};

// Strategy Map data aggregation function
const getStrategyMapData = async () => {
  try {
    // Get current tier and learning state from TagService
    const currentTierData = await TagService.getCurrentTier();
    const learningState = await TagService.getCurrentLearningState();

    // Get all tag relationships to build tier structure
    const { dbHelper } = await import("../src/shared/db/index.js");
    const db = await dbHelper.openDB();

    const tagRelationships = await new Promise((resolve, reject) => {
      const tx = db.transaction("tag_relationships", "readonly");
      const store = tx.objectStore("tag_relationships");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // Get tag mastery data
    const tagMastery = await new Promise((resolve, reject) => {
      const tx = db.transaction("tag_mastery", "readonly");
      const store = tx.objectStore("tag_mastery");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // Organize tags by tier with mastery information
    const tierData = {};
    const tiers = [
      "Core Concept",
      "Fundamental Technique",
      "Advanced Technique",
    ];

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
            unlocked: successRate > 0 || tier === "Core Concept", // Core concepts always unlocked
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

const handleRequestOriginal = async (request, sender, sendResponse) => {
  // Record request for health monitoring
  backgroundScriptHealth.recordRequest();
  const requestStartTime = Date.now();
  
  // Generate unique request ID, including tag parameter for strategy requests
  let requestId = `${request.type}-${sender.tab?.id || "background"}`;
  if (request.type === "getStrategyForTag" && request.tag) {
    requestId = `${request.type}-${request.tag}-${sender.tab?.id || "background"}`;
  }

  if (activeRequests[requestId]) return;
  activeRequests[requestId] = true;
  
  const finishRequest = () => {
    delete activeRequests[requestId];
    const duration = Date.now() - requestStartTime;
    
    // Record timeout if request took too long
    if (duration > 10000) { // 10 second threshold
      backgroundScriptHealth.recordTimeout(duration);
      console.warn(`⏰ Slow request detected: ${request.type} took ${duration}ms`);
    }
    
    processNextRequest();
  };

  try {
    /* ──────────────── Backup & Restore ──────────────── */

    switch (request.type) {
      case "backupIndexedDB":
        console.log("📌 Starting backup process...");
        backupIndexedDB()
          .then(() => {
            console.log("✅ Backup completed.");
            sendResponse({ message: "Backup successful" });
          })
          .catch((error) => {
            console.error("❌ Backup error:", error);
            sendResponse({ error: error.message });
          });
        return true; // Keep response channel open for async call

      case "getBackupFile":
        console.log("📌 Retrieving backup file...");
        getBackupFile()
          .then((backup) => {
            console.log("✅ Backup file retrieved.");
            sendResponse({ backup });
          })
          .catch((error) => {
            console.error("❌ Error getting backup file:", error);
            sendResponse({ error: error.message });
          });
        return true;

      /** ──────────────── Storage Handlers ──────────────── **/
      case "setStorage":
        StorageService.set(request.key, request.value)
          .then(sendResponse)
          .finally(finishRequest);
        return true;
      case "getStorage":
        StorageService.get(request.key)
          .then(sendResponse)
          .finally(finishRequest);
        return true;
      case "removeStorage":
        StorageService.remove(request.key)
          .then(sendResponse)
          .finally(finishRequest);
        return true;
      /** ──────────────── User Onboarding ──────────────── **/
      case "onboardingUserIfNeeded":
        onboardUserIfNeeded()
          .then(sendResponse)
          .catch((error) => {
            console.error("❌ Error onboarding user:", error);
            sendResponse({ error: error.message });
            return true;
          })
          .finally(finishRequest);
        return true;
      /** ──────────────── User Settings ──────────────── **/
      case "setSettings":
        console.log('🔧 BACKGROUND DEBUG: Setting settings with data:', JSON.stringify(request.message, null, 2));
        StorageService.setSettings(request.message)
          .then((result) => {
            console.log('✅ BACKGROUND DEBUG: Settings saved successfully:', result);
            sendResponse(result);
          })
          .catch((error) => {
            console.error('❌ BACKGROUND DEBUG: Settings save failed:', error);
            sendResponse({ status: "error", message: error.message });
          })
          .finally(finishRequest);
        return true;
      case "getSettings":
        console.log('🔍 BACKGROUND DEBUG: Getting settings...');
        StorageService.getSettings()
          .then((settings) => {
            console.log('📖 BACKGROUND DEBUG: Retrieved settings:', JSON.stringify(settings, null, 2));
            sendResponse(settings);
          })
          .catch((error) => {
            console.error('❌ BACKGROUND DEBUG: Settings retrieval failed:', error);
            sendResponse(null);
          })
          .finally(finishRequest);
        return true;
      case "clearSettingsCache":
        // Clear settings cache from background script cache
        const settingsCacheKeys = ['settings_all', 'settings_'];
        let clearedCount = 0;
        
        for (const [key] of responseCache.entries()) {
          if (settingsCacheKeys.some(prefix => key.startsWith(prefix))) {
            responseCache.delete(key);
            console.log(`🗑️ Cleared settings cache key: ${key}`);
            clearedCount++;
          }
        }
        
        console.log(`🔄 Cleared ${clearedCount} settings cache entries`);
        
        // Also call StorageService method for any internal cleanup
        StorageService.clearSettingsCache();
        sendResponse({ status: "success", clearedCount });
        finishRequest();
        return true;

      case "clearSessionCache":
        // Clear session-related cache from background script cache
        const sessionCacheKeys = ['createSession', 'getActiveSession', 'session_'];
        let sessionClearedCount = 0;
        
        for (const [key] of responseCache.entries()) {
          if (sessionCacheKeys.some(prefix => key.startsWith(prefix))) {
            responseCache.delete(key);
            console.log(`🗑️ Cleared session cache key: ${key}`);
            sessionClearedCount++;
          }
        }
        
        console.log(`🔄 Cleared ${sessionClearedCount} session cache entries`);
        sendResponse({ status: "success", clearedCount: sessionClearedCount });
        finishRequest();
        return true;

      case "getSessionState":
        StorageService.getSessionState("session_state")
          .then(sendResponse)
          .finally(finishRequest);
        return true;

      /** ──────────────── Problems Management ──────────────── **/
      case "getProblemByDescription":
        console.log(
          "🧼 getProblemByDescription:",
          request.description,
          request.slug
        );
        ProblemService.getProblemByDescription(
          request.description,
          request.slug
        )
          .then(sendResponse)
          .catch((error) => {
            console.error("❌ Error in getProblemByDescription:", error);
            sendResponse({ error: error.message || "Problem not found" });
          })
          .finally(finishRequest);
        return true;
      case "countProblemsByBoxLevel":
        ProblemService.countProblemsByBoxLevel()
          .then((counts) => sendResponse({ status: "success", data: counts }))
          .catch(() => sendResponse({ status: "error" }))
          .finally(finishRequest);
        return true;

      case "addProblem":
        ProblemService.addOrUpdateProblem(
          request.contentScriptData,
          sendResponse
        )
          .then(() => sendResponse({ message: "Problem added successfully" }))
          .catch(() => sendResponse({ error: "Failed to add problem" }))
          .finally(finishRequest);
        return true;

      case "skipProblem":
        console.log("⏭️ Skipping problem:", request.consentScriptData?.leetCodeID || "unknown");
        // Acknowledge the skip request - no additional processing needed
        sendResponse({ message: "Problem skipped successfully" });
        finishRequest();
        return true;

      case "getAllProblems":
        ProblemService.getAllProblems()
          .then(sendResponse)
          .catch(() => sendResponse({ error: "Failed to retrieve problems" }))
          .finally(finishRequest);
        return true;

      /** ──────────────── Sessions Management ──────────────── **/
      case "getSession":
        SessionService.getSession()
          .then((session) => sendResponse({ session }))
          .catch(() => sendResponse({ error: "Failed to get session" }))
          .finally(finishRequest);
        return true;

      case "getOrCreateSession":
        const startTime = Date.now();
        
        // Determine session type from settings when not explicitly provided
        let sessionType = request.sessionType;
        if (!sessionType) {
          try {
            const settings = await StorageService.getSettings();
            console.log('🔍 BACKGROUND DEBUG: Auto-determining session type from settings:', JSON.stringify(settings, null, 2));
            
            if (settings?.interviewMode && settings.interviewMode !== 'disabled') {
              if (settings.interviewFrequency === 'manual') {
                // Return null to trigger banner display for manual interview mode
                console.log('🎯 BACKGROUND DEBUG: Manual interview mode detected, showing banner');
                sendResponse({ session: null });
                finishRequest();
                return true;
              } else {
                // Auto-create interview session for non-manual frequencies
                sessionType = settings.interviewMode;
                console.log('🎯 BACKGROUND DEBUG: Auto interview mode detected, using sessionType:', sessionType);
              }
            } else {
              // Default to standard for disabled or missing interview mode
              sessionType = 'standard';
              console.log('🔍 BACKGROUND DEBUG: No interview mode, defaulting to standard');
            }
          } catch (error) {
            console.error('Error checking settings for session type:', error);
            sessionType = 'standard'; // Safe fallback
          }
        }
        
        console.log('🎯 BACKGROUND DEBUG: Final sessionType determined:', sessionType);
        
        // Add timeout monitoring
        const timeoutId = setTimeout(() => {
          const elapsed = Date.now() - startTime;
          console.error(`⏰ getOrCreateSession TIMEOUT after ${elapsed}ms for ${sessionType}`);
        }, 30000);
        
        console.log('🎯 BACKGROUND DEBUG: Calling SessionService.getOrCreateSession with sessionType:', sessionType);
        withTimeout(
          SessionService.getOrCreateSession(sessionType),
          25000, // 25 second timeout for session creation
          `SessionService.getOrCreateSession(${sessionType})`
        )
          .then((session) => {
            console.log('🎯 BACKGROUND DEBUG: SessionService returned session:', {
              sessionId: session?.id?.substring(0, 8),
              sessionType: session?.sessionType,
              requestedType: sessionType,
              status: session?.status,
              matchesRequested: session?.sessionType === sessionType
            });
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            
            // Check if session is stale
            let isSessionStale = false;
            if (session) {
              const classification = SessionService.classifySessionState(session);
              isSessionStale = !['active', 'unclear'].includes(classification);
              console.log('🔍 Background: Session staleness check:', {
                sessionId: session.id?.substring(0, 8),
                sessionType: session.sessionType,
                classification: classification,
                isSessionStale: isSessionStale,
                lastActivityTime: session.lastActivityTime
              });
            }
            
            sendResponse({
              session: session,
              isSessionStale: isSessionStale,
              backgroundScriptData: `${sessionType} session retrieved in ${duration}ms`,
            });
          })
          .catch((error) => {
            const duration = Date.now() - startTime;
            console.error(`❌ Error in getOrCreateSession after ${duration}ms:`, error);
            
            sendResponse({
              session: null,
              backgroundScriptData: `Failed to create session`,
              error: `Session creation failed: ${error.message}`,
              duration: duration,
              isEmergencyResponse: true
            });
          })
          .finally(() => {
            clearTimeout(timeoutId);
            finishRequest();
          });
        return true;

      case "refreshSession":
        console.log("🔄 Refreshing session:", request.sessionType || 'standard');
        const refreshStartTime = Date.now();
        
        withTimeout(
          SessionService.refreshSession(request.sessionType || 'standard', true), // forceNew = true
          20000, // 20 second timeout for refresh
          `SessionService.refreshSession(${request.sessionType || 'standard'})`
        )
          .then((session) => {
            const refreshDuration = Date.now() - refreshStartTime;
            console.log("✅ Session refreshed in", refreshDuration + "ms");
            
            sendResponse({
              session: session,
              isSessionStale: false, // Fresh session is never stale
              backgroundScriptData: `Session refreshed in ${refreshDuration}ms`,
            });
          })
          .catch((error) => {
            const refreshDuration = Date.now() - refreshStartTime;
            console.error(`❌ Error refreshing session after ${refreshDuration}ms:`, error);
            
            sendResponse({
              session: null,
              backgroundScriptData: `Failed to refresh session`,
              error: `Session refresh failed: ${error.message}`,
            });
          })
          .finally(finishRequest);
        return true;

      case "getCurrentSession":
        // DEPRECATED: Use getOrCreateSession instead 
        // Kept for backward compatibility
        console.warn("⚠️ getCurrentSession is deprecated, use getOrCreateSession instead");
        // const fileUrl = chrome.runtime.getURL("LeetCode_Tags_Combined.json");
        // console.log("updateStandardProblems");
        // updateStandardProblemsFromData(leetCodeProblems)
        //   .then(() => {
        //     sendResponse({ message: "Standard problems updated" });
        //   })
        //   .catch((error) => {
        //     console.error("Error updating standard problems:", error);
        //     sendResponse({
        //       backgroundScriptData: "Error updating standard problems",
        //     });
        //   });
        // buildAndStoreTagGraph()
        //   .then(() => {
        //     sendResponse({ message: "Tag graph built" });
        //   })
        //   .catch((error) => {
        //     console.error("Error building tag graph:", error);
        //     sendResponse({
        //       backgroundScriptData: "Error building tag graph",
        //     });
        //   });
        // normalizeTagForStandardProblems()
        // .then(()=> {
        //   sendResponse({ message: "Tags updated in standard problems" });
        // })
        // .catch((error) => {
        //   console.error("Error updating tags:", error);
        //   sendResponse({
        //     backgroundScriptData: "Error updating tags",
        //   });
        // })
        // updateProblemWithTags()
        //   .then(() => {
        //     sendResponse({ message: "Tags updated" });
        //   })
        //   .catch((error) => {
        //     console.error("Error updating tags:", error);
        //   });
        // classifyTags()
        //   .then(() => {
        //     sendResponse({ message: "Tags classified" });
        //   })
        //   .catch((error) => {
        //     console.error("Error classifying tags:", error);
        //     sendResponse({
        //       backgroundScriptData: "Error classifying tags",
        //     });
        //   });
        // calculateTagMastery()
        //   .then(() => {
        //     sendResponse({ message: "Tag mastery calculated" });
        //   })
        //   .catch((error) => {
        //     console.error("Error calculating tag mastery:", error);
        //     sendResponse({
        //       backgroundScriptData: "Error calculating tag mastery",
        //     });
        //   });
        // rebuildProblemRelationships().then(() => {
        //   sendResponse({ message: "Problem relationships rebuilt" });
        // }).catch((error) => {
        //   console.error("Error rebuilding problem relationships:", error);
        //   sendResponse({
        //     backgroundScriptData: "Error rebuilding problem relationships",
        //   })})
        // addStabilityToProblems().then(() => {
        //   sendResponse({ message: "Stability added to problems" });
        // }).catch((error) => {
        //   console.error("Error adding stability to problems:", error);
        //   sendResponse({
        //     backgroundScriptData: "Error adding stability to problems",
        //   });
        // })
        // updateProblemsWithRating().then(() => {
        //   sendResponse({ message: "Problems updated with ratings" });
        // }).catch((error) => {
        //   console.error("Error updating problems with ratings:", error);
        //   sendResponse({
        //     backgroundScriptData: "Error updating problems with ratings",
        //   });
        // });
        // generatePatternLaddersAndUpdateTagMastery()
        //   .then(() => sendResponse({ message: "Pattern ladders and tag mastery updated" }))
        //   .catch((error) => {
        //   console.error("Error updating pattern ladders and tag mastery:", error);
        //   sendResponse({
        //     backgroundScriptData: "Error updating pattern ladders and tag mastery",
        //   });
        // })
        //  let result = await clearOrRenameStoreField("tag_mastery", {
        //    remove: ["ladderPreview"],
        //  }).catch(error => console.log(error))
        //  console.log("result", result)
        StorageService.getSettings()
          .then(async (settings) => {
            console.log("getCurrentSession - checking interview mode:", settings?.interviewMode, "frequency:", settings?.interviewFrequency);
            
            // Determine session type based on settings
            let sessionType = 'standard';
            if (settings?.interviewMode && settings.interviewMode !== "disabled") {
              sessionType = settings.interviewMode;
            }
            
            return SessionService.getOrCreateSession(sessionType);
          })
          .then((session) => {
            console.log("getCurrentSession - session:", session);
            sendResponse({
              session: session,
            });
          })
          .catch((error) => {
            console.error("Error retrieving session:", error);
            sendResponse({
              error: "Failed to get current session",
              session: [],
            });
          })
          .finally(finishRequest);
        return true;

      /** ──────────────── Session Stall Detection & Management ──────────────── **/
      case "manualSessionCleanup":
        console.log("🧹 Manual session cleanup triggered");
        cleanupStalledSessions()
          .then((result) => {
            console.log("✅ Manual cleanup completed:", result);
            sendResponse({ result });
          })
          .catch((error) => {
            console.error("❌ Manual cleanup failed:", error);
            sendResponse({ error: error.message });
          })
          .finally(finishRequest);
        return true;

      // Removed startDraftSession and refreshSession handlers - sessions auto-start now

      // Removed getDraftSession handler - drafts auto-start immediately now

      case "getSessionAnalytics":
        console.log("📊 Getting session analytics");
        (async () => {
          try {
            const stalledSessions = await SessionService.detectStalledSessions();
            const cleanupAnalytics = await new Promise(resolve => {
              chrome.storage.local.get(["sessionCleanupAnalytics"], (result) => {
                resolve(result.sessionCleanupAnalytics || []);
              });
            });

            const response = {
              stalledSessions: stalledSessions.length,
              stalledByType: stalledSessions.reduce((acc, s) => {
                acc[s.classification] = (acc[s.classification] || 0) + 1;
                return acc;
              }, {}),
              recentCleanups: cleanupAnalytics.slice(-5)
            };

            console.log("✅ Session analytics:", response);
            sendResponse(response);
          } catch (error) {
            console.error("❌ Failed to get session analytics:", error);
            sendResponse({ error: error.message });
          }
        })().finally(finishRequest);
        return true;

      case "classifyAllSessions":
        console.log("🔍 Classifying all sessions");
        (async () => {
          try {
            const sessions = await SessionService.getAllSessionsFromDB();
            const classifications = sessions.map(session => ({
              id: session.id.substring(0, 8),
              origin: session.origin,
              status: session.status,
              classification: SessionService.classifySessionState(session),
              lastActivity: session.lastActivityTime || session.date
            }));
            
            console.log(`✅ Classified ${classifications.length} sessions`);
            sendResponse({ classifications });
          } catch (error) {
            console.error("❌ Failed to classify sessions:", error);
            sendResponse({ error: error.message });
          }
        })().finally(finishRequest);
        return true;

      case "generateSessionFromTracking":
        console.log("🎯 Manual session generation from tracking triggered");
        SessionService.checkAndGenerateFromTracking()
          .then((session) => {
            console.log(session ? "✅ Session generated" : "📝 No session generated");
            sendResponse({ session });
          })
          .catch((error) => {
            console.error("❌ Failed to generate session from tracking:", error);
            sendResponse({ error: error.message });
          })
          .finally(finishRequest);
        return true;

      case "getSessionMetrics":
        console.log("📊 Getting separated session metrics");
        getSessionMetrics(request.options || {})
          .then((result) => {
            console.log("✅ Session metrics retrieved");
            sendResponse({ result });
          })
          .catch((error) => {
            console.error("❌ Failed to get session metrics:", error);
            sendResponse({ error: error.message });
          })
          .finally(finishRequest);
        return true;

      /** ──────────────── Interview Session Handlers (REMOVED - use getOrCreateSession with sessionType) ──────────────── **/

      case "checkInterviewFrequency":
        console.log("🕐 Checking interview frequency requirements");
        StorageService.getSettings()
          .then(async (settings) => {
            const shouldCreate = await SessionService.shouldCreateInterviewSession(
              settings?.interviewFrequency, 
              settings?.interviewMode
            );
            
            if (shouldCreate && settings?.interviewMode && settings?.interviewMode !== "disabled") {
              console.log(`Creating interview session based on ${settings.interviewFrequency} frequency`);
              return SessionService.createInterviewSession(settings.interviewMode);
            }
            
            console.log(`No interview session needed for ${settings?.interviewFrequency} frequency`);
            return null;
          })
          .then((session) => {
            sendResponse({ 
              session,
              backgroundScriptData: session ? "Frequency-based interview session created" : "No interview session needed"
            });
          })
          .catch((error) => {
            console.error("❌ Failed to check interview frequency:", error);
            sendResponse({ 
              error: "Failed to check interview frequency",
              session: null
            });
          })
          .finally(finishRequest);
        return true;

      case "getInterviewReadiness":
        console.log("🎯 Assessing interview readiness");
        InterviewService.assessInterviewReadiness()
          .then((readiness) => {
            console.log("✅ Interview readiness assessed:", readiness);
            sendResponse(readiness);
          })
          .catch((error) => {
            console.error("❌ Failed to assess interview readiness:", error);
            // Safe fallback for development
            sendResponse({
              interviewLikeUnlocked: true,
              fullInterviewUnlocked: true,
              reasoning: "Fallback mode - all modes available",
              metrics: { accuracy: 0, masteredTagsCount: 0, totalTags: 0, transferReadinessScore: 0 }
            });
          })
          .finally(finishRequest);
        return true;

      // NOTE: startInterviewSession removed - use getOrCreateSession with explicit sessionType instead

      case "getInterviewAnalytics":
        console.log("🎯 Getting interview analytics");
        lazyLoadDashboard().then(({ getInterviewAnalyticsData }) =>
          getInterviewAnalyticsData(request.filters)
        ).then((analyticsData) => {
            console.log("✅ Interview analytics retrieved:", analyticsData);
            sendResponse({ 
              ...analyticsData,
              backgroundScriptData: "Interview analytics retrieved from dashboard service"
            });
          })
          .catch((error) => {
            console.error("❌ Failed to get interview analytics:", error);
            sendResponse({ 
              analytics: [],
              metrics: {},
              recommendations: [],
              error: "Failed to get interview analytics"
            });
          })
          .finally(finishRequest);
        return true;

      case "completeInterviewSession":
        console.log(`🎯 Completing interview session ${request.sessionId}`);
        SessionService.checkAndCompleteInterviewSession(request.sessionId)
          .then((result) => {
            console.log("✅ Interview session completion result:", result);
            sendResponse({ 
              completed: result === true,
              unattemptedProblems: Array.isArray(result) ? result : [],
              backgroundScriptData: "Interview session completion handled"
            });
          })
          .catch((error) => {
            console.error("❌ Failed to complete interview session:", error);
            sendResponse({ 
              error: "Failed to complete interview session",
              completed: false
            });
          })
          .finally(finishRequest);
        return true;

      /** ──────────────── Limits & Problem Tracking ──────────────── **/
      case "getLimits":
        console.log("🔍 Getting adaptive limits for problem", request.id);

        console.log(
          "🔍 Calling adaptiveLimitsService.getLimits with problemId:",
          request.id
        );

        adaptiveLimitsService
          .getLimits(request.id)
          .then((limitsConfig) => {
            console.log(
              "✅ AdaptiveLimitsService returned successfully:",
              limitsConfig
            );

            if (!limitsConfig) {
              console.error("❌ AdaptiveLimitsService returned null/undefined");
              sendResponse({ error: "Service returned no data" });
              return;
            }

            // Transform to match expected format
            const limits = {
              limit: limitsConfig.difficulty,
              Time: limitsConfig.recommendedTime,
              // Include additional adaptive data for timer component
              adaptiveLimits: limitsConfig,
            };

            console.log("🔍 Sending limits response:", limits);
            sendResponse({ limits });
          })
          .catch((error) => {
            console.error(
              "❌ Error getting adaptive limits:",
              error,
              error.stack
            );
            sendResponse({ error: "Failed to get limits: " + error.message });
          })
          .finally(finishRequest);
        return true;

      /** ──────────────── Navigation Management ──────────────── **/
      case "navigate":
        NavigationService.navigate(request.route, request.time)
          .then(() => sendResponse({ result: "success" }))
          .catch(() => sendResponse({ result: "error" }))
          .finally(finishRequest);
        return true;
      /** ──────────────── Dashboard Management ──────────────── **/
      case "getDashboardStatistics":
        console.log("getDashboardStatistics!!!");
        lazyLoadDashboard().then(({ getDashboardStatistics }) =>
          getDashboardStatistics(request.options || {})
        ).then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      /** ──────────────── Background Script Health & Management ──────────────── **/
      case "backgroundScriptHealth":
        const healthReport = backgroundScriptHealth.getHealthReport();
        console.log("🏥 Background script health check:", healthReport);
        sendResponse({ status: "success", data: healthReport });
        finishRequest();
        return true;
        
      case "emergencyReset":
        console.warn("🚑 Emergency reset requested from content script");
        backgroundScriptHealth.emergencyReset();
        sendResponse({ status: "success", message: "Emergency reset completed" });
        finishRequest();
        return true;

      /** ──────────────── Strategy Map Data ──────────────── **/
      case "getStrategyMapData":
        console.log("🗺️ Getting Strategy Map data...");
        getStrategyMapData()
          .then((data) => sendResponse({ status: "success", data }))
          .catch((error) => {
            console.error("❌ Strategy Map error:", error);
            sendResponse({ status: "error", error: error.message });
          })
          .finally(finishRequest);
        return true;

      /** ──────────────── Strategy Data Operations ──────────────── **/
      case "getStrategyForTag":
        const cacheKey = `strategy_${request.tag}`;
        const cachedStrategy = getCachedResponse(cacheKey);

        if (cachedStrategy) {
          console.log(
            `🔍 BACKGROUND DEBUG: Using cached strategy for "${request.tag}"`
          );
          sendResponse(cachedStrategy);
          finishRequest();
          return true;
        }

        console.log(
          `🔍 BACKGROUND DEBUG: Getting strategy for tag "${request.tag}"`
        );
        (async () => {
          try {
            console.log(
              `🔍 BACKGROUND DEBUG: Getting strategy for tag "${request.tag}" (static import)`
            );
            const strategy = await getStrategyForTag(request.tag);
            console.log(
              `🔍 BACKGROUND DEBUG: Strategy result for "${request.tag}":`,
              strategy ? "FOUND" : "NOT FOUND"
            );

            const response = { status: "success", data: strategy };
            setCachedResponse(cacheKey, response);
            sendResponse(response);
            console.log(
              `🔍 BACKGROUND DEBUG: Response sent for getStrategyForTag "${request.tag}"`
            );
          } catch (error) {
            console.error(
              `❌ BACKGROUND DEBUG: Strategy error for "${request.tag}":`,
              error
            );
            const errorResponse = { status: "error", error: error.message };
            sendResponse(errorResponse);
            console.log(
              `🔍 BACKGROUND DEBUG: Error response sent for getStrategyForTag "${request.tag}"`
            );
          }
        })().finally(finishRequest);
        return true;

      case "getStrategiesForTags":
        console.log(
          `🎯 BACKGROUND: Getting strategies for tags:`,
          request.tags
        );
        (async () => {
          try {
            const strategies = {};
            await Promise.all(
              request.tags.map(async (tag) => {
                try {
                  const strategy = await getStrategyForTag(tag);
                  if (strategy) {
                    strategies[tag] = strategy;
                  }
                } catch (error) {
                  console.error(
                    `❌ BACKGROUND: Error getting strategy for "${tag}":`,
                    error
                  );
                }
              })
            );

            console.log(
              `🎯 BACKGROUND: Bulk strategies result:`,
              Object.keys(strategies)
            );
            sendResponse({ status: "success", data: strategies });
          } catch (error) {
            console.error(`❌ BACKGROUND: Bulk strategies error:`, error);
            sendResponse({ status: "error", error: error.message });
          }
        })().finally(finishRequest);
        return true;

      case "isStrategyDataLoaded":
        console.log(
          `🔍 BACKGROUND DEBUG: Handling isStrategyDataLoaded request`
        );
        (async () => {
          try {
            console.log(`🔍 BACKGROUND DEBUG: Importing strategy_data.js...`);
            const { isStrategyDataLoaded } = await import(
              "../src/shared/db/strategy_data.js"
            );
            console.log(
              `🔍 BACKGROUND DEBUG: Import successful, calling function...`
            );
            const loaded = await isStrategyDataLoaded();
            console.log(
              `🔍 BACKGROUND DEBUG: Strategy data loaded result:`,
              loaded
            );
            sendResponse({ status: "success", data: loaded });
            console.log(
              `🔍 BACKGROUND DEBUG: Response sent for isStrategyDataLoaded`
            );
          } catch (error) {
            console.error(
              `❌ BACKGROUND DEBUG: Strategy data check error:`,
              error
            );
            sendResponse({ status: "error", error: error.message });
            console.log(
              `🔍 BACKGROUND DEBUG: Error response sent for isStrategyDataLoaded`
            );
          }
        })().finally(finishRequest);
        return true;

      /** ──────────────── Dashboard Data Handlers ──────────────── **/
      case "getLearningProgressData":
        lazyLoadDashboard().then(({ getLearningProgressData }) =>
          getLearningProgressData(request.options || {})
        ).then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getGoalsData":
        (async () => {
          try {
            // 🎯 Get coordinated focus decision (unified data source)
            const focusDecision = await FocusCoordinationService.getFocusDecision("session_state");
            const settings = await StorageService.getSettings();
            
            // Use coordinated focus decision for consistency
            const focusAreas = focusDecision.activeFocusTags;
            const userFocusAreas = focusDecision.userPreferences;
            const systemFocusTags = focusDecision.systemRecommendation;
            
            console.log("🎯 Goals data using coordination service:", {
              focusAreas,
              userFocusAreas, 
              systemFocusTags,
              reasoning: focusDecision.algorithmReasoning
            });
            
            const { getGoalsData } = await lazyLoadDashboard();
            const result = await getGoalsData(request.options || {}, { 
              settings, 
              focusAreas,
              userFocusAreas,
              systemFocusTags,
              focusDecision // Pass full decision for additional context
            });
            sendResponse({ result });
          } catch (error) {
            console.error("❌ Error in getGoalsData handler:", error);
            sendResponse({ error: error.message });
          }
        })()
          .finally(finishRequest);
        return true;

      case "getStatsData":
        lazyLoadDashboard().then(({ getStatsData }) =>
          getStatsData(request.options || {})
        ).then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getSessionHistoryData":
        lazyLoadDashboard().then(({ getSessionHistoryData }) =>
          getSessionHistoryData(request.options || {})
        ).then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getProductivityInsightsData":
        lazyLoadDashboard().then(({ getProductivityInsightsData }) =>
          getProductivityInsightsData(request.options || {})
        ).then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getTagMasteryData":
        lazyLoadDashboard().then(({ getTagMasteryData }) =>
          getTagMasteryData(request.options || {})
        ).then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getLearningStatus":
        (async () => {
          try {
            const { SessionService } = await import("../src/shared/services/sessionService.js");
            const cadenceData = await SessionService.getTypicalCadence();
            
            sendResponse({
              totalSessions: cadenceData.totalSessions || 0,
              learningPhase: cadenceData.learningPhase || true,
              confidenceScore: cadenceData.confidenceScore || 0,
              dataSpanDays: cadenceData.dataSpanDays || 0
            });
          } catch (error) {
            console.error("❌ Error in getLearningStatus handler:", error);
            sendResponse({
              totalSessions: 0,
              learningPhase: true,
              confidenceScore: 0,
              dataSpanDays: 0
            });
          }
        })()
          .finally(finishRequest);
        return true;

      case "getFocusAreasData":
        (async () => {
          try {
            const { StorageService } = await import("../src/shared/services/storageService.js");
            const { TagService } = await import("../src/shared/services/tagServices.js");
            
            // Load focus areas from settings with fallback
            const settings = await StorageService.getSettings();
            let focusAreas = settings.focusAreas || [];
            
            // Provide fallback focus areas if none configured (like content script pattern)
            if (focusAreas.length === 0) {
              focusAreas = ["array", "hash table", "string", "dynamic programming", "tree"];
              console.log("🔄 BACKGROUND: Using fallback focus areas");
            }
            
            // Get learning state data
            const learningState = await TagService.getCurrentLearningState();
            
            // Check for graduation status
            const graduationStatus = await TagService.checkFocusAreasGraduation();
            
            sendResponse({ 
              result: {
                focusAreas,
                masteryData: learningState.masteryData || [],
                masteredTags: learningState.masteredTags || [],
                graduationStatus
              }
            });
          } catch (error) {
            console.error("❌ Error in getFocusAreasData handler:", error);
            sendResponse({ 
              result: { 
                focusAreas: [],
                masteryData: [],
                masteredTags: [],
                graduationStatus: null
              }
            });
          }
        })()
          .finally(finishRequest);
        return true;

      case "graduateFocusAreas":
        (async () => {
          try {
            const { TagService } = await import("../src/shared/services/tagServices.js");
            const result = await TagService.graduateFocusAreas();
            sendResponse({ result });
          } catch (error) {
            console.error("❌ Error in graduateFocusAreas handler:", error);
            sendResponse({ error: error.message });
          }
        })()
          .finally(finishRequest);
        return true;

      case "getLearningPathData":
        lazyLoadDashboard().then(({ getLearningPathData }) =>
          getLearningPathData(request.options || {})
        ).then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getMistakeAnalysisData":
        lazyLoadDashboard().then(({ getMistakeAnalysisData }) =>
          getMistakeAnalysisData(request.options || {})
        ).then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      /** ──────────────── Hint Interaction Database Operations ──────────────── **/

      case "saveHintInteraction":
        console.log("💾 Saving hint interaction from content script");
        
        // Get problem context in background script first to avoid IndexedDB access in content script
        (async () => {
          let enrichedData = { ...request.data };
          
          if (request.data.problemId) {
            try {
              const problem = await getProblem(request.data.problemId);
              if (problem) {
                enrichedData.boxLevel = problem.box || 1;
                enrichedData.problemDifficulty = problem.difficulty || "Medium";
                console.log("✅ Enriched hint interaction with problem context:", {
                  problemId: problem.id,
                  boxLevel: enrichedData.boxLevel,
                  difficulty: enrichedData.problemDifficulty
                });
              }
            } catch (error) {
              console.warn("Could not enrich with problem context:", error);
              // Continue with fallback values - no problem context but interaction still saved
            }
          }
          
          return HintInteractionService.saveHintInteraction(enrichedData, request.sessionContext || {});
        })()
          .then((interaction) => sendResponse({ interaction }))
          .catch((error) => {
            console.error("❌ Background script failed to save hint interaction:", error);
            sendResponse({ error: error.message });
          })
          .finally(finishRequest);
        return true;

      case "getInteractionsByProblem":
        HintInteractionService.getInteractionsByProblem(request.problemId)
          .then((interactions) => sendResponse({ interactions }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getInteractionsBySession":
        HintInteractionService.getInteractionsBySession(request.sessionId)
          .then((interactions) => sendResponse({ interactions }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getInteractionStats":
        HintInteractionService.getInteractionStats(request.filters || {})
          .then((stats) => sendResponse({ stats }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getFocusAreaAnalytics":
        lazyLoadDashboard().then(({ getFocusAreaAnalytics }) =>
          getFocusAreaAnalytics(request.options || {})
        ).then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getAvailableTagsForFocus":
        console.log("🔍 BACKGROUND: Starting getAvailableTagsForFocus with userId:", request.userId);
        TagService.getAvailableTagsForFocus(request.userId)
          .then((result) => {
            console.log("🔍 BACKGROUND: TagService returned result:", result);
            console.log("🔍 BACKGROUND: Sending response with result");
            sendResponse({ result });
          })
          .catch((error) => {
            console.error("❌ BACKGROUND: TagService error:", error);
            sendResponse({ error: error.message });
          })
          .finally(() => {
            console.log("🔍 BACKGROUND: Finishing request");
            finishRequest();
          });
        return true;

      case "clearFocusAreaAnalyticsCache":
        try {
          clearFocusAreaAnalyticsCache();
          sendResponse({ result: "Cache cleared successfully" });
        } catch (error) {
          console.error("❌ clearFocusAreaAnalyticsCache error:", error);
          sendResponse({ error: error.message });
        }
        finishRequest();
        return true;

      case "getSimilarProblems":
        (async () => {
          try {
            const { buildRelationshipMap } = await import("../src/shared/db/problem_relationships.js");
            const { fetchAllProblems } = await import("../src/shared/db/problems.js");
            const { getAllStandardProblems } = await import("../src/shared/db/standard_problems.js");
            
            // Get all data sources
            const relationshipMap = await buildRelationshipMap();
            const allUserProblems = await fetchAllProblems();
            const standardProblems = await getAllStandardProblems();
            
            // Create comprehensive ID mapping from standard problems (the authoritative source)
            const standardProblemsById = new Map(); // numeric id -> standard problem
            const slugToStandardProblem = new Map(); // slug -> standard problem
            const titleToStandardProblem = new Map(); // title -> standard problem
            
            standardProblems.forEach(problem => {
              standardProblemsById.set(problem.id, problem);
              if (problem.slug) {
                slugToStandardProblem.set(problem.slug, problem);
              }
              if (problem.title) {
                titleToStandardProblem.set(problem.title, problem);
              }
            });
            
            // Since we're now receiving numeric IDs directly from Generator, use them directly
            const numericProblemId = parseInt(request.problemId);
            
            // Get similar problems from relationships using numeric ID
            const relationships = relationshipMap.get(numericProblemId) || {};
            
            const similarProblems = [];
            
            // Sort by relationship strength and take top N
            const sortedRelationships = Object.entries(relationships)
              .sort(([,a], [,b]) => b - a) // Sort by strength descending
              .slice(0, request.limit || 5);
            
            for (const [relatedNumericId, strength] of sortedRelationships) {
              const relatedId = parseInt(relatedNumericId);
              
              // Skip if this is the same problem as the one we're getting similar problems for
              if (relatedId === numericProblemId) {
                continue;
              }
              
              // Get standard problem data using numeric ID
              const relatedStandardProblem = standardProblemsById.get(relatedId);
              
              if (relatedStandardProblem) {
                similarProblems.push({
                  id: relatedStandardProblem.id,
                  title: relatedStandardProblem.title,
                  difficulty: relatedStandardProblem.difficulty,
                  slug: relatedStandardProblem.slug,
                  strength: strength
                });
              }
            }
            
            sendResponse({ similarProblems });
          } catch (error) {
            console.error("❌ getSimilarProblems error:", error);
            sendResponse({ similarProblems: [] });
          }
        })().finally(finishRequest);
        return true;

      /** ──────────────── Database Proxy ──────────────── **/
      case "DATABASE_OPERATION":
        (async () => {
          try {
            const { operation, params } = request;
            console.log(`📊 DATABASE_OPERATION: ${operation} on ${params.storeName}`, params);
            const { getRecord, addRecord, updateRecord, deleteRecord, getAllFromStore } = await import("../src/shared/db/common.js");

            let result;
            switch (operation) {
              case "getRecord":
                result = await getRecord(params.storeName, params.id);
                break;
              case "addRecord":
                result = await addRecord(params.storeName, params.record);
                break;
              case "updateRecord":
                console.log(`📝 Updating record ${params.id} in ${params.storeName}:`, params.record);
                result = await updateRecord(params.storeName, params.id, params.record);
                console.log(`✅ Update completed for ${params.id}:`, result);
                break;
              case "deleteRecord":
                result = await deleteRecord(params.storeName, params.id);
                break;
              case "getAllFromStore":
                result = await getAllFromStore(params.storeName);
                break;
              default:
                throw new Error(`Unknown database operation: ${operation}`);
            }

            console.log(`📊 DATABASE_OPERATION result:`, result);
            sendResponse({ data: result });
          } catch (error) {
            console.error(`❌ Database proxy error for ${request.operation}:`, error);
            sendResponse({ error: error.message });
          }
        })().finally(finishRequest);
        return true;

      /** ──────────────── Session Consistency & Habits ──────────────── **/
      case "getSessionPatterns":
        console.log("🔍 Getting session patterns for consistency analysis");
        (async () => {
          try {
            const { SessionService } = await import("../src/shared/services/sessionService.js");
            
            const [currentStreak, cadence, weeklyProgress] = await Promise.all([
              SessionService.getCurrentStreak(),
              SessionService.getTypicalCadence(),
              SessionService.getWeeklyProgress()
            ]);
            
            const patterns = {
              currentStreak,
              cadence,
              weeklyProgress,
              lastUpdated: new Date().toISOString()
            };
            
            console.log("✅ Session patterns retrieved:", patterns);
            sendResponse({ result: patterns });
          } catch (error) {
            console.error("❌ Error getting session patterns:", error);
            sendResponse({ error: error.message });
          }
        })().finally(finishRequest);
        return true;

      case "checkConsistencyAlerts":
        console.log("🔔 Checking consistency alerts for reminders");
        (async () => {
          try {
            const { SessionService } = await import("../src/shared/services/sessionService.js");
            const { StorageService } = await import("../src/shared/services/storageService.js");
            
            // Get user's reminder settings
            const settings = await StorageService.getSettings();
            const reminderSettings = settings?.reminder || { enabled: false };
            
            console.log("🔍 Using reminder settings:", reminderSettings);
            
            // Run comprehensive consistency check
            const consistencyCheck = await SessionService.checkConsistencyAlerts(reminderSettings);
            
            console.log(`✅ Consistency check complete: ${consistencyCheck.alerts?.length || 0} alerts`);
            sendResponse({ result: consistencyCheck });
          } catch (error) {
            console.error("❌ Error checking consistency alerts:", error);
            sendResponse({ 
              result: { 
                hasAlerts: false, 
                reason: "check_failed", 
                alerts: [],
                error: error.message 
              }
            });
          }
        })().finally(finishRequest);
        return true;

      case "getStreakRiskTiming":
        console.log("🔥 Getting streak risk timing analysis");
        (async () => {
          try {
            const { SessionService } = await import("../src/shared/services/sessionService.js");
            const streakTiming = await SessionService.getStreakRiskTiming();
            
            console.log("✅ Streak risk timing retrieved:", streakTiming);
            sendResponse({ result: streakTiming });
          } catch (error) {
            console.error("❌ Error getting streak risk timing:", error);
            sendResponse({ error: error.message });
          }
        })().finally(finishRequest);
        return true;

      case "getReEngagementTiming":
        console.log("👋 Getting re-engagement timing analysis");
        (async () => {
          try {
            const { SessionService } = await import("../src/shared/services/sessionService.js");
            const reEngagementTiming = await SessionService.getReEngagementTiming();
            
            console.log("✅ Re-engagement timing retrieved:", reEngagementTiming);
            sendResponse({ result: reEngagementTiming });
          } catch (error) {
            console.error("❌ Error getting re-engagement timing:", error);
            sendResponse({ error: error.message });
          }
        })().finally(finishRequest);
        return true;

      default:
        sendResponse({ error: "Unknown request type" });
        finishRequest();
        return false;
    }
  } catch (error) {
    sendResponse({ error: "Failed to handle request" });
    finishRequest();
  }
};

const contentPorts = {};

chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Check for existing dashboard tabs first
    const existingTabs = await chrome.tabs.query({ url: chrome.runtime.getURL("app.html") });
    
    if (existingTabs.length > 0) {
      // Focus the existing dashboard tab instead of creating a new one
      const existingTab = existingTabs[0];
      console.log("📱 Focusing existing dashboard tab:", existingTab.id);
      
      // Update and focus the existing tab
      await chrome.tabs.update(existingTab.id, { active: true });
      
      // Move to the window containing the tab if needed
      if (existingTab.windowId) {
        await chrome.windows.update(existingTab.windowId, { focused: true });
      }
    } else {
      // No existing dashboard tab found, create a new one
      console.log("📱 Creating new dashboard tab");
      chrome.tabs.create({ url: "app.html" });
    }
  } catch (error) {
    console.error("❌ Error handling dashboard tab:", error);
    // Fallback: create new tab anyway
    chrome.tabs.create({ url: "app.html" });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("🔍 BACKGROUND DEBUG: Received request:", request.type, request);

  // Enhanced health check handler for service worker diagnostics
  if (request.type === 'HEALTH_CHECK') {
    console.log('💚 SERVICE WORKER: Health check received');
    const healthData = {
      status: 'healthy', 
      timestamp: Date.now(),
      activeRequests: Object.keys(activeRequests).length,
      queueLength: requestQueue.length,
      isProcessing: isProcessing,
      uptime: Date.now() - (global.backgroundStartTime || Date.now()),
      memory: performance.memory ? {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      } : null,
      activeRequestTypes: Object.keys(activeRequests)
    };
    console.log('📊 SERVICE WORKER Health Details:', healthData);
    sendResponse(healthData);
    return true;
  }

  requestQueue.push({ request, sender, sendResponse });
  if (!isProcessing) processNextRequest();

  return true; // Keep response channel open
});

/** ──────────────── Session Consistency Alarm System ──────────────── **/

// Initialize consistency check alarm on startup
chrome.runtime.onStartup.addListener(() => {
  console.log("🚀 Background script startup - initializing consistency system");
  initializeConsistencySystem();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("🚀 Extension installed/updated - initializing consistency system");
  initializeConsistencySystem();
});

/**
 * Initialize the complete consistency system with API safety checks
 */
function initializeConsistencySystem() {
  try {
    console.log("🔧 Initializing consistency system with API safety checks...");
    
    // Set up alarm listener
    setupAlarmListener();
    
    // Set up notification click handlers
    setupNotificationClickHandlers();
    
    // Initialize alarms if API is available
    if (typeof chrome !== 'undefined' && chrome?.alarms) {
      initializeConsistencyAlarm();
    } else {
      console.warn("⚠️ Chrome alarms API not available - using fallback mode");
    }
    
    console.log("✅ Consistency system initialization complete");
  } catch (error) {
    console.error("❌ Error initializing consistency system:", error);
    console.warn("⚠️ Some consistency features may not work properly");
  }
}

/**
 * Initialize the daily consistency check alarm with Chrome API safety checks
 * Runs once per day at 6 PM to check for reminder conditions
 */
async function initializeConsistencyAlarm() {
  try {
    // Check Chrome alarms API availability
    if (!chrome?.alarms?.create || !chrome?.alarms?.clear) {
      console.warn("⚠️ Chrome alarms API methods not available - skipping alarm creation");
      return;
    }

    // Clear any existing alarm first
    await chrome.alarms.clear('consistency-check');
    console.log("🗑️ Cleared existing consistency alarm");
    
    // Create new daily alarm at 6 PM (18:00)
    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(18, 0, 0, 0); // 6 PM today
    
    // If it's already past 6 PM today, set for tomorrow
    if (now >= targetTime) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
    
    const delayInMinutes = (targetTime.getTime() - now.getTime()) / (1000 * 60);
    
    await chrome.alarms.create('consistency-check', {
      delayInMinutes: delayInMinutes,
      periodInMinutes: 24 * 60 // 24 hours = 1440 minutes
    });
    
    console.log(`⏰ Consistency alarm created - next check in ${Math.round(delayInMinutes)} minutes at ${targetTime.toLocaleString()}`);
  } catch (error) {
    console.error("❌ Error initializing consistency alarm:", error);
    console.warn("⚠️ Alarm creation failed - consistency reminders will not work until extension is reloaded");
  }
}

/**
 * Handle alarm triggers - with Chrome API availability check
 */
function setupAlarmListener() {
  if (typeof chrome !== 'undefined' && chrome?.alarms?.onAlarm) {
    chrome.alarms.onAlarm.addListener(async (alarm) => {
      console.log(`⏰ Alarm triggered: ${alarm.name}`);
      
      if (alarm.name === 'consistency-check') {
        console.log("🔔 Running daily consistency check...");
        await performConsistencyCheck();
      }
    });
    console.log("✅ Chrome alarms listener registered successfully");
  } else {
    console.warn("⚠️ Chrome alarms API not available - notification scheduling disabled");
  }
}

/**
 * Perform the daily consistency check and show notifications if needed
 * This is the main function that determines what reminders to show
 */
async function performConsistencyCheck() {
  try {
    console.log("🔍 Starting consistency check at", new Date().toLocaleString());
    
    // Get user settings to check if reminders are enabled
    const { StorageService } = await import("../src/shared/services/storageService.js");
    const settings = await StorageService.getSettings();
    
    // CONSERVATIVE DEFAULT: All reminder types disabled by default for prerelease safety
    const reminderSettings = settings?.reminder || { 
      enabled: false,
      streakAlerts: false,
      cadenceNudges: false,
      weeklyGoals: false,
      reEngagement: false
    };
    
    console.log("📋 Reminder settings:", reminderSettings);
    
    if (!reminderSettings?.enabled) {
      console.log("⏸️ Reminders disabled - skipping consistency check");
      return;
    }
    
    // PRERELEASE SAFETY: Double-check that at least one reminder type is enabled
    const hasAnyReminderEnabled = reminderSettings.streakAlerts || 
                                   reminderSettings.cadenceNudges || 
                                   reminderSettings.weeklyGoals || 
                                   reminderSettings.reEngagement;
    
    if (!hasAnyReminderEnabled) {
      console.log("⏸️ No specific reminder types enabled - skipping consistency check");
      return;
    }
    
    // Run the comprehensive consistency check
    const { SessionService } = await import("../src/shared/services/sessionService.js");
    const consistencyCheck = await SessionService.checkConsistencyAlerts(reminderSettings);
    
    console.log(`📊 Consistency check result: ${consistencyCheck.alerts?.length || 0} alerts found`);
    
    if (consistencyCheck.hasAlerts && consistencyCheck.alerts.length > 0) {
      // PRERELEASE SAFETY: Check if we already sent a notification today
      const lastNotificationDate = await getLastNotificationDate();
      const today = new Date().toDateString();
      
      if (lastNotificationDate === today) {
        console.log("🚫 Already sent notification today - respecting daily limit");
        return;
      }
      
      // Show the highest priority alert (limit to 1 notification per day)
      const highestPriorityAlert = getHighestPriorityAlert(consistencyCheck.alerts);
      await showConsistencyNotification(highestPriorityAlert);
      
      // Record notification date for daily limit enforcement
      await recordNotificationDate(today);
    } else {
      console.log("✅ No consistency alerts needed - user is on track");
    }
    
    // Log analytics for tracking
    logConsistencyCheckAnalytics(consistencyCheck);
    
  } catch (error) {
    console.error("❌ Error during consistency check:", error);
  }
}

/**
 * Get the highest priority alert from the list
 * Priority order: high -> medium -> low
 */
function getHighestPriorityAlert(alerts) {
  const priorityOrder = { high: 3, medium: 2, low: 1 };
  
  return alerts.reduce((highest, current) => {
    const currentPriority = priorityOrder[current.priority] || 0;
    const highestPriority = priorityOrder[highest.priority] || 0;
    
    return currentPriority > highestPriority ? current : highest;
  });
}

/**
 * PRERELEASE SAFETY: Get the last notification date to enforce daily limits
 * @returns {Promise<string|null>} Last notification date string or null
 */
async function getLastNotificationDate() {
  try {
    if (!chrome?.storage?.local?.get) {
      console.warn("⚠️ Chrome storage API not available - cannot check last notification date");
      return null;
    }
    
    const result = await chrome.storage.local.get(['lastNotificationDate']);
    return result.lastNotificationDate || null;
  } catch (error) {
    console.error("Error getting last notification date:", error);
    return null;
  }
}

/**
 * PRERELEASE SAFETY: Record notification date for daily limit enforcement
 * @param {string} dateString - Date string to record
 */
async function recordNotificationDate(dateString) {
  try {
    if (!chrome?.storage?.local?.set) {
      console.warn("⚠️ Chrome storage API not available - cannot record notification date");
      return;
    }
    
    await chrome.storage.local.set({ lastNotificationDate: dateString });
    console.log(`📝 Recorded notification date: ${dateString}`);
  } catch (error) {
    console.error("Error recording notification date:", error);
  }
}

/**
 * Show browser notification for consistency reminder with Chrome API safety checks
 * @param {Object} alert - The alert object with message and data
 */
async function showConsistencyNotification(alert) {
  try {
    console.log("📢 Routing consistency notification to AlertingService:", alert.type);
    
    // Route to appropriate AlertingService method based on alert type
    switch (alert.type) {
      case "streak_alert":
        AlertingService.sendStreakAlert(
          alert.data?.currentStreak || 0,
          alert.data?.daysSince || 0
        );
        break;
        
      case "cadence_nudge":
        AlertingService.sendCadenceNudge(
          alert.data?.typicalCadence || "daily",
          alert.data?.daysSince || 0
        );
        break;
        
      case "weekly_goal":
        AlertingService.sendWeeklyGoalReminder({
          completedSessions: alert.data?.completedSessions || 0,
          targetSessions: alert.data?.targetSessions || 3,
          remainingDays: alert.data?.remainingDays || 0
        });
        break;
        
      case "re_engagement":
        AlertingService.sendReEngagementPrompt(
          alert.data?.daysSince || 0,
          alert.data?.lastActivity || "session"
        );
        break;
        
      default:
        console.warn(`Unknown alert type: ${alert.type}, using generic re-engagement`);
        AlertingService.sendReEngagementPrompt(
          alert.data?.daysSince || 0,
          "session"
        );
        break;
    }
    
    console.log(`✅ Consistency notification sent via AlertingService: ${alert.type}`);
    
  } catch (error) {
    console.error("❌ Error showing consistency notification:", error);
    console.warn("⚠️ Notification display failed - consistency reminders may not appear");
  }
}

/**
 * Handle notification clicks - route to appropriate action with Chrome API safety
 */
function setupNotificationClickHandlers() {
  if (chrome?.notifications?.onClicked) {
    chrome.notifications.onClicked.addListener(async (notificationId) => {
      console.log(`🖱️ Notification clicked: ${notificationId}`);
      
      if (notificationId.startsWith('consistency-')) {
        try {
          // Get notification data (with API safety check)
          if (chrome?.storage?.local?.get) {
            const result = await chrome.storage.local.get(`notification_${notificationId}`);
            const notificationData = result[`notification_${notificationId}`];
            
            if (notificationData) {
              console.log("📝 Notification data:", notificationData);
              
              // Route to dashboard or session generation
              await routeToSession(notificationData);
              
              // Clean up notification data (with API safety checks)
              if (chrome?.notifications?.clear && chrome?.storage?.local?.remove) {
                await chrome.notifications.clear(notificationId);
                await chrome.storage.local.remove(`notification_${notificationId}`);
              }
            }
          }
        } catch (error) {
          console.error("❌ Error handling notification click:", error);
        }
      }
    });
  }

  if (chrome?.notifications?.onButtonClicked) {
    chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
      console.log(`🖱️ Notification button clicked: ${notificationId}, button: ${buttonIndex}`);
      
      if (notificationId.startsWith('consistency-')) {
        try {
          if (buttonIndex === 0) { // "Start Session" button
            if (chrome?.storage?.local?.get) {
              const result = await chrome.storage.local.get(`notification_${notificationId}`);
              const notificationData = result[`notification_${notificationId}`];
              
              if (notificationData) {
                await routeToSession(notificationData);
              }
            }
          }
          // Button 1 is "Later" - just dismiss the notification
          
          // Clean up (with API safety checks)
          if (chrome?.notifications?.clear && chrome?.storage?.local?.remove) {
            await chrome.notifications.clear(notificationId);
            await chrome.storage.local.remove(`notification_${notificationId}`);
          }
        } catch (error) {
          console.error("❌ Error handling notification button click:", error);
        }
      }
    });
  }

  if (chrome?.notifications?.onClicked || chrome?.notifications?.onButtonClicked) {
    console.log("✅ Notification click handlers registered successfully");
  } else {
    console.warn("⚠️ Chrome notifications click handlers not available - notifications will not be interactive");
  }
}

/**
 * Route user to appropriate session/dashboard page
 * @param {Object} notificationData - Data about the notification type
 */
async function routeToSession(notificationData) {
  try {
    console.log("🚀 Routing to session from notification:", notificationData.type);
    
    // Try to find existing dashboard tab first
    const dashboardTabs = await chrome.tabs.query({ url: chrome.runtime.getURL("app.html") });
    
    if (dashboardTabs.length > 0) {
      // Focus existing dashboard tab
      const dashboardTab = dashboardTabs[0];
      await chrome.tabs.update(dashboardTab.id, { active: true });
      await chrome.windows.update(dashboardTab.windowId, { focused: true });
      console.log("📱 Focused existing dashboard tab");
    } else {
      // Create new dashboard tab
      await chrome.tabs.create({ url: "app.html" });
      console.log("📱 Created new dashboard tab");
    }
    
    // Log analytics for notification engagement
    logNotificationEngagement(notificationData);
    
  } catch (error) {
    console.error("❌ Error routing to session:", error);
  }
}

/**
 * Log consistency check analytics for tracking system effectiveness
 * @param {Object} consistencyCheck - The consistency check result
 */
function logConsistencyCheckAnalytics(consistencyCheck) {
  try {
    const analyticsEvent = {
      type: "consistency_check_completed",
      timestamp: new Date().toISOString(),
      hasAlerts: consistencyCheck.hasAlerts,
      alertCount: consistencyCheck.alerts?.length || 0,
      alertTypes: consistencyCheck.alerts?.map(a => a.type) || [],
      reason: consistencyCheck.reason
    };
    
    console.log("📊 Consistency check analytics:", analyticsEvent);
    
    // Store in Chrome storage for dashboard analytics
    chrome.storage.local.get(["consistencyAnalytics"], (result) => {
      const analytics = result.consistencyAnalytics || [];
      analytics.push(analyticsEvent);
      
      // Keep only last 30 consistency checks
      const recentAnalytics = analytics.slice(-30);
      chrome.storage.local.set({ consistencyAnalytics: recentAnalytics });
    });
    
  } catch (error) {
    console.warn("Warning: Could not log consistency analytics:", error);
  }
}

/**
 * Log notification engagement for effectiveness tracking
 * @param {Object} notificationData - The notification data
 */
function logNotificationEngagement(notificationData) {
  try {
    const engagementEvent = {
      type: "notification_engaged",
      timestamp: new Date().toISOString(),
      notificationType: notificationData.type,
      createdAt: notificationData.createdAt
    };
    
    console.log("📊 Notification engagement:", engagementEvent);
    
    // Store in Chrome storage for tracking click-through rates
    chrome.storage.local.get(["notificationEngagement"], (result) => {
      const engagement = result.notificationEngagement || [];
      engagement.push(engagementEvent);
      
      // Keep only last 50 engagement events
      const recentEngagement = engagement.slice(-50);
      chrome.storage.local.set({ notificationEngagement: recentEngagement });
    });
    
  } catch (error) {
    console.warn("Warning: Could not log notification engagement:", error);
  }
}

/** ──────────────── Session Cleanup Jobs ──────────────── **/

/**
 * Clean up stalled and abandoned sessions based on intelligent classification
 * Runs periodically to maintain session health
 */
async function cleanupStalledSessions() {
  console.log('🧹 Starting session cleanup job...');
  
  try {
    const stalledSessions = await SessionService.detectStalledSessions();
    
    if (stalledSessions.length === 0) {
      console.log('✅ No stalled sessions found');
      return { cleaned: 0, actions: [] };
    }
    
    const actions = [];
    
    for (const { session, classification, action } of stalledSessions) {
      const sessionId = session.id.substring(0, 8);
      console.log(`🔧 Processing ${sessionId}: ${classification} -> ${action}`);
      
      try {
        switch (action) {
          case 'expire':
            session.status = 'expired';
            session.lastActivityTime = new Date().toISOString();
            await SessionService.updateSessionInDB(session);
            console.log(`⏰ Expired session ${sessionId}`);
            actions.push(`expired:${sessionId}`);
            break;
            
          case 'auto_complete':
            session.status = 'completed';
            session.lastActivityTime = new Date().toISOString();
            await SessionService.updateSessionInDB(session);
            
            // Run performance analysis for completed sessions
            await SessionService.summarizeSessionPerformance(session);
            console.log(`✅ Auto-completed session ${sessionId}`);
            actions.push(`completed:${sessionId}`);
            break;
            
          case 'create_new_tracking':
            // Mark old tracking session as completed
            session.status = 'completed';
            await SessionService.updateSessionInDB(session);
            
            // No need to create new tracking here - SAE will do it on next attempt
            console.log(`🔄 Marked tracking session ${sessionId} for replacement`);
            actions.push(`tracking_replaced:${sessionId}`);
            break;
            
          case 'refresh_guided_session':
            // For tracking-only users, mark their guided session for refresh
            // This will be picked up by auto-generation logic
            session.metadata = { 
              ...session.metadata, 
              needsRefreshFromTracking: true,
              markedAt: new Date().toISOString()
            };
            await SessionService.updateSessionInDB(session);
            console.log(`🎯 Flagged guided session ${sessionId} for tracking-based refresh`);
            actions.push(`flagged_for_refresh:${sessionId}`);
            break;
            
          case 'flag_for_user_choice':
            // Add metadata for UI to show user options
            session.metadata = { 
              ...session.metadata, 
              stalledDetected: true,
              stalledAt: new Date().toISOString(),
              classification: classification
            };
            await SessionService.updateSessionInDB(session);
            console.log(`🏃 Flagged session ${sessionId} for user decision`);
            actions.push(`user_choice:${sessionId}`);
            break;
            
          default:
            console.log(`❓ No action for ${sessionId}:${classification}`);
        }
      } catch (error) {
        console.error(`❌ Error processing session ${sessionId}:`, error);
        actions.push(`error:${sessionId}`);
      }
    }
    
    console.log(`✅ Session cleanup completed: ${actions.length} actions taken`);
    
    // Log cleanup analytics
    logSessionCleanupAnalytics(stalledSessions, actions);
    
    return { cleaned: actions.length, actions };
    
  } catch (error) {
    console.error('❌ Session cleanup job failed:', error);
    return { cleaned: 0, actions: [], error: error.message };
  }
}

/**
 * Log session cleanup analytics for monitoring
 */
function logSessionCleanupAnalytics(stalledSessions, actions) {
  try {
    const cleanupEvent = {
      type: "session_cleanup_completed",
      timestamp: new Date().toISOString(),
      stalledCount: stalledSessions.length,
      actionsCount: actions.length,
      classifications: stalledSessions.reduce((acc, s) => {
        acc[s.classification] = (acc[s.classification] || 0) + 1;
        return acc;
      }, {}),
      actions: actions.reduce((acc, action) => {
        const [type] = action.split(':');
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {})
    };
    
    console.log("📊 Session cleanup analytics:", cleanupEvent);
    
    // Store for dashboard monitoring
    chrome.storage.local.get(["sessionCleanupAnalytics"], (result) => {
      const analytics = result.sessionCleanupAnalytics || [];
      analytics.push(cleanupEvent);
      
      // Keep last 15 cleanup events
      const recentAnalytics = analytics.slice(-15);
      chrome.storage.local.set({ sessionCleanupAnalytics: recentAnalytics });
    });
    
  } catch (error) {
    console.warn("Warning: Could not log cleanup analytics:", error);
  }
}

/**
 * Schedule periodic session cleanup
 * Runs every 6 hours to maintain session health
 */
function scheduleSessionCleanup() {
  const CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
  
  console.log('🕐 Scheduling session cleanup job every 6 hours');
  
  // Initial cleanup after 5 minutes (let extension settle)
  setTimeout(() => {
    cleanupStalledSessions().catch(error => 
      console.error('Initial session cleanup failed:', error)
    );
  }, 5 * 60 * 1000);
  
  // Regular cleanup every 6 hours
  setInterval(() => {
    cleanupStalledSessions().catch(error => 
      console.error('Periodic session cleanup failed:', error)
    );
  }, CLEANUP_INTERVAL);
}

// Start session cleanup scheduling
scheduleSessionCleanup();

/**
 * Auto-generate sessions from tracking activity
 * Runs every 12 hours to check for session generation opportunities
 */
function scheduleAutoGeneration() {
  const AUTO_GEN_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours
  
  console.log('🎯 Scheduling auto-generation job every 12 hours');
  
  // Initial check after 10 minutes (let extension settle)
  setTimeout(() => {
    SessionService.checkAndGenerateFromTracking().catch(error => 
      console.error('Initial auto-generation failed:', error)
    );
  }, 10 * 60 * 1000);
  
  // Regular auto-generation every 12 hours
  setInterval(() => {
    SessionService.checkAndGenerateFromTracking().catch(error => 
      console.error('Periodic auto-generation failed:', error)
    );
  }, AUTO_GEN_INTERVAL);
}

// Start auto-generation scheduling
scheduleAutoGeneration();
