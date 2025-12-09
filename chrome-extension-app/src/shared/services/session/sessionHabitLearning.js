/**
 * Session Habit Learning Service
 * Extracted from sessionService.js - streak tracking and habit analysis
 */

import { getLatestSession } from "../../db/stores/sessions.js";
import { openDatabase } from "../../db/core/connectionUtils.js";
import { roundToPrecision } from "../../utils/leitner/Utils.js";
import logger from "../../utils/logging/logger.js";

/**
 * Circuit Breaker for Enhanced Habit Learning Features
 */
export class HabitLearningCircuitBreaker {
  static isOpen = false;
  static failureCount = 0;
  static MAX_FAILURES = 3;
  static lastFailureTime = null;
  static RECOVERY_TIMEOUT = 5 * 60 * 1000;

  static async safeExecute(enhancedFn, fallbackFn, operationName = "habit-learning") {
    if (this.isOpen && this.lastFailureTime) {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure > this.RECOVERY_TIMEOUT) {
        logger.info(`🔄 Circuit breaker reset for ${operationName} - attempting enhanced logic again`);
        this.isOpen = false;
        this.failureCount = 0;
      }
    }

    if (this.isOpen) {
      logger.info(`🚫 Circuit breaker open for ${operationName} - using fallback logic`);
      return await fallbackFn();
    }

    try {
      return await Promise.race([
        enhancedFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Enhanced function timeout')), 5000)
        )
      ]);
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      logger.warn(`⚠️ Enhanced ${operationName} failed (${this.failureCount}/${this.MAX_FAILURES}):`, error.message);

      if (this.failureCount >= this.MAX_FAILURES) {
        this.isOpen = true;
        logger.error(`🚨 Circuit breaker opened for ${operationName} - enhanced features disabled`);
      }

