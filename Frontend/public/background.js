import { StorageService } from "../src/shared/services/storageService.js";
import { ProblemService } from "../src/shared/services/problemService.js";
import { SessionService } from "../src/shared/services/sessionService.js";
///import { ScheduleService } from "../src/shared/services/scheduleService.js";
import { adaptiveLimitsService } from "../src/shared/services/adaptiveLimitsService.js";
import { NavigationService } from "../src/shared/services/navigationService.js";
import { TagService } from "../src/shared/services/tagServices.js";
import { backupIndexedDB, getBackupFile } from "../src/shared/db/backupDB.js";
// import { buildAndStoreTagGraph } from "../src/shared/db/tag_mastery.js";
// import { classifyTags } from "../src/shared/db/tag_mastery.js";
// import { updateStandardProblems } from "../src/shared/db/standard_problems.js";
// import { updateProblemTags } from "../src/shared/db/standard_problems.js";
// import { calculateTagMastery } from "../src/shared/db/tag_mastery.js";
// import { rebuildProblemRelationships } from "../src/shared/db/problem_relationships.js";
// import { recreateSessions } from "../src/shared/db/sessions.js";
// import { addStabilityToProblems } from "../src/shared/db/problems.js";
import { connect } from "chrome-extension-hot-reload";
import { onboardUserIfNeeded } from "../src/shared/services/onboardingService.js";
//import { updateProblemsWithRating } from "../src/shared/db/problems.js";
import { getDashboardStatistics } from "../src/app/services/dashboardService.js";
// import { updateStandardProblemsFromData } from "../src/shared/db/standard_problems.js";
// import leetCodeProblems from "./../src/shared/db/LeetCode_Tags_Combined(2).json";
// import { updateProblemWithTags } from "../src/shared/db/problems.js";
// import { normalizeTagForStandardProblems } from "../src/shared/db/standard_problems.js";
// import { generatePatternLaddersAndUpdateTagMastery } from "../src/shared/db/pattern_ladder.js";
// import { clearOrRenameStoreField } from "../src/shared/utils/Utils.js";
// import { getSessionPerformance } from "../src/shared/db/sessions.js";
// import { getLearningState } from "../src/shared/services/dashboardService.js";

