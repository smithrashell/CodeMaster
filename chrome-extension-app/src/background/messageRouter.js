/**
 * Message Router Module
 *
 * Extracted from background/index.js to improve maintainability
 * Handles all Chrome message routing for the extension
 *
 * IMPORTANT: This file was automatically extracted during refactoring
 * See docs/refactoring/background-index-refactoring-strategy.md for details
 */

// Service imports
import { StorageService } from "../shared/services/storageService.js";
import { ProblemService } from "../shared/services/problemService.js";
import { SessionService } from "../shared/services/sessionService.js";
import { AttemptsService } from "../shared/services/attemptsService.js";
import { TagService } from "../shared/services/tagServices.js";
import { HintInteractionService } from "../shared/services/hintInteractionService.js";
import { InterviewService } from "../shared/services/interviewService.js";
import { adaptiveLimitsService } from "../shared/services/adaptiveLimitsService.js";
import { NavigationService } from "../shared/services/navigationService.js";
import FocusCoordinationService from "../shared/services/focusCoordinationService.js";

// Database imports
import { backupIndexedDB, getBackupFile } from "../shared/db/backupDB.js";
import { getStrategyForTag, isStrategyDataLoaded } from "../shared/db/strategy_data.js";
import { getAllFromStore, getRecord, addRecord, updateRecord, deleteRecord } from "../shared/db/common.js";
import { buildRelationshipMap } from "../shared/db/problem_relationships.js";
import { getProblem, getProblemWithOfficialDifficulty, fetchAllProblems } from "../shared/db/problems.js";
import { getAllStandardProblems } from "../shared/db/standard_problems.js";

// Onboarding imports
import {
  onboardUserIfNeeded,
  checkContentOnboardingStatus,
  updateContentOnboardingStep,
  completeContentOnboarding,
  checkPageTourStatus,
  markPageTourCompleted,
  resetPageTour
} from "../shared/services/onboardingService.js";

// Dashboard service imports
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
  getInterviewAnalyticsData,
  getSessionMetrics
} from "../app/services/dashboardService.js";

// Relationship service import
import { buildProblemRelationships } from "../shared/services/relationshipService.js";

/**
 * Main message routing function
 * Handles all incoming Chrome messages and delegates to appropriate handlers
 *
 * @param {Object} request - The incoming message request
 * @param {Function} sendResponse - Callback to send response
 * @param {Function} finishRequest - Cleanup callback to mark request as complete
 * @param {Object} dependencies - Dependencies from background script
 * @param {Map} dependencies.responseCache - Response cache Map
 * @param {Object} dependencies.backgroundScriptHealth - Health monitoring object
 * @param {Function} dependencies.withTimeout - Timeout wrapper function
 * @param {Function} dependencies.cleanupStalledSessions - Session cleanup function
 * @param {Function} dependencies.getStrategyMapData - Strategy map data function
 * @param {Function} dependencies.getCachedResponse - Cache getter function
 * @param {Function} dependencies.setCachedResponse - Cache setter function
 * @param {Function} dependencies.checkOnboardingStatus - Onboarding status checker
 * @param {Function} dependencies.completeOnboarding - Onboarding completion function
 * @returns {boolean} - True if response will be sent asynchronously
 */
