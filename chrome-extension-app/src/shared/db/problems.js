import { dbHelper } from "./index.js";

import { AttemptsService } from "../services/attemptsService.js";

import { getAllStandardProblems } from "./standard_problems.js";
import { fetchProblemById } from "./standard_problems.js";
import { TagService } from "../services/tagServices.js";
import FocusCoordinationService from "../services/focusCoordinationService.js";
// Remove early binding - use TagService.getCurrentLearningState() directly
import { v4 as uuidv4 } from "uuid";

import { getDifficultyAllowanceForTag } from "../utils/Utils.js";
import { getPatternLadders } from "../utils/dbUtils/patternLadderUtils.js";
import { scoreProblemsWithRelationships } from "./problem_relationships.js";
import { regenerateCompletedPatternLadder } from "../services/problem/problemladderService.js";
import { calculateCompositeScore, logCompositeScores } from "./problemsHelpers.js";

// Import session functions are handled directly through SessionService

const openDB = () => dbHelper.openDB();

// Import retry service for enhanced database operations
import indexedDBRetry from "../services/storage/IndexedDBRetryService.js";
import { SessionService } from "../services/session/sessionService.js";
import logger from "../utils/logger.js";

/**
 * Updates problems with rating increases based on attempts.
 * @returns {Promise<string>} - Returns a message indicating the completion of the operation.
 */
export const updateProblemsWithRatings = async () => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("problems", "readwrite");
    const store = transaction.objectStore("problems");

    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const problem = cursor.value;
        problem.rating = problem.rating ? problem.rating + 1 : 1;
        store.put(problem);
        cursor.continue();
      } else {
        resolve("Problems updated with ratings");
      }
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Fetches a problem by its ID.
 * @param {string} problemId - The ID of the problem.
 * @returns {Promise<Object|null>} - The problem object or null if not found.
 */
