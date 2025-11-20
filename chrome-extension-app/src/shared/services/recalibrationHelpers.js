/**
 * Helper functions for recalibrationService.js
 *
 * Extracted to reduce function complexity
 */

// DECAY_CONFIG will be passed as parameter to avoid circular dependency

/**
 * Process individual problem for decay application
 * Returns updated problem if modified, null if no changes needed
 *
 * @param {object} problem - Problem to process
 * @param {number} daysSinceLastUse - Days since last app use
 * @param {function} getDaysSince - Helper to calculate days since date
 * @param {function} getBoxLevel - Helper to get validated box level
 * @param {object} config - DECAY_CONFIG object
 * @returns {object|null} Updated problem if modified, null otherwise
 */
export function processDecayForProblem(problem, daysSinceLastUse, getDaysSince, getBoxLevel, config) {
  const daysSinceLastAttempt = problem.last_attempt_date
    ? getDaysSince(problem.last_attempt_date)
    : daysSinceLastUse;

  if (daysSinceLastAttempt < config.MIN_GAP_DAYS) {
    return null;
  }

  let modified = false;
  const currentBoxLevel = getBoxLevel(problem);

  // Box Level Decay
  const boxDecayAmount = Math.floor(daysSinceLastAttempt / config.BOX_DECAY_INTERVAL);
  if (boxDecayAmount > 0) {
    const newBoxLevel = Math.max(config.MIN_BOX_LEVEL, currentBoxLevel - boxDecayAmount);
    if (newBoxLevel !== currentBoxLevel) {
      problem.box_level = newBoxLevel;
      problem.original_box_level = currentBoxLevel;
      modified = true;
    }
  }

  // Stability Decay
  if (problem.stability !== undefined && problem.stability !== null) {
    const forgettingFactor = Math.exp(-daysSinceLastAttempt / config.FORGETTING_HALF_LIFE);
    const newStability = Math.max(config.MIN_STABILITY, problem.stability * forgettingFactor);
    if (Math.abs(newStability - problem.stability) > 0.01) {
      problem.stability = parseFloat(newStability.toFixed(2));
      modified = true;
    }
  }

  // Mark for recalibration if threshold exceeded
  if (daysSinceLastAttempt >= config.RECALIBRATION_THRESHOLD) {
    problem.needs_recalibration = true;
    problem.decay_applied_date = new Date().toISOString();
    modified = true;
  }

  return modified ? problem : null;
}

/**
 * Apply batch updates to database
 */
export async function applyBatchUpdates(db, problemsToUpdate, batchSize = 100) {
  let totalProblemsAffected = 0;

  for (let i = 0; i < problemsToUpdate.length; i += batchSize) {
    const batch = problemsToUpdate.slice(i, i + batchSize);

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

  return totalProblemsAffected;
}

/**
 * Classify topics into retained vs forgotten based on accuracy threshold
 */
export function classifyTopics(topicPerformance, threshold = 0.7) {
  const topicsRetained = [];
  const topicsForgotten = [];

  topicPerformance.forEach((perf, tag) => {
    const accuracy = perf.correct / perf.total;
    const accuracyPercent = Math.round(accuracy * 100);

    if (accuracy >= threshold) {
      topicsRetained.push({ tag, accuracy: accuracyPercent });
    } else {
      topicsForgotten.push({ tag, accuracy: accuracyPercent });
    }
  });

  return { topicsRetained, topicsForgotten };
}

/**
 * Create diagnostic summary message based on accuracy
 */
export function createDiagnosticSummary(overallAccuracy, totalAttempts, topicsRetained, topicsForgotten, problemsRecalibrated) {
  const accuracyPercent = Math.round(overallAccuracy * 100);

  const message = overallAccuracy >= 0.7
    ? "Great retention! Your knowledge held up well."
    : overallAccuracy >= 0.4
    ? "Some topics need refreshing, but you're on the right track."
    : "Significant decay detected. Don't worry - we've adjusted your learning path.";

  return {
    totalProblems: totalAttempts,
    accuracy: accuracyPercent,
    topicsRetained,
    topicsForgotten,
    problemsRecalibrated,
    message
  };
}

/**
 * Prepare problems for diagnostic recalibration
 *
 * @param {object} db - Database connection
 * @param {Array} problemResults - Array of problem results
 * @param {function} getBoxLevel - Helper to get validated box level
 * @returns {Promise<Array>} Array of problems to recalibrate
 */
export async function prepareProblemsForRecalibration(db, problemResults, getBoxLevel) {
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

      if (problem && getBoxLevel(problem) > 1) {
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

  return problemsToRecalibrate;
}
