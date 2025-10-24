import logger from "../utils/logger.js";
import performanceMonitor from "../utils/PerformanceMonitor.js";
import { ErrorReportService } from "./ErrorReportService.js";
import { UserActionTracker } from "./UserActionTracker.js";

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

    // Update thresholds from config
    this.thresholds = { ...this.thresholds, ...config.thresholds };

    // Setup alert channels
    this.setupDefaultChannels();

    // Start monitoring loops
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

    // Add metadata to alert
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

  /**
   * Get alert statistics
   */
  static getAlertStatistics() {
    try {
      const alerts = JSON.parse(
        localStorage.getItem("codemaster_alerts") || "[]"
      );
      const last24Hours = alerts.filter(
        (a) =>
          new Date(a.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
      );

      const stats = {
        total24h: last24Hours.length,
        bySeverity: {},
        byType: {},
        recentAlerts: alerts.slice(-5),
      };

      last24Hours.forEach((alert) => {
        stats.bySeverity[alert.severity] =
          (stats.bySeverity[alert.severity] || 0) + 1;
        stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
      });

      return stats;
    } catch (error) {
      return { total24h: 0, bySeverity: {}, byType: {}, recentAlerts: [] };
    }
  }

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
   * Session Consistency Alert Methods
   * These methods handle habit-based reminders and consistency notifications
   */

  /**
   * Trigger a streak protection alert
   * @param {number} streakDays - Current streak length
   * @param {number} daysSince - Days since last session
   */
  static triggerStreakAlert(streakDays, daysSince) {
    this.queueAlert({
      type: "streak_protection",
      severity: "warning",
      title: "Practice Streak at Risk",
      message: `Don't break your ${streakDays}-day streak! It's been ${daysSince} days since your last session.`,
      category: "consistency",
      data: {
        streakDays,
        daysSince,
        alertType: "streak_protection",
        priority: "high"
      },
      actions: [
        {
          label: "Start Quick Session",
          handler: () => this.routeToSession("streak_recovery")
        },
        {
          label: "Remind Me Later",
          handler: () => this.snoozeAlert("streak_protection", 2 * 60 * 60 * 1000) // 2 hours
        }
      ]
    });
  }

  /**
   * Trigger a cadence nudge alert
   * @param {number} typicalGap - User's typical gap between sessions
   * @param {number} actualGap - Current gap since last session
   */
  static triggerCadenceAlert(typicalGap, actualGap) {
    this.queueAlert({
      type: "cadence_nudge",
      severity: "info",
      title: "Practice Cadence Reminder",
      message: `You usually practice every ${Math.round(typicalGap)} days — it's been ${Math.floor(actualGap)}. Ready for a quick session?`,
      category: "consistency",
      data: {
        typicalGap,
        actualGap,
        alertType: "cadence_nudge",
        priority: "medium"
      },
      actions: [
        {
          label: "Start Session",
          handler: () => this.routeToSession("cadence_practice")
        },
        {
          label: "Skip Today",
          handler: () => this.dismissAlert("cadence_nudge")
        }
      ]
    });
  }

  /**
   * Trigger a weekly goal reminder alert
   * @param {number} completed - Sessions completed this week
   * @param {number} goal - Weekly session goal
   * @param {number} daysLeft - Days remaining in week
   * @param {boolean} isMidWeek - Whether it's Wednesday (mid-week check)
   */
  static triggerWeeklyGoalAlert(completed, goal, daysLeft, isMidWeek) {
    const progressPercent = Math.round((completed / goal) * 100);
    const isWeekend = daysLeft <= 2;
    
    let message;
    if (isMidWeek) {
      message = `Halfway through the week! You've completed ${completed} of ${goal} sessions (${progressPercent}%).`;
    } else if (isWeekend) {
      message = `Weekend check: ${daysLeft} days left to hit your ${goal}-session goal. You're at ${completed}/${goal}.`;
    } else {
      message = `Weekly progress: ${completed} of ${goal} sessions completed (${progressPercent}%).`;
    }

    this.queueAlert({
      type: "weekly_goal",
      severity: progressPercent < 30 ? "warning" : "info",
      title: "Weekly Goal Update",
      message,
      category: "consistency",
      data: {
        completed,
        goal,
        daysLeft,
        progressPercent,
        isMidWeek,
        isWeekend,
        alertType: "weekly_goal",
        priority: "low"
      },
      actions: [
        {
          label: "Practice Now",
          handler: () => this.routeToSession("weekly_goal")
        },
        {
          label: "View Progress",
          handler: () => this.routeToProgress()
        }
      ]
    });
  }

  /**
   * Trigger a re-engagement alert for users who haven't practiced recently
   * @param {number} daysSince - Days since last session
   * @param {string} messageType - Type of re-engagement message (friendly_weekly, supportive_biweekly, gentle_monthly)
   */
  static triggerReEngagementAlert(daysSince, messageType) {
    const messages = {
      friendly_weekly: {
        title: "Ready to Jump Back In?",
        message: "It's been a week since your last session. Your coding progress is waiting for you!",
        severity: "info"
      },
      supportive_biweekly: {
        title: "No Pressure - We're Here",
        message: "Take your time! When you're ready, start with just one problem to get back into the flow.",
        severity: "info"
      },
      gentle_monthly: {
        title: "Your Coding Journey Continues",
        message: "We're here when you want to continue your coding journey. No rush, no pressure.",
        severity: "info"
      }
    };

    const messageConfig = messages[messageType] || messages.friendly_weekly;

    this.queueAlert({
      type: "re_engagement",
      severity: messageConfig.severity,
      title: messageConfig.title,
      message: messageConfig.message,
      category: "consistency",
      data: {
        daysSince,
        messageType,
        alertType: "re_engagement",
        priority: "low"
      },
      actions: [
        {
          label: "Start Easy Session",
          handler: () => this.routeToSession("re_engagement")
        },
        {
          label: "View Dashboard",
          handler: () => this.routeToDashboard()
        }
      ]
    });
  }

  /**
   * Handle generic consistency alerts from background script
   * @param {Array} alerts - Array of alert objects from consistency check
   */
  static handleConsistencyAlerts(alerts) {
    if (!alerts || alerts.length === 0) return;

    alerts.forEach(alert => {
      switch (alert.type) {
        case "streak_alert":
          this.triggerStreakAlert(
            alert.data?.currentStreak || 0,
            alert.data?.daysSince || 0
          );
          break;
        
        case "cadence_nudge":
          this.triggerCadenceAlert(
            alert.data?.typicalGap || 2,
            alert.data?.actualGap || 3
          );
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

  /**
   * Navigation helper methods for consistency alerts
   */

  /**
   * Route to session generation with context
   * @param {string} context - Context for why the session is being started
   */
  static routeToSession(context) {
    try {
      logger.info(`🚀 Routing to session generation - context: ${context}`);
      
      // Try to use existing navigation service if available
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
          const result = chrome.runtime.sendMessage({
            type: 'navigate',
            route: '/session-generator',
            context: context
          });
          if (result && typeof result.catch === 'function') {
            result.catch((error) => {
              logger.warn("Failed to send navigation message (async):", error);
            });
          }
        } catch (error) {
          logger.warn("Failed to send navigation message (sync):", error);
        }
      } else if (window.location) {
        // Fallback for web context
        window.location.hash = '/session-generator';
      }
    } catch (error) {
      logger.error("Error routing to session:", error);
      this.fallbackRoute();
    }
  }

  /**
   * Route to progress/dashboard page
   */
  static routeToProgress() {
    try {
      logger.info("📊 Routing to progress dashboard");
      
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
          const result = chrome.runtime.sendMessage({
            type: 'navigate',
            route: '/progress'
          });
          if (result && typeof result.catch === 'function') {
            result.catch((error) => {
              logger.warn("Failed to send progress navigation message (async):", error);
            });
          }
        } catch (error) {
          logger.warn("Failed to send progress navigation message (sync):", error);
        }
      } else if (window.location) {
        window.location.hash = '/progress';
      }
    } catch (error) {
      logger.error("Error routing to progress:", error);
      this.fallbackRoute();
    }
  }

  /**
   * Route to main dashboard
   */
  static routeToDashboard() {
    try {
      logger.info("🏠 Routing to main dashboard");
      
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
          const result = chrome.runtime.sendMessage({
            type: 'navigate',
            route: '/'
          });
          if (result && typeof result.catch === 'function') {
            result.catch((error) => {
              logger.warn("Failed to send dashboard navigation message (async):", error);
            });
          }
        } catch (error) {
          logger.warn("Failed to send dashboard navigation message (sync):", error);
        }
      } else if (window.location) {
        window.location.hash = '/';
      }
    } catch (error) {
      logger.error("Error routing to dashboard:", error);
      this.fallbackRoute();
    }
  }

  /**
   * Fallback routing when other methods fail
   */
  static fallbackRoute() {
    if (window.location) {
      // Try to reload current page or go to dashboard
      window.location.reload();
    }
  }

  /**
   * Snooze an alert for a specified duration
   * @param {string} alertType - Type of alert to snooze
   * @param {number} duration - Duration in milliseconds
   */
  static snoozeAlert(alertType, duration) {
    logger.info(`😴 Snoozing ${alertType} alert for ${duration / 1000 / 60} minutes`);
    
    // Store snooze info in localStorage
    const snoozeKey = `alert_snooze_${alertType}`;
    const snoozeUntil = Date.now() + duration;
    
    try {
      localStorage.setItem(snoozeKey, snoozeUntil.toString());
      
      // Set timeout to clear snooze
      setTimeout(() => {
        localStorage.removeItem(snoozeKey);
        logger.info(`⏰ Snooze cleared for ${alertType}`);
      }, duration);
      
    } catch (error) {
      logger.error("Error setting alert snooze:", error);
    }
  }

  /**
   * Check if an alert type is currently snoozed
   * @param {string} alertType - Type of alert to check
   * @returns {boolean} Whether the alert is snoozed
   */
  static isAlertSnoozed(alertType) {
    const snoozeKey = `alert_snooze_${alertType}`;
    
    try {
      const snoozeUntil = localStorage.getItem(snoozeKey);
      if (!snoozeUntil) return false;
      
      const snoozeTime = parseInt(snoozeUntil, 10);
      const isStillSnoozed = Date.now() < snoozeTime;
      
      if (!isStillSnoozed) {
        // Snooze expired, clean up
        localStorage.removeItem(snoozeKey);
      }
      
      return isStillSnoozed;
    } catch (error) {
      logger.error("Error checking alert snooze:", error);
      return false;
    }
  }

  /**
   * Dismiss an alert without snoozing
   * @param {string} alertType - Type of alert to dismiss
   */
  static dismissAlert(alertType) {
    logger.info(`✖️ Dismissing ${alertType} alert`);
    
    // Remove from queue if present
    this.alertQueue = this.alertQueue.filter(alert => alert.type !== alertType);
    
    // Log dismissal for analytics
    try {
      const dismissalEvent = {
        type: "alert_dismissed",
        alertType,
        timestamp: new Date().toISOString()
      };
      
      // Store dismissal analytics
      const dismissals = JSON.parse(localStorage.getItem("alert_dismissals") || "[]");
      dismissals.push(dismissalEvent);
      
      // Keep only last 50 dismissals
      const recentDismissals = dismissals.slice(-50);
      localStorage.setItem("alert_dismissals", JSON.stringify(recentDismissals));
      
    } catch (error) {
      logger.warn("Could not log alert dismissal:", error);
    }
  }

  // ===== HABIT-BASED REMINDER NOTIFICATIONS =====
  // Desktop-only notifications for re-engagement and habit formation

  /**
   * Send streak alert desktop notification
   * @param {number} currentStreak - Current streak count
   * @param {number} daysSince - Days since last session
   */
  static sendStreakAlert(currentStreak, daysSince) {
    if (typeof chrome === "undefined" || !chrome?.notifications) {
      logger.warn("Chrome notifications API not available");
      return;
    }

    const message = currentStreak > 0 
      ? `Your ${currentStreak}-day streak is at risk! It's been ${daysSince} days since your last session.`
      : `Let's start building your coding streak! It's been ${daysSince} days since your last session.`;

    chrome.notifications.create({
      type: "basic",
      iconUrl: "/icon48.png",
      title: "🔥 Coding Streak Alert",
      message,
      buttons: [
        { title: "Start Session" },
        { title: "Remind Later" }
      ]
    });

    logger.info(`🔥 Sent streak alert notification: ${currentStreak} streak, ${daysSince} days`);
  }

  /**
   * Send cadence nudge desktop notification
   * @param {string} typicalCadence - User's typical coding cadence
   * @param {number} daysSince - Days since last session
   */
  static sendCadenceNudge(typicalCadence, daysSince) {
    if (typeof chrome === "undefined" || !chrome?.notifications) {
      logger.warn("Chrome notifications API not available");
      return;
    }

    const message = `You typically code ${typicalCadence}. It's been ${daysSince} days since your last session.`;

    chrome.notifications.create({
      type: "basic",
      iconUrl: "/icon48.png",
      title: "⏰ Coding Routine Reminder",
      message,
      buttons: [
        { title: "Quick Session" },
        { title: "Schedule Later" }
      ]
    });

    logger.info(`⏰ Sent cadence nudge: ${typicalCadence}, ${daysSince} days`);
  }

  /**
   * Send weekly goal reminder desktop notification
   * @param {Object} weeklyProgress - Weekly progress data
   */
  static sendWeeklyGoalReminder(weeklyProgress) {
    if (typeof chrome === "undefined" || !chrome?.notifications) {
      logger.warn("Chrome notifications API not available");
      return;
    }

    const { completedSessions, targetSessions, remainingDays } = weeklyProgress;
    const remaining = Math.max(0, targetSessions - completedSessions);

    const message = remaining > 0
      ? `${remaining} sessions remaining to hit your weekly goal! ${remainingDays} days left.`
      : `🎉 Weekly goal achieved! You've completed ${completedSessions} sessions this week.`;

    chrome.notifications.create({
      type: "basic",
      iconUrl: "/icon48.png",
      title: "📊 Weekly Goal Update",
      message,
      buttons: remaining > 0 
        ? [{ title: "Start Session" }, { title: "Adjust Goal" }]
        : [{ title: "View Progress" }, { title: "Set Next Goal" }]
    });

    logger.info(`📊 Sent weekly goal reminder: ${completedSessions}/${targetSessions}, ${remainingDays} days left`);
  }

  /**
   * Send re-engagement prompt desktop notification
   * @param {number} daysSince - Days since last activity
   * @param {string} lastActivity - Description of last activity
   */
  static sendReEngagementPrompt(daysSince, lastActivity = "session") {
    if (typeof chrome === "undefined" || !chrome?.notifications) {
      logger.warn("Chrome notifications API not available");
      return;
    }

    let message, title;

    if (daysSince <= 3) {
      title = "👋 Ready for another session?";
      message = `It's been ${daysSince} days since your last ${lastActivity}. Keep the momentum going!`;
    } else if (daysSince <= 7) {
      title = "🚀 Let's get back to coding";
      message = `It's been ${daysSince} days since your last ${lastActivity}. A quick session can rebuild your rhythm.`;
    } else {
      title = "💪 Time to restart your coding journey";
      message = `It's been ${daysSince} days since your last ${lastActivity}. Every expert was once a beginner - let's begin again!`;
    }

    chrome.notifications.create({
      type: "basic",
      iconUrl: "/icon48.png",
      title,
      message,
      buttons: [
        { title: "Start Learning" },
        { title: "Not Now" }
      ]
    });

    logger.info(`👋 Sent re-engagement prompt: ${daysSince} days since ${lastActivity}`);
  }

  /**
   * Send focus area recommendation desktop notification
   * @param {string} focusArea - Recommended focus area
   * @param {string} reason - Reason for recommendation
   */
  static sendFocusAreaReminder(focusArea, reason) {
    if (typeof chrome === "undefined" || !chrome?.notifications) {
      logger.warn("Chrome notifications API not available");
      return;
    }

    chrome.notifications.create({
      type: "basic",
      iconUrl: "/icon48.png",
      title: "🎯 Focus Area Suggestion",
      message: `Time to work on ${focusArea}. ${reason}`,
      buttons: [
        { title: "Practice Now" },
        { title: "Change Focus" }
      ]
    });

    logger.info(`🎯 Sent focus area reminder: ${focusArea} - ${reason}`);
  }
}

export default AlertingService;
