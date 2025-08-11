import { dbHelper } from "./index.js";
import { isDifficultyAllowed, deduplicateById } from "../utils/Utils.js";
import { AttemptsService } from "../services/attemptsService.js";

import { getAllStandardProblems } from "./standard_problems.js";
import { fetchProblemById } from "./standard_problems.js";
import { TagService } from "../services/tagServices.js";
// Remove early binding - use TagService.getCurrentLearningState() directly
import { v4 as uuidv4 } from "uuid";
import { getAllowedDifficulties } from "../utils/Utils.js";
import { getDifficultyAllowanceForTag } from "../utils/Utils.js";
import { getPatternLadders } from "../utils/dbUtils/patternLadderUtils.js";
import { getTagRelationships } from "./tag_relationships.js";
const openDB = dbHelper.openDB;

// Import retry service for enhanced database operations
import indexedDBRetry from "../services/IndexedDBRetryService.js";

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
//           console.log(
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
//       console.warn("No additional NextProblems meet the criteria.");
//       break;
//     }
//   }

//   // Fetch validated NextProblems from standard_problems store
//   const nextProblems = await fetchProblemsByIdsWithTransaction(
//     db,
//     validatedNextProblemIds.slice(0, limit)
//   );

//   console.log(
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
export async function getProblemByDescription(description, slug) {
  console.log("📌 getProblemByDescription called with:", description);

  if (!description) {
    console.error("❌ Error: No description provided.");
    return null;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["problems"], "readonly");
    const store = transaction.objectStore("problems");

    if (!store.indexNames.contains("by_ProblemDescription")) {
      console.error("❌ Error: Index 'by_ProblemDescription' does not exist.");
      reject("Index missing: by_ProblemDescription");
      return;
    }

    console.log("📌 Using index 'by_ProblemDescription' to fetch problem...");
    const index = store.index("by_ProblemDescription");

    // Ensure the description is stored in lowercase
    const request = index.get(description.toLowerCase());

    request.onsuccess = (event) => {
      const result = event.target.result;
      if (result) {
        console.log("✅ Problem found:", result);
        resolve(result);
      } else {
        console.warn("⚠️ Problem not found for description:", description);
        resolve(false);
      }
    };

    request.onerror = (event) => {
      console.error("❌ Error fetching problem:", event.target.error);
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
    const standardProblem = await fetchProblemById(problemData.leetCodeID);

    let session = await new Promise((resolve) => {
      chrome.storage.local.get(["currentSession"], (result) => {
        resolve(result.currentSession || null);
      });
    });

    if (!session) {
      session = await getOrCreateSession();
      await saveSessionToStorage(session);
    }

    const transaction = db.transaction(["problems"], "readwrite");
    const store = transaction.objectStore("problems");

    const problemId = uuidv4();
    const attemptId = uuidv4();

    const leetCodeID = problemData.leetCodeID
      ? Number(problemData.leetCodeID)
      : null;
    const address = problemData.address;
    const problem = {
      id: problemId,
      ProblemDescription: problemData.title.toLowerCase(),
      ProblemNumberAssoc: [],
      leetCodeID: leetCodeID,
      LeetCodeAddress: address,
      CooldownStatus: false,
      BoxLevel: 1,
      ReviewSchedule: problemData.reviewSchedule,
      perceivedDifficulty: problemData.difficulty || 5, // User's perceived difficulty (0-10 scale, default 5)
      ConsecutiveFailures: 0,
      Stability: 1.0,
      AttemptStats: {
        TotalAttempts: 0,
        SuccessfulAttempts: 0,
        UnsuccessfulAttempts: 0,
      },

      Tags: problemData.tags || [],
    };
    console.log("Adding problem:", problem);
    const request = store.add(problem);
    transaction.oncomplete = async function () {
      console.log("Problem added successfully:", problem);

      const attemptData = {
        id: attemptId,
        ProblemID: problemId,
        Success: problemData.success,
        AttemptDate: problemData.date,
        TimeSpent: Number(problemData.timeSpent), // Now expecting seconds from forms
        perceivedDifficulty: problemData.difficulty || 5, // User's perceived difficulty assessment
        Comments: problemData.comments || "",
        BoxLevel: 1,
        NextReviewDate: null,
        SessionID: session.id,

        // Enhanced time tracking fields
        ExceededRecommendedTime: problemData.exceededRecommendedTime || false,
        OverageTime: Number(problemData.overageTime) || 0,
        UserIntent: problemData.userIntent || "completed",
        TimeWarningLevel: Number(problemData.timeWarningLevel) || 0,
      };

      try {
        if (!AttemptsService || !AttemptsService.addAttempt) {
          throw new Error(
            "❌ attemptsService is undefined or missing addAttempt method."
          );
        }

        await AttemptsService.addAttempt(attemptData, problem);
        console.log("✅ Attempt and problem added successfully.");
      } catch (error) {
        console.error("❌ Error adding attempt:", error);
      }
    };

    request.onerror = function (event) {
      console.error("Error adding problem:", event.target.error);
    };
  } catch (error) {
    console.error("Error in addProblem function:", error);
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
    const index = store.index("by_problem");
    console.log("🔍 problemId:", problemId);
    const request = index.get(problemId);

    // return true if problem is found, false otherwise
    request.onsuccess = () => {
      console.log("✅ Problem found in database:", request.result);
      resolve(request.result);
    };
    request.onerror = () => {
      console.error("❌ Error checking database for problem:", request.error);

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

  return new Promise((resolve, reject) => {
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
      console.error(
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
  userFocusAreas = []
) {
  try {
    const { masteryData, focusTags, allTagsInCurrentTier } =
      await TagService.getCurrentLearningState();
    const allProblems = await getAllStandardProblems();
    const ladders = await getPatternLadders();

    console.log("🧠 Starting intelligent problem selection...");
    console.log("🧠 Focus Tags:", focusTags);
    console.log("🧠 User Focus Areas:", userFocusAreas);
    console.log("🧠 Needed problems:", numNewProblems);

    // Create enhanced focus tags that prioritize user selections
    const enhancedFocusTags = [...focusTags];
    if (userFocusAreas.length > 0) {
      // Boost user-selected tags by moving them to the front
      const userSelectedTags = userFocusAreas.filter(tag => 
        allTagsInCurrentTier.includes(tag)
      );
      if (userSelectedTags.length > 0) {
        // Remove user selected tags from their current positions
        const systemTags = focusTags.filter(tag => 
          !userSelectedTags.includes(tag)
        );
        // Put user selected tags first with system tags following
        enhancedFocusTags.splice(0, enhancedFocusTags.length, 
          ...userSelectedTags, ...systemTags);
        console.log("🎯 Enhanced focus tags (user priority):", enhancedFocusTags);
      }
    }

    // Get tag relationships for expansion
    const tagRelationships = await getTagRelationships();

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

    console.log(
      `🎯 Primary focus: ${primaryTag} (${primaryFocusCount} problems)`
    );
    const primaryProblems = await selectProblemsForTag(
      primaryTag,
      primaryFocusCount,
      tagDifficultyAllowances[primaryTag],
      ladders,
      allProblems,
      allTagsInCurrentTier,
      usedProblemIds
    );

    selectedProblems.push(...primaryProblems);
    primaryProblems.forEach((p) => usedProblemIds.add(p.id));

    // Step 2: Focus tag expansion (40% of problems) - Use next focus tag
    const expansionCount = numNewProblems - selectedProblems.length;
    if (expansionCount > 0 && enhancedFocusTags.length > 1) {
      const expansionTag = enhancedFocusTags[1]; // Use next highest priority tag for expansion
      console.log(
        `🔗 Expanding to next focus tag: ${expansionTag} (${expansionCount} problems)`
      );

      const tagMastery = masteryData.find((m) => m.tag === expansionTag) || {
        tag: expansionTag,
        totalAttempts: 0,
        successfulAttempts: 0,
        mastered: false,
      };
      const allowance = getDifficultyAllowanceForTag(tagMastery);

      const expansionProblems = await selectProblemsForTag(
        expansionTag,
        expansionCount,
        allowance,
        ladders,
        allProblems,
        allTagsInCurrentTier,
        usedProblemIds
      );

      selectedProblems.push(...expansionProblems);
      expansionProblems.forEach((p) => usedProblemIds.add(p.id));

      console.log(
        `🔗 Added ${expansionProblems.length} problems from expansion tag: ${expansionTag}`
      );
    }

    console.log(`🎯 Selected ${selectedProblems.length} problems for learning`);
    return selectedProblems;
  } catch (error) {
    console.error("❌ Error in fetchAdditionalProblems():", error);
    return [];
  }
}

async function getProblemSequenceScore(
  problemId,
  unmasteredTagSet,
  tierTagSet
) {
  const db = await openDB();
  const tx = db.transaction("problem_relationships", "readonly");
  const store = tx.objectStore("problem_relationships");

  return new Promise((resolve, reject) => {
    const request = store.index("by_problemId1").getAll(problemId);
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
        console.log(
          `🎯 Final sequenceScore for Problem ${problemId}:`,
          weightedAvgStrength
        );
        resolve(weightedAvgStrength);
      } else {
        console.warn(`⚠️ No relationships found for problem ${problemId}`);
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
//     console.log(`📝 Updated attemptedProblems:`, attemptedProblems);
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

//         console.log(`✅ NextProblem Selected: ${nextProblemId}`);
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
//       console.warn(
//         "⚠️ No additional NextProblems meet the criteria. Retrying..."
//       );
//     }
//   }

//   // ✅ Exit early if no problems found after retries
//   if (validatedNextProblemIds.length === 0) {
//     console.error(
//       "❌ Could not find additional NextProblems after retries. Exiting."
//     );
//     return [];
//   }

//   // ✅ Fetch validated NextProblems from `standard_problems`
//   const nextProblems = await fetchProblemsByIdsWithTransaction(
//     db,
//     validatedNextProblemIds.slice(0, countNeeded)
//   );

//   console.log(
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

        console.log("🔍 Attempts:", attempts);

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
        console.log("✅ Stability added/updated for all problems.");
        resolve();
      };

      transaction.onerror = (err) => {
        console.error("❌ Transaction failed:", err);
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
    console.log("🔍 difficultyMap:", difficultyMap);
    const transaction = db.transaction(["problems"], "readwrite");
    const problemStore = transaction.objectStore("problems");

    const request = problemStore.getAll();

    request.onsuccess = async (event) => {
      const problems = event.target.result;

      for (let problem of problems) {
        const difficulty = difficultyMap[problem.leetCodeID];
        console.log("🔍 difficulty:", difficulty);
        console.log("🔍 problem:", problem.leetCodeID);
        if (difficulty) {
          problem.Rating = difficulty;
          problemStore.put(problem);
        }
      }
    };

    transaction.oncomplete = () => {
      console.log("✅ All problems updated with ratings.");
    };

    transaction.onerror = (event) => {
      console.error("❌ Transaction error:", event.target.error);
    };
  } catch (error) {
    console.error("❌ Error updating problems with ratings:", error);
  }
}

export async function updateProblemWithTags() {
  const db = await openDB();
  const standardProblems = await getAllStandardProblems();
  const problemStore = db
    .transaction(["problems"], "readwrite")
    .objectStore("problems");
  const request = problemStore.getAll();

  request.onsuccess = async (event) => {
    const problems = event.target.result;

    for (let problem of problems) {
      const standardProblem = standardProblems.find(
        (p) => p.id === problem.leetCodeID
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
 * @param {object} difficultyAllowance - Difficulty allowance for the tag
 * @param {object} ladders - Pattern ladders
 * @param {array} allProblems - All standard problems
 * @param {array} allTagsInCurrentTier - Tags in current tier
 * @param {Set} usedProblemIds - Already used problem IDs
 * @returns {Promise<Array>} Selected problems
 */
async function selectProblemsForTag(
  tag,
  count,
  difficultyAllowance,
  ladders,
  allProblems,
  allTagsInCurrentTier,
  usedProblemIds
) {
  console.log(`🎯 Selecting ${count} problems for tag: ${tag}`);

  const ladder = ladders?.[tag]?.problems || [];
  const allTagsInCurrentTierSet = new Set(allTagsInCurrentTier);

  // Filter eligible problems with progressive difficulty preference
  const eligibleProblems = ladder
    .filter((problem) => {
      const id = problem.leetCodeID ?? problem.id;
      const rating = problem.rating || "Medium";
      const tags = normalizeTags(problem.tags || []);

      // Basic filters
      if (usedProblemIds.has(id)) return false;
      if (difficultyAllowance[rating] <= 0) return false;
      if (!tags.includes(tag)) return false;

      // Tier constraint - all tags must be in current tier
      const tierValid = tags.every((t) => allTagsInCurrentTierSet.has(t));
      if (!tierValid) return false;

      return true;
    })
    .map((problem) => ({
      ...problem,
      difficultyScore: getDifficultyScore(problem.rating || "Medium"),
      allowanceWeight: difficultyAllowance[problem.rating || "Medium"],
    }))
    .sort((a, b) => {
      // Sort by difficulty score (easier first) and then by allowance weight
      if (a.difficultyScore !== b.difficultyScore) {
        return a.difficultyScore - b.difficultyScore;
      }
      return b.allowanceWeight - a.allowanceWeight;
    });

  console.log(
    `🎯 Found ${eligibleProblems.length} eligible problems for ${tag}`
  );

  // Select problems with progressive difficulty
  const selectedProblems = [];
  let selectedCount = 0;

  for (const problem of eligibleProblems) {
    if (selectedCount >= count) break;

    const standardProblem = allProblems.find(
      (p) => p.id === problem.leetCodeID
    );
    if (standardProblem) {
      selectedProblems.push(standardProblem);
      selectedCount++;
    }
  }

  console.log(`🎯 Selected ${selectedProblems.length} problems for ${tag}`);
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
      console.warn(
        `⚠️ No standard problem found for LeetCode ID: ${leetCodeID}`
      );
      return userProblem; // Return user problem without official difficulty
    }

    // Merge data: user problem data + official difficulty
    const mergedProblem = {
      ...userProblem,
      officialDifficulty: standardProblem.difficulty,
      tags: standardProblem.tags,
      title: standardProblem.title || userProblem?.ProblemDescription,
    };

    return mergedProblem;
  } catch (error) {
    console.error(
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
export async function getProblemWithRetry(problemId, options = {}) {
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
export async function checkDatabaseForProblemWithRetry(
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
        const index = store.index("by_problem");
        const request = index.get(problemId);

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
export async function addProblemWithRetry(problemData, options = {}) {
  const {
    timeout = indexedDBRetry.defaultTimeout,
    operationName = "addProblem",
    priority = "normal",
    abortController = null,
  } = options;

  return indexedDBRetry.executeWithRetry(
    async () => {
      // This is a complex operation, so we'll use the enhanced dbHelper transaction method
      return dbHelper.executeTransaction(
        ["problems", "standard_problems"], // Multiple stores needed
        "readwrite",
        async (tx, stores) => {
          const [problemStore] = stores;

          // Get standard problem data
          const standardProblem = await fetchProblemById(
            problemData.leetCodeID
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
            leetCodeID: problemData.leetCodeID,
            ProblemDescription: problemData.ProblemDescription,
            problem: problemData.leetCodeID,
            review: new Date().toISOString(),
            tags: standardProblem?.tags || [],
            difficulty: standardProblem?.difficulty || "Medium",
            box: 1, // Start in first Leitner box
            nextProblem: problemData.nextProblem || null,
            sessionId: session.id,
          };

          // Add problem to database
          return new Promise((resolve, reject) => {
            const request = problemStore.put(problemEntry);
            request.onsuccess = () =>
              resolve({
                success: true,
                problemId: problemEntry.leetCodeID,
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
export async function saveUpdatedProblemWithRetry(problem, options = {}) {
  const {
    timeout = indexedDBRetry.defaultTimeout,
    operationName = "saveUpdatedProblem",
    priority = "normal",
    abortController = null,
  } = options;

  return indexedDBRetry.executeWithRetry(
    async () => {
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
export async function countProblemsByBoxLevelWithRetry(options = {}) {
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
export async function fetchAllProblemsWithRetry(options = {}) {
  const {
    timeout = indexedDBRetry.bulkTimeout,
    operationName = "fetchAllProblems",
    priority = "low",
    abortController = null,
    streaming = false,
    onProgress = null,
  } = options;

  return indexedDBRetry.executeWithRetry(
    async () => {
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
export async function getProblemWithOfficialDifficultyWithRetry(
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
    async () => {
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
