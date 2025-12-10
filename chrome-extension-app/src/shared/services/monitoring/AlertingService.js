import logger from "../../utils/logging/logger.js";
import performanceMonitor from "../../utils/performance/PerformanceMonitor.js";
import { ErrorReportService } from "./ErrorReportService.js";
import { UserActionTracker } from "../chrome/UserActionTracker.js";
import {
  triggerStreakAlert as triggerStreakAlertHelper,
  triggerCadenceAlert as triggerCadenceAlertHelper,
  triggerWeeklyGoalAlert as triggerWeeklyGoalAlertHelper,
  triggerReEngagementAlert as triggerReEngagementAlertHelper,
  routeToSession,
  routeToProgress,
  routeToDashboard,
  fallbackRoute,
  sendStreakAlert,
  sendCadenceNudge,
  sendWeeklyGoalReminder,
  sendReEngagementPrompt,
  sendFocusAreaReminder,
  snoozeAlert,
  isAlertSnoozed,
  createDismissHandler,
  getAlertStatistics,
} from "./AlertingServiceHelpers.js";

/**
 * Automated Alerting Service for production monitoring
 * Monitors system health and triggers alerts for critical issues
 */
export class AlertingService {
  static isActive = false;
  static alertQueue = [];
  static thresholds = {
    errorRate: 10, // % errors in last 100 requests
    crashRate: 5, // crashes per hour
    performanceDegraded: 2000, // ms average response time
    memoryUsage: 100 * 1024 * 1024, // 100MB
    userInactivity: 30 * 60 * 1000, // 30 minutes
    rapidErrors: 5, // errors in 5 minutes
  };

  static alertChannels = [];
  static lastAlerts = {};
  static suppressionPeriod = 5 * 60 * 1000; // 5 minutes between same alerts

  /**
   * Initialize alerting system with monitoring
   */
  static initialize(config = {}) {
    if (this.isActive) {
      return;
    }

    this.thresholds = { ...this.thresholds, ...config.thresholds };
    this.setupDefaultChannels();
    this.startMonitoring();

    this.isActive = true;
    logger.info("Alerting service initialized", {
      section: "alerting",
      thresholds: this.thresholds,
    });
  }

  /**
   * Setup default alert channels
   */
  static setupDefaultChannels() {
    // Console alerting (always available)
    this.addAlertChannel({
      name: "console",
      handler: (alert) => {
        const emoji = this.getAlertEmoji(alert.severity);
        logger.error(`${emoji} ALERT: ${alert.title}`, alert);
      },
    });

    // localStorage logging for debugging
    this.addAlertChannel({
      name: "localStorage",
      handler: (alert) => {
        try {
          const alerts = JSON.parse(
            localStorage.getItem("codemaster_alerts") || "[]"
          );
          alerts.push(alert);

          // Keep only last 20 alerts
          const recentAlerts = alerts.slice(-20);
          localStorage.setItem(
            "codemaster_alerts",
            JSON.stringify(recentAlerts)
          );
        } catch (error) {
          logger.warn("Failed to store alert in localStorage:", error);
        }
      },
    });

    // Browser notification (with permission)
    if ("Notification" in window) {
      this.addAlertChannel({
        name: "browser_notification",
        handler: (alert) => {
          if (
            alert.severity === "critical" &&
            Notification.permission === "granted"
          ) {
            new Notification(`CodeMaster Alert: ${alert.title}`, {
              body: alert.message,
              icon: "/icon.png", // Extension icon
            });
          }
        },
      });
    }
  }

  /**
   * Add custom alert channel
   */
  static addAlertChannel(channel) {
    if (!channel.name || !channel.handler) {
      throw new Error("Alert channel must have name and handler");
    }

    this.alertChannels.push(channel);
    logger.debug(`Alert channel '${channel.name}' added`, {
      section: "alerting",
    });
  }

