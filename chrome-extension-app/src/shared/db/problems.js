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
import { getTagRelationships } from "./tag_relationships.js";

// Import session functions
const getOrCreateSession = () => {
  return SessionService.getOrCreateSession();
};

const saveSessionToStorageLocal = (session) => {
  return saveSessionToStorage(session);
};

const openDB = dbHelper.openDB;

// Import retry service for enhanced database operations
import indexedDBRetry from "../services/IndexedDBRetryService.js";
import { SessionService } from "../services/sessionService.js";
import { saveSessionToStorage } from "./sessions.js";
import logger from "../utils/logger.js";

/**
 * Fetches a set of problems based on difficulty level.
 * @param {number} limit - The number of problems to fetch.
 * @returns {Promise<Array>} - Returns an array of problems matching the criteria.
 */
// export const getProblemsByDifficulty = async (limit) => {
//   const db = await openDB();
//   return new Promise((resolve, reject) => {
//     const transaction = db.transaction("problems", "readonly");
//     const store = transaction.objectStore("problems");

//     const problems = [];
//     const request = store.openCursor();

//     request.onsuccess = (event) => {
//       const cursor = event.target.result;
//       if (cursor && problems.length < limit) {
//         problems.push(cursor.value);
//         cursor.continue();
//       } else {
//         resolve(problems);
//       }
//     };

//     request.onerror = (event) => {
//       reject(event.target.error);
//     };
//   });
// };

// /**
//  * Fetches a set of new problems that haven't been attempted yet.
//  * @param {number} limit - The number of new problems to fetch.
//  * @param {Array} excludeIds - The IDs of problems to exclude.
//  * @returns {Promise<Array>} - Returns an array of new problems.
//  */
// export const getNewProblems = async (
//   limit,
//   excludeIds,
//   maxDifficulty = "Medium"
// ) => {
//   const db = await openDB();

//   // Corresponding intervals for 0-based box levels
//   const boxIntervals = [1, 3, 7, 14, 30, 60, 90, 120];
//   const highestBoxLevel = boxIntervals.length - 1; // Index of the highest interval
//   let validatedNextProblemIds = [];
//   let problemsPulled = 0;

//   while (problemsPulled < limit) {
//     let additionalNextProblemIds = [];

//     for (let boxLevel = highestBoxLevel; boxLevel >= 0; boxLevel--) {
//       if (problemsPulled >= limit) break;

//       const allProblems = await fetchAllProblems();
//       const problemsInBox = allProblems
//         .filter(
//           (problem) =>
//             problem.BoxLevel === boxLevel &&
//             problem.NextProblem &&
//             !excludeIds.includes(problem.NextProblem)
//         )
//         .sort(
//           (a, b) => b.AttemptStats.TotalAttempts - a.AttemptStats.TotalAttempts
//         );

//       for (const problem of problemsInBox) {
//         if (problemsPulled >= limit) break;

//         const nextProblemId = problem.NextProblem;

//         // Check if the NextProblem has already been attempted
//         const nextProblemRequest = db
//           .transaction("problems", "readonly")
//           .objectStore("problems")
//           .index("by_problem")
//           .get(nextProblemId);

//         const nextProblemExists = await new Promise((resolve) => {
//           nextProblemRequest.onsuccess = (event) =>
//             resolve(!!nextProblemRequest.result);
//           nextProblemRequest.onerror = () => resolve(false);
//         });

//         // If the NextProblem exists in the problems store, skip it
//         if (nextProblemExists) {
//           logger.info(
//             `Skipping NextProblem ${nextProblemId} (already attempted).`
//           );
//           continue;
//         }

//         // Fetch the NextProblem details from the standard_problems store
//         const standardProblemRequest = db
//           .transaction("standard_problems", "readonly")
//           .objectStore("standard_problems")
//           .get(nextProblemId);

//         const standardProblem = await new Promise((resolve) => {
//           standardProblemRequest.onsuccess = (event) =>
//             resolve(event.target.result || null);
//           standardProblemRequest.onerror = () => resolve(null);
//         });

//         if (
//           standardProblem &&
//           isDifficultyAllowed(standardProblem.difficulty, maxDifficulty) &&
//           !excludeIds.includes(standardProblem.id)
//         ) {
//           validatedNextProblemIds.push(standardProblem.id);
//           additionalNextProblemIds.push(standardProblem.id);
//           problemsPulled++;
//         }
//       }
//     }

