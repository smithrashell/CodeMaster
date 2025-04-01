import { dbHelper } from "./index.js";
import { isDifficultyAllowed, deduplicateById } from "../utils/Utils.js";
import { AttemptsService } from "../services/attemptsService.js";
import { TagService } from "../services/tagServices.js";
import { determineNextProblem } from "./problem_relationships.js";
import { findBestNextProblem } from "./problem_relationships.js";
import { getAllStandardProblems } from "./standard_problems.js";
import { fetchProblemById } from "./standard_problems.js";
const getCurrentLearningState = TagService.getCurrentLearningState;
import { v4 as uuidv4 } from "uuid";
const openDB = dbHelper.openDB;

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
      Difficulty: problemData.difficulty || 0,
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
        TimeSpent: Number(problemData.timeSpent),
        Difficulty: problemData.difficulty || 0,
        Comments: problemData.comments || "",
        BoxLevel: 1,
        NextReviewDate: null,
        SessionID: session.id,
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

export async function fetchAdditionalProblems(numNewProblems, excludeIds) {
  try {
    const { sessionPerformance, masteryData, unmasteredTags, tagsinTier } =
      await getCurrentLearningState();

    let allProblems = await getAllStandardProblems();
    const unmasteredTagSet = new Set(unmasteredTags);
    const tierTagSet = new Set(tagsinTier);
    const tagMasteryMap = {};
    masteryData.forEach((tagObj) => {
      tagMasteryMap[tagObj.tag] = {
        attempts: tagObj.totalAttempts,
        correct: tagObj.successfulAttempts,
      };
    });

    console.log("🔍 tagMasteryMap:", tagMasteryMap);
    console.log("🔍 unmasteredTagSet:", unmasteredTagSet);
    console.log("🔍 tierTagSet:", tierTagSet);

    console.log("🔍 masteryData:", masteryData);

    console.log(`🔍 Exclude List Size: ${excludeIds.size}`);

    // 1️⃣ Dynamic Difficulty Adjustment
    let difficultyWeights = {
      Easy: 1,
      Medium: 0,
      Hard: 0,
    };

    if (
      sessionPerformance.Easy.correct / sessionPerformance.Easy.attempts >
      0.85
    ) {
      difficultyWeights.Medium = 1;
    }
    if (
      sessionPerformance.Medium.correct / sessionPerformance.Medium.attempts >
      0.75
    ) {
      difficultyWeights.Hard = 0.5;
    }

    const allowedDifficulties = Object.keys(difficultyWeights).filter(
      (d) => difficultyWeights[d] > 0
    );

    // 2️⃣ Filter out seen problems & allowed difficulties
    let candidateProblems = allProblems.filter(
      (problem) =>
        !excludeIds.has(problem.id) &&
        allowedDifficulties.includes(problem.difficulty)
    );

    console.log(
      `✅ Candidate Problems Before Tag Filtering: ${candidateProblems.length}`
    );

    // 3️⃣ Tag mastery scoring
    candidateProblems.forEach((problem) => {
      problem.tagMatchScore = (problem.tags || []).reduce((score, tag) => {
        let tagScore = 0;

        if (unmasteredTagSet.has(tag)) {
          tagScore += 3; // Current focus
        } else if (tierTagSet.has(tag)) {
          tagScore += 1; // Tier tag
        }

        const tagStats = tagMasteryMap[tag];
        const accuracy = tagStats
          ? tagStats.attempts > 0
            ? tagStats.correct / tagStats.attempts
            : 0
          : 0;
        if (accuracy > 0.75) tagScore += 1; // Mastered tags bonus

        // 🛑 Penalize tags outside tier/focus:
        if (!tierTagSet.has(tag) && !unmasteredTagSet.has(tag)) {
          tagScore -= 1;
        }

        return score + tagScore;
      }, 0);
    });

    console.log(
      "🔍 candidateProblems:",
      candidateProblems.sort((a, b) => b.tagMatchScore - a.tagMatchScore)
    );

    // Filter out problems with weak tag match
    candidateProblems = candidateProblems.filter((p) => p.tagMatchScore >= 2);

    console.log(
      `✅ Candidate Problems After Tag Filtering (Min Match Score 2): ${candidateProblems.length}`
    );

    if (candidateProblems.length === 0) {
      console.warn("⚠️ No new problems found matching tags.");
      return [];
    }

    // 4️⃣ Get sequence scores dynamically
    for (let problem of candidateProblems) {
      problem.sequenceScore = await getProblemSequenceScore(
        problem.id,
        unmasteredTagSet,
        tierTagSet
      );
    }
    // ✅ Normalize sequence scores to 0-100 range
    let sequenceScores = candidateProblems.map((p) => p.sequenceScore || 0);
    let maxSequenceScore = Math.max(...sequenceScores, 1);
    let minSequenceScore = Math.min(...sequenceScores, 0);
    let scoreRange = maxSequenceScore - minSequenceScore || 1;

    candidateProblems.forEach((problem) => {
      problem.sequenceScore =
        ((problem.sequenceScore - minSequenceScore) / scoreRange) * 100;
    });

    // 🏆 Strict Chained Sort:
    // First by tagMatchScore DESCENDING
    // Then by sequenceScore DESCENDING
    candidateProblems.sort((a, b) => {
      if (b.tagMatchScore !== a.tagMatchScore) {
        return b.tagMatchScore - a.tagMatchScore;
      }
      return b.sequenceScore - a.sequenceScore;
    });

    console.log("🏆 Sorted Candidates:", candidateProblems);

    // 6️⃣ Weighted Sampling by difficulty
    function weightedSample(candidates, weights, totalNeeded) {
      const pools = { Easy: [], Medium: [], Hard: [] };
      candidates.forEach((p) => pools[p.difficulty].push(p));

      const result = [];
      const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

      for (let diff of Object.keys(pools)) {
        const count = Math.floor(totalNeeded * (weights[diff] / totalWeight));
        result.push(...pools[diff].slice(0, count));
      }

      // If still need more, fill from any left
      while (result.length < totalNeeded) {
        const extra = candidates.find(
          (p) =>
            !result.includes(p) && allowedDifficulties.includes(p.difficulty)
        );
        if (!extra) break;
        result.push(extra);
      }

      return result;
    }

    const finalProblems = weightedSample(
      candidateProblems,
      difficultyWeights,
      numNewProblems
    );

    console.log("🎯 Final Selected Problems:", finalProblems);

    return finalProblems;
  } catch (error) {
    console.error("❌ Error fetching additional problems:", error);
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

function getAllowedDifficulties(classification) {
  if (classification === "Core Concept") return ["Easy"];
  if (classification === "Fundamental Technique") return ["Easy", "Medium"];
  if (classification === "Advanced Technique")
    return ["Easy", "Medium", "Hard"];
  return ["Easy", "Medium", "Hard"]; // If everything is mastered, allow all difficulties
}

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