  /**
   * Remove alert channel
   */
  static removeAlertChannel(channelName) {
    const index = this.alertChannels.findIndex((c) => c.name === channelName);
    if (index > -1) {
      this.alertChannels.splice(index, 1);
      logger.debug(`Alert channel '${channelName}' removed`, {
        section: "alerting",
      });
    }
  }

  /**
   * Start monitoring loops for different metrics
   */
  static startMonitoring() {
    // Monitor performance every 30 seconds
    setInterval(() => {
      this.checkPerformanceHealth();
    }, 30000);

    // Monitor errors every minute
    setInterval(() => {
      this.checkErrorPatterns();
    }, 60000);

    // Monitor crashes every 2 minutes
    setInterval(() => {
      this.checkCrashPatterns();
    }, 120000);

    // Monitor system resources every minute
    setInterval(() => {
      this.checkResourceUsage();
    }, 60000);

    // Process alert queue every 10 seconds
    setInterval(() => {
      this.processAlertQueue();
    }, 10000);
  }

  /**
   * Check performance health metrics
   */
  static checkPerformanceHealth() {
    try {
      const summary = performanceMonitor.getPerformanceSummary();

      // Check average query time
      if (
        summary.systemMetrics.averageQueryTime >
        this.thresholds.performanceDegraded
      ) {
        this.queueAlert({
          type: "performance_degraded",
          severity: "warning",
          title: "Performance Degradation Detected",
          message: `Average query time is ${summary.systemMetrics.averageQueryTime.toFixed(
            2
          )}ms (threshold: ${this.thresholds.performanceDegraded}ms)`,
          data: summary.systemMetrics,
        });
      }

      // Check error rate
      if (summary.systemMetrics.errorRate > this.thresholds.errorRate) {
        this.queueAlert({
          type: "high_error_rate",
          severity: "error",
          title: "High Error Rate Detected",
          message: `Error rate is ${summary.systemMetrics.errorRate.toFixed(
            2
          )}% (threshold: ${this.thresholds.errorRate}%)`,
          data: summary.systemMetrics,
        });
      }

      // Check system health
      if (summary.health === "critical") {
        this.queueAlert({
          type: "system_health_critical",
          severity: "critical",
          title: "System Health Critical",
          message: "Multiple performance indicators show critical status",
          data: summary,
        });
      }
    } catch (error) {
      logger.error(
        "Failed to check performance health",
        { section: "alerting" },
        error
      );
    }
  }

  /**
   * Check error patterns for concerning trends
   */
  static async checkErrorPatterns() {
    try {
      const recentErrors = await ErrorReportService.getErrorReports({
        since: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // Last 5 minutes
        resolved: false,
      });

      // Check for rapid errors
      if (recentErrors.length > this.thresholds.rapidErrors) {
        this.queueAlert({
          type: "rapid_errors",
          severity: "error",
          title: "Rapid Error Pattern Detected",
          message: `${recentErrors.length} errors in the last 5 minutes (threshold: ${this.thresholds.rapidErrors})`,
          data: {
            errorCount: recentErrors.length,
            errors: recentErrors.slice(0, 3), // First 3 errors for context
          },
        });
      }

      // Check for repeating error patterns
      const errorMessages = recentErrors.map((e) => e.message);
      const messageCount = {};
      errorMessages.forEach((msg) => {
        const key = msg.substring(0, 50);
        messageCount[key] = (messageCount[key] || 0) + 1;
      });

      const repeatingErrors = Object.entries(messageCount)
        .filter(([, count]) => count >= 3)
        .map(([message, count]) => ({ message, count }));

      if (repeatingErrors.length > 0) {
        this.queueAlert({
          type: "repeating_errors",
          severity: "warning",
          title: "Repeating Error Pattern Detected",
          message: `Same error occurring multiple times: ${repeatingErrors[0].message} (${repeatingErrors[0].count}x)`,
          data: repeatingErrors,
        });
      }
    } catch (error) {
      logger.error(
        "Failed to check error patterns",
        { section: "alerting" },
        error
      );
    }
  }

