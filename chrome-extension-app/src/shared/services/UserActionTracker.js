import logger from "../utils/logging/logger.js";
import performanceMonitor from "../utils/performance/PerformanceMonitor.js";
// eslint-disable-next-line no-restricted-imports
import { dbHelper } from "../db/index.js";

/**
 * Detect if we're running in a content script context
 * Content scripts cannot access IndexedDB directly
 */
function isContentScriptContext() {
  try {
    return (
      typeof chrome !== "undefined" && 
      chrome.runtime && 
      chrome.runtime.sendMessage &&
      typeof document !== "undefined" &&
      (window.location.protocol === "http:" || window.location.protocol === "https:") &&
      !window.location.href.startsWith("chrome-extension://")
    );
  } catch (error) {
    return false;
  }
}

/**
 * User Action Tracking Service for production analytics
 * Tracks user interactions and behaviors for insights and optimization
 */
export class UserActionTracker {
  static STORE_NAME = "user_actions";
  static MAX_ACTIONS = 5000; // Keep last 5000 actions
  static BATCH_SIZE = 50; // Batch process actions for performance

  // Action categories for analytics
  static CATEGORIES = {
    NAVIGATION: "navigation",
    PROBLEM_SOLVING: "problem_solving",
    FEATURE_USAGE: "feature_usage",
    SYSTEM_INTERACTION: "system_interaction",
    ERROR_OCCURRENCE: "error_occurrence",
  };

  static sessionStart = Date.now();
  static actionQueue = [];
  static isProcessing = false;


  /**
   * Track a user action with context
   */
  static async trackAction({
    action,
    category = this.CATEGORIES.SYSTEM_INTERACTION,
    context = {},
    metadata = {},
    performance = null,
  }) {
    try {
      const actionData = {
        action,
        category,
        context,
        metadata,
        timestamp: new Date().toISOString(),
        sessionId: logger.sessionId,
        url: window.location.href,
        userAgent: navigator.userAgent,
        performance,
        sessionTime: Date.now() - this.sessionStart,
      };

      // Add to queue for batch processing
      this.actionQueue.push(actionData);

      // Process queue if it's getting full or this is a critical action
      const isCritical =
        category === this.CATEGORIES.ERROR_OCCURRENCE ||
        category === this.CATEGORIES.PROBLEM_SOLVING;

      if (this.actionQueue.length >= this.BATCH_SIZE || isCritical) {
        await this.processBatch();
      }

      // Log significant actions
      if (isCritical || category === this.CATEGORIES.FEATURE_USAGE) {
        logger.info(`User action tracked: ${action}`, {
          category,
          section: "user_tracking",
          context,
        });
      }

      return actionData;
    } catch (error) {
      logger.error(
        "Failed to track user action",
        {
          section: "user_tracking",
          action,
          category,
        },
        error
      );
      throw error;
    }
  }

  /**
   * Process queued actions in batch for performance
   */
  static async processBatch() {
    if (this.isProcessing || this.actionQueue.length === 0) {
      return;
    }

    // Skip database operations in content script context
    if (isContentScriptContext()) {
      // eslint-disable-next-line no-console
      console.warn("🚫 UserActionTracker: Skipping database operation in content script context");
      // Clear the queue to prevent memory build-up
      this.actionQueue = [];
      return;
    }

    this.isProcessing = true;
    const queryContext = performanceMonitor.startQuery(
      "batch_process_user_actions",
      {
        batchSize: this.actionQueue.length,
      }
    );

    try {
      const db = await dbHelper.openDB();

      const transaction = db.transaction([this.STORE_NAME], "readwrite");
      const store = transaction.objectStore(this.STORE_NAME);

      const actionsToProcess = [...this.actionQueue];
      this.actionQueue = [];

      // Store all actions in batch
      const promises = actionsToProcess.map(
        (action) =>
          new Promise((resolve, reject) => {
            const request = store.add(action);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          })
      );

      await Promise.all(promises);

      // Clean up old actions periodically
      if (Math.random() < 0.1) {
        // 10% chance
        this.cleanupOldActions();
      }

      performanceMonitor.endQuery(queryContext, true, actionsToProcess.length);
    } catch (error) {
      logger.error(
        "Failed to process user action batch",
        {
          section: "user_tracking",
          batchSize: this.actionQueue.length,
        },
        error
      );

      performanceMonitor.endQuery(queryContext, false, 0, error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get user actions with filtering
   */
  static async getUserActions({
    limit = 100,
    category = null,
    action = null,
    since = null,
    sessionId = null,
  } = {}) {
    try {
      const db = await dbHelper.openDB();

      const transaction = db.transaction([this.STORE_NAME], "readonly");
      const store = transaction.objectStore(this.STORE_NAME);

      let request;
      if (category) {
        const index = store.index("by_category");
        request = index.getAll(category);
      } else if (sessionId) {
        const index = store.index("by_session");
        request = index.getAll(sessionId);
      } else {
        request = store.getAll();
      }

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          let actions = request.result;

          // Apply filters
          if (action) {
            actions = actions.filter((a) => a.action === action);
          }

          if (since) {
            actions = actions.filter(
              (a) => new Date(a.timestamp) >= new Date(since)
            );
          }

          // Sort by timestamp (newest first) and limit
          actions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

          if (limit) {
            actions = actions.slice(0, limit);
          }

          resolve(actions);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      logger.error(
        "Failed to retrieve user actions",
        {
          section: "user_tracking",
        },
        error
      );
      return [];
    }
  }

  /**
   * Get user behavior analytics
   */
  static async getUserAnalytics(days = 7) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const actions = await this.getUserActions({
        since: since.toISOString(),
        limit: null,
      });

      const analytics = {
        totalActions: actions.length,
        uniqueSessions: new Set(actions.map((a) => a.sessionId)).size,
        actionsByCategory: {},
        actionsByType: {},
        actionsByHour: {},
        topActions: {},
        averageSessionTime: 0,
        userFlow: this._analyzeUserFlow(actions),
      };

      let totalSessionTime = 0;

      actions.forEach((action) => {
        // Count by category
        analytics.actionsByCategory[action.category] =
          (analytics.actionsByCategory[action.category] || 0) + 1;

        // Count by action type
        analytics.actionsByType[action.action] =
          (analytics.actionsByType[action.action] || 0) + 1;

        // Count by hour
        const hour = new Date(action.timestamp).getHours();
        analytics.actionsByHour[hour] =
          (analytics.actionsByHour[hour] || 0) + 1;

        // Top actions
        analytics.topActions[action.action] =
          (analytics.topActions[action.action] || 0) + 1;

        // Session time
        if (action.sessionTime) {
          totalSessionTime += action.sessionTime;
        }
      });

      analytics.averageSessionTime =
        actions.length > 0
          ? Math.round(totalSessionTime / actions.length / 1000)
          : 0; // Convert to seconds

      return analytics;
    } catch (error) {
      logger.error(
        "Failed to generate user analytics",
        {
          section: "user_tracking",
        },
        error
      );
      return null;
    }
  }

  /**
   * Analyze user flow patterns
   */
  static _analyzeUserFlow(actions) {
    const flowMap = {};
    const sortedActions = actions.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    for (let i = 0; i < sortedActions.length - 1; i++) {
      const current = sortedActions[i].action;
      const next = sortedActions[i + 1].action;
      const flowKey = `${current} → ${next}`;

      flowMap[flowKey] = (flowMap[flowKey] || 0) + 1;
    }

    // Return top 10 flows
    return Object.entries(flowMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});
  }

