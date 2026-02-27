/**
 * Problem Handler Module
 *
 * Extracted from messageRouter.js to improve maintainability
 * Handles all problem-related message types
 *
 * CRITICAL BEHAVIORS:
 * - addProblem: Clears 6 dashboard cache keys after adding problem
 * - problemSubmitted: Broadcasts to all tabs for navigation state refresh
 * - skipProblem: Graph weakening, prerequisite replacement, and session completion
 *   vary by skip reason (too_difficult / dont_understand / not_relevant / other)
 */

import { ProblemService } from "../../shared/services/problem/problemService.js";
import { AttemptsService } from "../../shared/services/attempts/attemptsService.js";
import { getProblemWithOfficialDifficulty } from "../../shared/db/stores/problems.js";
import {
  weakenRelationshipsForSkip,
  weakenRelationshipsForNotRelevant,
  hasRelationshipsToAttempted,
  findPrerequisiteProblem
} from "../../shared/db/stores/problem_relationships.js";
import { SessionService } from "../../shared/services/session/sessionService.js";
import { getLatestSessionByType } from "../../shared/db/stores/sessions.js";

/**
 * Handler: getProblemByDescription
 * Retrieves problem by description and slug
 */
export function handleGetProblemByDescription(request, _dependencies, sendResponse, finishRequest) {
  console.log(
    "🧼 getProblemByDescription:",
    request.description,
    request.slug
  );
  ProblemService.getProblemByDescription(
    request.description,
    request.slug
  )
    .then(r => sendResponse({ success: true, ...r }))
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
export function handleCountProblemsByBoxLevel(request, _dependencies, sendResponse, finishRequest) {
  // Support cache invalidation for fresh database reads
  const countProblemsPromise = request.forceRefresh ?
    ProblemService.countProblemsByBoxLevelWithRetry({ priority: "high" }) :
    ProblemService.countProblemsByBoxLevel();

  countProblemsPromise
    .then((counts) => {
      console.log("📊 Background: Problem counts retrieved", counts);
      sendResponse({ success: true, data: counts });
    })
    .catch((error) => {
      console.error("❌ Background: Error counting problems by box level:", error);
      sendResponse({ error: error.message });
    })
    .finally(finishRequest);
  return true;
}

/**
 * Handler: addProblem
 * Adds or updates a problem with retry logic
 */
export function handleAddProblem(request, _dependencies, sendResponse, finishRequest) {
  ProblemService.addOrUpdateProblemWithRetry(
    request.contentScriptData,
    sendResponse
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
export function handleProblemSubmitted(_request, _dependencies, sendResponse, finishRequest) {
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
  sendResponse({ success: true, message: "Problem submission notification sent" });
  finishRequest();
  return true;
}

/**
 * Checks session completion state after a skip and mutates result accordingly.
 * Always calls checkAndCompleteSession — even when the problems list is empty —
 * so the session can be finalized in either case.
 */
async function checkPostSkipCompletion(session, result) {
  if (!session) return;

  if ((session.problems?.length || 0) === 0) {
    console.warn(`⚠️ Session empty after skip - this should not happen, session may need attention`);
    result.sessionEmpty = true;
  }

  const completionResult = await SessionService.checkAndCompleteSession(session.id);
  if (Array.isArray(completionResult) && completionResult.length === 0) {
    console.log(`✅ Session completed after skip - all remaining problems were already attempted`);
    result.sessionCompleted = true;
  }
}

/**
 * Finds a prerequisite for the skipped problem and either replaces it in the
 * session or removes it if no prerequisite exists.
 */
async function findAndReplaceWithPrerequisite(leetcodeId, session, result) {
  const excludeIds = session.problems?.map(p => p.leetcode_id) || [];
  const prerequisite = await findPrerequisiteProblem(leetcodeId, excludeIds);
  if (prerequisite) {
    result.prerequisite = prerequisite;
    result.replaced = true;
    console.log(`🎓 Found prerequisite: ${prerequisite.title}`);
    await SessionService.skipProblem(leetcodeId, prerequisite);
    console.log(`✅ Replaced problem ${leetcodeId} with prerequisite ${prerequisite.leetcode_id || prerequisite.id}`);
  } else {
    await SessionService.skipProblem(leetcodeId);
    console.log(`✅ Removed problem ${leetcodeId} from session`);
  }
}

/**
 * Applies graph and session effects based on the skip reason.
 * All reasons ultimately remove the problem from the session.
 */
async function applySkipReasonEffects(skipReason, leetcodeId, session, result, hasRelationships) {
  switch (skipReason) {
    case 'too_difficult':
      if (hasRelationships) {
        const weakenResult = await weakenRelationshipsForSkip(leetcodeId);
        result.graphUpdated = weakenResult.updated > 0;
        console.log(`📉 Graph updated: ${weakenResult.updated} relationships weakened`);
      }
      await findAndReplaceWithPrerequisite(leetcodeId, session, result);
      break;

    case 'dont_understand':
      await findAndReplaceWithPrerequisite(leetcodeId, session, result);
      break;

    case 'not_relevant':
      if (hasRelationships) {
        const weakenResult = await weakenRelationshipsForNotRelevant(leetcodeId);
        result.graphUpdated = weakenResult.updated > 0;
        console.log(`🚫 Graph updated: ${weakenResult.updated} relationships weakened for not-relevant`);
      }
      await SessionService.skipProblem(leetcodeId);
      console.log(`✅ Removed problem ${leetcodeId} from session`);
      break;

    default:
      // "other" — no graph effect, just remove
      await SessionService.skipProblem(leetcodeId);
      console.log(`✅ Removed problem ${leetcodeId} from session`);
  }
}

/**
 * Handler: skipProblem
 * Handles problem skip with reason-based behavior
 *
 * Skip reasons and their actions (all reasons always remove the problem):
 * - "too_difficult": Weaken graph (-0.4, last 5 successes) + find prerequisite replacement
 * - "dont_understand": Find prerequisite problem as replacement (no graph weakening)
 * - "not_relevant": Weaken ALL graph connections (-0.8) — permanent quality signal
 * - "other": No graph effect, just remove
 *
 * Free skip: Problems with zero relationships to attempted problems get no graph penalty
 */
export function handleSkipProblem(request, _dependencies, sendResponse, finishRequest) {
  const leetcodeId = request.leetcodeId;
  const VALID_SKIP_REASONS = ['too_difficult', 'dont_understand', 'not_relevant', 'other'];
  const skipReason = VALID_SKIP_REASONS.includes(request.skipReason) ? request.skipReason : 'other';

  // Input validation
  if (!leetcodeId) {
    console.error("❌ skipProblem called without valid leetcodeId");
    sendResponse({ error: "Invalid problem ID" });
    finishRequest();
    return true;
  }

  console.log(`⏭️ Skipping problem ${leetcodeId} - Reason: ${skipReason}`);

  (async () => {
    try {
      const result = {
        success: true,
        message: "Problem skipped successfully",
        skipReason,
        prerequisite: null,
        graphUpdated: false,
        freeSkip: false
      };

      // Check if this is a "free skip" (no relationships to attempted problems)
      const hasRelationships = await hasRelationshipsToAttempted(leetcodeId);
      result.freeSkip = !hasRelationships;

      // Re-fetch session fresh before making skip decisions (standard in-progress only)
      const session = await getLatestSessionByType(null, 'in_progress');

      // Null guard: if no active session, return error immediately
      if (!session) {
        console.error("❌ No active session found for skip operation");
        sendResponse({ error: "No active session" });
        return;
      }

      await applySkipReasonEffects(skipReason, leetcodeId, session, result, hasRelationships);

      // After skip, check if session is now effectively complete
      // (all remaining problems have been attempted).
      // Run this for ALL paths including "kept" — if the kept problem was
      // already attempted, the session should complete so a new one generates.
      const postSkipSession = await getLatestSessionByType(null, 'in_progress');
      await checkPostSkipCompletion(postSkipSession, result);

      sendResponse(result);
    } catch (error) {
      console.error("❌ Error in skipProblem handler:", error);
      sendResponse({ error: error.message });
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
export function handleGetAllProblems(_request, _dependencies, sendResponse, finishRequest) {
  ProblemService.getAllProblems()
    .then(data => sendResponse({ success: true, data }))
    .catch(() => sendResponse({ error: "Failed to retrieve problems" }))
    .finally(finishRequest);
  return true;
}

/**
 * Handler: getProblemById
 * Retrieves a single problem by ID with official difficulty
 */
export function handleGetProblemById(request, _dependencies, sendResponse, finishRequest) {
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
export function handleGetProblemAttemptStats(request, _dependencies, sendResponse, finishRequest) {
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