  /**
   * Check crash patterns for systemic issues
   */
  static checkCrashPatterns() {
    try {
      // This would integrate with CrashReporter if available
      if (window.CrashReporter) {
        const crashStats = window.CrashReporter.getCrashStatistics();

        if (crashStats.totalCrashes > this.thresholds.crashRate) {
          this.queueAlert({
            type: "high_crash_rate",
            severity: "critical",
            title: "High Crash Rate Detected",
            message: `Application has crashed ${crashStats.totalCrashes} times (threshold: ${this.thresholds.crashRate})`,
            data: crashStats,
          });
        }

        if (!crashStats.isHealthy) {
          this.queueAlert({
            type: "system_instability",
            severity: "error",
            title: "System Instability Detected",
            message: "Multiple crash indicators suggest system instability",
            data: crashStats,
          });
        }
      }
    } catch (error) {
      logger.error(
        "Failed to check crash patterns",
        { section: "alerting" },
        error
      );
    }
  }

  /**
   * Check system resource usage
   */
  static checkResourceUsage() {
    try {
      // Check memory usage
      if (performance.memory) {
        const memInfo = performance.memory;
        if (memInfo.usedJSHeapSize > this.thresholds.memoryUsage) {
          this.queueAlert({
            type: "high_memory_usage",
            severity: "warning",
            title: "High Memory Usage",
            message: `Memory usage is ${(
              memInfo.usedJSHeapSize /
              1024 /
              1024
            ).toFixed(2)}MB (threshold: ${(
              this.thresholds.memoryUsage /
              1024 /
              1024
            ).toFixed(2)}MB)`,
            data: memInfo,
          });
        }
      }

      // Check for potential memory leaks
      performanceMonitor.recordMemoryUsage(
        performance.memory?.usedJSHeapSize || 0,
        "alerting_check"
      );
    } catch (error) {
      logger.error(
        "Failed to check resource usage",
        { section: "alerting" },
        error
      );
    }
  }

