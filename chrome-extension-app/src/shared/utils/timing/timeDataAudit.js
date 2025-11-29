/**
 * Time Data Audit Utility for CodeMaster
 *
 * This utility provides functions to audit and repair existing time data
 * in the database that may have been stored inconsistently before the
 * timer accuracy fixes were implemented.
 */

import timeMigration from "./timeMigration.js";
import AccurateTimer from "./AccurateTimer.js";
// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../../db/index.js";

/**
 * Comprehensive audit of all time-related data in the database
 * @returns {Promise<Object>} Audit report
 */
export async function auditAllTimeData() {

  const auditReport = {
    timestamp: new Date().toISOString(),
    attempts: null,
    issues: [],
    recommendations: [],
    summary: {
      totalRecords: 0,
      suspiciousRecords: 0,
      zeroTimeRecords: 0,
      extremeTimeRecords: 0,
      averageTime: 0,
      medianTime: 0,
    },
  };

  try {
    // Audit attempts data
    const attemptsAudit = await auditAttemptsTimeData();
    auditReport.attempts = attemptsAudit;

    // Compile issues and recommendations
    auditReport.issues = [...attemptsAudit.issues];

    auditReport.recommendations = generateAuditRecommendations(auditReport);

    return auditReport;
  } catch (error) {
    console.error("❌ Audit failed:", error);
    auditReport.error = error.message;
    return auditReport;
  }
}

/**
 * Audits attempts table for time data issues
 * @returns {Promise<Object>} Attempts audit results
 */
export async function auditAttemptsTimeData() {
  const db = await dbHelper.openDB();
  const transaction = db.transaction(["attempts"], "readonly");
  const store = transaction.objectStore("attempts");

  const attempts = await new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });


  const issues = [];
  const timeValues = [];
  let zeroTimeCount = 0;
  let extremeTimeCount = 0;

  // Analyze each attempt
  attempts.forEach((attempt, _index) => {
    const timeSpent = Number(attempt.time_spent) || 0;
    const attemptDate = attempt.attempt_date;
    const problemId = attempt.problem_id;

    // Collect time values for statistics
    if (timeSpent > 0) {
      timeValues.push(timeSpent);
    }

    // Check for zero or missing time
    if (timeSpent <= 0) {
      zeroTimeCount++;
      issues.push({
        type: "zero_time",
        recordId: attempt.id,
        problemId: problemId,
        value: timeSpent,
        date: attemptDate,
        severity: "medium",
        message: `Attempt has zero or negative time: ${timeSpent}`,
      });
    }

    // Check for extremely short time (< 10 seconds)
    else if (timeSpent < 10) {
      issues.push({
        type: "suspicious_short_time",
        recordId: attempt.id,
        problemId: problemId,
        value: timeSpent,
        date: attemptDate,
        severity: "low",
        message: `Suspiciously short time: ${timeSpent} seconds (${AccurateTimer.formatTime(
          timeSpent
        )})`,
      });
    }

    // Check for extremely long time (> 4 hours)
    else if (timeSpent > 14400) {
      extremeTimeCount++;
      issues.push({
        type: "extreme_long_time",
        recordId: attempt.id,
        problemId: problemId,
        value: timeSpent,
        date: attemptDate,
        severity: "high",
        message: `Extremely long time: ${timeSpent} seconds (${AccurateTimer.formatTime(
          timeSpent
        )})`,
      });
    }

    // Check for suspicious "round" numbers that might indicate unit issues
    else if (timeSpent % 60 === 0 && timeSpent < 900) {
      const minutes = timeSpent / 60;
      if (minutes < 15 && Number.isInteger(minutes)) {
        issues.push({
          type: "possible_unit_confusion",
          recordId: attempt.id,
          problemId: problemId,
          value: timeSpent,
          date: attemptDate,
          severity: "low",
          message: `Possible unit confusion: ${timeSpent} seconds = exactly ${minutes} minutes`,
        });
      }
    }
  });

  // Calculate statistics
  const summary = calculateTimeStatistics(timeValues);

  // Analyze time unit consistency
  const unitAnalysis = timeMigration.analyzeTimeUnits(attempts);

  return {
    totalRecords: attempts.length,
    issues,
    timeStatistics: summary,
    unitAnalysis,
    summary: {
      totalRecords: attempts.length,
      suspiciousRecords: issues.length,
      zeroTimeRecords: zeroTimeCount,
      extremeTimeRecords: extremeTimeCount,
      averageTime: summary.average,
      medianTime: summary.median,
    },
  };
}

