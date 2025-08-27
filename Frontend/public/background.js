import { StorageService } from "../src/shared/services/storageService.js";
import { ProblemService } from "../src/shared/services/problemService.js";
import { SessionService } from "../src/shared/services/sessionService.js";
import { adaptiveLimitsService } from "../src/shared/services/adaptiveLimitsService.js";
import { NavigationService } from "../src/shared/services/navigationService.js";
import { TagService } from "../src/shared/services/tagServices.js";
import { HintInteractionService } from "../src/shared/services/hintInteractionService.js";
import { backupIndexedDB, getBackupFile } from "../src/shared/db/backupDB.js";
import { connect } from "chrome-extension-hot-reload";
import { onboardUserIfNeeded } from "../src/shared/services/onboardingService.js";
import { getStrategyForTag } from "../src/shared/db/strategy_data.js";
import { getProblem } from "../src/shared/db/problems.js";
import { 
  getDashboardStatistics,
  getFocusAreaAnalytics,
  getLearningProgressData,
  getGoalsData,
  getStatsData,
  getSessionHistoryData,
  getProductivityInsightsData,
  getTagMasteryData,
  getLearningPathData,
  getMistakeAnalysisData,
  clearFocusAreaAnalyticsCache,
  getInterviewAnalyticsData
} from "../src/app/services/dashboardService.js";
import FocusCoordinationService from "../src/shared/services/focusCoordinationService.js";
import { InterviewService } from "../src/shared/services/interviewService.js";

connect(); // handles app and popup

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
    
    // Dashboard data operations
    case 'getStatsData': 
      return `stats_${request.timeframe || 'all'}`;
    case 'getSessionHistoryData': 
      return `sessions_${JSON.stringify(request.filters || {})}`;
    case 'getTagMasteryData': 
      return `mastery_${request.timeframe || 'current'}`;
    case 'getLearningProgressData': 
      return `progress_${request.period || 'all'}`;
    case 'getProductivityInsightsData': 
      return `productivity_${request.period || 'all'}`;
    case 'getLearningPathData': 
      return `learning_path_${request.filters || 'all'}`;
    case 'getMistakeAnalysisData': 
      return `mistakes_${request.period || 'all'}`;
    case 'getInterviewAnalyticsData': 
      return `interview_${request.period || 'all'}`;
    
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
        StorageService.setSettings(request.message)
          .then(sendResponse)
          .finally(finishRequest);
        return true;
      case "getSettings":
        StorageService.getSettings().then(sendResponse).finally(finishRequest);
        return true;
      case "clearSettingsCache":
        StorageService.clearSettingsCache();
        sendResponse({ status: "success" });
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
          .catch(() => sendResponse({ error: "Problem not found" }))
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
        
        // Check if we should show interview banner instead of auto-creating session
        if (!request.sessionType) {
          try {
            const settings = await StorageService.getSettings();
            if (settings?.interviewMode && 
                settings.interviewMode !== 'disabled' && 
                settings.interviewFrequency === 'manual') {
              // Return null to trigger banner display
              sendResponse({ session: null });
              finishRequest();
              return true;
            }
          } catch (error) {
            console.error('Error checking settings for banner logic:', error);
            // Continue with fallback behavior
          }
        }
        
        // Use explicit sessionType or default to standard (DO NOT auto-trigger interview sessions)
        const sessionType = request.sessionType || 'standard';
        
        // Add timeout monitoring
        const timeoutId = setTimeout(() => {
          const elapsed = Date.now() - startTime;
          console.error(`⏰ getOrCreateSession TIMEOUT after ${elapsed}ms for ${sessionType}`);
        }, 30000);
        
        withTimeout(
          SessionService.getOrCreateSession(sessionType),
          25000, // 25 second timeout for session creation
          `SessionService.getOrCreateSession(${sessionType})`
        )
          .then((session) => {
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            
            sendResponse({
              session: session,
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
        getInterviewAnalyticsData(request.filters)
          .then((analyticsData) => {
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
        getDashboardStatistics(request.options || {})
          .then((result) => sendResponse({ result }))
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
        getLearningProgressData(request.options || {})
          .then((result) => sendResponse({ result }))
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
        getStatsData(request.options || {})
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getSessionHistoryData":
        getSessionHistoryData(request.options || {})
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getProductivityInsightsData":
        getProductivityInsightsData(request.options || {})
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getTagMasteryData":
        getTagMasteryData(request.options || {})
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getLearningPathData":
        getLearningPathData(request.options || {})
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error: error.message }))
          .finally(finishRequest);
        return true;

      case "getMistakeAnalysisData":
        getMistakeAnalysisData(request.options || {})
          .then((result) => sendResponse({ result }))
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
        getFocusAreaAnalytics(request.options || {})
          .then((result) => sendResponse({ result }))
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