  /**
   * Queue an alert for processing
   */
  static queueAlert(alert) {
    const alertKey = `${alert.type}_${alert.severity}`;
    const now = Date.now();

    // Check suppression period
    if (
      this.lastAlerts[alertKey] &&
      now - this.lastAlerts[alertKey] < this.suppressionPeriod
    ) {
      return; // Skip duplicate alerts within suppression period
    }

    const fullAlert = {
      id: `alert_${now}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      ...alert,
    };

    this.alertQueue.push(fullAlert);
    this.lastAlerts[alertKey] = now;

    logger.warn(`Alert queued: ${alert.title}`, {
      section: "alerting",
      alertType: alert.type,
      severity: alert.severity,
    });
  }

  /**
   * Process queued alerts
   */
  static processAlertQueue() {
    if (this.alertQueue.length === 0) {
      return;
    }

    const alertsToProcess = [...this.alertQueue];
    this.alertQueue = [];

    alertsToProcess.forEach((alert) => {
      this.sendAlert(alert);
    });
  }

  /**
   * Send alert to all configured channels
   */
  static sendAlert(alert) {
    this.alertChannels.forEach((channel) => {
      try {
        channel.handler(alert);
      } catch (error) {
        logger.error(`Failed to send alert via ${channel.name}:`, error);
      }
    });

    // Track alert in user actions for analytics
    UserActionTracker.trackAction({
      action: "alert_triggered",
      category: UserActionTracker.CATEGORIES.SYSTEM_INTERACTION,
      context: {
        alertType: alert.type,
        severity: alert.severity,
        title: alert.title,
      },
    });
  }

  /**
   * Get alert emoji for severity
   */
  static getAlertEmoji(severity) {
    const emojis = {
      info: "ℹ️",
      warning: "⚠️",
      error: "❌",
      critical: "🚨",
    };
    return emojis[severity] || "📢";
  }

  /**
   * Manually trigger an alert
   */
  static triggerAlert(type, message, severity = "info", data = {}) {
    this.queueAlert({
      type: `manual_${type}`,
      severity,
      title: `Manual Alert: ${type}`,
      message,
      data,
    });
  }

  static getAlertStatistics = getAlertStatistics;

  /**
   * Update alert thresholds
   */
  static updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info("Alert thresholds updated", {
      section: "alerting",
      thresholds: this.thresholds,
    });
  }

  /**
   * Enable/disable alerting
   */
  static setActive(active) {
    this.isActive = active;
    logger.info(`Alerting ${active ? "enabled" : "disabled"}`, {
      section: "alerting",
    });
  }

  /**
   * Clear all alerts
   */
  static clearAlerts() {
    this.alertQueue = [];
    this.lastAlerts = {};
    localStorage.removeItem("codemaster_alerts");
    logger.info("All alerts cleared", { section: "alerting" });
  }

  /**
   * Consistency alert wrappers - delegate to helper functions
   */
  static triggerStreakAlert(streakDays, daysSince) {
    triggerStreakAlertHelper(
      this.queueAlert.bind(this),
      routeToSession,
      this.snoozeAlert.bind(this),
      streakDays,
      daysSince
    );
  }

  static triggerCadenceAlert(typicalGap, actualGap) {
    triggerCadenceAlertHelper(
      this.queueAlert.bind(this),
      routeToSession,
      this.dismissAlert.bind(this),
      typicalGap,
      actualGap
    );
  }

  static triggerWeeklyGoalAlert(completed, goal, daysLeft, isMidWeek) {
    triggerWeeklyGoalAlertHelper(
      this.queueAlert.bind(this),
      routeToSession,
      routeToProgress,
      { completed, goal, daysLeft, isMidWeek }
    );
  }

  static triggerReEngagementAlert(daysSince, messageType) {
    triggerReEngagementAlertHelper(
      this.queueAlert.bind(this),
      routeToSession,
      routeToDashboard,
      daysSince,
      messageType
    );
  }

  static handleConsistencyAlerts(alerts) {
    if (!alerts || alerts.length === 0) return;

    alerts.forEach(alert => {
      switch (alert.type) {
        case "streak_alert":
          this.triggerStreakAlert(alert.data?.currentStreak || 0, alert.data?.daysSince || 0);
          break;
        case "cadence_nudge":
          this.triggerCadenceAlert(alert.data?.typicalGap || 2, alert.data?.actualGap || 3);
          break;
        case "weekly_goal":
          this.triggerWeeklyGoalAlert(
            alert.data?.completed || 0,
            alert.data?.goal || 3,
            alert.data?.daysLeft || 0,
            alert.data?.isMidWeek || false
          );
          break;
        case "re_engagement":
          this.triggerReEngagementAlert(
            alert.data?.daysSinceLastSession || 7,
            alert.data?.messageType || "friendly_weekly"
          );
          break;
        default:
          logger.warn(`Unknown consistency alert type: ${alert.type}`);
      }
    });
  }

  // Re-export navigation helpers for backwards compatibility
  static routeToSession = routeToSession;
  static routeToProgress = routeToProgress;
  static routeToDashboard = routeToDashboard;
  static fallbackRoute = fallbackRoute;

  // Snooze/dismiss wrappers
  static snoozeAlert = snoozeAlert;
  static isAlertSnoozed = isAlertSnoozed;

  static dismissAlert(alertType) {
    const filterFn = createDismissHandler(alertType);
    this.alertQueue = this.alertQueue.filter(filterFn);
  }

  // Re-export desktop notification helpers for backwards compatibility
  static sendStreakAlert = sendStreakAlert;
  static sendCadenceNudge = sendCadenceNudge;
  static sendWeeklyGoalReminder = sendWeeklyGoalReminder;
  static sendReEngagementPrompt = sendReEngagementPrompt;
  static sendFocusAreaReminder = sendFocusAreaReminder;
}

export default AlertingService;
