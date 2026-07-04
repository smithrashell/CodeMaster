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
import { getLatestSessionByType, saveSessionToStorage } from "../../shared/db/stores/sessions.js";
import { excludeProblem } from "../../shared/db/stores/excludedProblems.js";
import { normalizeProblem } from "../../shared/services/problem/problemNormalizer.js";

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

export function handleCountProblemsByBoxLevel(request, _dependencies, sendResponse, finishRequest) {
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

// Broadcasts problemSubmitted to all open tabs — content scripts use this to refresh navigation state.
export function handleProblemSubmitted(_request, _dependencies, sendResponse, finishRequest) {
  console.log("🔄 Problem submitted - notifying all content scripts to refresh");
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

async function removeFromSession(session, leetcodeId, replacement = null) {
  session.problems = session.problems.filter(p => p.leetcode_id !== leetcodeId);
  if (replacement) {
    const normalized = normalizeProblem({
      ...replacement,
      selectionReason: {
        type: 'prerequisite',
        details: { skippedProblemId: leetcodeId },
        shortText: 'Prerequisite',
        fullText: 'Easier problem to help understand skipped concept'
      }
    }, 'prerequisite');
    session.problems.push(normalized);
  }
  await saveSessionToStorage(session, true);
}

async function checkPostSkipCompletion(session, result) {
  if (!session) return;

  if ((session.problems?.length || 0) === 0) {
    console.warn(`⚠️ Session empty after skip - this should not happen, session may need attention`);
    result.sessionEmpty = true;
  }

  // Always runs — session must be finalized even if the problems list is now empty.
  const completionResult = await SessionService.checkAndCompleteSession(session.id);
  if (Array.isArray(completionResult) && completionResult.length === 0) {
    console.log(`✅ Session completed after skip - all remaining problems were already attempted`);
    result.sessionCompleted = true;
  }
}

async function findAndReplaceWithPrerequisite(leetcodeId, session, result) {
  const excludeIds = session.problems?.map(p => p.leetcode_id) || [];
  const prerequisite = await findPrerequisiteProblem(leetcodeId, excludeIds);
  if (prerequisite) {
    result.prerequisite = prerequisite;
    result.replaced = true;
    console.log(`🎓 Found prerequisite: ${prerequisite.title}`);
    await removeFromSession(session, leetcodeId, prerequisite);
    console.log(`✅ Replaced problem ${leetcodeId} with prerequisite ${prerequisite.leetcode_id || prerequisite.id}`);
  } else {
    await removeFromSession(session, leetcodeId);
    console.log(`✅ Removed problem ${leetcodeId} from session`);
  }
}

// All skip reasons remove the problem — they differ only in graph effects and prerequisite search.
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
      await excludeProblem(leetcodeId, 'not_relevant');
      await removeFromSession(session, leetcodeId);
      console.log(`✅ Removed problem ${leetcodeId} from session`);
      break;

    default:
      // "other" — no graph effect, just remove
      await removeFromSession(session, leetcodeId);
      console.log(`✅ Removed problem ${leetcodeId} from session`);
  }
}

/**
 * Skip reasons and their effects (all reasons remove the problem from the session):
 * - too_difficult:   weaken graph relationships + search for a prerequisite replacement
 * - dont_understand: search for a prerequisite replacement (no graph penalty)
 * - not_relevant:    weaken ALL graph connections permanently + write to excluded_problems store + remove
 * - other:           remove only
 *
 * Free skip: problems with no relationships to attempted problems skip graph effects entirely.
 */
export function handleSkipProblem(request, _dependencies, sendResponse, finishRequest) {
  const leetcodeId = request.leetcodeId;
  const VALID_SKIP_REASONS = ['too_difficult', 'dont_understand', 'not_relevant', 'other'];
  const skipReason = VALID_SKIP_REASONS.includes(request.skipReason) ? request.skipReason : 'other';

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

      const hasRelationships = await hasRelationshipsToAttempted(leetcodeId);
      result.freeSkip = !hasRelationships;

      const session = await getLatestSessionByType(null, 'in_progress');

      if (!session) {
        console.error("❌ No active session found for skip operation");
        sendResponse({ error: "No active session" });
        return;
      }

      await applySkipReasonEffects(skipReason, leetcodeId, session, result, hasRelationships);

      // Re-fetch: remaining problems may all now be attempted, which should complete the session.
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

export function handleGetAllProblems(_request, _dependencies, sendResponse, finishRequest) {
  ProblemService.getAllProblems()
    .then(data => sendResponse({ success: true, data }))
    .catch(() => sendResponse({ error: "Failed to retrieve problems" }))
    .finally(finishRequest);
  return true;
}

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