export async function routeMessage(request, sendResponse, finishRequest, dependencies = {}) {
  // Destructure dependencies for easier access
  const {
    responseCache,
    backgroundScriptHealth,
    withTimeout,
    cleanupStalledSessions,
    getStrategyMapData,
    getCachedResponse,
    setCachedResponse,
    checkOnboardingStatus,
    completeOnboarding
  } = dependencies;
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
          .then((result) => {
            // Handle both old and new response formats
            if (result && typeof result === 'object' && 'success' in result) {
              sendResponse(result);
            } else {
              // Legacy format - assume success
              sendResponse({ success: true, message: "Onboarding completed" });
            }
          })
          .catch((error) => {
            console.error("❌ Error onboarding user:", error);
            // Return a graceful error that doesn't break the UI
            sendResponse({ 
              success: false, 
              error: error.message,
              fallback: true 
            });
          })
          .finally(finishRequest);
        return true;
      
      case "checkInstallationOnboardingStatus":
        StorageService.get('installation_onboarding_complete')
          .then((result) => {
            console.log("🔍 Installation onboarding status check:", result);
            sendResponse({ 
              isComplete: result?.completed === true,
              timestamp: result?.timestamp,
              version: result?.version,
              error: result?.error
            });
          })
          .catch((error) => {
            console.error("❌ Error checking installation onboarding status:", error);
            sendResponse({ 
              isComplete: false, 
              error: error.message 
            });
          })
          .finally(finishRequest);
        return true;
      
      case "checkContentOnboardingStatus":
        checkContentOnboardingStatus()
          .then(sendResponse)
          .catch((error) => {
            console.error("❌ Error checking content onboarding status:", error);
            sendResponse({ error: error.message });
          })
          .finally(finishRequest);
        return true;

      case "checkOnboardingStatus":
        checkOnboardingStatus()
          .then(sendResponse)
          .catch((error) => {
            console.error("❌ Error checking onboarding status:", error);
            sendResponse({ error: error.message });
          })
          .finally(finishRequest);
        return true;

      case "completeOnboarding":
        completeOnboarding()
          .then(sendResponse)
          .catch((error) => {
            console.error("❌ Error completing onboarding:", error);
            sendResponse({ error: error.message });
          })
          .finally(finishRequest);
        return true;

      case "updateContentOnboardingStep":
        updateContentOnboardingStep(request.step)
          .then(sendResponse)
          .catch((error) => {
            console.error("❌ Error updating content onboarding step:", error);
            sendResponse({ error: error.message });
          })
          .finally(finishRequest);
        return true;
      
      case "completeContentOnboarding":
        completeContentOnboarding()
          .then(sendResponse)
          .catch((error) => {
            console.error("❌ Error completing content onboarding:", error);
            sendResponse({ error: error.message });
          })
          .finally(finishRequest);
        return true;
      
      case "checkPageTourStatus":
        checkPageTourStatus(request.pageId)
          .then(sendResponse)
          .catch((error) => {
            console.error("❌ Error checking page tour status:", error);
            sendResponse({ error: error.message });
          })
          .finally(finishRequest);
        return true;
      
      case "markPageTourCompleted":
        markPageTourCompleted(request.pageId)
          .then(sendResponse)
          .catch((error) => {
            console.error("❌ Error marking page tour completed:", error);
            sendResponse({ error: error.message });
          })
          .finally(finishRequest);
        return true;
      
      case "resetPageTour":
        resetPageTour(request.pageId)
          .then(sendResponse)
          .catch((error) => {
            console.error("❌ Error resetting page tour:", error);
            sendResponse({ error: error.message });
          })
          .finally(finishRequest);
        return true;
      /** ──────────────── User Settings ──────────────── **/
      case "setSettings":
        StorageService.setSettings(request.message)
          .then((result) => {
            // Also save to Chrome storage to trigger chrome.storage.onChanged listeners
            // This enables theme synchronization across extension contexts
            if (chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ 
                settings: request.message 
              }, () => {
                if (chrome.runtime.lastError) {
                  console.warn("Failed to sync settings to Chrome storage:", chrome.runtime.lastError.message);
                }
              });
            }
            sendResponse(result);
          })
          .catch((error) => {
            console.error("Failed to save settings:", error);
            sendResponse({ status: "error", message: error.message });
          })
          .finally(finishRequest);
        return true;
      case "getSettings":
        StorageService.getSettings().then(sendResponse).finally(finishRequest);
        return true;
      case "clearSettingsCache": {
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
      }
      case "clearSessionCache": {
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
      }

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
      case "countProblemsByBoxLevel": {
        // Support cache invalidation for fresh database reads
        const countProblemsPromise = request.forceRefresh ?
          ProblemService.countProblemsByBoxLevelWithRetry({ priority: "high" }) :
          ProblemService.countProblemsByBoxLevel();

        countProblemsPromise
          .then((counts) => {
            console.log("📊 Background: Problem counts retrieved", counts);
            sendResponse({ status: "success", data: counts });
          })
          .catch((error) => {
            console.error("❌ Background: Error counting problems by box level:", error);
            sendResponse({ status: "error", message: error.message });
          })
          .finally(finishRequest);
        return true;
      }

      case "addProblem":
        ProblemService.addOrUpdateProblemWithRetry(
          request.contentScriptData,
          (response) => {
            // Enhanced logging for cache invalidation debugging
            console.log('📊 ProblemService response received:', {
              hasResponse: !!response,
              hasSuccess: response && 'success' in response,
              successValue: response?.success,
              responseKeys: response ? Object.keys(response) : [],
              responseMessage: response?.message,
              responseError: response?.error
            });

            // Always clear dashboard cache when attempts are added (regardless of success field)
            console.log('🔄 Clearing dashboard cache after attempt creation...');
            const dashboardCacheKeys = ['stats_data', 'progress_data', 'sessions_data', 'mastery_data', 'productivity_data', 'learning_path_data'];
            let clearedCount = 0;
            for (const key of dashboardCacheKeys) {
              if (responseCache.has(key)) {
                responseCache.delete(key);
                clearedCount++;
                console.log(`🗑️ Cleared cache key: ${key}`);
              } else {
                console.log(`💨 Cache key not found (already cleared): ${key}`);
              }
            }
            console.log(`🔄 Cache clearing complete: ${clearedCount} entries cleared`);
            
            sendResponse(response);
          }
        )
          .catch((error) => {
            console.error('[ERROR]', new Date().toISOString(), '- Error adding problem:', error);
            sendResponse({ error: "Failed to add problem: " + error.message });
          })
          .finally(finishRequest);
        return true;

      case "problemSubmitted":
        console.log("🔄 Problem submitted - notifying all content scripts to refresh");
        // Forward the message to all tabs to refresh navigation state
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            // Only send to tabs that might have content scripts (http/https URLs)
            if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
              chrome.tabs.sendMessage(tab.id, { type: "problemSubmitted" }, (_response) => {
                // Ignore errors from tabs without content scripts
                if (chrome.runtime.lastError) {
                  console.log(`ℹ️ Tab ${tab.id} doesn't have content script:`, chrome.runtime.lastError.message);
                } else {
                  console.log(`✅ Notified tab ${tab.id} about problem submission`);
                }
              });
            }
          });
        });
        sendResponse({ status: "success", message: "Problem submission notification sent" });
        finishRequest();
        return true;

      case "skipProblem":
        console.log("⏭️ Skipping problem:", request.consentScriptData?.leetcode_id || "unknown");
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

      case "getProblemById":
        getProblemWithOfficialDifficulty(request.problemId)
          .then((problemData) => sendResponse({ success: true, data: problemData }))
          .catch((error) => {
            console.error("❌ Error getting problem by ID:", error);
            sendResponse({ success: false, error: error.message });
          })
          .finally(finishRequest);
        return true;

      case "getProblemAttemptStats":
        AttemptsService.getProblemAttemptStats(request.problemId)
          .then((stats) => sendResponse({ success: true, data: stats }))
          .catch((error) => {
            console.error("❌ Error getting problem attempt stats:", error);
            sendResponse({ success: false, error: error.message });
          })
          .finally(finishRequest);
        return true;

      /** ──────────────── Sessions Management ──────────────── **/
      case "getSession":
        SessionService.getSession()
          .then((session) => sendResponse({ session }))
          .catch(() => sendResponse({ error: "Failed to get session" }))
          .finally(finishRequest);
        return true;

      case "getOrCreateSession": {
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
      }

      case "refreshSession": {
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
      }

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
          .then((settings) => {
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
      case "backgroundScriptHealth": {
        const healthReport = backgroundScriptHealth.getHealthReport();
        console.log("🏥 Background script health check:", healthReport);
        sendResponse({ status: "success", data: healthReport });
        finishRequest();
        return true;
      }

      case "TEST_FUNCTIONS_AVAILABLE": {
        console.log("🧪 Checking test function availability...");
        const testFunctionStatus = {
          testSimple: typeof globalThis.testSimple,
          testAsync: typeof globalThis.testAsync,
          runTestsSilent: typeof globalThis.runTestsSilent,
          quickHealthCheck: typeof globalThis.quickHealthCheck,
          backgroundScriptLoaded: true,
          timestamp: Date.now()
        };
        console.log("📊 Test function status:", testFunctionStatus);
        sendResponse({ status: "success", data: testFunctionStatus });
        finishRequest();
        return true;
      }

      case "RUN_SIMPLE_TEST":
        console.log("🧪 Running simple test...");
        try {
          const result = globalThis.testSimple();
          console.log("✅ Simple test result:", result);
          sendResponse({ status: "success", data: result });
        } catch (error) {
          console.error("❌ Simple test failed:", error);
          sendResponse({ status: "error", error: error.message });
        }
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
      case "getStrategyForTag": {
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
      }

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
            console.log(`🔍 BACKGROUND DEBUG: Using statically imported strategy_data.js...`);
            // isStrategyDataLoaded is now statically imported at the top
            console.log(
              `🔍 BACKGROUND DEBUG: Calling function...`
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

      case "getLearningStatus":
        (async () => {
          try {
            // SessionService is now statically imported at the top
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
            // StorageService and TagService are now statically imported at the top

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
            // TagService is now statically imported at the top
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
        console.log("💾 Saving hint interaction from content script", { 
          hasData: !!request.data, 
          hasInteractionData: !!request.interactionData,
          problemIdFromData: request.data?.problemId,
          problemIdFromInteractionData: request.interactionData?.problemId
        });
        
        // Get problem context in background script first to avoid IndexedDB access in content script
        (async () => {
          const interactionData = request.interactionData || request.data;
          let enrichedData = { ...interactionData };
          
          if (interactionData.problemId) {
            try {
              const problem = await getProblem(interactionData.problemId);
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
            console.log("🔍 getSimilarProblems: Starting similarity search...");
            // buildRelationshipMap, fetchAllProblems, and getAllStandardProblems are now statically imported at the top

            // Get all data sources
            const relationshipMap = await buildRelationshipMap();
            const _allUserProblems = await fetchAllProblems();
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
            
            // Ensure consistent number type for Map key lookup
            const numericProblemId = Number(request.problemId);

            // Get similar problems from relationships using numeric ID
            const relationships = relationshipMap.get(numericProblemId) || {};

            console.log(`🔍 getSimilarProblems: Processing problem ${numericProblemId}, found ${Object.keys(relationships).length} relationships`);

            const similarProblems = [];

            // Check if we have any relationships at all
            if (relationshipMap.size === 0) {
              console.warn("⚠️ getSimilarProblems: Relationship map is empty - problem relationships may not be built yet");
              sendResponse({
                similarProblems: [],
                debug: { message: "Problem relationships not initialized", mapSize: 0 }
              });
              return;
            }

            // Sort by relationship strength and take top N
            const sortedRelationships = Object.entries(relationships)
              .sort(([,a], [,b]) => b - a) // Sort by strength descending
              .slice(0, request.limit || 5);
            
            for (const [relatedNumericId, strength] of sortedRelationships) {
              const relatedId = Number(relatedNumericId);
              
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
            
            console.log("✅ getSimilarProblems: Found", similarProblems.length, "similar problems");
            sendResponse({ similarProblems });
          } catch (error) {
            console.error("❌ getSimilarProblems error:", error);
            sendResponse({ similarProblems: [] });
          }
        })().finally(finishRequest);
        return true;

      case "rebuildProblemRelationships":
        (async () => {
          try {
            console.log("🔄 Starting problem relationships rebuild...");
            // buildProblemRelationships is now statically imported at the top

            // Rebuild relationships
            await buildProblemRelationships();
            console.log("✅ Problem relationships rebuilt successfully");
            sendResponse({ success: true, message: "Problem relationships rebuilt successfully" });
          } catch (error) {
            console.error("❌ Error rebuilding problem relationships:", error);
            sendResponse({ success: false, error: error.message });
          }
        })().finally(finishRequest);
        return true;

      /** ──────────────── Database Proxy ──────────────── **/
      case "DATABASE_OPERATION":
        (async () => {
          try {
            const { operation, params } = request;
            console.log(`📊 DATABASE_OPERATION: ${operation} on ${params.storeName}`, params);
            // getRecord, addRecord, updateRecord, deleteRecord, and getAllFromStore are now statically imported at the top

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
            // SessionService is now statically imported at the top

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
            // SessionService and StorageService are now statically imported at the top

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
            // SessionService is now statically imported at the top
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
            // SessionService is now statically imported at the top
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

}
