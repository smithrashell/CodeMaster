import { StorageService } from "../src/shared/services/storageService.js";
import { ProblemService } from "../src/shared/services/problemService.js";
import { SessionService } from "../src/shared/services/sessionService.js";
import { adaptiveLimitsService } from "../src/shared/services/adaptiveLimitsService.js";
import { NavigationService } from "../src/shared/services/navigationService.js";
import { TagService } from "../src/shared/services/tagServices.js";
import { backupIndexedDB, getBackupFile } from "../src/shared/db/backupDB.js";
import { connect } from "chrome-extension-hot-reload";
import { onboardUserIfNeeded } from "../src/shared/services/onboardingService.js";
import { getStrategyForTag } from "../src/shared/db/strategy_data.js";
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
  clearFocusAreaAnalyticsCache
} from "../src/app/services/dashboardService.js";
import FocusCoordinationService from "../src/shared/services/focusCoordinationService.js";

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
console.log('🚀 SERVICE WORKER: Background script loaded and ready for messages');

let activeRequests = {};
let requestQueue = [];
let isProcessing = false;

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

const processNextRequest = () => {
  if (requestQueue.length === 0) {
    console.log("🔍 BACKGROUND DEBUG: Queue empty, stopping processing");
    isProcessing = false;
    return;
  }
  isProcessing = true;
  const { request, sender, sendResponse } = requestQueue.shift();
  console.log("🔍 BACKGROUND DEBUG: Processing request:", request.type);
  handleRequest(request, sender, sendResponse).finally(() => {
    console.log("🔍 BACKGROUND DEBUG: Finished processing:", request.type);
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

const handleRequest = async (request, sender, sendResponse) => {
  // Generate unique request ID, including tag parameter for strategy requests
  let requestId = `${request.type}-${sender.tab?.id || "background"}`;
  if (request.type === "getStrategyForTag" && request.tag) {
    requestId = `${request.type}-${request.tag}-${sender.tab?.id || "background"}`;
  }

  if (activeRequests[requestId]) return;
  activeRequests[requestId] = true;
  const finishRequest = () => {
    delete activeRequests[requestId];
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

      case "getCurrentSession":
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
        SessionService.getOrCreateSession()
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

      /** ──────────────── Database Proxy ──────────────── **/
      case "DATABASE_OPERATION":
        (async () => {
          try {
            const { operation, params } = request;
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
                result = await updateRecord(params.storeName, params.id, params.record);
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

            sendResponse({ data: result });
          } catch (error) {
            console.error(`❌ Database proxy error:`, error);
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

chrome.action.onClicked.addListener((tab) => {
  // Open your React application in a new tab

  chrome.tabs.create({ url: "app.html" });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("🔍 BACKGROUND DEBUG: Received request:", request.type, request);

  // Add health check handler for service worker diagnostics
  if (request.type === 'HEALTH_CHECK') {
    console.log('💚 SERVICE WORKER: Health check received');
    sendResponse({ 
      status: 'healthy', 
      timestamp: Date.now(),
      activeRequests: Object.keys(activeRequests).length,
      queueLength: requestQueue.length 
    });
    return true;
  }

  requestQueue.push({ request, sender, sendResponse });
  if (!isProcessing) processNextRequest();

  return true; // Keep response channel open
});
