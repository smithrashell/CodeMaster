/**
 * Integrity Monitoring Functions
 * Extracted from DataIntegrityCheckService
 */

import ReferentialIntegrityService from "./ReferentialIntegrityService.js";
import logger from "../../utils/logger.js";

/**
 * Start periodic integrity monitoring
 */
export function startPeriodicMonitoring(service, config = {}) {
  const {
    quickCheckInterval = service.INTERVALS.FREQUENT,
    fullCheckInterval = service.INTERVALS.DAILY,
    autoRepair = false,
  } = config;

  logger.info("Starting periodic data integrity monitoring...");

  if (!service.monitoringIntervals.has("quick")) {
    const quickInterval = setInterval(async () => {
      try {
        logger.info("Running quick integrity check...");
        const result = await service.performIntegrityCheck({
          checkType: service.CHECK_TYPES.QUICK,
          priority: service.PRIORITIES.LOW,
          saveToHistory: true,
        });

        if (!result.overall.valid && result.overall.errors > 0) {
          logger.warn(`Quick check found ${result.overall.errors} errors`);
          await notifyIntegrityIssues("quick_check", result);
        }
      } catch (error) {
        logger.error("Quick integrity check failed:", error);
      }
    }, quickCheckInterval);

    service.monitoringIntervals.set("quick", quickInterval);
    logger.info(`Quick checks scheduled every ${quickCheckInterval / 1000 / 60} minutes`);
  }

  if (!service.monitoringIntervals.has("full")) {
    const fullInterval = setInterval(async () => {
      try {
        logger.info("Running full integrity check...");
        const result = await service.performIntegrityCheck({
          checkType: service.CHECK_TYPES.FULL,
          priority: service.PRIORITIES.MEDIUM,
          saveToHistory: true,
        });

        if (result.overall.score < 80) {
          logger.warn(`Full check score: ${result.overall.score}%`);
          await notifyIntegrityIssues("full_check", result);
        }

        if (autoRepair && result.results.referential?.repairSuggestions) {
          const safeRepairs =
            result.results.referential.repairSuggestions.filter(
              (s) => s.automated && s.risk === "low"
            );

          if (safeRepairs.length > 0) {
            logger.info(`Auto-repairing ${safeRepairs.length} low-risk issues...`);
            await ReferentialIntegrityService.executeRepairs(safeRepairs, {
              automatedOnly: true,
              createBackup: true,
            });
          }
        }
      } catch (error) {
        logger.error("Full integrity check failed:", error);
      }
    }, fullCheckInterval);

    service.monitoringIntervals.set("full", fullInterval);
    logger.info(`Full checks scheduled every ${fullCheckInterval / 1000 / 60 / 60} hours`);
  }

  logger.info("Periodic integrity monitoring started");
}

/**
 * Stop periodic monitoring
 */
export function stopPeriodicMonitoring(service) {
  logger.info("Stopping periodic integrity monitoring...");

  for (const [type, interval] of service.monitoringIntervals) {
    clearInterval(interval);
    logger.info(`Stopped ${type} monitoring`);
  }

  service.monitoringIntervals.clear();
  logger.info("All periodic monitoring stopped");
}

/**
 * Get monitoring status
 */
export function getMonitoringStatus(service) {
  return {
    active: service.monitoringIntervals.size > 0,
    intervals: Array.from(service.monitoringIntervals.keys()),
    lastChecks: Object.fromEntries(service.lastCheck),
    historySize: service.checkHistory.length,
    nextScheduledCheck: getNextScheduledCheck(service),
  };
}

/**
 * Get next scheduled check times
 */
export function getNextScheduledCheck(service) {
  const lastQuick = service.lastCheck.get(service.CHECK_TYPES.QUICK) || 0;
  const lastFull = service.lastCheck.get(service.CHECK_TYPES.FULL) || 0;

  const nextQuick = lastQuick + service.INTERVALS.FREQUENT;
  const nextFull = lastFull + service.INTERVALS.DAILY;

  return {
    nextQuick: new Date(nextQuick).toISOString(),
    nextFull: new Date(nextFull).toISOString(),
  };
}

/**
 * Notify about integrity issues
 */
export function notifyIntegrityIssues(checkType, result) {
  logger.warn(`Integrity issues detected in ${checkType}:`, {
    score: result.overall.score,
    errors: result.overall.errors,
    warnings: result.overall.warnings,
  });
}
