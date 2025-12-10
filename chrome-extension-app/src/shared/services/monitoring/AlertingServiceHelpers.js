/**
 * Alerting Service Helpers - Consistency Alerts and Desktop Notifications
 */

import logger from "../../utils/logging/logger.js";

/**
 * Trigger a streak protection alert
 */
export function triggerStreakAlert(queueAlert, routeToSession, snoozeAlert, streakDays, daysSince) {
  queueAlert({
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
      { label: "Start Quick Session", handler: () => routeToSession("streak_recovery") },
      { label: "Remind Me Later", handler: () => snoozeAlert("streak_protection", 2 * 60 * 60 * 1000) }
    ]
  });
}

/**
 * Trigger a cadence nudge alert
 */
export function triggerCadenceAlert(queueAlert, routeToSession, dismissAlert, typicalGap, actualGap) {
  queueAlert({
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
      { label: "Start Session", handler: () => routeToSession("cadence_practice") },
      { label: "Skip Today", handler: () => dismissAlert("cadence_nudge") }
    ]
  });
}

/**
 * Trigger a weekly goal reminder alert
 */
export function triggerWeeklyGoalAlert(queueAlert, routeToSession, routeToProgress, goalData) {
  const { completed, goal, daysLeft, isMidWeek } = goalData;
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

  queueAlert({
    type: "weekly_goal",
    severity: progressPercent < 30 ? "warning" : "info",
    title: "Weekly Goal Update",
    message,
    category: "consistency",
    data: {
      completed, goal, daysLeft, progressPercent, isMidWeek, isWeekend,
      alertType: "weekly_goal",
      priority: "low"
    },
    actions: [
      { label: "Practice Now", handler: () => routeToSession("weekly_goal") },
      { label: "View Progress", handler: () => routeToProgress() }
    ]
  });
}

/**
 * Trigger a re-engagement alert
 */
export function triggerReEngagementAlert(queueAlert, routeToSession, routeToDashboard, daysSince, messageType) {
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

  queueAlert({
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
      { label: "Start Easy Session", handler: () => routeToSession("re_engagement") },
      { label: "View Dashboard", handler: () => routeToDashboard() }
    ]
  });
}

/**
 * Route to session generation with context
 */
export function routeToSession(context) {
  try {
    logger.info(`🚀 Routing to session generation - context: ${context}`);

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
    } else if (typeof window !== 'undefined' && window.location) {
      window.location.hash = '/session-generator';
    }
  } catch (error) {
    logger.error("Error routing to session:", error);
    fallbackRoute();
  }
}

/**
 * Route to progress/dashboard page
 */
export function routeToProgress() {
  try {
    logger.info("📊 Routing to progress dashboard");

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        const result = chrome.runtime.sendMessage({ type: 'navigate', route: '/progress' });
        if (result && typeof result.catch === 'function') {
          result.catch((error) => { logger.warn("Failed to send progress navigation message (async):", error); });
        }
      } catch (error) {
        logger.warn("Failed to send progress navigation message (sync):", error);
      }
    } else if (typeof window !== 'undefined' && window.location) {
      window.location.hash = '/progress';
    }
  } catch (error) {
    logger.error("Error routing to progress:", error);
    fallbackRoute();
  }
}

/**
 * Route to main dashboard
 */
export function routeToDashboard() {
  try {
    logger.info("🏠 Routing to main dashboard");

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      try {
        const result = chrome.runtime.sendMessage({ type: 'navigate', route: '/' });
        if (result && typeof result.catch === 'function') {
          result.catch((error) => { logger.warn("Failed to send dashboard navigation message (async):", error); });
        }
      } catch (error) {
        logger.warn("Failed to send dashboard navigation message (sync):", error);
      }
    } else if (typeof window !== 'undefined' && window.location) {
      window.location.hash = '/';
    }
  } catch (error) {
    logger.error("Error routing to dashboard:", error);
    fallbackRoute();
  }
}

/**
 * Fallback routing when other methods fail
 */
export function fallbackRoute() {
  if (typeof window !== 'undefined' && window.location) {
    window.location.reload();
  }
}

/**
 * Send streak alert desktop notification
 */