export async function getProblem(problemId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems"], "readonly");
    const problemStore = transaction.objectStore("problems");

    const request = problemStore.get(problemId);

    request.onsuccess = (event) => {
      resolve(event.target.result || null);
    };
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Fetch details of problems by IDs from standard_problems
 * @param {IDBDatabase} db - IndexedDB instance
 * @param {Array<string>} problemIds - List of problem IDs
 * @returns {Promise<Array>} - List of problems
 */
export async function fetchProblemsByIdsWithTransaction(db, problemIds) {
  const transaction = db.transaction(["standard_problems"], "readonly");
  const standardProblemsStore = transaction.objectStore("standard_problems");

  const problems = await Promise.all(
    problemIds.map(
      (id) =>
        new Promise((resolve) => {
          const request = standardProblemsStore.get(id);
          request.onsuccess = (event) => resolve(event.target.result || null);
          request.onerror = () => resolve(null);
        })
    )
  );

  return problems.filter(Boolean); // Exclude any null results
}

/**
 * Saves an updated problem in the database.
 * @param {Object} problem - The updated problem object.
 * @returns {Promise<void>}
 */
export async function saveUpdatedProblem(problem) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems"], "readwrite");
    const store = transaction.objectStore("problems");

    const request = store.put(problem);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Fetches a problem by description.
 * @param {string} description - The problem description.
 * @returns {Promise<Object|null>} - The problem object or null if not found.
 */
export async function getProblemByDescription(description, _slug) {
  logger.info("📌 getProblemByDescription called with:", description);

  if (!description) {
    logger.error("❌ Error: No description provided.");
    return null;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems"], "readonly");
    const store = transaction.objectStore("problems");

    if (!store.indexNames.contains("by_title")) {
      logger.error("❌ Error: Index 'by_title' does not exist.");
      reject(new Error("Index missing: by_title"));
      return;
    }

    logger.info("📌 Using index 'by_title' to fetch problem...");
    let index;
    try {
      index = store.index("by_title");
    } catch (error) {
      console.error(`❌ PROBLEMS INDEX ERROR: by_title index not found in problems`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "problems"
      });
      reject(error);
      return;
    }

    // Ensure the description is stored in lowercase
    const request = index.get(description.toLowerCase());

    request.onsuccess = (event) => {
      const result = event.target.result;
      if (result) {
        logger.info("✅ Problem found:", result);
        resolve(result);
      } else {
        logger.warn("⚠️ Problem not found for description:", description);
        resolve(false);
      }
    };

    request.onerror = (event) => {
      logger.error("❌ Error fetching problem:", event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Adds a problem to the database.
 * @param {Object} problemData - The problem data.
 * @returns {Promise<void>}
 */
export async function addProblem(problemData) {
  try {
    const db = await openDB();
    const _standardProblem = await fetchProblemById(problemData.leetcode_id);

    const transaction = db.transaction(["problems"], "readwrite");
    const store = transaction.objectStore("problems");

    // Check if problem already exists by leetcode_id within the same transaction to prevent race conditions
    let index;
    try {
      index = store.index("by_leetcode_id");
    } catch (error) {
      console.error(`❌ PROBLEMS INDEX ERROR: by_leetcode_id index not found in problems`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "problems"
      });
      throw error;
    }

    const existingCheck = index.get(Number(problemData.leetcode_id));
    const existingProblem = await new Promise((resolve, reject) => {
      existingCheck.onsuccess = () => {
        const result = existingCheck.result;
        logger.info("🔍 Duplicate check result:", result ? "Found existing problem" : "No duplicate found");
        resolve(result); // Will be undefined/null if not found, or the problem object if found
      };
      existingCheck.onerror = () => {
        logger.error("❌ Error checking for duplicate problem:", existingCheck.error);
        reject(existingCheck.error);
      };
    });

    if (existingProblem) {
      logger.info("Problem already exists, not creating duplicate:", existingProblem);
      return existingProblem;
    }

    const problemId = uuidv4();
    const attemptId = uuidv4();

    const leetCodeID = problemData.leetcode_id
      ? Number(problemData.leetcode_id)
      : null;
    const address = problemData.address;
    const problem = {
      problem_id: problemId, // UUID primary key
      leetcode_id: leetCodeID, // References standard_problems.id
      title: problemData.title.toLowerCase(),
      leetcode_address: address,
      cooldown_status: false,
      box_level: 1,
      review_schedule: problemData.reviewSchedule,
      perceived_difficulty: null, // Will be calculated from attempts
      consecutive_failures: 0,
      stability: 1.0,
      attempt_stats: {
        total_attempts: 0,
        successful_attempts: 0,
        unsuccessful_attempts: 0,
      }
      // Removed session_id - problems are persistent records, not session-specific
      // Removed tags - available from standard_problems store
    };
    logger.info("Adding problem:", problem);
    const request = store.add(problem);
    transaction.oncomplete = async function () {
      logger.info("Problem added successfully:", problem);

      // Get current session using SessionService to respect mutex
      let session = await SessionService.resumeSession();

      if (!session) {
        logger.warn("No active session found, creating session");
        session = await SessionService.getOrCreateSession();
      }

      const attemptData = {
        id: attemptId,
        problem_id: problemId, // Internal UUID reference
        leetcode_id: leetCodeID, // LeetCode ID for lookups
        success: problemData.success,
        attempt_date: problemData.date,
        time_spent: Number(problemData.timeSpent),
        perceived_difficulty: problemData.difficulty || 1,
        comments: problemData.comments || "",
        box_level: 1,
        next_review_date: null,
        session_id: session.id,

        // Enhanced time tracking fields
        exceeded_recommended_time: problemData.exceededRecommendedTime || false,
        overage_time: Number(problemData.overageTime) || 0,
        user_intent: problemData.userIntent || "completed",
        time_warning_level: Number(problemData.timeWarningLevel) || 0,
      };

      try {
        if (!AttemptsService || !AttemptsService.addAttempt) {
          throw new Error(
            "❌ attemptsService is undefined or missing addAttempt method."
          );
        }

        await AttemptsService.addAttempt(attemptData, problem);
        logger.info("✅ Attempt and problem added successfully.");
      } catch (error) {
        logger.error("❌ Error adding attempt:", error);
      }
    };

    request.onerror = function (event) {
      logger.error("Error adding problem:", event.target.error);
    };
  } catch (error) {
    logger.error("Error in addProblem function:", error);
  }
}

/**
 * Counts problems grouped by Leitner box level.
 * @returns {Promise<Object>} - An object with counts per box level.
 */
export async function countProblemsByBoxLevel() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems"], "readonly");
    const store = transaction.objectStore("problems");

    const boxLevelCounts = {};
    const request = store.openCursor();

    request.onsuccess = function (event) {
      const cursor = event.target.result;
      if (cursor) {
        const { box_level = 1 } = cursor.value;
        boxLevelCounts[box_level] = (boxLevelCounts[box_level] || 0) + 1;
        cursor.continue();
      } else {
        resolve(boxLevelCounts);
      }
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Checks if a problem exists in the database by its ID.
 * @param {string} problemId - The problem ID.
 * @returns {Promise<boolean>} - Returns true if the problem exists, false otherwise.
 */
export async function checkDatabaseForProblem(leetcodeId) {
  // Validate leetcodeId before attempting database operation
  if (leetcodeId == null || isNaN(Number(leetcodeId))) {
    logger.error("❌ Invalid leetcodeId for database lookup:", leetcodeId);
    throw new Error(`Invalid leetcodeId: ${leetcodeId}. Must be a valid number.`);
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems"], "readonly");
    const store = transaction.objectStore("problems");
    let index;
    try {
      index = store.index("by_leetcode_id");
    } catch (error) {
      console.error(`❌ PROBLEMS INDEX ERROR: by_leetcode_id index not found in problems`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "problems"
      });
      reject(error);
      return;
    }
    logger.info("🔍 leetcodeId lookup:", leetcodeId);
    const request = index.get(Number(leetcodeId)); // Look up by leetcode_id

    request.onsuccess = () => {
      logger.info("✅ Problem found in database by leetcode_id:", request.result);
      resolve(request.result);
    };
    request.onerror = () => {
      logger.error("❌ Error checking database for problem by leetcode_id:", request.error);
      reject(request.error);
    };
  });
}

export async function fetchAllProblems() {
  console.log('🔍 FETCH ALL PROBLEMS: Starting to fetch problems...');
  const db = await openDB();
  console.log('🔍 FETCH ALL PROBLEMS: Database opened:', db.name);
  const transaction = db.transaction("problems", "readonly");
  const objectStore = transaction.objectStore("problems");
  const cursorRequest = objectStore.openCursor();
  const problems = [];

  return new Promise((resolve, _reject) => {
    cursorRequest.onsuccess = function (event) {
      const cursor = event.target.result;

      if (cursor) {
        console.log('🔍 FETCH ALL PROBLEMS: Found problem:', cursor.value.id, cursor.value.title);
        problems.push(cursor.value);
        cursor.continue();
      } else {
        console.log('🔍 FETCH ALL PROBLEMS: Finished. Total problems found:', problems.length);
        resolve(problems); // ✅ Always return an array, even if empty
      }
    };

    cursorRequest.onerror = function (event) {
      logger.error(
        "❌ Error fetching problems from IndexedDB:",
        event.target.error
      );
      resolve([]); // ✅ Prevent errors by returning an empty array on failure
    };
  });
}

export async function fetchAdditionalProblems(
  numNewProblems,
  excludeIds = new Set(),
  _userFocusAreas = [],
  _currentAllowedTags = [],
  options = {}
) {
  const { currentDifficultyCap = null, isOnboarding = false } = options;
  logger.info("🔰 fetchAdditionalProblems called with isOnboarding:", isOnboarding);

  try {
    const context = await loadProblemSelectionContext(currentDifficultyCap);
    logProblemSelectionStart(numNewProblems, context);

    const tagDifficultyAllowances = calculateTagDifficultyAllowances(
      context.enhancedFocusTags, context.masteryData, context.tagRelationshipsRaw
    );

    const { selectedProblems, usedProblemIds } = await selectPrimaryAndExpansionProblems(
      numNewProblems, context, tagDifficultyAllowances, currentDifficultyCap, excludeIds
    );

    await expandWithRemainingFocusTags({
      numNewProblems, selectedProblems, usedProblemIds, context, currentDifficultyCap
    });

    fillRemainingWithRandomProblems(
      numNewProblems, selectedProblems, usedProblemIds, context.availableProblems, excludeIds
    );

    logger.info(`✅ Final selection: ${selectedProblems.length} problems`);
    return selectedProblems;
  } catch (error) {
    logger.error("❌ Error in fetchAdditionalProblems:", error);
    return [];
  }
}

async function loadProblemSelectionContext(currentDifficultyCap) {
  const { masteryData, _focusTags, allTagsInCurrentTier } =
    await TagService.getCurrentLearningState();
  const allProblems = await getAllStandardProblems();
  const ladders = await getPatternLadders();

  // Get attempted problems from problems store
  // All problems in this store have been attempted by the user
  const attemptedProblems = await fetchAllProblems();
  const attemptedProblemIds = new Set(
    attemptedProblems.map(p => Number(p.leetcode_id))
  );
  logger.info(`🎯 Excluding ${attemptedProblemIds.size} attempted problems from selection`);

  // Filter out attempted problems
  let availableProblems = allProblems.filter(problem => {
    const problemId = Number(problem.id || problem.leetcode_id);
    return !attemptedProblemIds.has(problemId);
  });
  logger.info(`🎯 Available problems after filtering attempts: ${availableProblems.length}/${allProblems.length}`);

  if (currentDifficultyCap) {
    availableProblems = filterProblemsByDifficultyCap(availableProblems, currentDifficultyCap);
    logger.info(`🎯 Difficulty cap applied: ${currentDifficultyCap} (${availableProblems.length} problems)`);
  }

  const focusDecision = await FocusCoordinationService.getFocusDecision("session_state");
  const enhancedFocusTags = focusDecision.activeFocusTags;

  const db = await openDB();
  const tagRelationshipsRaw = await new Promise((resolve, reject) => {
    const tx = db.transaction("tag_relationships", "readonly");
    const store = tx.objectStore("tag_relationships");
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return {
    masteryData, allTagsInCurrentTier, availableProblems, ladders,
    focusDecision, enhancedFocusTags, tagRelationshipsRaw
  };
}

function filterProblemsByDifficultyCap(allProblems, currentDifficultyCap) {
  const difficultyMap = { "Easy": 1, "Medium": 2, "Hard": 3 };
  const maxDifficulty = difficultyMap[currentDifficultyCap] || 3;
  return allProblems.filter(problem => {
    const problemDifficultyString = problem.difficulty || "Medium";
    const problemDifficultyNum = difficultyMap[problemDifficultyString] || 2;
    return problemDifficultyNum <= maxDifficulty;
  });
}

function logProblemSelectionStart(numNewProblems, context) {
  logger.info("🧠 Starting intelligent problem selection...");
  logger.info("🎯 Focus Coordination Service decision:", {
    activeFocusTags: context.enhancedFocusTags,
    reasoning: context.focusDecision.algorithmReasoning,
    userPreferences: context.focusDecision.userPreferences,
    systemRecommendation: context.focusDecision.systemRecommendation
  });
  logger.info("🧠 Needed problems:", numNewProblems);
  logger.info("🔍 Debug data availability:", {
    totalStandardProblems: context.availableProblems.length,
    ladderTags: Object.keys(context.ladders || {}),
    enhancedFocusTagsCount: context.enhancedFocusTags.length
  });
}

function calculateTagDifficultyAllowances(enhancedFocusTags, masteryData, tagRelationshipsRaw) {
  const tagDifficultyAllowances = {};
  for (const tag of enhancedFocusTags) {
    const tagMastery = masteryData.find((m) => m.tag === tag) || {
      tag, totalAttempts: 0, successfulAttempts: 0, mastered: false
    };

    const tagRelData = tagRelationshipsRaw.find(tr => tr.id === tag);
    if (tagRelData && tagRelData.difficulty_distribution) {
      tagMastery.difficulty_distribution = tagRelData.difficulty_distribution;
    }

    tagDifficultyAllowances[tag] = getDifficultyAllowanceForTag(tagMastery);
  }
  return tagDifficultyAllowances;
}

async function selectPrimaryAndExpansionProblems(numNewProblems, context, tagDifficultyAllowances, currentDifficultyCap, excludeIds = new Set()) {
  const selectedProblems = [];
  const usedProblemIds = new Set(excludeIds);

  const primaryFocusCount = Math.ceil(numNewProblems * 0.6);
  const primaryTag = context.enhancedFocusTags[0];

  logger.info(`🎯 Primary focus: ${primaryTag} (${primaryFocusCount} problems)`);
  const primaryProblems = await selectProblemsForTag(primaryTag, primaryFocusCount, {
    difficultyAllowance: tagDifficultyAllowances[primaryTag],
    ladders: context.ladders,
    allProblems: context.availableProblems,
    allTagsInCurrentTier: context.allTagsInCurrentTier,
    usedProblemIds,
    currentDifficultyCap
  });

  selectedProblems.push(...primaryProblems);
  primaryProblems.forEach((p) => usedProblemIds.add(p.id));

  const expansionCount = numNewProblems - selectedProblems.length;
  if (expansionCount > 0 && context.enhancedFocusTags.length > 1) {
    await addExpansionProblems({
      expansionCount, context, selectedProblems, usedProblemIds, currentDifficultyCap
    });
  }

  logSelectedProblems(selectedProblems);

  return { selectedProblems, usedProblemIds };
}

async function addExpansionProblems(params) {
  const { expansionCount, context, selectedProblems, usedProblemIds, currentDifficultyCap } = params;
  const expansionTag = context.enhancedFocusTags[1];
  logger.info(`🔗 Expanding to next focus tag: ${expansionTag} (${expansionCount} problems)`);

  const tagMastery = context.masteryData.find((m) => m.tag === expansionTag) || {
    tag: expansionTag, totalAttempts: 0, successfulAttempts: 0, mastered: false
  };

  const tagRelData = context.tagRelationshipsRaw.find(tr => tr.id === expansionTag);
  if (tagRelData && tagRelData.difficulty_distribution) {
    tagMastery.difficulty_distribution = tagRelData.difficulty_distribution;
  }

  const allowance = getDifficultyAllowanceForTag(tagMastery);

  const expansionProblems = await selectProblemsForTag(expansionTag, expansionCount, {
    difficultyAllowance: allowance,
    ladders: context.ladders,
    allProblems: context.availableProblems,
    allTagsInCurrentTier: context.allTagsInCurrentTier,
    usedProblemIds,
    currentDifficultyCap
  });

  selectedProblems.push(...expansionProblems);
  expansionProblems.forEach((p) => usedProblemIds.add(p.id));

  logger.info(`🔗 Added ${expansionProblems.length} problems from expansion tag: ${expansionTag}`);
}

function logSelectedProblems(selectedProblems) {
  logger.info(`🎯 Selected ${selectedProblems.length} problems for learning`);
  logger.info(`🎯 Selected problems by difficulty:`, {
    Easy: selectedProblems.filter(p => p.difficulty === 'Easy').length,
    Medium: selectedProblems.filter(p => p.difficulty === 'Medium').length,
    Hard: selectedProblems.filter(p => p.difficulty === 'Hard').length,
    problems: selectedProblems.map(p => ({id: p.id, difficulty: p.difficulty, title: p.title}))
  });
}

async function expandWithRemainingFocusTags(params) {
  const { numNewProblems, selectedProblems, usedProblemIds, context, currentDifficultyCap } = params;
  const remainingAfterExpansion = numNewProblems - selectedProblems.length;
  if (remainingAfterExpansion <= 0 || context.enhancedFocusTags.length <= 2) {
    return;
  }

  logger.info(`🔗 Expanding to all remaining focus tags for ${remainingAfterExpansion} more problems...`);

  for (let i = 2; i < context.enhancedFocusTags.length && selectedProblems.length < numNewProblems; i++) {
    const expansionTag = context.enhancedFocusTags[i];
    const needed = numNewProblems - selectedProblems.length;

    const tagMastery = context.masteryData.find((m) => m.tag === expansionTag) || {
      tag: expansionTag, totalAttempts: 0, successfulAttempts: 0, mastered: false
    };

    const allowance = getDifficultyAllowanceForTag(tagMastery);
    const moreProblems = await selectProblemsForTag(expansionTag, needed, {
      difficultyAllowance: allowance,
      ladders: context.ladders,
      allProblems: context.availableProblems,
      allTagsInCurrentTier: context.allTagsInCurrentTier,
      usedProblemIds,
      currentDifficultyCap
    });

    selectedProblems.push(...moreProblems);
    moreProblems.forEach((p) => usedProblemIds.add(p.id));

    if (moreProblems.length > 0) {
      logger.info(`🔗 Added ${moreProblems.length} problems from additional tag: ${expansionTag}`);
    }
  }
}

function fillRemainingWithRandomProblems(numNewProblems, selectedProblems, usedProblemIds, availableProblems, _excludeIds) {
  if (selectedProblems.length >= numNewProblems || availableProblems.length === 0) {
    return;
  }

  const remainingNeeded = numNewProblems - selectedProblems.length;
  logger.info(`ℹ️ Tag-based selection found ${selectedProblems.length}/${numNewProblems} problems across all focus tags. Using random selection for final ${remainingNeeded} problems.`);

  const selectedIds = new Set(selectedProblems.map(p => p.id));
  logger.info(`🔍 Before fallback filter - selectedIds:`, Array.from(selectedIds).slice(0, 5));

  const fallbackProblems = availableProblems
    .filter(p => {
      const pId = p.id;
      const isSelected = selectedIds.has(pId);
      const isUsed = usedProblemIds.has(pId);

      if (isSelected || isUsed) {
        logger.info(`🚫 Filtered out problem ${pId}: isSelected=${isSelected}, isUsed=${isUsed}`);
      }

      return !isSelected && !isUsed;
    })
    .slice(0, remainingNeeded);

  logger.info(`🔄 Fallback filter debug:`, {
    availableProblemsCount: availableProblems.length,
    selectedIdsCount: selectedIds.size,
    usedProblemIdsCount: usedProblemIds.size,
    afterFilterCount: fallbackProblems.length,
    remainingNeeded: remainingNeeded,
    firstFallbackIds: fallbackProblems.slice(0, 3).map(p => p.id)
  });

  const beforeCount = selectedProblems.length;
  selectedProblems.push(...fallbackProblems);
  const afterCount = selectedProblems.length;

  logger.warn(`🔄 FALLBACK RESULT: Added ${fallbackProblems.length} problems. Before: ${beforeCount}, After: ${afterCount}`);
  logger.info(`🔍 Fallback problems by difficulty:`, {
    Easy: fallbackProblems.filter(p => p.difficulty === 'Easy').length,
    Medium: fallbackProblems.filter(p => p.difficulty === 'Medium').length,
    Hard: fallbackProblems.filter(p => p.difficulty === 'Hard').length,
    problems: fallbackProblems.map(p => ({id: p.id, difficulty: p.difficulty, title: p.title}))
  });
}

async function _getProblemSequenceScore(
  problemId,
  unmasteredTagSet,
  tierTagSet
) {
  const db = await openDB();
  const tx = db.transaction("problem_relationships", "readonly");
  const store = tx.objectStore("problem_relationships");

  return new Promise((resolve, reject) => {
    let index;
    try {
      index = store.index("by_problem_id1");
    } catch (error) {
      console.error(`❌ PROBLEMS INDEX ERROR: by_problem_id1 index not found in problem_relationships`, {
        error: error.message,
        availableIndexes: Array.from(store.indexNames),
        storeName: "problem_relationships"
      });
      reject(error);
      return;
    }
    const request = index.getAll(problemId);
    request.onsuccess = async () => {
      const relationships = request.result;

      if (relationships.length > 0) {
        let totalStrength = 0;
        let count = 0;
        for (const rel of relationships) {
          const linkedProblem = await fetchProblemById(rel.problemId2);
          if (!linkedProblem) continue;

          const tags = linkedProblem.tags || [];

          // Count matching tags (positive influence)
          const relevantTags = tags.filter(
            (tag) => unmasteredTagSet.has(tag) || tierTagSet.has(tag)
          );
          let tagBonus = relevantTags.length;

          // Count unrelated tags (negative influence)
          const unrelatedTags = tags.filter(
            (tag) => !unmasteredTagSet.has(tag) && !tierTagSet.has(tag)
          );
          let tagPenalty = unrelatedTags.length;

          // Final adjustment:
          totalStrength += rel.strength * (tagBonus - 0.5 * tagPenalty); // adjust penalty weight
          count++;
        }

        let weightedAvgStrength = count > 0 ? totalStrength / count : 0;
        logger.info(
          `🎯 Final sequenceScore for Problem ${problemId}:`,
          weightedAvgStrength
        );
        resolve(weightedAvgStrength);
      } else {
        logger.warn(`⚠️ No relationships found for problem ${problemId}`);
        resolve(0);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function addStabilityToProblems() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems", "attempts"], "readwrite");
    const problemStore = transaction.objectStore("problems");
    const attemptStore = transaction.objectStore("attempts");
    let attemptIndex;
    try {
      attemptIndex = attemptStore.index("by_problem_id");
    } catch (error) {
      console.error(`❌ PROBLEMS INDEX ERROR: by_problem_id index not found in attempts`, {
        error: error.message,
        availableIndexes: Array.from(attemptStore.indexNames),
        storeName: "attempts"
      });
      reject(error);
      return;
    }

    const problemsRequest = problemStore.getAll();

    problemsRequest.onsuccess = async (event) => {
      const problems = event.target.result;

      for (let problem of problems) {
        const problemId = problem.id;

        // Fetch attempts for problem
        const attempts = await new Promise((resolved, reject) => {
          const request = attemptIndex.getAll(problemId);
          request.onsuccess = (event) => {
            resolved(event.target.result);
          };
          request.onerror = (event) => {
            reject(event.target.error);
          };
        });

        logger.info("🔍 Attempts:", attempts);

        // Sort attempts by date (assuming attempt_date exists)
        attempts.sort(
          (a, b) => new Date(a.attempt_date) - new Date(b.attempt_date)
        );

        // Initialize stability
        let currentStability = 1.0;

        for (let attempt of attempts) {
          currentStability = updateStabilityFSRS(
            currentStability,
            attempt.success // Assuming attempt.success is a boolean
          );
        }

        // Save stability to problem
        problem.stability = currentStability;

        problemStore.put(problem);
      }

      transaction.oncomplete = () => {
        logger.info("✅ Stability added/updated for all problems.");
        resolve();
      };

      transaction.onerror = (err) => {
        logger.error("❌ Transaction failed:", err);
        reject(err);
      };
    };
  });
}

// FSRS stability update with time-based decay consideration
/**
 * Updates stability considering both performance and time elapsed
 *
 * @param {number} currentStability - Current stability value
 * @param {boolean} wasCorrect - Whether the attempt was successful
 * @param {string|null} lastAttemptDate - ISO date string of last attempt (optional)
 * @returns {number} New stability value
 */
export function updateStabilityFSRS(currentStability, wasCorrect, lastAttemptDate = null) {
  let newStability;

  // Performance-based update
  if (wasCorrect) {
    newStability = currentStability * 1.2 + 0.5;
  } else {
    newStability = currentStability * 0.7;
  }

  // Apply time-based decay if last attempt date provided
  if (lastAttemptDate) {
    try {
      const lastDate = new Date(lastAttemptDate);
      const now = new Date();
      const daysSinceLastAttempt = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

      // Only apply decay if more than 30 days have passed
      if (daysSinceLastAttempt > 30) {
        // Exponential forgetting curve with 90-day half-life
        // stability * e^(-days / 90)
        const forgettingFactor = Math.exp(-daysSinceLastAttempt / 90);
        newStability = newStability * forgettingFactor;
      }
    } catch (error) {
      console.warn("Error applying time-based decay to stability:", error);
      // Continue with performance-based stability only
    }
  }

  return parseFloat(newStability.toFixed(2));
}

/**
 * Updates all problems with a Rating property based on their difficulty from standard_problems.
 * @returns {Promise<void>}
 */
export async function updateProblemsWithRating() {
  try {
    const db = await openDB();
    const standardProblems = await getAllStandardProblems();

    // Create a map of problem IDs to their difficulties
    const difficultyMap = {};
    standardProblems.forEach((problem) => {
      difficultyMap[problem.id] = problem.difficulty;
    });
    logger.info("🔍 difficultyMap:", difficultyMap);
    const transaction = db.transaction(["problems"], "readwrite");
    const problemStore = transaction.objectStore("problems");

    const request = problemStore.getAll();

    request.onsuccess = (event) => {
      const problems = event.target.result;

      for (let problem of problems) {
        const difficulty = difficultyMap[problem.leetcode_id];
        logger.info("🔍 difficulty:", difficulty);
        logger.info("🔍 problem:", problem.leetcode_id);
        if (difficulty) {
          problem.Rating = difficulty;
          problemStore.put(problem);
        }
      }
    };

    transaction.oncomplete = () => {
      logger.info("✅ All problems updated with ratings.");
    };

    transaction.onerror = (event) => {
      logger.error("❌ Transaction error:", event.target.error);
    };
  } catch (error) {
    logger.error("❌ Error updating problems with ratings:", error);
  }
}

export async function updateProblemWithTags() {
  const db = await openDB();
  const standardProblems = await getAllStandardProblems();
  const problemStore = db
    .transaction(["problems"], "readwrite")
    .objectStore("problems");
  const request = problemStore.getAll();

  request.onsuccess = (event) => {
    const problems = event.target.result;

    for (let problem of problems) {
      const standardProblem = standardProblems.find(
        (p) => p.id === problem.leetcode_id
      );
      if (standardProblem) {
        problem.tags = standardProblem.tags;
        problemStore.put(problem);
      }
    }
  };
}
/**
 * Normalizes an array of tags to lowercase and trims whitespace.
 * @param {string[]} tags - An array of tag strings.
 * @returns {string[]} Normalized tag array.
 */
function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => tag.trim().toLowerCase());
}

/**
 * Gets a single pattern ladder by tag name
 * @param {string} tag - The tag name to fetch ladder for
 * @returns {Promise<Object|null>} The ladder object or null if not found
 */
async function getSingleLadder(tag) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("pattern_ladders", "readonly");
    const store = transaction.objectStore("pattern_ladders");
    const request = store.get(tag);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Selects problems for a specific tag with progressive difficulty
 * @param {string} tag - The tag to select problems for
 * @param {number} count - Number of problems to select
 * @param {object} config - Configuration object containing:
 *   - difficultyAllowance: Difficulty allowance for the tag
 *   - ladders: Pattern ladders
 *   - allProblems: All standard problems
 *   - allTagsInCurrentTier: Tags in current tier
 *   - usedProblemIds: Already used problem IDs
 * @returns {Array} Selected problems
 */
async function selectProblemsForTag(tag, count, config) {
  const { difficultyAllowance, ladders, allProblems, allTagsInCurrentTier, usedProblemIds, recentAttempts = [], currentDifficultyCap = null } = config;
  logger.info(`🎯 Selecting ${count} problems for tag: ${tag}`);

  let ladder = ladders?.[tag]?.problems || [];
  const allTagsInCurrentTierSet = new Set(allTagsInCurrentTier);

  // PHASE 2: Proactive ladder regeneration - regenerate if ladder is too depleted
  const available = ladder.filter(p => !p.attempted && !usedProblemIds.has(p.id));
  const neededThreshold = count * 0.6; // Need at least 60% of request

  if (available.length < neededThreshold) {
    logger.info(`🔄 Ladder "${tag}" has ${available.length}/${Math.ceil(neededThreshold)} needed (${ladder.length} total). Regenerating...`);

    try {
      // Regenerate using existing function (re-scores with fresh relationships)
      await regenerateCompletedPatternLadder(tag);

      // Reload the regenerated ladder
      const reloadedLadder = await getSingleLadder(tag);
      if (reloadedLadder && reloadedLadder.problems) {
        ladder = reloadedLadder.problems;
        logger.info(`✅ Regenerated ladder "${tag}" now has ${ladder.length} problems (${ladder.filter(p => !p.attempted).length} unattempted)`);
      }
    } catch (error) {
      logger.error(`❌ Failed to regenerate ladder "${tag}":`, error);
      // Continue with existing ladder on error
    }
  }

  logger.info(`🔍 Tag selection debug for "${tag}":`, {
    ladderProblemsCount: ladder.length,
    allTagsInCurrentTierCount: allTagsInCurrentTier.length,
    difficultyAllowance: difficultyAllowance,
    usedProblemIdsCount: usedProblemIds.size
  });

  // Filter eligible problems with progressive difficulty preference
  const eligibleProblems = ladder
    .filter((problem) => {
      // Use consistent 'id' field (LeetCode ID)
      const id = problem.id;
      const rating = problem.difficulty || problem.rating || "Medium";
      const tags = normalizeTags(problem.tags || []);

      // Basic filters
      if (usedProblemIds.has(id)) return false;
      if (difficultyAllowance[rating] <= 0) return false;
      if (!tags.includes(tag)) return false;

      // Tier constraint - for onboarding, only check if target tag is in tier
      const tierValid = allTagsInCurrentTierSet.has(tag) || allTagsInCurrentTier.length === 0;
      if (!tierValid) return false;

      return true;
    })
    .map((problem) => ({
      ...problem,
      difficultyScore: getDifficultyScore(problem.difficulty || "Medium"),
      allowanceWeight: difficultyAllowance[problem.difficulty || "Medium"],
    }))
    // Add relationship scoring before final sort
  const problemsWithRelationships = await scoreProblemsWithRelationships(
    eligibleProblems.map(p => ({ id: p.id, ...p })),
    recentAttempts,
    5 // Look at last 5 attempts
  );

  // Calculate composite scores
  problemsWithRelationships.forEach(problem => {
    problem.compositeScore = calculateCompositeScore(problem, currentDifficultyCap, getDifficultyScore);
  });

  // Sort by composite score (higher is better)
  problemsWithRelationships.sort((a, b) => {
    const scoreDiff = b.compositeScore - a.compositeScore;
    if (Math.abs(scoreDiff) > 0.001) {
      return scoreDiff;
    }
    // Tiebreaker: prefer easier problems if scores are equal
    return a.difficultyScore - b.difficultyScore;
  });

  // Log composite score distribution for debugging
  logCompositeScores(problemsWithRelationships, tag);

  logger.info(
    `🎯 Found ${eligibleProblems.length} eligible problems for ${tag}`
  );

  // Add detailed debug info if no problems found
  if (eligibleProblems.length === 0 && ladder.length > 0) {
    logger.warn(`🔍 Why no problems for "${tag}"? Analyzing first ladder problem:`, {
      sampleProblem: ladder[0],
      sampleId: ladder[0]?.id,
      isUsed: usedProblemIds.has(ladder[0]?.id),
      sampleRating: ladder[0]?.difficulty || ladder[0]?.rating,
      allowanceForRating: difficultyAllowance[ladder[0]?.difficulty || ladder[0]?.rating || "Medium"],
      sampleTags: normalizeTags(ladder[0]?.tags || []),
      hasTargetTag: normalizeTags(ladder[0]?.tags || []).includes(tag),
      tierValidation: ladder[0]?.tags ? normalizeTags(ladder[0].tags).every(t => allTagsInCurrentTierSet.has(t)) : false
    });
  }

  // Select problems with progressive difficulty
  const selectedProblems = [];
  let selectedCount = 0;

  for (const problem of eligibleProblems) {
    if (selectedCount >= count) break;

    // Use consistent 'id' field (LeetCode ID)
    const problemId = problem.id;
    const standardProblem = allProblems.find(
      (p) => p.id === problemId
    );
    if (standardProblem) {
      selectedProblems.push(standardProblem);
      selectedCount++;
    }
  }

  logger.info(`🎯 Selected ${selectedProblems.length} problems for ${tag}`);
  return selectedProblems;
}

/**
 * Gets related tags for expansion based on tag relationships
 * @param {string} primaryTag - The primary focus tag
 * @param {array} focusTags - Current focus tags
 * @param {object} tagRelationships - Tag relationship data
 * @param {array} allTagsInCurrentTier - All tags in current tier
 * @returns {Promise<Array>} Related tags for expansion
 */

/**
 * Gets difficulty score for progressive difficulty ordering
 * @param {string} difficulty - Difficulty level
 * @returns {number} Difficulty score
 */
function getDifficultyScore(difficulty) {
  const scores = { Easy: 1, Medium: 2, Hard: 3 };
  return scores[difficulty] || 2;
}

/**
 * Gets problem data with official difficulty from standard_problems
 * Merges user problem data with official difficulty information
 * @param {number} leetCodeID - The LeetCode problem ID
 * @returns {Promise<Object|null>} - Problem with official difficulty or null
 */
export async function getProblemWithOfficialDifficulty(leetCodeID) {
  try {
    const db = await openDB();

    // Get user problem data
    const problemTx = db.transaction("problems", "readonly");
    const problemStore = problemTx.objectStore("problems");
    // Note: Using direct store access since we're querying all problems, not by specific index

    const userProblem = await new Promise((resolve, reject) => {
      let index;
      try {
        index = problemStore.index("by_leetcode_id");
      } catch (error) {
        console.error(`❌ PROBLEMS INDEX ERROR: by_leetcode_id index not found in problems`, {
          error: error.message,
          availableIndexes: Array.from(problemStore.indexNames),
          storeName: "problems"
        });
        reject(error);
        return;
      }
      const request = index.get(leetCodeID);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    // Get official difficulty from standard_problems
    const standardProblem = await fetchProblemById(leetCodeID);

    if (!standardProblem) {
      logger.warn(
        `⚠️ No standard problem found for LeetCode ID: ${leetCodeID}`
      );
      // Return user problem with field mapping even without standard problem data
      return {
        ...userProblem,
        id: userProblem?.leetcode_id || leetCodeID,
        leetcode_id: userProblem?.leetcode_id || leetCodeID,
        problemId: userProblem?.problem_id,
        title: userProblem?.title,
        difficulty: userProblem?.difficulty || userProblem?.Rating || "Unknown",
        tags: userProblem?.tags || userProblem?.Tags || [],
        boxLevel: userProblem?.box_level,
        reviewSchedule: userProblem?.review_schedule,
        cooldownStatus: userProblem?.cooldown_status,
        perceivedDifficulty: userProblem?.perceived_difficulty,
        consecutiveFailures: userProblem?.consecutive_failures,
        attemptStats: userProblem?.attempt_stats,
      };
    }

    // Merge data: user problem data + official metadata from standard_problems
    // Convert snake_case to camelCase for UI compatibility
    const mergedProblem = {
      ...userProblem,
      // Map snake_case fields to camelCase for UI compatibility
      id: userProblem?.leetcode_id || leetCodeID, // UI expects 'id' not 'leetcode_id'
      leetcode_id: userProblem?.leetcode_id || leetCodeID, // Keep both for compatibility
      problemId: userProblem?.problem_id, // Internal UUID
      // Official metadata from standard_problems (don't duplicate in problems table)
      difficulty: standardProblem.difficulty || userProblem?.difficulty || userProblem?.Rating || "Unknown",
      tags: standardProblem.tags || userProblem?.tags || userProblem?.Tags || [],
      title: standardProblem.title || userProblem?.title,
      // Map other snake_case fields to camelCase
      boxLevel: userProblem?.box_level,
      reviewSchedule: userProblem?.review_schedule,
      cooldownStatus: userProblem?.cooldown_status,
      perceivedDifficulty: userProblem?.perceived_difficulty,
      consecutiveFailures: userProblem?.consecutive_failures,
      attemptStats: userProblem?.attempt_stats,
    };

    return mergedProblem;
  } catch (error) {
    logger.error(
      `❌ Error getting problem with official difficulty for ID ${leetCodeID}:`,
      error
    );
    return null;
  }
}

// ===============================
// RETRY-ENABLED DATABASE OPERATIONS
// ===============================

/**
 * Get problem by ID with retry logic
 * Enhanced version of getProblem() with timeout and retry handling
 * @param {number} problemId - Problem ID to fetch
 * @param {Object} options - Retry configuration options
 * @returns {Promise<Object|null>} Problem data or null
 */
export function getProblemWithRetry(problemId, options = {}) {
  const {
    timeout = indexedDBRetry.quickTimeout,
    operationName = "getProblem",
    priority = "normal",
    abortController = null,
  } = options;

  return indexedDBRetry.executeWithRetry(
    async () => {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["problems"], "readonly");
        const problemStore = transaction.objectStore("problems");
        const request = problemStore.get(problemId);

        request.onsuccess = (event) => {
          resolve(event.target.result || null);
        };

        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
      });
    },
    {
      timeout,
      operationName,
      priority,
      abortController,
      deduplicationKey: `get_problem_${problemId}`,
    }
  );
}

/**
 * Check if problem exists in database with retry logic
 * Enhanced version of checkDatabaseForProblem() with timeout and retry handling
 * @param {number} problemId - Problem ID to check
 * @param {Object} options - Retry configuration options
 * @returns {Promise<boolean>} True if problem exists, false otherwise
 */
export function checkDatabaseForProblemWithRetry(
  leetcodeId,
  options = {}
) {
  const {
    timeout = indexedDBRetry.quickTimeout,
    operationName = "checkDatabaseForProblem",
    priority = "normal",
    abortController = null,
  } = options;

  // Validate leetcodeId before attempting database operation
  if (leetcodeId == null || isNaN(Number(leetcodeId))) {
    logger.error("❌ Invalid leetcodeId for database lookup with retry:", leetcodeId);
    return Promise.reject(new Error(`Invalid leetcodeId: ${leetcodeId}. Must be a valid number.`));
  }

  return indexedDBRetry.executeWithRetry(
    async () => {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["problems"], "readonly");
        const store = transaction.objectStore("problems");
        let index;
        try {
          index = store.index("by_leetcode_id");
        } catch (error) {
          console.error(`❌ PROBLEMS INDEX ERROR: by_leetcode_id index not found in problems`, {
            error: error.message,
            availableIndexes: Array.from(store.indexNames),
            storeName: "problems"
          });
          reject(error);
          return;
        }
        const request = index.get(Number(leetcodeId)); // Look up by leetcode_id

        request.onsuccess = () => {
          resolve(!!request.result); // Convert to boolean
        };

        request.onerror = () => reject(request.error);
        transaction.onerror = () => reject(transaction.error);
      });
    },
    {
      timeout,
      operationName,
      priority,
      abortController,
      deduplicationKey: `check_problem_${leetcodeId}`,
    }
  );
}