/**
 * Calculate comprehensive time statistics
 * @param {number[]} timeValues - Array of time values in seconds
 * @returns {Object} Statistical analysis
 */
function calculateTimeStatistics(timeValues) {
  if (timeValues.length === 0) {
    return {
      count: 0,
      average: 0,
      median: 0,
      min: 0,
      max: 0,
      standardDeviation: 0,
    };
  }

  const sorted = [...timeValues].sort((a, b) => a - b);
  const sum = timeValues.reduce((a, b) => a + b, 0);

  const average = sum / timeValues.length;
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

  const variance =
    timeValues.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) /
    timeValues.length;
  const standardDeviation = Math.sqrt(variance);

  return {
    count: timeValues.length,
    average: Math.round(average),
    median: Math.round(median),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    standardDeviation: Math.round(standardDeviation),
    percentiles: {
      p25: sorted[Math.floor(sorted.length * 0.25)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    },
  };
}

/**
 * Generate recommendations based on audit results
 * @param {Object} auditReport - Complete audit report
 * @returns {string[]} Array of recommendations
 */
function generateAuditRecommendations(auditReport) {
  const recommendations = [];
  const attempts = auditReport.attempts;

  if (!attempts) return recommendations;

  // Unit consistency recommendations
  if (attempts.unitAnalysis.confidence < 0.7) {
    recommendations.push(
      `🔄 Time unit detection has low confidence (${Math.round(
        attempts.unitAnalysis.confidence * 100
      )}%). ` +
        `Consider running data migration with manual unit specification.`
    );
  }

  // Data quality recommendations
  const highSeverityIssues = attempts.issues.filter(
    (i) => i.severity === "high"
  ).length;
  if (highSeverityIssues > 0) {
    recommendations.push(
      `⚠️ Found ${highSeverityIssues} high-severity time data issues. ` +
        `Review extremely long times (>4 hours) for potential data corruption.`
    );
  }

  const zeroTimePercent =
    (attempts.summary.zeroTimeRecords / attempts.totalRecords) * 100;
  if (zeroTimePercent > 10) {
    recommendations.push(
      `📊 ${Math.round(zeroTimePercent)}% of attempts have zero time values. ` +
        `This may indicate timer functionality issues or data collection problems.`
    );
  }

  // Performance recommendations
  const avgTimeMinutes = AccurateTimer.secondsToMinutes(
    attempts.timeStatistics.average
  );
  if (avgTimeMinutes > 60) {
    recommendations.push(
      `⏱️ Average problem solving time is ${Math.round(
        avgTimeMinutes
      )} minutes. ` +
        `This is higher than typical and may indicate data unit issues.`
    );
  }

  // Migration recommendations
  const unitIssues = attempts.issues.filter(
    (i) => i.type === "possible_unit_confusion"
  ).length;
  if (unitIssues > attempts.totalRecords * 0.1) {
    recommendations.push(
      `🔧 Found ${unitIssues} records with possible unit confusion. ` +
        `Consider running time data migration to standardize units.`
    );
  }

  return recommendations;
}

/**
 * Repair time data issues automatically where possible
 * @param {Object} options - Repair options
 * @returns {Promise<Object>} Repair results
 */
export async function repairTimeData(options = {}) {
  const {
    dryRun = false,
    fixZeroTimes = false,
    fixExtremeTimes = false,
    backupFirst = true,
  } = options;


  const repairResults = {
    timestamp: new Date().toISOString(),
    backupId: null,
    repairedRecords: 0,
    errorRecords: 0,
    errors: [],
    dryRun,
  };

  try {
    // Create backup if requested
    if (backupFirst && !dryRun) {
      repairResults.backupId = await timeMigration.backupTimeData();
    }

    // Get current audit
    const audit = await auditAttemptsTimeData();

    if (!dryRun) {
      const db = await dbHelper.openDB();
      const transaction = db.transaction(["attempts"], "readwrite");
      const store = transaction.objectStore("attempts");

      for (const issue of audit.issues) {
        await _processIssueForRepair(issue, store, fixZeroTimes, fixExtremeTimes, repairResults);
      }
    }

    return repairResults;
  } catch (error) {
    console.error("❌ Repair failed:", error);
    repairResults.error = error.message;
    return repairResults;
  }
}

