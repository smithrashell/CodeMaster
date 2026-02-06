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

import { ProblemService } from "../../shared/services/problem/problemService.js";
import { AttemptsService } from "../../shared/services/attempts/attemptsService.js";
import { getProblemWithOfficialDifficulty } from "../../shared/db/stores/problems.js";
import {
  weakenRelationshipsForSkip,
  hasRelationshipsToAttempted,
  findPrerequisiteProblem
} from "../../shared/db/stores/problem_relationships.js";
import { SessionService } from "../../shared/services/session/sessionService.js";
import { getLatestSession } from "../../shared/db/stores/sessions.js";

/**
 * Handler: getProblemByDescription
 * Retrieves problem by description and slug
 */
export function handleGetProblemByDescription(request, dependencies, sendResponse, finishRequest) {
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
export function handleCountProblemsByBoxLevel(request, dependencies, sendResponse, finishRequest) {
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
 */
export function handleAddProblem(request, dependencies, sendResponse, finishRequest) {
  ProblemService.addOrUpdateProblemWithRetry(
    request.contentScriptData,
    (response) => {
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
export function handleProblemSubmitted(request, dependencies, sendResponse, finishRequest) {
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
 * Handles problem skip with reason-based behavior
 *
 * Skip reasons and their actions:
 * - "too_difficult": Weaken graph relationships (if problem has connections)
 * - "dont_understand": Find prerequisite problem as replacement
 * - "not_relevant": Just remove from session
 * - "other": Just remove from session
 *
 * Free skip: Problems with zero relationships to attempted problems get no graph penalty
 */
export function handleSkipProblem(request, dependencies, sendResponse, finishRequest) {
  const leetcodeId = request.leetcodeId || request.problemData?.leetcode_id || request.consentScriptData?.leetcode_id;
  const VALID_SKIP_REASONS = ['too_difficult', 'dont_understand', 'not_relevant', 'other'];
  const skipReason = VALID_SKIP_REASONS.includes(request.skipReason) ? request.skipReason : 'other';

  // Input validation
  if (!leetcodeId) {
    console.error("❌ skipProblem called without valid leetcodeId");
    sendResponse({ error: "Invalid problem ID", message: "Problem skip failed" });
    finishRequest();
    return true;
  }

  console.log(`⏭️ Skipping problem ${leetcodeId} - Reason: ${skipReason}`);

  (async () => {
    try {
      const result = {
        message: "Problem skipped successfully",
        skipReason,
        prerequisite: null,
        graphUpdated: false,
        freeSkip: false
      };

      // Check if this is a "free skip" (no relationships to attempted problems)
      const hasRelationships = await hasRelationshipsToAttempted(leetcodeId);
      result.freeSkip = !hasRelationships;

      // Handle based on skip reason
      if (skipReason === 'too_difficult') {
        // Weaken graph relationships for "too difficult" skips (if has relationships)
        if (hasRelationships) {
          const weakenResult = await weakenRelationshipsForSkip(leetcodeId);
          result.graphUpdated = weakenResult.updated > 0;
          console.log(`📉 Graph updated: ${weakenResult.updated} relationships weakened`);
        }
        // Always remove from session
        await SessionService.skipProblem(leetcodeId);
        console.log(`✅ Removed problem ${leetcodeId} from session`);
      } else if (skipReason === 'dont_understand') {
        // Find prerequisite problem for "don't understand" skips
        // Get current session to exclude problems already in it
        const session = await getLatestSession();
        const excludeIds = session?.problems?.map(p => p.leetcode_id) || [];

        const prerequisite = await findPrerequisiteProblem(leetcodeId, excludeIds);
        if (prerequisite) {
          result.prerequisite = prerequisite;
          result.replaced = true;
          console.log(`🎓 Found prerequisite: ${prerequisite.title}`);
          // Remove skipped problem and add prerequisite as replacement
          await SessionService.skipProblem(leetcodeId, prerequisite);
          console.log(`✅ Replaced problem ${leetcodeId} with prerequisite ${prerequisite.leetcode_id || prerequisite.id}`);
        } else {
          // No prerequisite found, just remove
          await SessionService.skipProblem(leetcodeId);
          console.log(`✅ Removed problem ${leetcodeId} from session (no prerequisite found)`);
        }
      } else {
        // "not_relevant" or "other" - just remove from session
        await SessionService.skipProblem(leetcodeId);
        console.log(`✅ Removed problem ${leetcodeId} from session`);
      }

      sendResponse(result);
    } catch (error) {
      console.error("❌ Error in skipProblem handler:", error);
      sendResponse({
        message: "Problem skipped with errors",
        error: error.message
      });
    } finally {
      finishRequest();
    }
  })();

  return true;
}

/**
 * Handler: getAllProblems
 * Retrieves all problems from database
 */
export function handleGetAllProblems(request, dependencies, sendResponse, finishRequest) {
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
export function handleGetProblemById(request, dependencies, sendResponse, finishRequest) {
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
export function handleGetProblemAttemptStats(request, dependencies, sendResponse, finishRequest) {
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
