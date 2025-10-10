// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../db/index.js";
import { v4 as uuidv4 } from "uuid";

const openDB = dbHelper.openDB;

/**
 * Helper function to check if a problem's difficulty is allowed
 * @param {string} difficulty - Problem's difficulty (Easy, Medium, Hard)
 * @param {string} maxDifficulty - Max allowed difficulty level
 * @returns {boolean}
 */
export function isDifficultyAllowed(difficulty, maxDifficulty) {
  const difficultyLevels = ["Easy", "Medium", "Hard"];
  return (
    difficultyLevels.indexOf(difficulty) <=
    difficultyLevels.indexOf(maxDifficulty)
  );
}

/**
 * Deduplicates an array of problems based on their ID
 * @param {Array} problems - Array of problem objects
 * @returns {Array} - Deduplicated problems
 */
export function deduplicateById(problems) {
  const seen = new Set();
  return problems.filter((problem) => {
    if (seen.has(problem.id)) return false;
    seen.add(problem.id);
    return true;
  });
}

/**
 * Calculates a problem's decay score based on time since last attempt and success rate
 * @param {Date} lastAttemptDate - Date of last attempt
 * @param {number} successRate - Ratio of successful attempts to total attempts
 * @returns {number} - Decay score
 */
export function calculateDecayScore(lastAttemptDate, successRate, stability) {
  const today = new Date();
  const lastAttempt = new Date(lastAttemptDate);
  const daysSinceLastAttempt = (today - lastAttempt) / (1000 * 60 * 60 * 24);
  const retrievability = Math.exp(-daysSinceLastAttempt / stability);
  return (1 - successRate) * (daysSinceLastAttempt / (1 + retrievability));
}

export function createAttemptRecord(attemptData) {
  // Support both uppercase (legacy) and lowercase property names
  const rawDate = attemptData.attempt_date || attemptData.AttemptDate;
  // CRITICAL: Ensure attempt_date is ALWAYS a Date object for IndexedDB compound index compatibility
  // The compound index [problem_id, attempt_date] requires Date objects, not strings
  const attemptDate = rawDate instanceof Date ? rawDate : new Date(rawDate);

  const baseRecord = {
    id: attemptData.id || uuidv4(), // Generate UUID if not provided
    session_id: attemptData.session_id,
    problem_id: attemptData.problem_id !== undefined ? attemptData.problem_id : attemptData.ProblemID,
    success: attemptData.success !== undefined ? attemptData.success : attemptData.Success,
    attempt_date: attemptDate,  // Must be Date object for compound index [problem_id, attempt_date]
    time_spent: Number(attemptData.time_spent || attemptData.TimeSpent || 0),
    comments: attemptData.comments || attemptData.Comments || "",
  };

  // Add optional fields only if they have values
  if (attemptData.leetcode_id !== undefined) {
    baseRecord.leetcode_id = attemptData.leetcode_id;
  }

  if (attemptData.perceived_difficulty !== undefined && attemptData.perceived_difficulty !== 0) {
    baseRecord.perceived_difficulty = Number(attemptData.perceived_difficulty);
  }

  if (attemptData.hints_used !== undefined) {
    baseRecord.hints_used = attemptData.hints_used;
  }

  if (attemptData.source !== undefined) {
    baseRecord.source = attemptData.source;
  }

  // Add difficulty field if present (legacy support)
  if (attemptData.Difficulty !== undefined || attemptData.difficulty !== undefined) {
    baseRecord.difficulty = Number(attemptData.difficulty || attemptData.Difficulty);
  }

  // Add interview signals if present
  if (attemptData.interviewSignals) {
    baseRecord.interviewSignals = {
      transferAccuracy: attemptData.interviewSignals.transferAccuracy,
      speedDelta: attemptData.interviewSignals.speedDelta,
      hintPressure: attemptData.interviewSignals.hintPressure,
      timeToFirstPlanMs: attemptData.interviewSignals.timeToFirstPlanMs,
      timeToFirstKeystroke: attemptData.interviewSignals.timeToFirstKeystroke,
      hintsUsed: attemptData.interviewSignals.hintsUsed,
      hintsRequestedTimes: attemptData.interviewSignals.hintsRequestedTimes || [],
      approachChosen: attemptData.interviewSignals.approachChosen,
      stallReasons: attemptData.interviewSignals.stallReasons || []
    };
  }

  return baseRecord;
}

/**
 * Clear or rename fields from all records in an IndexedDB store.
 *
 * @param {string} storeName - The name of the object store (e.g. "tag_mastery")
 * @param {Object} options
 * @param {string[]} [options.remove] - Fields to remove entirely
 * @param {Object} [options.rename] - Keys are old names, values are new names
 */