/**
 * Add problem to database with retry logic
 * Enhanced version of addProblem() with timeout and retry handling
 * @param {Object} problemData - Problem data to add
 * @param {Object} options - Retry configuration options
 * @returns {Promise<Object>} Result of add operation
 */
export function addProblemWithRetry(problemData, options = {}) {
  const {
    timeout = indexedDBRetry.defaultTimeout,
    operationName = "addProblem",
    priority = "normal",
    abortController = null,
  } = options;

  return indexedDBRetry.executeWithRetry(
    () => {
      // This is a complex operation, so we'll use the enhanced dbHelper transaction method
      return dbHelper.executeTransaction(
        ["problems", "standard_problems"], // Multiple stores needed
        "readwrite",
        async (tx, stores) => {
          const [problemStore] = stores;

          // Get standard problem data (for future use if needed)
          const _standardProblem = await fetchProblemById(
            problemData.leetcode_id
          );

          // Get current session using SessionService to respect mutex
          let session = await SessionService.resumeSession();

          if (!session) {
            throw new Error("No active session found");
          }

          // Create the problem entry
          const problemEntry = {
            problem_id: uuidv4(), // UUID primary key
            leetcode_id: problemData.leetcode_id,
            title: problemData.title.toLowerCase(),
            box_level: 1,
            review_schedule: new Date().toISOString(),
            // Removed session_id - problems are persistent records, not session-specific
            // Removed tags and difficulty - available from standard_problems store
          };

          // Add problem to database
          return new Promise((resolve, reject) => {
            const request = problemStore.put(problemEntry);
            request.onsuccess = () =>
              resolve({
                success: true,
                problemId: problemEntry.leetcode_id,
                data: problemEntry,
              });
            request.onerror = () => reject(request.error);
          });
        },
        {
          timeout,
          operationName,
          priority,
          abortController,
        }
      );
    },
    {
      timeout,
      operationName,
      priority,
      abortController,
      retries: 2, // Fewer retries for write operations
    }
  );
}

