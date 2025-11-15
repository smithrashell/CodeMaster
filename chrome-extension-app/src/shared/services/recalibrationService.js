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
import { openDatabase } from "../db/connectionUtils.js";

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
 * Normalize and validate box level field
 * CRITICAL FIX: Ensures box_level exists and is valid
 * @param {object} problem - Problem object
 * @returns {number} Normalized box level (defaults to 1 if missing/invalid)
 */
function getBoxLevel(problem) {
  if (!problem) return 1;

  const boxLevel = problem.box_level;

  // Validate box_level exists and is a valid number
  if (boxLevel === undefined || boxLevel === null || typeof boxLevel !== 'number' || isNaN(boxLevel)) {
    return 1; // Default to box level 1
  }

  // Ensure box level is within valid range
  return Math.max(1, Math.floor(boxLevel));
}

// Configuration constants with scientific justification
const DECAY_CONFIG = {
  MIN_GAP_DAYS: 30,           // No decay for gaps under 30 days
  BOX_DECAY_INTERVAL: 60,     // 1 box per 60 days (2 months) - conservative
  FORGETTING_HALF_LIFE: 90,   // 90-day half-life based on Ebbinghaus forgetting curve
  RECALIBRATION_THRESHOLD: 90, // Flag problems unused for 90+ days for diagnostic
  MIN_BOX_LEVEL: 1,           // Minimum box level (never goes below 1)
  MIN_STABILITY: 0.5          // Minimum stability (never goes below 0.5)
};

/**
 * Atomically check and set decay date to prevent race conditions
 * @param {string} today - Today's date in YYYY-MM-DD format
 * @returns {Promise<boolean>} True if decay should proceed, false if already applied
 */
