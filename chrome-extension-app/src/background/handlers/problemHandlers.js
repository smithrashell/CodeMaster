/**
 * Problem Handler Module
 *
 * Extracted from messageRouter.js to improve maintainability
 * Handles all problem-related message types
 *
 * IMPORTANT: This file was automatically extracted during refactoring
 * All handler logic preserved exactly to maintain behavioral compatibility
 *
 * CRITICAL BEHAVIORS PRESERVED:
 * - addProblem: Clears 6 dashboard cache keys after adding problem
 * - problemSubmitted: Broadcasts to all tabs for navigation state refresh
 */

import { ProblemService } from "../../shared/services/problemService.js";
import { AttemptsService } from "../../shared/services/attemptsService.js";
import { getProblemWithOfficialDifficulty } from "../../shared/db/problems.js";

/**
 * Handler: getProblemByDescription
 * Retrieves problem by description and slug
 */
export async function handleGetProblemByDescription(request, dependencies, sendResponse, finishRequest) {
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
}

/**
 * Handler: countProblemsByBoxLevel
 * Counts problems by box level with optional cache invalidation
 */
export async function handleCountProblemsByBoxLevel(request, dependencies, sendResponse, finishRequest) {
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

/**
 * Handler: addProblem
 * Adds or updates a problem with retry logic
 *
 * CRITICAL BEHAVIOR: Clears 6 dashboard cache keys after adding problem
 * This cache invalidation MUST happen regardless of success field value
 */
export async function handleAddProblem(request, dependencies, sendResponse, finishRequest) {
  const { responseCache } = dependencies;

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

      // CRITICAL: Always clear dashboard cache when attempts are added (regardless of success field)
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
}

/**
 * Handler: problemSubmitted
 * Notifies all content scripts about problem submission
 *
 * CRITICAL BEHAVIOR: Broadcasts to all tabs to refresh navigation state
 * Uses chrome.tabs.query() and chrome.tabs.sendMessage() for cross-tab communication
 */
export async function handleProblemSubmitted(request, dependencies, sendResponse, finishRequest) {
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
}

/**
 * Handler: skipProblem
 * Acknowledges problem skip request
 */
export async function handleSkipProblem(request, dependencies, sendResponse, finishRequest) {
  console.log("⏭️ Skipping problem:", request.consentScriptData?.leetcode_id || "unknown");
  // Acknowledge the skip request - no additional processing needed
  sendResponse({ message: "Problem skipped successfully" });
  finishRequest();
  return true;
}

/**
 * Handler: getAllProblems
 * Retrieves all problems from database
 */
export async function handleGetAllProblems(request, dependencies, sendResponse, finishRequest) {
  ProblemService.getAllProblems()
    .then(sendResponse)
    .catch(() => sendResponse({ error: "Failed to retrieve problems" }))
    .finally(finishRequest);
  return true;
}

/**
 * Handler: getProblemById
 * Retrieves a single problem by ID with official difficulty
 */
export async function handleGetProblemById(request, dependencies, sendResponse, finishRequest) {
  getProblemWithOfficialDifficulty(request.problemId)
    .then((problemData) => sendResponse({ success: true, data: problemData }))
    .catch((error) => {
      console.error("❌ Error getting problem by ID:", error);
      sendResponse({ success: false, error: error.message });
    })
    .finally(finishRequest);
  return true;
}

/**
 * Handler: getProblemAttemptStats
 * Retrieves attempt statistics for a problem
 */
export async function handleGetProblemAttemptStats(request, dependencies, sendResponse, finishRequest) {
  AttemptsService.getProblemAttemptStats(request.problemId)
    .then((stats) => sendResponse({ success: true, data: stats }))
    .catch((error) => {
      console.error("❌ Error getting problem attempt stats:", error);
      sendResponse({ success: false, error: error.message });
    })
    .finally(finishRequest);
  return true;
}

// Export handler registry for problem-related messages
export const problemHandlers = {
  'getProblemByDescription': handleGetProblemByDescription,
  'countProblemsByBoxLevel': handleCountProblemsByBoxLevel,
  'addProblem': handleAddProblem,
  'problemSubmitted': handleProblemSubmitted,
  'skipProblem': handleSkipProblem,
  'getAllProblems': handleGetAllProblems,
  'getProblemById': handleGetProblemById,
  'getProblemAttemptStats': handleGetProblemAttemptStats,
};