connect(); // handles app and popup

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
    expiry: Date.now() + CACHE_EXPIRY
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
  const requestId = `${request.type}-${sender.tab?.id || "background"}`;

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
      // TODO: setStorage
      case "setStorage":
        StorageService.set(request.key, request.value)
          .then(sendResponse)
          .finally(finishRequest);
        return true;
      // TODO: getStorage
      case "getStorage":
        StorageService.get(request.key)
          .then(sendResponse)
          .finally(finishRequest);
        return true;
      // TODO: removeStorage
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
      // TODO: setSettings
      case "setSettings":
        StorageService.setSettings(request.message)
          .then(sendResponse)
          .finally(finishRequest);
        return true;
      // TODO: getSettings
      case "getSettings":
        StorageService.getSettings().then(sendResponse).finally(finishRequest);
        return true;
      // TODO: clearSettingsCache
      case "clearSettingsCache":
        StorageService.clearSettingsCache();
        sendResponse({ status: "success" });
        finishRequest();
        return true;

      /** ──────────────── Problems Management ──────────────── **/
      // TODO: getProblemByDescription
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
      // TODO: countProblemsByBoxLevel
      case "countProblemsByBoxLevel":
        ProblemService.countProblemsByBoxLevel()
          .then((counts) => sendResponse({ status: "success", data: counts }))
          .catch(() => sendResponse({ status: "error" }))
          .finally(finishRequest);
        return true;

      // TODO: addProblem
      case "addProblem":
        ProblemService.addOrUpdateProblem(
          request.contentScriptData,
          sendResponse
        )
          .then(() => sendResponse({ message: "Problem added successfully" }))
          .catch(() => sendResponse({ error: "Failed to add problem" }))
          .finally(finishRequest);
        return true;
      // TODO: getAllProblems
      case "getAllProblems":
        ProblemService.getAllProblems()
          .then(sendResponse)
          .catch(() => sendResponse({ error: "Failed to retrieve problems" }))
          .finally(finishRequest);
        return true;

      /** ──────────────── Sessions Management ──────────────── **/
      // TODO: getSession
      case "getSession":
        SessionService.getSession()
          .then((session) => sendResponse({ session }))
          .catch(() => sendResponse({ error: "Failed to get session" }))
          .finally(finishRequest);
        return true;

      // TODO: getCurrentSession
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
        // recreateSessions().then(() => {
        //   sendResponse({ message: "Sessions recreated" });
        // }).catch((error) => {
        //   console.error("Error recreating sessions:", error);
        //   sendResponse({
        //     backgroundScriptData: "Error recreating sessions",
        //   });
        // })
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
        // console.log("🔍 getSessionPerformance");
        // const { unmasteredTags } = await getCurrentLearningState();
        // await getSessionPerformance({
        //   recentSessionsLimit: 5,
        //   unmasteredTags,
        // });
        // console.log("performance", performance);
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
      // TODO: getLimits
      case "getLimits":
        console.log("🔍 Getting adaptive limits for problem", request.id);
        
        console.log("🔍 Calling adaptiveLimitsService.getLimits with problemId:", request.id);
        
        adaptiveLimitsService.getLimits(request.id)
          .then((limitsConfig) => {
            console.log("✅ AdaptiveLimitsService returned successfully:", limitsConfig);
            
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
              adaptiveLimits: limitsConfig
            };
            
            console.log("🔍 Sending limits response:", limits);
            sendResponse({ limits });
          })
          .catch((error) => {
            console.error("❌ Error getting adaptive limits:", error, error.stack);
            sendResponse({ error: "Failed to get limits: " + error.message });
          })
          .finally(finishRequest);
        return true;

      /** ──────────────── Navigation Management ──────────────── **/
      // TODO: navigate
      case "navigate":
        NavigationService.navigate(request.route, request.time)
          .then(() => sendResponse({ result: "success" }))
          .catch(() => sendResponse({ result: "error" }))
          .finally(finishRequest);
        return true;
      /** ──────────────── Dashboard Management ──────────────── **/
      // TODO: getDashboardStatistics
      case "getDashboardStatistics":
        console.log("getDashboardStatistics!!!");
        getDashboardStatistics()
          .then((result) => sendResponse({ result }))
          .catch((error) => sendResponse({ error }))
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
          console.log(`🔍 BACKGROUND DEBUG: Using cached strategy for "${request.tag}"`);
          sendResponse(cachedStrategy);
          finishRequest();
          return true;
        }
        
        console.log(`🔍 BACKGROUND DEBUG: Getting strategy for tag "${request.tag}"`);
        (async () => {
          try {
            console.log(`🔍 BACKGROUND DEBUG: Importing strategy_data.js for tag "${request.tag}"`);
            const { getStrategyForTag } = await import("../src/shared/db/strategy_data.js");
            console.log(`🔍 BACKGROUND DEBUG: Import successful, calling getStrategyForTag for "${request.tag}"`);
            const strategy = await getStrategyForTag(request.tag);
            console.log(`🔍 BACKGROUND DEBUG: Strategy result for "${request.tag}":`, strategy ? 'FOUND' : 'NOT FOUND');
            
            const response = { status: "success", data: strategy };
            setCachedResponse(cacheKey, response);
            sendResponse(response);
            console.log(`🔍 BACKGROUND DEBUG: Response sent for getStrategyForTag "${request.tag}"`);
          } catch (error) {
            console.error(`❌ BACKGROUND DEBUG: Strategy error for "${request.tag}":`, error);
            const errorResponse = { status: "error", error: error.message };
            sendResponse(errorResponse);
            console.log(`🔍 BACKGROUND DEBUG: Error response sent for getStrategyForTag "${request.tag}"`);
          }
        })().finally(finishRequest);
        return true;

      case "getStrategiesForTags":
        console.log(`🎯 BACKGROUND: Getting strategies for tags:`, request.tags);
        (async () => {
          try {
            const { getStrategyForTag } = await import("../src/shared/db/strategy_data.js");
            
            const strategies = {};
            await Promise.all(
              request.tags.map(async (tag) => {
                try {
                  const strategy = await getStrategyForTag(tag);
                  if (strategy) {
                    strategies[tag] = strategy;
                  }
                } catch (error) {
                  console.error(`❌ BACKGROUND: Error getting strategy for "${tag}":`, error);
                }
              })
            );
            
            console.log(`🎯 BACKGROUND: Bulk strategies result:`, Object.keys(strategies));
            sendResponse({ status: "success", data: strategies });
          } catch (error) {
            console.error(`❌ BACKGROUND: Bulk strategies error:`, error);
            sendResponse({ status: "error", error: error.message });
          }
        })().finally(finishRequest);
        return true;

      case "isStrategyDataLoaded":
        console.log(`🔍 BACKGROUND DEBUG: Handling isStrategyDataLoaded request`);
        (async () => {
          try {
            console.log(`🔍 BACKGROUND DEBUG: Importing strategy_data.js...`);
            const { isStrategyDataLoaded } = await import("../src/shared/db/strategy_data.js");
            console.log(`🔍 BACKGROUND DEBUG: Import successful, calling function...`);
            const loaded = await isStrategyDataLoaded();
            console.log(`🔍 BACKGROUND DEBUG: Strategy data loaded result:`, loaded);
            sendResponse({ status: "success", data: loaded });
            console.log(`🔍 BACKGROUND DEBUG: Response sent for isStrategyDataLoaded`);
          } catch (error) {
            console.error(`❌ BACKGROUND DEBUG: Strategy data check error:`, error);
            sendResponse({ status: "error", error: error.message });
            console.log(`🔍 BACKGROUND DEBUG: Error response sent for isStrategyDataLoaded`);
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

  requestQueue.push({ request, sender, sendResponse });
  if (!isProcessing) processNextRequest();

  return true; // Keep response channel open
});