/**
 * Fixes problems with corrupted difficulty fields by restoring from standard problems
 * @returns {Promise<number>} Number of problems fixed
 */
export async function fixCorruptedDifficultyFields() {
  const db = await openDB();
  let fixedCount = 0;

  return new Promise((resolve, reject) => {
    (async () => {
      try {
        // Get all standard problems for lookup
        const standardProblems = await getAllStandardProblems();
      const standardProblemsMap = {};
      standardProblems.forEach(p => {
        standardProblemsMap[p.id] = p;
      });

      const transaction = db.transaction(["problems"], "readwrite");
      const store = transaction.objectStore("problems");
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          // Note: difficulty was removed from problem objects - it's now in standard_problems
          // This corruption check is no longer needed since difficulty is managed separately
          // Skipping difficulty corruption check as it's handled by standard_problems store

          cursor.continue();
        } else {
          console.log(`✅ Fixed ${fixedCount} problems with corrupted difficulty fields`);
          resolve(fixedCount);
        }
      };

        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    })();
  });
}

/**
 * Save updated problem with retry logic
 * Enhanced version of saveUpdatedProblem() with timeout and retry handling
 * @param {Object} problem - Problem data to save
 * @param {Object} options - Retry configuration options
 * @returns {Promise<Object>} Save result
 */