  /**
   * Track specific feature usage
   */
  static trackFeatureUsage(featureName, additionalContext = {}) {
    return this.trackAction({
      action: `feature_${featureName}_used`,
      category: this.CATEGORIES.FEATURE_USAGE,
      context: additionalContext,
    });
  }

  /**
   * Track navigation events
   */
  static trackNavigation(from, to, method = "click") {
    return this.trackAction({
      action: "page_navigation",
      category: this.CATEGORIES.NAVIGATION,
      context: { from, to, method },
    });
  }

  /**
   * Track problem-solving events
   */
  static trackProblemSolving(problemId, event, context = {}) {
    return this.trackAction({
      action: `problem_${event}`,
      category: this.CATEGORIES.PROBLEM_SOLVING,
      context: { problemId, ...context },
    });
  }

  /**
   * Track errors with context
   */
  static trackError(error, context = {}) {
    return this.trackAction({
      action: "error_occurred",
      category: this.CATEGORIES.ERROR_OCCURRENCE,
      context: {
        errorMessage: error.message,
        errorStack: error.stack,
        ...context,
      },
      metadata: {
        severity: context.severity || "medium",
      },
    });
  }

  /**
   * Clean up old actions to prevent storage bloat
   */
  static async cleanupOldActions() {
    try {
      const actions = await this.getUserActions({ limit: null });

      if (actions.length > this.MAX_ACTIONS) {
        const excessActions = actions.slice(this.MAX_ACTIONS);
        const db = await dbHelper.openDB();

        const transaction = db.transaction([this.STORE_NAME], "readwrite");
        const store = transaction.objectStore(this.STORE_NAME);

        for (const action of excessActions) {
          store.delete(action.id);
        }
      }
    } catch (error) {
      logger.error(
        "Failed to cleanup old user actions",
        {
          section: "user_tracking",
        },
        error
      );
    }
  }

  /**
   * Export user actions for external analysis
   */
  static async exportUserActions(format = "json") {
    try {
      const actions = await this.getUserActions({ limit: null });

      if (format === "json") {
        return JSON.stringify(actions, null, 2);
      } else if (format === "csv") {
        const headers = [
          "Timestamp",
          "Action",
          "Category",
          "Session ID",
          "Context",
        ];
        const csvRows = [headers.join(",")];

        actions.forEach((action) => {
          const row = [
            action.timestamp,
            action.action,
            action.category,
            action.sessionId,
            `"${JSON.stringify(action.context).replace(/"/g, '""')}"`,
          ];
          csvRows.push(row.join(","));
        });

        return csvRows.join("\n");
      }

      throw new Error(`Unsupported export format: ${format}`);
    } catch (error) {
      logger.error(
        "Failed to export user actions",
        {
          section: "user_tracking",
        },
        error
      );
      throw error;
    }
  }

  /**
   * Flush remaining actions before page unload
   */
  static async flush() {
    if (this.actionQueue.length > 0) {
      await this.processBatch();
    }
  }
}

// Auto-flush on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    UserActionTracker.flush();
  });
}

export default UserActionTracker;