async function atomicCheckAndSetDecayDate(today) {
  try {
    const lastDecayDate = await StorageService.get('last_decay_date');

    if (lastDecayDate === today) {
      return false; // Already applied today
    }

    // Atomically set the date
    await StorageService.set('last_decay_date', today);
    return true; // Proceed with decay
  } catch (error) {
    console.error("❌ Error in atomicCheckAndSetDecayDate:", error);
    throw error;
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
  // No decay needed for gaps under threshold
  if (daysSinceLastUse < DECAY_CONFIG.MIN_GAP_DAYS) {
    console.log(`✅ No decay needed (${daysSinceLastUse} days < ${DECAY_CONFIG.MIN_GAP_DAYS} day threshold)`);
    return {
      applied: false,
      problemsAffected: 0,
      message: `No decay needed for ${daysSinceLastUse} day gap`
    };
  }

  // CRITICAL FIX: Atomically check and set decay date to prevent race conditions
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const shouldProceed = await atomicCheckAndSetDecayDate(today);

  if (!shouldProceed) {
    console.log(`✅ Decay already applied today (${today}), skipping to prevent duplicate application`);
    return {
      applied: false,
      problemsAffected: 0,
      message: `Decay already applied today`
    };
  }

  console.log(`🔄 Applying passive decay for ${daysSinceLastUse} day gap...`);

  try {
    const db = await openDatabase();

    // CRITICAL FIX: Batch processing to prevent memory leak with large datasets
    const BATCH_SIZE = 100; // Process 100 problems per transaction
    let totalProblemsAffected = 0;

    // Get all problems first (read-only)
    const readTransaction = db.transaction(["problems"], "readonly");
    const problemStore = readTransaction.objectStore("problems");
    const allProblemsRequest = problemStore.getAll();

    const allProblems = await new Promise((resolve, reject) => {
      allProblemsRequest.onsuccess = () => resolve(allProblemsRequest.result);
      allProblemsRequest.onerror = () => reject(allProblemsRequest.error);
    });

    // Process problems to identify which need decay
    const problemsToUpdate = [];

    for (const problem of allProblems) {
      // Calculate days since last attempt for this specific problem
      const daysSinceLastAttempt = problem.last_attempt_date
        ? getDaysSince(problem.last_attempt_date)
        : daysSinceLastUse; // Use app gap if no attempts

      // Skip if problem was attempted recently
      if (daysSinceLastAttempt < DECAY_CONFIG.MIN_GAP_DAYS) {
        continue;
      }

      let modified = false;

      // CRITICAL FIX: Use validated box level
      const currentBoxLevel = getBoxLevel(problem);
      const original = {
        boxLevel: currentBoxLevel,
        stability: problem.stability
      };

      // Box Level Decay: 1 box per 60 days (conservative)
      const boxDecayAmount = Math.floor(daysSinceLastAttempt / DECAY_CONFIG.BOX_DECAY_INTERVAL);
      if (boxDecayAmount > 0) {
        const newBoxLevel = Math.max(DECAY_CONFIG.MIN_BOX_LEVEL, currentBoxLevel - boxDecayAmount);
        if (newBoxLevel !== currentBoxLevel) {
          problem.box_level = newBoxLevel;
          problem.original_box_level = original.boxLevel; // Store for rollback
          modified = true;
        }
      }

      // Stability Decay: Exponential forgetting curve (90-day half-life)
      // Formula: stability * e^(-days / FORGETTING_HALF_LIFE)
      if (problem.stability !== undefined && problem.stability !== null) {
        const forgettingFactor = Math.exp(-daysSinceLastAttempt / DECAY_CONFIG.FORGETTING_HALF_LIFE);
        const newStability = Math.max(DECAY_CONFIG.MIN_STABILITY, problem.stability * forgettingFactor);
        if (Math.abs(newStability - problem.stability) > 0.01) {
          problem.stability = parseFloat(newStability.toFixed(2));
          modified = true;
        }
      }

      // Mark problems needing recalibration (90+ days unused)
      if (daysSinceLastAttempt >= DECAY_CONFIG.RECALIBRATION_THRESHOLD) {
        problem.needs_recalibration = true;
        problem.decay_applied_date = new Date().toISOString();
        modified = true;
      }

      if (modified) {
        problemsToUpdate.push(problem);
      }
    }

    // Apply updates in batches
    for (let i = 0; i < problemsToUpdate.length; i += BATCH_SIZE) {
      const batch = problemsToUpdate.slice(i, i + BATCH_SIZE);

      await new Promise((resolve, reject) => {
        const writeTransaction = db.transaction(["problems"], "readwrite");
        const writeProblemStore = writeTransaction.objectStore("problems");

        batch.forEach(problem => {
          writeProblemStore.put(problem);
        });

        writeTransaction.oncomplete = () => {
          totalProblemsAffected += batch.length;
          resolve();
        };

        writeTransaction.onerror = () => {
          console.error("❌ Batch decay transaction failed:", writeTransaction.error);
          reject(writeTransaction.error);
        };
      });
    }

    const message = `Applied decay to ${totalProblemsAffected} problems (${daysSinceLastUse} day gap)`;
    console.log(`✅ ${message}`);
    return {
      applied: true,
      problemsAffected: totalProblemsAffected,
      message
    };
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
    // Performance optimization: Check if we already checked today (24-hour cooldown)
    const lastCheckDate = await StorageService.get('last_decay_check_date');
    const today = new Date().toISOString().split('T')[0];

    if (lastCheckDate === today) {
      console.log(`✅ Decay check already performed today (${today}), skipping for performance`);
      return {
        decayApplied: false,
        daysSinceLastUse: 0,
        problemsAffected: 0,
        message: 'Already checked today'
      };
    }

    // Update check date immediately to prevent race conditions on rapid service worker restarts
    await StorageService.set('last_decay_check_date', today);

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
    const db = await openDatabase();
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

/**
 * Phase 2: Get welcome back strategy based on usage gap
 * Determines what type of recalibration flow to show the user
 *
 * @param {number} daysSinceLastUse - Days since user last used the app
 * @returns {object} Strategy object with type, message, and options
 */
export function getWelcomeBackStrategy(daysSinceLastUse) {
  // < 30 days: Business as usual, no special handling
  if (daysSinceLastUse < 30) {
    return { type: 'normal' };
  }

  // 30-90 days: Gentle recalibration with adaptive first session
  if (daysSinceLastUse < 90) {
    return {
      type: 'gentle_recal',
      message: "You've been away for a while. Your first session will help us recalibrate your learning path.",
      approach: 'adaptive_first_session',
      daysSinceLastUse
    };
  }

  // 90-365 days: Moderate recalibration with user choice
  if (daysSinceLastUse < 365) {
    return {
      type: 'moderate_recal',
      message: "Welcome back! Let's find your current skill level.",
      daysSinceLastUse,
      options: [
        {
          value: 'diagnostic',
          label: 'Quick Assessment (5 problems)',
          description: 'Sample key topics to quickly recalibrate',
          time: '~15 min',
          recommended: true
        },
        {
          value: 'adaptive_first_session',
          label: 'Adaptive Session',
          description: 'Learn while we recalibrate your level',
          time: '~30 min',
          recommended: false
        }
      ]
    };
  }

  // > 365 days: Major recalibration with strong diagnostic recommendation
  return {
    type: 'major_recal',
    message: "It's been a while! Let's see what you remember.",
    daysSinceLastUse,
    recommendation: 'diagnostic',
    options: [
      {
        value: 'diagnostic',
        label: '5-Minute Diagnostic (Recommended)',
        description: 'Sample problems from your previous topics to quickly recalibrate',
        time: '~15 min',
        recommended: true
      },
      {
        value: 'reset',
        label: 'Start Fresh',
        description: 'Reset progress and rebuild from scratch (keeps history for analytics)',
        time: 'immediate',
        recommended: false,
        warning: 'This will reset all box levels to 1'
      },
      {
        value: 'adaptive_first_session',
        label: 'Jump Back In',
        description: 'Start sessions immediately and adapt as we go',
        time: '~30 min',
        recommended: false
      }
    ]
  };
}

/**
 * Phase 3: Create diagnostic session to sample problems and assess retention
 *
 * Samples 5-7 problems from previously mastered topics (box level 3+) to assess
 * what the user actually remembers after a long break.
 *
 * Strategy:
 * - Prioritize problems marked with `needs_recalibration` flag
 * - Include variety across difficulty levels (Easy, Medium, Hard)
 * - Sample from different topics/tags for comprehensive assessment
 * - Prefer higher box levels to test what was "mastered"
 *
 * @param {object} options - Diagnostic session options
 * @param {number} options.problemCount - Number of problems to sample (default: 5)
 * @param {number} options.daysSinceLastUse - Days since last app use
 * @returns {Promise<{sessionId: string, problems: Array, metadata: object}>}
 */
export async function createDiagnosticSession(options = {}) {
  const { problemCount = 5, daysSinceLastUse = 0 } = options;

  console.log(`🎯 Creating diagnostic session (${problemCount} problems, ${daysSinceLastUse} days gap)...`);

  try {
    const db = await openDatabase();
    const transaction = db.transaction(["problems"], "readonly");
    const problemStore = transaction.objectStore("problems");
    const allProblemsRequest = problemStore.getAll();

    return new Promise((resolve, reject) => {
      allProblemsRequest.onsuccess = () => {
        const allProblems = allProblemsRequest.result;

        // Filter for mastered problems (box level 3+)
        // CRITICAL FIX: Use validated box level
        const masteredProblems = allProblems.filter(p => getBoxLevel(p) >= 3);

        if (masteredProblems.length === 0) {
          console.warn("⚠️ No mastered problems found for diagnostic session");
          reject(new Error("No mastered problems available for diagnostic assessment"));
          return;
        }

        // Prioritize problems needing recalibration
        const needsRecal = masteredProblems.filter(p => p.needs_recalibration);
        const others = masteredProblems.filter(p => !p.needs_recalibration);

        // Sort by box level (descending) to test the "most mastered" problems
        // CRITICAL FIX: Use validated box level
        const sortByBoxLevel = (a, b) => {
          return getBoxLevel(b) - getBoxLevel(a);
        };

        needsRecal.sort(sortByBoxLevel);
        others.sort(sortByBoxLevel);

        // Sample problems with variety
        const selectedProblems = [];
        const seenTags = new Set();
        const seenDifficulties = new Set();

        // Strategy: Pick from needs_recalibration first, then others
        const candidatePool = [...needsRecal, ...others];

        for (const problem of candidatePool) {
          if (selectedProblems.length >= problemCount) break;

          // Try to maximize variety in tags and difficulty
          const problemTags = problem.topicTags || [];
          const difficulty = problem.difficulty || 'Medium';

          // Add problem if it adds variety OR if we still need more problems
          const addsTagVariety = problemTags.some(tag => !seenTags.has(tag));
          const addsDifficultyVariety = !seenDifficulties.has(difficulty);

          if (selectedProblems.length < 3 || addsTagVariety || addsDifficultyVariety) {
            selectedProblems.push(problem);
            problemTags.forEach(tag => seenTags.add(tag));
            seenDifficulties.add(difficulty);
          }
        }

        // Fallback: if we still don't have enough, just take the top box level problems
        while (selectedProblems.length < problemCount && candidatePool.length > selectedProblems.length) {
          const nextProblem = candidatePool[selectedProblems.length];
          if (!selectedProblems.includes(nextProblem)) {
            selectedProblems.push(nextProblem);
          }
        }

        // Create metadata for diagnostic session
        const metadata = {
          type: 'diagnostic',
          daysSinceLastUse,
          problemCount: selectedProblems.length,
          sampledFromMastered: masteredProblems.length,
          needsRecalibration: needsRecal.length,
          createdAt: new Date().toISOString()
        };

        console.log(`✅ Diagnostic session created: ${selectedProblems.length} problems selected`);

        resolve({
          problems: selectedProblems,
          metadata
        });
      };

      allProblemsRequest.onerror = () => {
        console.error("❌ Failed to fetch problems for diagnostic:", allProblemsRequest.error);
        reject(allProblemsRequest.error);
      };
    });
  } catch (error) {
    console.error("❌ createDiagnosticSession failed:", error);
    throw error;
  }
}

/**
 * Helper: Analyze diagnostic performance by topic/tag
 * @param {Array} attempts - Problem attempts with tags
 * @returns {{topicPerformance: Map, problemResults: Array}}
 */
function analyzeDiagnosticPerformance(attempts) {
  const topicPerformance = new Map();
  const problemResults = [];

  attempts.forEach(attempt => {
    const { problemId, success, tags = [] } = attempt;

    problemResults.push({ problemId, success });

    // Track performance per tag
    tags.forEach(tag => {
      if (!topicPerformance.has(tag)) {
        topicPerformance.set(tag, { correct: 0, total: 0 });
      }
      const perf = topicPerformance.get(tag);
      perf.total++;
      if (success) perf.correct++;
    });
  });

  return { topicPerformance, problemResults };
}

/**
 * Phase 3: Process diagnostic session results and apply recalibration
 *
 * Analyzes user performance on diagnostic problems and applies topic-based
 * recalibration (not global reset).
 *
 * Strategy:
 * - Calculate accuracy per topic/tag
 * - Reduce box levels for topics with poor performance
 * - Keep box levels for topics with good performance
 * - Generate retention summary for user feedback
 *
 * @param {object} diagnosticResults - Results from diagnostic session
 * @param {string} diagnosticResults.sessionId - Session ID
 * @param {Array} diagnosticResults.attempts - Problem attempts with success/failure
 * @returns {Promise<{recalibrated: boolean, summary: object}>}
 */
export async function processDiagnosticResults(diagnosticResults) {
  const { sessionId, attempts } = diagnosticResults;

  if (!attempts || attempts.length === 0) {
    console.warn("⚠️ No attempts to process for diagnostic session");
    return {
      recalibrated: false,
      summary: {
        totalProblems: 0,
        accuracy: 0,
        topicsRetained: [],
        topicsForgotten: [],
        message: "No attempts recorded"
      }
    };
  }

  console.log(`📊 Processing diagnostic results (${attempts.length} attempts)...`);

  try {
    const db = await openDatabase();

    // Analyze performance by topic/tag
    const { topicPerformance, problemResults } = analyzeDiagnosticPerformance(attempts);

    // Calculate overall accuracy
    const totalAttempts = attempts.length;
    const successfulAttempts = attempts.filter(a => a.success).length;
    const overallAccuracy = totalAttempts > 0 ? successfulAttempts / totalAttempts : 0;

    // Identify retained vs forgotten topics (70% threshold)
    const topicsRetained = [];
    const topicsForgotten = [];

    topicPerformance.forEach((perf, tag) => {
      const accuracy = perf.correct / perf.total;
      if (accuracy >= 0.7) {
        topicsRetained.push({ tag, accuracy: Math.round(accuracy * 100) });
      } else {
        topicsForgotten.push({ tag, accuracy: Math.round(accuracy * 100) });
      }
    });

    // CRITICAL FIX: Apply recalibration with proper rollback mechanism
    // First, get all problems that need updating
    const readTransaction = db.transaction(["problems"], "readonly");
    const readProblemStore = readTransaction.objectStore("problems");

    const problemsToRecalibrate = [];

    for (const result of problemResults) {
      if (!result.success) {
        const problemRequest = readProblemStore.get(result.problemId);

        const problem = await new Promise((resolve, reject) => {
          problemRequest.onsuccess = () => resolve(problemRequest.result);
          problemRequest.onerror = () => reject(problemRequest.error);
        });

        // CRITICAL FIX: Use validated box level
        if (problem && getBoxLevel(problem) > 1) {
          // Prepare updated problem
          const currentBoxLevel = getBoxLevel(problem);
          const updatedProblem = {
            ...problem,
            box_level: Math.max(1, currentBoxLevel - 1),
            diagnostic_recalibrated: true,
            diagnostic_date: new Date().toISOString()
          };
          problemsToRecalibrate.push(updatedProblem);
        }
      }
    }

    // Apply all updates in a single transaction (atomic - all or nothing)
    let problemsRecalibrated = 0;

    if (problemsToRecalibrate.length > 0) {
      await new Promise((resolve, reject) => {
        const writeTransaction = db.transaction(["problems"], "readwrite");
        const writeProblemStore = writeTransaction.objectStore("problems");

        // Queue all updates in the same transaction
        problemsToRecalibrate.forEach(problem => {
          writeProblemStore.put(problem);
        });

        writeTransaction.oncomplete = () => {
          problemsRecalibrated = problemsToRecalibrate.length;
          resolve();
        };

        writeTransaction.onerror = () => {
          console.error("❌ Diagnostic recalibration transaction failed - rolling back all changes");
          reject(writeTransaction.error);
        };
      });
    }

    const summary = {
      totalProblems: totalAttempts,
      accuracy: Math.round(overallAccuracy * 100),
      topicsRetained,
      topicsForgotten,
      problemsRecalibrated,
      message: overallAccuracy >= 0.7
        ? "Great retention! Your knowledge held up well."
        : overallAccuracy >= 0.4
        ? "Some topics need refreshing, but you're on the right track."
        : "Significant decay detected. Don't worry - we've adjusted your learning path."
    };

    console.log(`✅ Diagnostic processing complete: ${problemsRecalibrated} problems recalibrated`);

    // Store diagnostic results for analytics
    await StorageService.set('last_diagnostic_result', {
      sessionId,
      summary,
      completedAt: new Date().toISOString()
    });

    return {
      recalibrated: true,
      summary
    };
  } catch (error) {
    console.error("❌ processDiagnosticResults failed:", error);
    return {
      recalibrated: false,
      summary: {
        totalProblems: attempts.length,
        accuracy: 0,
        topicsRetained: [],
        topicsForgotten: [],
        message: `Error: ${error.message}`
      }
    };
  }
}

/**
 * Phase 4: Create adaptive recalibration session flag
 *
 * Instead of a separate diagnostic, the adaptive approach flags the next session
 * to track performance carefully and decide whether to keep or revert passive decay.
 *
 * Strategy:
 * - Flag next session as "adaptive recalibration session"
 * - Session runs normally but tracks performance metrics
 * - After session: If performance is good (70%+ accuracy), keep decay
 * - If performance is poor (<40% accuracy), revert decay partially
 * - Middle ground (40-70%): Keep decay but reduce magnitude
 *
 * @param {object} options - Adaptive session options
 * @param {number} options.daysSinceLastUse - Days since last app use
 * @returns {Promise<{status: string, message: string}>}
 */
export async function createAdaptiveRecalibrationSession(options = {}) {
  const { daysSinceLastUse = 0 } = options;

  console.log(`🔄 Setting up adaptive recalibration for next session (${daysSinceLastUse} days gap)...`);

  try {
    // Store flag for next session to be adaptive
    await StorageService.set('pending_adaptive_recalibration', {
      daysSinceLastUse,
      createdAt: new Date().toISOString(),
      decayApplied: true, // Passive decay was already applied in Phase 1
      decayMagnitude: daysSinceLastUse >= 365 ? 'major' : daysSinceLastUse >= 90 ? 'moderate' : 'gentle'
    });

    console.log(`✅ Next session will be adaptive recalibration session`);

    return {
      status: 'success',
      message: `Adaptive recalibration enabled for next session`
    };
  } catch (error) {
    console.error("❌ createAdaptiveRecalibrationSession failed:", error);
    return {
      status: 'error',
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Phase 4: Process adaptive session completion
 *
 * After user completes their first session back, analyze performance
 * and decide whether to keep, adjust, or revert the passive decay.
 *
 * @param {object} sessionData - Completed session data
 * @param {string} sessionData.sessionId - Session ID
 * @param {number} sessionData.accuracy - Overall accuracy (0-1)
 * @param {number} sessionData.totalProblems - Total problems attempted
 * @returns {Promise<{status: string, action: string, summary: object}>}
 */
export async function processAdaptiveSessionCompletion(sessionData) {
  const { sessionId, accuracy, totalProblems } = sessionData;

  console.log(`📊 Processing adaptive session completion (${Math.round(accuracy * 100)}% accuracy on ${totalProblems} problems)...`);

  try {
    // Get the adaptive session flag
    const adaptiveFlag = await StorageService.get('pending_adaptive_recalibration');

    if (!adaptiveFlag) {
      console.warn("⚠️ No adaptive recalibration flag found");
      return {
        status: 'success',
        action: 'none',
        summary: { message: 'No adaptive recalibration needed' }
      };
    }

    const { daysSinceLastUse, decayMagnitude } = adaptiveFlag;

    let action = 'keep_decay';
    let message = '';

    // Decision logic based on performance
    if (accuracy >= 0.7) {
      // Strong performance - decay was appropriate, keep it
      action = 'keep_decay';
      message = `Great performance! Your knowledge held up well after ${daysSinceLastUse} days away.`;
    } else if (accuracy >= 0.4) {
      // Middle performance - reduce decay slightly
      action = 'reduce_decay';
      message = `Good effort! We'll make small adjustments to better match your current level.`;
      await reduceDecayMagnitude(0.5); // Reduce decay by 50%
    } else {
      // Poor performance - decay may have been too aggressive
      action = 'revert_decay_partially';
      message = `We'll adjust the difficulty to better match where you are right now.`;
      await reduceDecayMagnitude(0.75); // Reduce decay by 75%
    }

    // Clear the adaptive flag
    await StorageService.set('pending_adaptive_recalibration', null);

    // Store results for analytics
    await StorageService.set('last_adaptive_result', {
      sessionId,
      accuracy,
      totalProblems,
      action,
      daysSinceLastUse,
      decayMagnitude,
      completedAt: new Date().toISOString()
    });

    console.log(`✅ Adaptive session processed: ${action}`);

    return {
      status: 'success',
      action,
      summary: {
        accuracy: Math.round(accuracy * 100),
        totalProblems,
        daysSinceLastUse,
        message
      }
    };
  } catch (error) {
    console.error("❌ processAdaptiveSessionCompletion failed:", error);
    return {
      status: 'error',
      action: 'none',
      summary: { message: `Error: ${error.message}` }
    };
  }
}

/**
 * Helper: Reduce decay magnitude by a percentage
 * @param {number} reductionFactor - How much to reduce (0.5 = 50% reduction)
 */
async function reduceDecayMagnitude(reductionFactor) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(["problems"], "readwrite");
    const problemStore = transaction.objectStore("problems");
    const allProblemsRequest = problemStore.getAll();

    return new Promise((resolve, reject) => {
      allProblemsRequest.onsuccess = () => {
        const problems = allProblemsRequest.result;
        let adjustedCount = 0;

        problems.forEach(problem => {
          // Only adjust problems that had decay applied
          // CRITICAL FIX: Use validated box level
          if (problem.decay_applied_date && problem.original_box_level) {
            const currentBoxLevel = getBoxLevel(problem);
            const decayAmount = problem.original_box_level - currentBoxLevel;

            if (decayAmount > 0) {
              // Reduce the decay by the reduction factor
              const reducedDecay = Math.floor(decayAmount * (1 - reductionFactor));
              problem.box_level = problem.original_box_level - reducedDecay;
              problem.decay_adjusted = true;
              problem.decay_adjustment_date = new Date().toISOString();
              problemStore.put(problem);
              adjustedCount++;
            }
          }
        });

        transaction.oncomplete = () => {
          console.log(`✅ Adjusted decay for ${adjustedCount} problems`);
          resolve(adjustedCount);
        };

        transaction.onerror = () => {
          console.error("❌ Decay reduction transaction failed:", transaction.error);
          reject(transaction.error);
        };
      };

      allProblemsRequest.onerror = () => {
        console.error("❌ Failed to fetch problems for decay reduction:", allProblemsRequest.error);
        reject(allProblemsRequest.error);
      };
    });
  } catch (error) {
    console.error("❌ reduceDecayMagnitude failed:", error);
    throw error;
  }
}