export function saveUpdatedProblemWithRetry(problem, options = {}) {
  const {
    timeout = indexedDBRetry.defaultTimeout,
    operationName = "saveUpdatedProblem",
    priority = "normal",
    abortController = null,
  } = options;

  return indexedDBRetry.executeWithRetry(
    () => {
      return dbHelper.putRecord("problems", problem, {
        timeout,
        operationName,
        priority,
        abortController,
      });
    },
    {
      timeout,
      operationName,
      priority,
      abortController,
      retries: 2, // Fewer retries for write operations
    }
  );
}

/**
 * Count problems by box level with retry logic
 * Enhanced version of countProblemsByBoxLevel() with timeout and retry handling
 * @param {Object} options - Retry configuration options
 * @returns {Promise<Object>} Box level counts as {boxLevel: count}
 * @example
 * // Returns: {1: 5, 2: 3, 3: 2, 4: 1}
 * const counts = await countProblemsByBoxLevelWithRetry();
 */
export function countProblemsByBoxLevelWithRetry(options = {}) {
  const {
    timeout = indexedDBRetry.defaultTimeout,
    operationName = "countProblemsByBoxLevel",
    priority = "low",
    abortController = null,
  } = options;

  return indexedDBRetry.executeWithRetry(
    async () => {
      const db = await openDB();
      const problems = await new Promise((resolve, reject) => {
        const transaction = db.transaction(["problems"], "readonly");
        const store = transaction.objectStore("problems");
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Count problems by box level - return object format to match non-retry version
      const boxLevelCounts = {};
      problems.forEach((problem) => {
        const box_level = problem.box_level || 1;
        boxLevelCounts[box_level] = (boxLevelCounts[box_level] || 0) + 1;
      });

      return boxLevelCounts;
    },
    {
      timeout,
      operationName,
      priority,
      abortController,
      deduplicationKey: "count_problems_by_box",
    }
  );
}

/**
 * Fetch all problems with retry logic and streaming support
 * Enhanced version of fetchAllProblems() with timeout and retry handling
 * @param {Object} options - Retry configuration options
 * @returns {Promise<Array>} All problems
 */
export function fetchAllProblemsWithRetry(options = {}) {
  const {
    timeout = indexedDBRetry.bulkTimeout,
    operationName = "fetchAllProblems",
    priority = "low",
    abortController = null,
    streaming = false,
    onProgress = null,
  } = options;

  return indexedDBRetry.executeWithRetry(
    () => {
      return dbHelper.getAllRecords("problems", null, {
        timeout,
        operationName,
        priority,
        abortController,
        streaming,
        onProgress,
      });
    },
    {
      timeout,
      operationName,
      priority,
      abortController,
      retries: 3, // More retries for bulk operations
    }
  );
}

/**
 * Get problem with official difficulty using retry logic
 * Enhanced version of getProblemWithOfficialDifficulty() with timeout and retry handling
 * @param {number} leetCodeID - LeetCode problem ID
 * @param {Object} options - Retry configuration options
 * @returns {Promise<Object|null>} Problem with official difficulty
 */
export function getProblemWithOfficialDifficultyWithRetry(
  leetCodeID,
  options = {}
) {
  const {
    timeout = indexedDBRetry.defaultTimeout,
    operationName = "getProblemWithOfficialDifficulty",
    priority = "normal",
    abortController = null,
  } = options;

  return indexedDBRetry.executeWithRetry(
    () => {
      // Use the existing implementation but wrap it with our retry logic
      return getProblemWithOfficialDifficulty(leetCodeID);
    },
    {
      timeout,
      operationName,
      priority,
      abortController,
      deduplicationKey: `problem_official_difficulty_${leetCodeID}`,
    }
  );
}