//     // If no additional problems are found, break to avoid infinite loops
//     if (additionalNextProblemIds.length === 0) {
//       logger.warn("No additional NextProblems meet the criteria.");
//       break;
//     }
//   }

//   // Fetch validated NextProblems from standard_problems store
//   const nextProblems = await fetchProblemsByIdsWithTransaction(
//     db,
//     validatedNextProblemIds.slice(0, limit)
//   );

//   logger.info(
//     `Pulled ${nextProblems.length} problems from NextProblem.`,
//     nextProblems
//   );

//   return nextProblems;
// };

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
    const index = store.index("by_title");

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

    let session = await new Promise((resolve) => {
      chrome.storage.local.get(["currentSession"], (result) => {
        resolve(result.currentSession || null);
      });
    });

    if (!session) {
      session = await getOrCreateSession();
      await saveSessionToStorageLocal(session);
    }

    const transaction = db.transaction(["problems"], "readwrite");
    const store = transaction.objectStore("problems");

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
      perceived_difficulty: problemData.difficulty || 5,
      consecutive_failures: 0,
      stability: 1.0,
      attempt_stats: {
        total_attempts: 0,
        successful_attempts: 0,
        unsuccessful_attempts: 0,
      },
      tags: problemData.tags || [],
      session_id: session.id,
    };
    logger.info("Adding problem:", problem);
    const request = store.add(problem);
    transaction.oncomplete = async function () {
      logger.info("Problem added successfully:", problem);

      const attemptData = {
        id: attemptId,
        problem_id: problemId, // Internal UUID reference
        leetcode_id: leetCodeID, // LeetCode ID for lookups
        success: problemData.success,
        attempt_date: problemData.date,
        time_spent: Number(problemData.timeSpent),
        perceived_difficulty: problemData.difficulty || 5,
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
        const { BoxLevel } = cursor.value;
        boxLevelCounts[BoxLevel] = (boxLevelCounts[BoxLevel] || 0) + 1;
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
export async function checkDatabaseForProblem(problemId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems"], "readonly");
    const store = transaction.objectStore("problems");
    logger.info("🔍 problemId:", problemId);
    const request = store.get(problemId); // Use primary key (leetcode_id) directly

    // return true if problem is found, false otherwise
    request.onsuccess = () => {
      logger.info("✅ Problem found in database:", request.result);
      resolve(request.result);
    };
    request.onerror = () => {
      logger.error("❌ Error checking database for problem:", request.error);

      reject(request.error);
    };
  });
}