export async function clearOrRenameStoreField(
  storeName,
  { remove = [], rename = {} } = {}
) {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], "readwrite");
    const store = tx.objectStore(storeName);

    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result;

      for (const record of records) {
        const updated = { ...record };

        // Remove fields
        for (const field of remove) {
          delete updated[field];
        }

        // Rename fields
        for (const oldKey in rename) {
          if (oldKey in updated) {
            updated[rename[oldKey]] = updated[oldKey];
            delete updated[oldKey];
          }
        }

        // Put updated record back
        store.put(updated);
      }

      tx.oncomplete = () => {
        // Updated all records in storeName
        resolve();
      };
      tx.onerror = () => {
        // Failed updating storeName
        reject(tx.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
}

export function getDifficultyAllowanceForTag(data = null) {
  // Default natural distribution if no tag-specific data available
  const defaultDistribution = { Easy: 0.6, Medium: 0.3, Hard: 0.1 };

  // If no mastery data, use natural distribution with slight easy bias for safety
  if (!data || typeof data.totalAttempts !== "number") {
    return { Easy: 0.7, Medium: 0.25, Hard: 0.05 };
  }

  // Use real-world difficulty distribution from tag data if available
  const naturalDistribution = data.difficulty_distribution || defaultDistribution;
  const totalProblems = (naturalDistribution.easy || 0) + (naturalDistribution.medium || 0) + (naturalDistribution.hard || 0);

  let baseAllowance;
  if (totalProblems > 0) {
    // Use actual proportions from real problem distribution
    baseAllowance = {
      Easy: (naturalDistribution.easy || 0) / totalProblems,
      Medium: (naturalDistribution.medium || 0) / totalProblems,
      Hard: (naturalDistribution.hard || 0) / totalProblems
    };
  } else {
    // Fallback to default distribution
    baseAllowance = defaultDistribution;
  }

  const successRate = data.successfulAttempts / data.totalAttempts;
  const attempts = data.totalAttempts;

  // Apply readiness multipliers based on user performance
  const allowance = { ...baseAllowance };

  // Reduce harder difficulties based on readiness, but don't eliminate them entirely
  // This preserves natural distribution while respecting user skill level

  // Medium problems: reduce if user isn't ready
  if (successRate < 0.7 || attempts < 3) {
    allowance.Medium *= 0.3; // Reduce but don't eliminate
  } else if (successRate >= 0.85 && attempts >= 5) {
    allowance.Medium *= 1.2; // Slight boost for high performers
  }

  // Hard problems: more conservative scaling
  if (successRate < 0.8 || attempts < 5) {
    allowance.Hard *= 0.1; // Significantly reduce but don't eliminate
  } else if (successRate >= 0.9 && attempts >= 8) {
    allowance.Hard *= 1.0; // Keep natural proportion for experts
  }

  // Normalize to ensure weights don't exceed 1.0
  const total = allowance.Easy + allowance.Medium + allowance.Hard;
  if (total > 0) {
    allowance.Easy /= total;
    allowance.Medium /= total;
    allowance.Hard /= total;
  }

  return allowance;
}

/**
 * Calculate success rate with safe division handling
 * @param {number} successfulAttempts - Number of successful attempts
 * @param {number} totalAttempts - Total number of attempts
 * @returns {number} Success rate between 0 and 1, or 0 if no attempts
 */
export function calculateSuccessRate(successfulAttempts, totalAttempts) {
  if (!totalAttempts || totalAttempts === 0) {
    return 0;
  }
  return successfulAttempts / totalAttempts;
}

/**
 * Calculate progress percentage with rounding
 * @param {number} successfulAttempts - Number of successful attempts
 * @param {number} totalAttempts - Total number of attempts
 * @returns {number} Progress percentage (0-100), or 0 if no attempts
 */
export function calculateProgressPercentage(successfulAttempts, totalAttempts) {
  const successRate = calculateSuccessRate(successfulAttempts, totalAttempts);
  return Math.round(successRate * 100);
}

/**
 * Calculate failed attempts count
 * @param {number} successfulAttempts - Number of successful attempts
 * @param {number} totalAttempts - Total number of attempts
 * @returns {number} Number of failed attempts
 */
export function calculateFailedAttempts(successfulAttempts, totalAttempts) {
  if (!totalAttempts || totalAttempts === 0) {
    return 0;
  }
  return totalAttempts - successfulAttempts;
}

/**
 * Calculate failure rate with safe division handling
 * @param {number} successfulAttempts - Number of successful attempts
 * @param {number} totalAttempts - Total number of attempts
 * @returns {number} Failure rate between 0 and 1, or 0 if no attempts
 */
export function calculateFailureRate(successfulAttempts, totalAttempts) {
  const successRate = calculateSuccessRate(successfulAttempts, totalAttempts);
  return 1 - successRate;
}

/**
 * Calculate comprehensive progress statistics
 * @param {number} successfulAttempts - Number of successful attempts
 * @param {number} totalAttempts - Total number of attempts
 * @returns {Object} Object containing all progress statistics
 */
export function calculateProgressStats(successfulAttempts, totalAttempts) {
  const successRate = calculateSuccessRate(successfulAttempts, totalAttempts);
  const failedAttempts = calculateFailedAttempts(successfulAttempts, totalAttempts);
  
  return {
    successfulAttempts,
    totalAttempts,
    failedAttempts,
    successRate,
    failureRate: 1 - successRate,
    progressPercentage: Math.round(successRate * 100)
  };
}

/**
 * Round value to specified number of decimal places
 * @param {number} value - Value to round
 * @param {number} decimals - Number of decimal places (default 2)
 * @returns {number} Rounded value
 */
export function roundToPrecision(value, decimals = 2) {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}