      return await fallbackFn();
    }
  }

  static getStatus() {
    return {
      isOpen: this.isOpen,
      failureCount: this.failureCount,
      maxFailures: this.MAX_FAILURES,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Streak and habit learning helper functions
 */
export const HabitLearningHelpers = {
  /**
   * Gets user's current practice streak
   */
  async getCurrentStreak() {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(["sessions"], "readonly");
      const store = transaction.objectStore("sessions");

      const sessions = [];
      return new Promise((resolve) => {
        const request = store.openCursor(null, "prev");
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && cursor.value.status === "completed") {
            sessions.push(cursor.value);
            cursor.continue();
          } else {
            resolve(this._calculateStreak(sessions));
          }
        };
        request.onerror = () => resolve(0);
      });
    } catch (error) {
      logger.error("Error calculating current streak:", error);
      return 0;
    }
  },

  _calculateStreak(sessions) {
    if (!sessions || sessions.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < sessions.length; i++) {
      const sessionDate = new Date(sessions[i].date);
      sessionDate.setHours(0, 0, 0, 0);

      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - streak);

      if (sessionDate.getTime() === expectedDate.getTime()) {
        streak++;
      } else if (sessionDate.getTime() < expectedDate.getTime()) {
        break;
      }
    }

    return streak;
  },

  async getTypicalCadence() {
    return await HabitLearningCircuitBreaker.safeExecute(
      async () => {
        const sessions = await this._getSessionsFromPeriod(30);
        return this._analyzeCadence(sessions);
      },
      () => {
        return {
          averageGapDays: 2,
          pattern: "daily",
          reliability: "low",
          totalSessions: 0,
          learningPhase: true,
          fallbackMode: true
        };
      },
      "cadence-analysis"
    );
  },

  async _getSessionsFromPeriod(days) {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - days);

    const db = await openDatabase();
    const transaction = db.transaction(["sessions"], "readonly");
    const store = transaction.objectStore("sessions");

    const sessions = [];
    return new Promise((resolve, reject) => {
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const session = cursor.value;
          if (session.status === "completed" &&
            new Date(session.date) >= periodStart) {
            sessions.push(session);
          }
          cursor.continue();
        } else {
          resolve(sessions);
        }
      };
      request.onerror = () => reject(new Error("Database query failed"));
    });
  },

  _analyzeCadence(sessions) {
    if (!sessions || sessions.length < 5) {
      return {
        averageGapDays: 2,
        pattern: "insufficient_data",
        reliability: "low",
        totalSessions: sessions?.length || 0,
        learningPhase: true,
        sessionsNeeded: Math.max(0, 5 - (sessions?.length || 0))
      };
    }

    sessions.sort((a, b) => new Date(a.date) - new Date(b.date));

    const gaps = [];
    for (let i = 1; i < sessions.length; i++) {
      const prevDate = new Date(sessions[i - 1].date);
      const currDate = new Date(sessions[i].date);
      const gapDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);
      if (gapDays > 0 && gapDays < 14) {
        gaps.push(gapDays);
      }
    }

    if (gaps.length === 0) {
      return {
        averageGapDays: 2,
        pattern: "insufficient_data",
        reliability: "low",
        totalSessions: sessions.length,
        learningPhase: true
      };
    }

    const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const variance = gaps.reduce((sum, gap) => sum + Math.pow(gap - averageGap, 2), 0) / gaps.length;
    const stdDev = Math.sqrt(variance);

    const sessionCountFactor = Math.min(sessions.length / 10, 1);
    const consistencyFactor = Math.max(0, 1 - (stdDev / 3));
    const confidenceScore = (sessionCountFactor * 0.6) + (consistencyFactor * 0.4);

    let pattern = "inconsistent";
    let reliability = "low";

    if (confidenceScore >= 0.7) {
      if (stdDev < 1) {
        pattern = "daily";
        reliability = "high";
      } else if (averageGap >= 1.5 && averageGap <= 2.5 && stdDev < 1.5) {
        pattern = "every_other_day";
        reliability = "high";
      } else if (averageGap >= 6 && averageGap <= 8 && stdDev < 2) {
        pattern = "weekly";
        reliability = "high";
      }
    } else if (confidenceScore >= 0.5) {
      if (stdDev < 1.5) {
        pattern = averageGap <= 1.5 ? "daily" : averageGap <= 3 ? "every_other_day" : "weekly";
        reliability = "medium";
      }
    }

    const firstSession = new Date(sessions[0].date);
    const lastSession = new Date(sessions[sessions.length - 1].date);
    const dataSpanDays = (lastSession - firstSession) / (1000 * 60 * 60 * 24);
    const learningPhase = dataSpanDays < 14;

    return {
      averageGapDays: Math.round(averageGap * 10) / 10,
      pattern,
      reliability,
      totalSessions: sessions.length,
      consistency: stdDev < 2 ? "consistent" : "variable",
      confidenceScore: roundToPrecision(confidenceScore),
      learningPhase,
      dataSpanDays: Math.round(dataSpanDays),
      standardDeviation: Math.round(stdDev * 10) / 10
    };
  },

  async getWeeklyProgress() {
    try {
      const today = new Date();
      const currentWeekStart = new Date(today);
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      currentWeekStart.setDate(today.getDate() + daysToMonday);
      currentWeekStart.setHours(0, 0, 0, 0);

      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
      currentWeekEnd.setHours(23, 59, 59, 999);

      const db = await openDatabase();
      const transaction = db.transaction(["sessions"], "readonly");
      const store = transaction.objectStore("sessions");

      const currentWeekSessions = [];
      return new Promise((resolve) => {
        const request = store.openCursor();
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const session = cursor.value;
            const sessionDate = new Date(session.date);
            if (session.status === "completed" &&
              sessionDate >= currentWeekStart &&
              sessionDate <= currentWeekEnd) {
              currentWeekSessions.push(session);
            }
            cursor.continue();
          } else {
            resolve(this._calculateWeeklyProgress(currentWeekSessions));
          }
        };
        request.onerror = () => resolve({
          completed: 0,
          goal: 3,
          percentage: 0,
          daysLeft: 0
        });
      });
    } catch (error) {
      logger.error("Error calculating weekly progress:", error);
      return {
        completed: 0,
        goal: 3,
        percentage: 0,
        daysLeft: 0
      };
    }
  },

  _calculateWeeklyProgress(sessions) {
    const completed = sessions.length;
    const goal = Math.max(3, Math.ceil(completed * 1.2));

    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysLeft = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

    return {
      completed,
      goal,
      percentage: goal > 0 ? Math.round((completed / goal) * 100) : 0,
      daysLeft,
      isOnTrack: completed >= Math.floor((7 - daysLeft) / 7 * goal)
    };
  },

  async getStreakRiskTiming() {
    try {
      const [currentStreak, cadence] = await Promise.all([
        this.getCurrentStreak(),
        this.getTypicalCadence()
      ]);

      if (currentStreak === 0) {
        return {
          shouldAlert: false,
          reason: "no_current_streak",
          daysUntilAlert: null
        };
      }

      const lastSession = await getLatestSession();
      if (!lastSession) {
        return {
          shouldAlert: false,
          reason: "no_session_data",
          daysUntilAlert: null
        };
      }

      const lastSessionDate = new Date(lastSession.date);
      const daysSinceLastSession = (Date.now() - lastSessionDate.getTime()) / (1000 * 60 * 60 * 24);

      const alertThreshold = Math.max(2, Math.ceil(cadence.averageGapDays + 1));
      const shouldAlert = daysSinceLastSession >= alertThreshold && currentStreak >= 3;

      return {
        shouldAlert,
        reason: shouldAlert ? "streak_at_risk" : "streak_safe",
        currentStreak,
        daysSinceLastSession: Math.floor(daysSinceLastSession),
        alertThreshold,
        daysUntilAlert: shouldAlert ? 0 : Math.max(0, alertThreshold - daysSinceLastSession)
      };
    } catch (error) {
      logger.error("Error calculating streak risk timing:", error);
      return {
        shouldAlert: false,
        reason: "error",
        daysUntilAlert: null
      };
    }
  },

  async getReEngagementTiming() {
    try {
      const lastSession = await getLatestSession();
      if (!lastSession) {
        return {
          shouldPrompt: false,
          reason: "no_session_data",
          messageType: null
        };
      }

      const lastSessionDate = new Date(lastSession.date);
      const daysSinceLastSession = (Date.now() - lastSessionDate.getTime()) / (1000 * 60 * 60 * 24);

      let messageType = null;
      let shouldPrompt = false;

      if (daysSinceLastSession >= 30) {
        messageType = "gentle_monthly";
        shouldPrompt = true;
      } else if (daysSinceLastSession >= 14) {
        messageType = "supportive_biweekly";
        shouldPrompt = true;
      } else if (daysSinceLastSession >= 7) {
        messageType = "friendly_weekly";
        shouldPrompt = true;
      }

      return {
        shouldPrompt,
        reason: shouldPrompt ? "extended_absence" : "recent_activity",
        messageType,
        daysSinceLastSession: Math.floor(daysSinceLastSession),
        lastSessionDate: lastSession.date
      };
    } catch (error) {
      logger.error("Error calculating re-engagement timing:", error);
      return {
        shouldPrompt: false,
        reason: "error",
        messageType: null
      };
    }
  },

  async checkConsistencyAlerts(reminderSettings) {
    try {
      logger.info("🔍 Running comprehensive consistency check...");

      if (!reminderSettings?.enabled) {
        return {
          hasAlerts: false,
          reason: "reminders_disabled",
          alerts: []
        };
      }

      const [streakTiming, cadence, weeklyProgress, reEngagement] = await Promise.all([
        reminderSettings.streakAlerts ? this.getStreakRiskTiming() : Promise.resolve(null),
        reminderSettings.cadenceNudges ? this.getTypicalCadence() : Promise.resolve(null),
        reminderSettings.weeklyGoals ? this.getWeeklyProgress() : Promise.resolve(null),
        reminderSettings.reEngagement ? this.getReEngagementTiming() : Promise.resolve(null)
      ]);

      const alerts = [];

      if (streakTiming?.shouldAlert) {
        alerts.push({
          type: "streak_alert",
          priority: "high",
          message: `🔥 Keep your ${streakTiming.currentStreak}-day streak alive! Start a quick session?`,
          data: { currentStreak: streakTiming.currentStreak }
        });
      }

      if (cadence && reminderSettings.cadenceNudges) {
        if (cadence.learningPhase || cadence.pattern === "insufficient_data") {
          logger.info("⏸️ Skipping cadence nudges - still in learning phase or insufficient data");
        } else {
          const lastSession = await getLatestSession();
          if (lastSession) {
            const daysSince = (Date.now() - new Date(lastSession.date).getTime()) / (1000 * 60 * 60 * 24);
            const threshold = cadence.averageGapDays + 0.5;
            this._addCadenceNudgeIfNeeded(alerts, cadence, daysSince, threshold);
          }
        }
      }

      if (weeklyProgress && reminderSettings.weeklyGoals) {
        this._addWeeklyGoalAlertIfNeeded(alerts, weeklyProgress, cadence);
      }

      if (reEngagement?.shouldPrompt) {
        this._addReEngagementAlert(alerts, reEngagement);
      }

      logger.info(`✅ Consistency check complete: ${alerts.length} alerts found`);

      return {
        hasAlerts: alerts.length > 0,
        reason: alerts.length > 0 ? "consistency_issues_detected" : "all_good",
        alerts,
        analysis: {
          streak: streakTiming,
          cadence,
          weeklyProgress,
          reEngagement
        }
      };

    } catch (error) {
      logger.error("Error in consistency check:", error);
      return {
        hasAlerts: false,
        reason: "check_failed",
        alerts: [],
        error: error.message
      };
    }
  },

  _addCadenceNudgeIfNeeded(alerts, cadence, daysSince, threshold) {
    if (daysSince >= threshold &&
      cadence.reliability !== "low" &&
      cadence.confidenceScore >= 0.5) {

      alerts.push({
        type: "cadence_nudge",
        priority: "medium",
        message: `📅 You usually practice every ${Math.round(cadence.averageGapDays)} days — it's been ${Math.floor(daysSince)}. Quick session?`,
        data: {
          typicalGap: cadence.averageGapDays,
          actualGap: Math.floor(daysSince),
          typicalCadence: cadence.pattern
        }
      });
    }
  },

  _addWeeklyGoalAlertIfNeeded(alerts, weeklyProgress, cadence) {
    const hasEnoughHistoryForWeeklyGoals = cadence &&
      !cadence.learningPhase &&
      cadence.totalSessions >= 3;

    if (hasEnoughHistoryForWeeklyGoals) {
      const today = new Date();
      const dayOfWeek = today.getDay();

      if ((dayOfWeek === 3 || dayOfWeek === 6) && weeklyProgress.percentage < 50) {
        const isWednesday = dayOfWeek === 3;
        const message = isWednesday
          ? `⚡ Halfway through the week! ${weeklyProgress.completed} of ${weeklyProgress.goal} sessions completed`
          : `🎯 Weekend check: ${weeklyProgress.daysLeft} days left to hit your ${weeklyProgress.goal}-session goal`;

        alerts.push({
          type: "weekly_goal",
          priority: "low",
          message,
          data: {
            completedSessions: weeklyProgress.completed,
            targetSessions: weeklyProgress.goal,
            remainingDays: weeklyProgress.daysLeft
          }
        });
      }
    } else {
      logger.info("⏸️ Skipping weekly goal reminders - insufficient data for reliable weekly patterns");
    }
  },

  _addReEngagementAlert(alerts, reEngagement) {
    const messages = {
      friendly_weekly: "👋 Ready to jump back in? Your progress is waiting",
      supportive_biweekly: "💪 No pressure — start with just one problem when you're ready",
      gentle_monthly: "🌟 We're here when you want to continue your coding journey"
    };

    alerts.push({
      type: "re_engagement",
      priority: "low",
      message: messages[reEngagement.messageType],
      data: {
        daysSinceLastSession: reEngagement.daysSinceLastSession,
        messageType: reEngagement.messageType
      }
    });
  },
};
