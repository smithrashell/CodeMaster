/**
 * Business Logic Validation Functions
 * Extracted from DataIntegrityCheckService
 */

// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../../db/index.js";

/**
 * Get all data from a store
 */
export function getAllStoreData(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check cross-store data consistency
 */
export async function checkCrossStoreConsistency(result, helperMethods) {
  const startTime = performance.now();
  const db = await dbHelper.openDB();

  try {
    const problems = await getAllStoreData(db, "problems");
    const attempts = await getAllStoreData(db, "attempts");

    const problemsWithAttempts = new Set(attempts.map((a) => a.problemId));

    for (const problem of problems) {
      if (problemsWithAttempts.has(problem.leetCodeID)) {
        const problemAttempts = attempts.filter(
          (a) => a.problemId === problem.leetCodeID
        );
        const actualTotal = problemAttempts.length;
        const actualSuccessful = problemAttempts.filter(
          (a) => a.success
        ).length;

        if (problem.attempt_stats) {
          const { total_attempts, successful_attempts } = problem.attempt_stats;

          helperMethods._checkAttemptStatsMismatch(
            result,
            problem,
            { total_attempts, successful_attempts },
            { actualTotal, actualSuccessful }
          );
        }
      }
    }

    const sessions = await getAllStoreData(db, "sessions");
    for (const session of sessions) {
      if (session.attempts) {
        for (const sessionAttempt of session.attempts) {
          const attemptExists = attempts.some(
            (a) => a.id === sessionAttempt.attemptId
          );
          helperMethods._checkMissingAttemptReference(
            result,
            session,
            sessionAttempt,
            attemptExists
          );
        }
      }
    }
  } catch (error) {
    result.checks.push({
      type: "cross_store_check_error",
      severity: "error",
      message: `Cross-store consistency check failed: ${error.message}`,
      error: error.stack,
    });
    result.errorCount++;
  }

  const endTime = performance.now();
  result.performanceMetrics.checkBreakdown.crossStoreConsistency =
    endTime - startTime;
}

/**
 * Check data freshness and staleness
 */
export async function checkDataFreshness(result, stores) {
  const startTime = performance.now();
  const db = await dbHelper.openDB();
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    if (stores.includes("sessions")) {
      const sessions = await getAllStoreData(db, "sessions");
      const staleSessions = sessions.filter((session) => {
        if (session.status === "completed") return false;

        const sessionDate = new Date(session.date);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return sessionDate < oneDayAgo;
      });

      if (staleSessions.length > 0) {
        result.warningCount += staleSessions.length;
        result.checks.push({
          type: "stale_sessions",
          severity: "warning",
          message: `Found ${staleSessions.length} incomplete sessions older than 24 hours`,
          details: {
            count: staleSessions.length,
            sessions: staleSessions.map((s) => s.id),
          },
        });
      }
    }

    if (stores.includes("tag_mastery")) {
      const tagMastery = await getAllStoreData(db, "tag_mastery");
      const outdatedMastery = tagMastery.filter((tm) => {
        if (!tm.lastAttemptDate) return false;
        const lastAttempt = new Date(tm.lastAttemptDate);
        return lastAttempt < oneWeekAgo && tm.decayScore > 0.1;
      });

      if (outdatedMastery.length > 0) {
        result.warningCount++;
        result.checks.push({
          type: "outdated_mastery",
          severity: "warning",
          message: `Found ${outdatedMastery.length} tag mastery records that may need decay score updates`,
          details: {
            count: outdatedMastery.length,
            tags: outdatedMastery.map((tm) => tm.tag),
          },
        });
      }
    }
  } catch (error) {
    result.checks.push({
      type: "data_freshness_error",
      severity: "error",
      message: `Data freshness check failed: ${error.message}`,
      error: error.stack,
    });
    result.errorCount++;
  }

  const endTime = performance.now();
  result.performanceMetrics.checkBreakdown.dataFreshness =
    endTime - startTime;
}

/**
 * Check for statistical anomalies in the data
 */
export async function checkStatisticalAnomalies(result, stores) {
  const startTime = performance.now();
  const db = await dbHelper.openDB();

  try {
    if (stores.includes("tag_mastery")) {
      const tagMastery = await getAllStoreData(db, "tag_mastery");

      const suspiciousHighRates = tagMastery.filter(
        (tm) =>
          tm.successRate >= 1.0 &&
          tm.totalAttempts > 0 &&
          tm.totalAttempts < 3
      );

      if (suspiciousHighRates.length > 0) {
        result.warningCount++;
        result.checks.push({
          type: "suspicious_success_rates",
          severity: "warning",
          message: `Found ${suspiciousHighRates.length} tags with 100% success rate but very few attempts`,
          details: {
            count: suspiciousHighRates.length,
            tags: suspiciousHighRates.map((tm) => ({
              tag: tm.tag,
              attempts: tm.totalAttempts,
            })),
          },
        });
      }
    }

    if (stores.includes("attempts")) {
      const attempts = await getAllStoreData(db, "attempts");
      const recentAttempts = attempts.filter((a) => {
        const attemptDate = new Date(a.date);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return attemptDate > oneDayAgo;
      });

      const suspiciouslyFast = recentAttempts.filter((a) => a.timeSpent < 30);
      if (suspiciouslyFast.length > 5) {
        result.warningCount++;
        result.checks.push({
          type: "suspicious_completion_times",
          severity: "warning",
          message: `Found ${suspiciouslyFast.length} attempts completed in under 30 seconds in the last 24 hours`,
          details: { count: suspiciouslyFast.length },
        });
      }

      const suspiciouslySlow = recentAttempts.filter(
        (a) => a.timeSpent > 7200
      );
      if (suspiciouslySlow.length > 0) {
        result.warningCount++;
        result.checks.push({
          type: "unusual_long_attempts",
          severity: "warning",
          message: `Found ${suspiciouslySlow.length} attempts taking over 2 hours in the last 24 hours`,
          details: { count: suspiciouslySlow.length },
        });
      }
    }
  } catch (error) {
    result.checks.push({
      type: "statistical_anomaly_error",
      severity: "error",
      message: `Statistical anomaly check failed: ${error.message}`,
      error: error.stack,
    });
    result.errorCount++;
  }

  const endTime = performance.now();
  result.performanceMetrics.checkBreakdown.statisticalAnomalies =
    endTime - startTime;
}

/**
 * Perform business logic validation
 */
export async function performBusinessLogicValidation(stores, options, helperMethods) {
  const { priority, PRIORITIES } = options;

  const result = {
    valid: true,
    checks: [],
    errorCount: 0,
    warningCount: 0,
    performanceMetrics: {
      totalTime: 0,
      checkBreakdown: {},
    },
  };

  const startTime = performance.now();

  await checkCrossStoreConsistency(result, helperMethods);
  await checkDataFreshness(result, stores);

  if (priority === PRIORITIES.CRITICAL) {
    await checkStatisticalAnomalies(result, stores);
  }

  const endTime = performance.now();
  result.performanceMetrics.totalTime = endTime - startTime;

  return result;
}