export function sendStreakAlert(currentStreak, daysSince) {
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
    buttons: [{ title: "Start Session" }, { title: "Remind Later" }]
  });

  logger.info(`🔥 Sent streak alert notification: ${currentStreak} streak, ${daysSince} days`);
}

/**
 * Send cadence nudge desktop notification
 */
export function sendCadenceNudge(typicalCadence, daysSince) {
  if (typeof chrome === "undefined" || !chrome?.notifications) {
    logger.warn("Chrome notifications API not available");
    return;
  }

  chrome.notifications.create({
    type: "basic",
    iconUrl: "/icon48.png",
    title: "⏰ Coding Routine Reminder",
    message: `You typically code ${typicalCadence}. It's been ${daysSince} days since your last session.`,
    buttons: [{ title: "Quick Session" }, { title: "Schedule Later" }]
  });

  logger.info(`⏰ Sent cadence nudge: ${typicalCadence}, ${daysSince} days`);
}

/**
 * Send weekly goal reminder desktop notification
 */
export function sendWeeklyGoalReminder(weeklyProgress) {
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
 */
export function sendReEngagementPrompt(daysSince, lastActivity = "session") {
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
    buttons: [{ title: "Start Learning" }, { title: "Not Now" }]
  });

  logger.info(`👋 Sent re-engagement prompt: ${daysSince} days since ${lastActivity}`);
}

/**
 * Send focus area recommendation desktop notification
 */
export function sendFocusAreaReminder(focusArea, reason) {
  if (typeof chrome === "undefined" || !chrome?.notifications) {
    logger.warn("Chrome notifications API not available");
    return;
  }

  chrome.notifications.create({
    type: "basic",
    iconUrl: "/icon48.png",
    title: "🎯 Focus Area Suggestion",
    message: `Time to work on ${focusArea}. ${reason}`,
    buttons: [{ title: "Practice Now" }, { title: "Change Focus" }]
  });

  logger.info(`🎯 Sent focus area reminder: ${focusArea} - ${reason}`);
}

/**
 * Snooze an alert for a specified duration
 */
export function snoozeAlert(alertType, duration) {
  logger.info(`😴 Snoozing ${alertType} alert for ${duration / 1000 / 60} minutes`);

  const snoozeKey = `alert_snooze_${alertType}`;
  const snoozeUntil = Date.now() + duration;

  try {
    localStorage.setItem(snoozeKey, snoozeUntil.toString());

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
 */
export function isAlertSnoozed(alertType) {
  const snoozeKey = `alert_snooze_${alertType}`;

  try {
    const snoozeUntil = localStorage.getItem(snoozeKey);
    if (!snoozeUntil) return false;

    const snoozeTime = parseInt(snoozeUntil, 10);
    const isStillSnoozed = Date.now() < snoozeTime;

    if (!isStillSnoozed) {
      localStorage.removeItem(snoozeKey);
    }

    return isStillSnoozed;
  } catch (error) {
    logger.error("Error checking alert snooze:", error);
    return false;
  }
}

/**
 * Dismiss an alert - returns filter function for alert queue
 */
export function createDismissHandler(alertType) {
  logger.info(`✖️ Dismissing ${alertType} alert`);

  try {
    const dismissalEvent = {
      type: "alert_dismissed",
      alertType,
      timestamp: new Date().toISOString()
    };

    const dismissals = JSON.parse(localStorage.getItem("alert_dismissals") || "[]");
    dismissals.push(dismissalEvent);

    const recentDismissals = dismissals.slice(-50);
    localStorage.setItem("alert_dismissals", JSON.stringify(recentDismissals));
  } catch (error) {
    logger.warn("Could not log alert dismissal:", error);
  }

  return (alert) => alert.type !== alertType;
}

/**
 * Get alert statistics from localStorage
 */
export function getAlertStatistics() {
  try {
    const alerts = JSON.parse(localStorage.getItem("codemaster_alerts") || "[]");
    const last24Hours = alerts.filter(
      (a) => new Date(a.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
    );

    const stats = {
      total24h: last24Hours.length,
      bySeverity: {},
      byType: {},
      recentAlerts: alerts.slice(-5),
    };

    last24Hours.forEach((alert) => {
      stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;
      stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
    });

    return stats;
  } catch (error) {
    return { total24h: 0, bySeverity: {}, byType: {}, recentAlerts: [] };
  }
}