/**
 * Generate a human-readable audit report
 * @param {Object} auditResults - Results from auditAllTimeData()
 * @returns {string} Formatted report
 */
export function generateAuditReport(auditResults) {
  const report = [];

  report.push("# CodeMaster Time Data Audit Report");
  report.push(`Generated: ${auditResults.timestamp}`);
  report.push("");

  if (auditResults.error) {
    report.push(`❌ Audit failed: ${auditResults.error}`);
    return report.join("\n");
  }

  // Summary
  const attempts = auditResults.attempts;
  report.push("## Summary");
  report.push(`- Total attempt records: ${attempts.totalRecords}`);
  report.push(`- Records with issues: ${attempts.issues.length}`);
  report.push(`- Zero time records: ${attempts.summary.zeroTimeRecords}`);
  report.push(`- Extreme time records: ${attempts.summary.extremeTimeRecords}`);
  report.push(
    `- Average time: ${AccurateTimer.formatTime(
      attempts.timeStatistics.average
    )}`
  );
  report.push(
    `- Median time: ${AccurateTimer.formatTime(attempts.timeStatistics.median)}`
  );
  report.push("");

  // Unit analysis
  report.push("## Time Unit Analysis");
  report.push(`- Detected unit: ${attempts.unitAnalysis.unit}`);
  report.push(
    `- Confidence: ${Math.round(attempts.unitAnalysis.confidence * 100)}%`
  );
  report.push(
    `- Sample values: [${
      attempts.unitAnalysis.sampleValues?.join(", ") || "none"
    }]`
  );
  report.push("");

  // Issues by severity
  const highIssues = attempts.issues.filter((i) => i.severity === "high");
  const _mediumIssues = attempts.issues.filter((i) => i.severity === "medium");
  const _lowIssues = attempts.issues.filter((i) => i.severity === "low");

  if (highIssues.length > 0) {
    report.push("## High Severity Issues");
    highIssues.slice(0, 10).forEach((issue) => {
      report.push(`- ${issue.message} (Record: ${issue.recordId})`);
    });
    if (highIssues.length > 10) {
      report.push(`... and ${highIssues.length - 10} more`);
    }
    report.push("");
  }

  // Recommendations
  if (auditResults.recommendations.length > 0) {
    report.push("## Recommendations");
    auditResults.recommendations.forEach((rec) => {
      report.push(`- ${rec}`);
    });
    report.push("");
  }

  return report.join("\n");
}

/**
 * Process a single issue for repair
 * @private
 */
async function _processIssueForRepair(issue, store, fixZeroTimes, fixExtremeTimes, repairResults) {
  try {
    // Decide what to fix based on options and issue type
    const fixConfig = _determineFixAction(issue, fixZeroTimes, fixExtremeTimes);
    
    if (fixConfig.shouldFix) {
      await _applyRecordFix(store, issue.recordId, fixConfig.newValue, repairResults);
    }
  } catch (error) {
    repairResults.errorRecords++;
    repairResults.errors.push({
      recordId: issue.recordId,
      error: error.message,
    });
    console.error(`❌ Failed to repair record ${issue.recordId}:`, error);
  }
}

/**
 * Determine if and how to fix a time data issue
 * @private
 */
function _determineFixAction(issue, fixZeroTimes, fixExtremeTimes) {
  let shouldFix = false;
  let newValue = null;

  if (fixZeroTimes && issue.type === "zero_time") {
    shouldFix = true;
    newValue = 60; // Default to 1 minute for zero times
  } else if (fixExtremeTimes && issue.type === "extreme_long_time") {
    shouldFix = true;
    newValue = Math.min(issue.value, 14400); // Cap at 4 hours
  }

  return { shouldFix, newValue };
}

/**
 * Apply fix to a specific record
 * @private
 */
async function _applyRecordFix(store, recordId, newValue, repairResults) {
  // Get the record and update it
  const getRequest = await new Promise((resolve, reject) => {
    const req = store.get(recordId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (getRequest) {
    getRequest.time_spent = newValue;
    await new Promise((resolve, reject) => {
      const putRequest = store.put(getRequest);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });

    repairResults.repairedRecords++;
  }
}

export default {
  auditAllTimeData,
  auditAttemptsTimeData,
  repairTimeData,
  generateAuditReport,
};