export async function fetchAllProblems() {
  const db = await openDB();
  const transaction = db.transaction("problems", "readonly");
  const objectStore = transaction.objectStore("problems");
  const cursorRequest = objectStore.openCursor();
  const problems = [];

  return new Promise((resolve, _reject) => {
    cursorRequest.onsuccess = function (event) {
      const cursor = event.target.result;

      if (cursor) {
        problems.push(cursor.value);
        cursor.continue();
      } else {
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
  const { userId = "session_state", currentDifficultyCap = null, isOnboarding = false } = options;
  logger.info("🔰 fetchAdditionalProblems called with isOnboarding:", isOnboarding);
  try {
    const { masteryData, _focusTags, allTagsInCurrentTier } =
      await TagService.getCurrentLearningState();
    const allProblems = await getAllStandardProblems();
    const ladders = await getPatternLadders();


    // Filter problems by difficulty cap if provided (for non-onboarding/adaptive progression)
    let availableProblems = allProblems;
    if (currentDifficultyCap) {
      const difficultyMap = { "Easy": 1, "Medium": 2, "Hard": 3 };
      const maxDifficulty = difficultyMap[currentDifficultyCap] || 3;
      availableProblems = allProblems.filter(problem => {
        const problemDifficultyString = problem.difficulty || problem.Difficulty || "Medium";
        const problemDifficultyNum = difficultyMap[problemDifficultyString] || 2;
        return problemDifficultyNum <= maxDifficulty;
      });
      logger.info(`🎯 Difficulty cap applied: ${currentDifficultyCap} (${availableProblems.length}/${allProblems.length} problems)`);
    }

    // 🎯 Get coordinated focus decision (integrates all systems)
    const focusDecision = await FocusCoordinationService.getFocusDecision(userId);
    
    // Use coordinated focus decision for enhanced focus tags
    const enhancedFocusTags = focusDecision.activeFocusTags;

    logger.info("🧠 Starting intelligent problem selection...");
    logger.info("🎯 Focus Coordination Service decision:", {
      activeFocusTags: enhancedFocusTags,
      reasoning: focusDecision.algorithmReasoning,
      userPreferences: focusDecision.userPreferences,
      systemRecommendation: focusDecision.systemRecommendation
    });
    logger.info("🧠 Needed problems:", numNewProblems);
    logger.info("🔍 Debug data availability:", {
      totalStandardProblems: availableProblems.length,
      ladderTags: Object.keys(ladders || {}),
      enhancedFocusTagsCount: enhancedFocusTags.length,
      difficultyCapApplied: !!currentDifficultyCap
    });
    
    // Backward compatibility logging
    logger.info("🧠 Enhanced focus tags (from coordination service):", enhancedFocusTags);

    // Get tag relationships for expansion
    const _tagRelationships = await getTagRelationships();

    // Calculate difficulty allowances for all tags
    const tagDifficultyAllowances = {};
    for (const tag of enhancedFocusTags) {
      const tagMastery = masteryData.find((m) => m.tag === tag) || {
        tag,
        totalAttempts: 0,
        successfulAttempts: 0,
        mastered: false,
      };
      tagDifficultyAllowances[tag] = getDifficultyAllowanceForTag(tagMastery);
    }

    const selectedProblems = [];
    const usedProblemIds = new Set(excludeIds);

    // Step 1: Primary focus (60% of problems) - Deep learning on highest priority tag
    const primaryFocusCount = Math.ceil(numNewProblems * 0.6);
    const primaryTag = enhancedFocusTags[0]; // Highest priority tag (user selection or system recommendation)

    logger.info(
      `🎯 Primary focus: ${primaryTag} (${primaryFocusCount} problems)`
    );
    const primaryProblems = await selectProblemsForTag(primaryTag, primaryFocusCount, {
      difficultyAllowance: tagDifficultyAllowances[primaryTag],
      ladders,
      allProblems: availableProblems,
      allTagsInCurrentTier,
      usedProblemIds
    });

    selectedProblems.push(...primaryProblems);
    primaryProblems.forEach((p) => usedProblemIds.add(p.id));

    // Step 2: Focus tag expansion (40% of problems) - Use next focus tag
    const expansionCount = numNewProblems - selectedProblems.length;
    if (expansionCount > 0 && enhancedFocusTags.length > 1) {
      const expansionTag = enhancedFocusTags[1]; // Use next highest priority tag for expansion
      logger.info(
        `🔗 Expanding to next focus tag: ${expansionTag} (${expansionCount} problems)`
      );

      const tagMastery = masteryData.find((m) => m.tag === expansionTag) || {
        tag: expansionTag,
        totalAttempts: 0,
        successfulAttempts: 0,
        mastered: false,
      };
      const allowance = getDifficultyAllowanceForTag(tagMastery);

      const expansionProblems = await selectProblemsForTag(expansionTag, expansionCount, {
        difficultyAllowance: allowance,
        ladders,
        allProblems: availableProblems,
        allTagsInCurrentTier,
        usedProblemIds
      });

      selectedProblems.push(...expansionProblems);
      expansionProblems.forEach((p) => usedProblemIds.add(p.id));

      logger.info(
        `🔗 Added ${expansionProblems.length} problems from expansion tag: ${expansionTag}`
      );
    }

    logger.info(`🎯 Selected ${selectedProblems.length} problems for learning`);
    logger.info(`🎯 Selected problems by difficulty:`, {
      Easy: selectedProblems.filter(p => (p.difficulty || p.Difficulty) === 'Easy').length,
      Medium: selectedProblems.filter(p => (p.difficulty || p.Difficulty) === 'Medium').length,
      Hard: selectedProblems.filter(p => (p.difficulty || p.Difficulty) === 'Hard').length,
      problems: selectedProblems.map(p => ({id: p.id, difficulty: p.difficulty || p.Difficulty, title: p.title}))
    });
    
    // **FALLBACK LOGIC**: If we don't have enough problems, select from all available problems
    logger.info(`🔍 Fallback check: selectedProblems.length=${selectedProblems.length}, numNewProblems=${numNewProblems}, availableProblems.length=${availableProblems.length}`);
    
    if (selectedProblems.length < numNewProblems && availableProblems.length > 0) {
      const remainingNeeded = numNewProblems - selectedProblems.length;
      logger.warn(`⚠️ Tag-based selection only found ${selectedProblems.length}/${numNewProblems} problems. Using fallback selection for ${remainingNeeded} more.`);
      
      // Filter out already selected problems
      const selectedIds = new Set(selectedProblems.map(p => p.id));
      logger.info(`🔍 Before fallback filter - selectedIds:`, Array.from(selectedIds).slice(0, 5));
      
      const fallbackProblems = availableProblems
        .filter(p => {
          const pId = p.id;
          const isSelected = selectedIds.has(pId);
          const isUsed = usedProblemIds.has(pId);
          
          // Debug first few failures
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
        Easy: fallbackProblems.filter(p => (p.difficulty || p.Difficulty) === 'Easy').length,
        Medium: fallbackProblems.filter(p => (p.difficulty || p.Difficulty) === 'Medium').length,
        Hard: fallbackProblems.filter(p => (p.difficulty || p.Difficulty) === 'Hard').length,
        problems: fallbackProblems.map(p => ({id: p.id, difficulty: p.difficulty || p.Difficulty, title: p.title}))
      });
    } else {
      logger.info(`🔄 Fallback skipped: hasEnough=${selectedProblems.length >= numNewProblems}, hasAvailable=${availableProblems.length > 0}`);
    }
    
    return selectedProblems;
  } catch (error) {
    logger.error("❌ Error in fetchAdditionalProblems():", error);
    return [];
  }
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
    const request = store.index("by_problem_id_1").getAll(problemId);
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

// export async function fetchAdditionalProblems(countNeeded, excludeIds) {
//   const db = await openDB();
//   const { classification, unmasteredTags } = await getCurrentLearningState();
//   const allowedDifficulties = getAllowedDifficulties(classification);

//   const boxIntervals = [1, 3, 7, 14, 30, 60, 90, 120];
//   const highestBoxLevel = boxIntervals.length - 1;
//   let validatedNextProblemIds = [];
//   let problemsPulled = 0;

//   const attemptedProblems = new Set(excludeIds); // ✅ Persisted between calls

//   // 🔹 Callback to update `attemptedProblems`
//   const updateAttemptedCallback = (newProblem) => {
//     attemptedProblems.add(newProblem);
//     logger.info(`📝 Updated attemptedProblems:`, attemptedProblems);
//   };

//   let maxRetries = 3; // 🔹 Prevents infinite loops

//   while (problemsPulled < countNeeded && maxRetries-- > 0) {
//     for (let boxLevel = highestBoxLevel; boxLevel >= 0; boxLevel--) {
//       if (problemsPulled >= countNeeded) break;

//       const allProblems = await fetchAllProblems();
//       const problemsInBox = allProblems
//         .filter(
//           (problem) =>
//             problem.BoxLevel === boxLevel && !attemptedProblems.has(problem.id)
//         )
//         .sort(
//           (a, b) => b.AttemptStats.TotalAttempts - a.AttemptStats.TotalAttempts
//         );

//       for (const problem of problemsInBox) {
//         if (problemsPulled >= countNeeded) break;

//         // ✅ Pass callback to track selected problems
//         const nextProblemId = await findBestNextProblem(
//           attemptedProblems,
//           updateAttemptedCallback
//         );

//         if (!nextProblemId || attemptedProblems.has(nextProblemId)) {
//           continue;
//         }

//         logger.info(`✅ NextProblem Selected: ${nextProblemId}`);
//         attemptedProblems.add(nextProblemId); // ✅ Ensure problem is not chosen again

//         // ✅ Fetch NextProblem details from `standard_problems`
//         const standardProblemRequest = db
//           .transaction("standard_problems", "readonly")
//           .objectStore("standard_problems")
//           .get(nextProblemId);

//         const standardProblem = await new Promise((resolve) => {
//           standardProblemRequest.onsuccess = (event) =>
//             resolve(event.target.result || null);
//           standardProblemRequest.onerror = () => resolve(null);
//         });

//         // ✅ Validate difficulty & ensure uniqueness
//         if (
//           standardProblem &&
//           allowedDifficulties.includes(standardProblem.difficulty) &&
//           !attemptedProblems.has(standardProblem.id)
//         ) {
//           validatedNextProblemIds.push(standardProblem.id);
//           problemsPulled++;
//         }
//       }
//     }

//     if (validatedNextProblemIds.length === 0) {
//       logger.warn(
//         "⚠️ No additional NextProblems meet the criteria. Retrying..."
//       );
//     }
//   }

//   // ✅ Exit early if no problems found after retries
//   if (validatedNextProblemIds.length === 0) {
//     logger.error(
//       "❌ Could not find additional NextProblems after retries. Exiting."
//     );
//     return [];
//   }

//   // ✅ Fetch validated NextProblems from `standard_problems`
//   const nextProblems = await fetchProblemsByIdsWithTransaction(
//     db,
//     validatedNextProblemIds.slice(0, countNeeded)
//   );

//   logger.info(
//     `✅ Pulled ${nextProblems.length} problems from NextProblem.`,
//     nextProblems
//   );
//   return nextProblems;
// }

export async function addStabilityToProblems() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems", "attempts"], "readwrite");
    const problemStore = transaction.objectStore("problems");
    const attemptStore = transaction.objectStore("attempts");
    const attemptIndex = attemptStore.index("by_problemId");

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

        // Sort attempts by date (assuming attemptDate exists)
        attempts.sort(
          (a, b) => new Date(a.AttemptDate) - new Date(b.AttemptDate)
        );

        // Initialize stability
        let currentStability = 1.0;

        for (let attempt of attempts) {
          currentStability = updateStabilityFSRS(
            currentStability,
            attempt.Success // Assuming attempt.hasCorrect is a boolean
          );
        }

        // Save stability to problem
        problem.Stability = currentStability;

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

// Reuse updateStabilityFSRS:
export function updateStabilityFSRS(currentStability, wasCorrect) {
  if (wasCorrect) {
    return parseFloat((currentStability * 1.2 + 0.5).toFixed(2));
  } else {
    return parseFloat((currentStability * 0.7).toFixed(2));
  }
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
        delete problem.tags;
        problem.Tags = standardProblem.tags;
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
function selectProblemsForTag(tag, count, config) {
  const { difficultyAllowance, ladders, allProblems, allTagsInCurrentTier, usedProblemIds } = config;
  logger.info(`🎯 Selecting ${count} problems for tag: ${tag}`);

  const ladder = ladders?.[tag]?.problems || [];
  const allTagsInCurrentTierSet = new Set(allTagsInCurrentTier);
  
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
    .sort((a, b) => {
      // Sort by difficulty score (easier first) and then by allowance weight
      if (a.difficultyScore !== b.difficultyScore) {
        return a.difficultyScore - b.difficultyScore;
      }
      return b.allowanceWeight - a.allowanceWeight;
    });

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
    const problemIndex = problemStore.index("by_problem");

    const userProblem = await new Promise((resolve, reject) => {
      const request = problemIndex.get(leetCodeID);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    // Get official difficulty from standard_problems
    const standardProblem = await fetchProblemById(leetCodeID);

    if (!standardProblem) {
      logger.warn(
        `⚠️ No standard problem found for LeetCode ID: ${leetCodeID}`
      );
      return userProblem; // Return user problem without official difficulty
    }

    // Merge data: user problem data + official difficulty
    const mergedProblem = {
      ...userProblem,
      officialDifficulty: standardProblem.difficulty,
      tags: standardProblem.tags,
      title: standardProblem.title || userProblem?.title,
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
  problemId,
  options = {}
) {
  const {
    timeout = indexedDBRetry.quickTimeout,
    operationName = "checkDatabaseForProblem",
    priority = "normal",
    abortController = null,
  } = options;

  return indexedDBRetry.executeWithRetry(
    async () => {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(["problems"], "readonly");
        const store = transaction.objectStore("problems");
        const request = store.get(problemId); // Use primary key (leetcode_id) directly

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
      deduplicationKey: `check_problem_${problemId}`,
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

          // Get standard problem data
          const standardProblem = await fetchProblemById(
            problemData.leetcode_id
          );

          // Get current session from Chrome storage (this is external to transaction)
          let session = await new Promise((resolve) => {
            chrome.storage.local.get(["currentSession"], (result) => {
              resolve(result.currentSession || null);
            });
          });

          if (!session) {
            throw new Error("No active session found");
          }

          // Create the problem entry
          const problemEntry = {
            leetcode_id: problemData.leetcode_id,
            title: problemData.title,
            tags: standardProblem?.tags || [],
            difficulty: standardProblem?.difficulty || "Medium",
            box_level: 1,
            review_schedule: new Date().toISOString(),
            session_id: session.id,
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
 * @returns {Promise<Array>} Box level counts
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

      // Count problems by box level
      const boxCounts = [0, 0, 0, 0, 0]; // Boxes 0-4
      problems.forEach((problem) => {
        const box = Math.min(problem.box || 1, 4); // Cap at box 4
        boxCounts[box]++;
      });

      return boxCounts;
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
