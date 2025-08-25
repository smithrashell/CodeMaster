import { dbHelper } from "../db/index.js";
import SessionLimits from "./sessionLimits.js";
// import { v4 as uuidv4 } from "uuid"; // Commented out - uncomment when needed

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
  return {
    id: attemptData.id,
    SessionID: attemptData.SessionID,
    ProblemID: attemptData.ProblemID,
    Success: attemptData.Success,
    AttemptDate: attemptData.AttemptDate,
    TimeSpent: Number(attemptData.TimeSpent),
    Difficulty: attemptData.Difficulty,
    Comments: attemptData.Comments || "",
  };
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

    request.onsuccess = async () => {
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
        console.log(`✅ Updated all records in ${storeName}`);
        resolve();
      };
      tx.onerror = () => {
        console.error(`❌ Failed updating ${storeName}:`, tx.error);
        reject(tx.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
}

export function getDifficultyAllowanceForTag(data = null) {
  // 🚨 Onboarding fallback - allow Easy and Medium for new users
  if (
    !data ||
    typeof data.totalAttempts !== "number" ||
    data.totalAttempts < SessionLimits.getMinAttemptsForExperienced()
  ) {
    return { Easy: 1.0, Medium: 0.8, Hard: 0 };
  }

  const successRate = data.successfulAttempts / data.totalAttempts;
  const attempts = data.totalAttempts;

  // Progressive difficulty scaling based on success rate and experience
  const allowance = {
    Easy: 1.0, // Always allow Easy problems
    Medium: 0,
    Hard: 0,
  };

  // Medium difficulty allowance with progressive scaling
  if (successRate >= 0.85 && attempts >= 5) {
    allowance.Medium = 1.0; // Full confidence
  } else if (successRate >= 0.75 && attempts >= 3) {
    allowance.Medium = 0.8; // Good confidence
  } else if (successRate >= 0.65 && attempts >= 2) {
    allowance.Medium = 0.6; // Moderate confidence
  } else if (successRate >= 0.5 && attempts >= 1) {
    allowance.Medium = 0.4; // Low confidence
  }

  // Hard difficulty allowance with stricter requirements
  if (successRate >= 0.9 && attempts >= 8) {
    allowance.Hard = 0.8; // High confidence for hard problems
  } else if (successRate >= 0.85 && attempts >= 6) {
    allowance.Hard = 0.6; // Moderate confidence
  } else if (successRate >= 0.8 && attempts >= 4) {
    allowance.Hard = 0.4; // Low confidence
  }

  console.log(
    `🎯 Difficulty allowance for tag (${attempts} attempts, ${(
      successRate * 100
    ).toFixed(1)}% success):`,
    allowance
  );

  return allowance;
}
