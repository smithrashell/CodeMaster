/**
 * Recalibration Service - Phase 1: Passive Background Decay
 *
 * Handles intelligent recalibration for users returning after long breaks.
 * Applies time-based decay to prevent "fail-fest" experience.
 *
 * Key Features:
 * - Conservative time-based decay for box levels and stability
 * - Forgetting curve based on cognitive science (90-day half-life)
 * - No user interaction required (runs silently on startup)
 * - Marks problems needing recalibration for future phases
 */

import { StorageService } from "./storageService.js";
import { dbHelper } from "../db/index.js";

/**
 * Calculate days since a given date
 * @param {string} dateString - ISO date string
 * @returns {number} Days elapsed
 */
function getDaysSince(dateString) {
  if (!dateString) return 0;

  try {
    const pastDate = new Date(dateString);
    const now = new Date();
    const diffMs = now - pastDate;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch (error) {
    console.error("Error calculating days since:", error);
    return 0;
  }
}

/**
 * Apply passive background decay to problems based on time elapsed
 *
 * Decay Strategy:
 * - Box Level Decay: 1 box per 60 days (2 months) - conservative
 * - Stability Decay: Exponential forgetting curve with 90-day half-life
 * - Minimum Values: Box level never goes below 1, stability never below 0.5
 * - Recalibration Flag: Set for problems unused for 90+ days
 *
 * @param {number} daysSinceLastUse - Days since user last used the app
 * @returns {Promise<{applied: boolean, problemsAffected: number, message: string}>}
 */
export async function applyPassiveDecay(daysSinceLastUse) {
  // No decay needed for gaps under 30 days
  if (daysSinceLastUse < 30) {
    console.log(`✅ No decay needed (${daysSinceLastUse} days < 30 day threshold)`);
    return {
      applied: false,
      problemsAffected: 0,
      message: `No decay needed for ${daysSinceLastUse} day gap`
    };
  }

  console.log(`🔄 Applying passive decay for ${daysSinceLastUse} day gap...`);

  try {
    const db = await dbHelper.openDB();
    const transaction = db.transaction(["problems"], "readwrite");
    const problemStore = transaction.objectStore("problems");
    const allProblemsRequest = problemStore.getAll();

    return new Promise((resolve, reject) => {
      allProblemsRequest.onsuccess = () => {
        const problems = allProblemsRequest.result;
        let problemsAffected = 0;

        problems.forEach(problem => {
          // Calculate days since last attempt for this specific problem
          const daysSinceLastAttempt = problem.last_attempt_date
            ? getDaysSince(problem.last_attempt_date)
            : daysSinceLastUse; // Use app gap if no attempts

          // Skip if problem was attempted recently
          if (daysSinceLastAttempt < 30) {
            return;
          }

          let modified = false;
          const original = {
            boxLevel: problem.box_level,
            stability: problem.stability
          };

          // Box Level Decay: 1 box per 60 days (conservative)
          const boxDecayAmount = Math.floor(daysSinceLastAttempt / 60);
          if (boxDecayAmount > 0 && problem.box_level) {
            const newBoxLevel = Math.max(1, problem.box_level - boxDecayAmount);
            if (newBoxLevel !== problem.box_level) {
              problem.box_level = newBoxLevel;
              problem.original_box_level = original.boxLevel; // Store for rollback
              modified = true;
            }
          }

          // Stability Decay: Exponential forgetting curve (90-day half-life)
          // Formula: stability * e^(-days / 90)
          if (problem.stability !== undefined && problem.stability !== null) {
            const forgettingFactor = Math.exp(-daysSinceLastAttempt / 90);
            const newStability = Math.max(0.5, problem.stability * forgettingFactor);
            if (Math.abs(newStability - problem.stability) > 0.01) {
              problem.stability = parseFloat(newStability.toFixed(2));
              modified = true;
            }
          }

          // Mark problems needing recalibration (90+ days unused)
          if (daysSinceLastAttempt >= 90) {
            problem.needs_recalibration = true;
            problem.decay_applied_date = new Date().toISOString();
            modified = true;
          }

          // Update problem in database if modified
          if (modified) {
            problemStore.put(problem);
            problemsAffected++;
          }
        });

        transaction.oncomplete = () => {
          const message = `Applied decay to ${problemsAffected} problems (${daysSinceLastUse} day gap)`;
          console.log(`✅ ${message}`);
          resolve({
            applied: true,
            problemsAffected,
            message
          });
        };

        transaction.onerror = () => {
          console.error("❌ Passive decay transaction failed:", transaction.error);
          reject(transaction.error);
        };
      };

      allProblemsRequest.onerror = () => {
        console.error("❌ Failed to fetch problems for decay:", allProblemsRequest.error);
        reject(allProblemsRequest.error);
      };
    });
  } catch (error) {
    console.error("❌ applyPassiveDecay failed:", error);
    return {
      applied: false,
      problemsAffected: 0,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Check if decay should be applied and apply it if needed
 * Called on app startup to handle returning users
 *
 * @returns {Promise<{decayApplied: boolean, daysSinceLastUse: number, problemsAffected: number}>}
 */
export async function checkAndApplyDecay() {
  try {
    // Get days since last activity
    const daysSinceLastUse = await StorageService.getDaysSinceLastActivity();

    console.log(`📊 Days since last use: ${daysSinceLastUse}`);

    // Apply decay if needed
    const result = await applyPassiveDecay(daysSinceLastUse);

    // Update last activity date after successful decay
    if (result.applied || daysSinceLastUse === 0) {
      await StorageService.updateLastActivityDate();
    }

    return {
      decayApplied: result.applied,
      daysSinceLastUse,
      problemsAffected: result.problemsAffected,
      message: result.message
    };
  } catch (error) {
    console.error("❌ checkAndApplyDecay failed:", error);
    return {
      decayApplied: false,
      daysSinceLastUse: 0,
      problemsAffected: 0,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Get decay statistics for analytics
 *
 * @returns {Promise<{problemsNeedingRecalibration: number, averageDecayDays: number}>}
 */
export async function getDecayStatistics() {
  try {
    const db = await dbHelper.openDB();
    const transaction = db.transaction(["problems"], "readonly");
    const problemStore = transaction.objectStore("problems");
    const allProblemsRequest = problemStore.getAll();

    return new Promise((resolve, reject) => {
      allProblemsRequest.onsuccess = () => {
        const problems = allProblemsRequest.result;

        const problemsNeedingRecalibration = problems.filter(p => p.needs_recalibration).length;

        const decayDays = problems
          .filter(p => p.decay_applied_date)
          .map(p => getDaysSince(p.decay_applied_date));

        const averageDecayDays = decayDays.length > 0
          ? Math.round(decayDays.reduce((sum, days) => sum + days, 0) / decayDays.length)
          : 0;

        resolve({
          problemsNeedingRecalibration,
          averageDecayDays
        });
      };

      allProblemsRequest.onerror = () => {
        reject(allProblemsRequest.error);
      };
    });
  } catch (error) {
    console.error("❌ getDecayStatistics failed:", error);
    return {
      problemsNeedingRecalibration: 0,
      averageDecayDays: 0
    };
  }
}
