/**
 * Centralized Error Notifications for CodeMaster
 *
 * Replaces console-only error logging with user-facing notifications
 * and provides consistent error messaging across the application.
 *
 * Note: This uses a simple DOM-based notification system until
 * @mantine/notifications package can be installed.
 */

// Simple notification system for immediate use
class NotificationManager {
  constructor() {
    this.container = null;
    this.notifications = new Map();
    this.isBackgroundContext = typeof document === "undefined";
    if (!this.isBackgroundContext) {
      this.init();
    }
  }

  init() {
    // Skip DOM operations in background/service worker context
    if (this.isBackgroundContext) {
      return;
    }

    // Create notification container if it doesn't exist
    if (!document.getElementById("codemaster-notifications")) {
      this.container = document.createElement("div");
      this.container.id = "codemaster-notifications";
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById("codemaster-notifications");
    }
  }

  show(options) {
    // In background context, log to console instead of showing DOM notification
    if (this.isBackgroundContext) {
      const { _title = "Notification", _message = "", type = "info" } = options;
      const _logMethod =
        type === "error" ? "error" : type === "warning" ? "warn" : "log";
      // Background logging removed
      return `background-${Date.now()}`;
    }

    const {
      id = `notification-${Date.now()}`,
      title = "Notification",
      message = "",
      type = "info", // info, success, warning, error
      duration = 5000,
      persistent = false,
      actions = [],
    } = options;

    // Remove existing notification with same ID
    if (this.notifications.has(id)) {
      this.hide(id);
    }

    const notification = this.createNotification({
      id,
      title,
      message,
      type,
      actions,
    });

    this.container.appendChild(notification);
    this.notifications.set(id, notification);

    // Animate in
    setTimeout(() => {
      notification.style.transform = "translateX(0)";
      notification.style.opacity = "1";
    }, 10);

    // Auto-hide unless persistent
    if (!persistent && duration > 0) {
      setTimeout(() => this.hide(id), duration);
    }

    return id;
  }

  createNotification({ id, title, message, type, actions }) {
    const notification = document.createElement("div");
    notification.id = id;
    notification.style.cssText = `
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      margin-bottom: 12px;
      padding: 16px;
      transform: translateX(100%);
      transition: all 0.3s ease;
      opacity: 0;
      pointer-events: auto;
      position: relative;
      ${this.getTypeStyles(type)}
    `;

    const header = document.createElement("div");
    header.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;";

    const titleEl = document.createElement("div");
    titleEl.style.cssText = `
      font-weight: 600;
      font-size: 14px;
      color: ${this.getTypeColor(type)};
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    titleEl.innerHTML = `${this.getTypeIcon(type)} ${title}`;

    const closeBtn = document.createElement("button");
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.innerHTML = "×";
    closeBtn.onclick = () => this.hide(id);

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    if (message) {
      const messageEl = document.createElement("div");
      messageEl.style.cssText =
        "font-size: 13px; color: #555; margin-bottom: 12px; line-height: 1.4;";
      messageEl.textContent = message;
      notification.appendChild(header);
      notification.appendChild(messageEl);
    } else {
      notification.appendChild(header);
    }

    // Add actions if provided
    if (actions && actions.length > 0) {
      const actionsEl = document.createElement("div");
      actionsEl.style.cssText = "display: flex; gap: 8px; margin-top: 12px;";

      actions.forEach((action) => {
        const btn = document.createElement("button");
        btn.style.cssText = `
          background: ${
            action.primary ? this.getTypeColor(type) : "transparent"
          };
          color: ${action.primary ? "white" : this.getTypeColor(type)};
          border: 1px solid ${this.getTypeColor(type)};
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: opacity 0.2s;
        `;
        btn.textContent = action.label;
        btn.onclick = () => {
          if (action.onClick) action.onClick();
          if (action.closeOnClick !== false) this.hide(id);
        };
        actionsEl.appendChild(btn);
      });

      notification.appendChild(actionsEl);
    }

    return notification;
  }

  hide(id) {
    // In background context, just remove from memory
    if (this.isBackgroundContext) {
      this.notifications.delete(id);
      return;
    }

    const notification = this.notifications.get(id);
    if (notification) {
      notification.style.transform = "translateX(100%)";
      notification.style.opacity = "0";

      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        this.notifications.delete(id);
      }, 300);
    }
  }

  hideAll() {
    if (this.isBackgroundContext) {
      this.notifications.clear();
      return;
    }
    this.notifications.forEach((_, id) => this.hide(id));
  }

  getTypeStyles(type) {
    const styles = {
      info: "border-left: 4px solid #339af0;",
      success: "border-left: 4px solid #51cf66;",
      warning: "border-left: 4px solid #ffd43b;",
      error: "border-left: 4px solid #ff6b6b;",
    };
    return styles[type] || styles.info;
  }

  getTypeColor(type) {
    const colors = {
      info: "#339af0",
      success: "#51cf66",
      warning: "#fd7e14",
      error: "#ff6b6b",
    };
    return colors[type] || colors.info;
  }

  getTypeIcon(type) {
    const icons = {
      info: "🔵",
      success: "✅",
      warning: "⚠️",
      error: "❌",
    };
    return icons[type] || icons.info;
  }
}

// Global notification manager instance
const notifications = new NotificationManager();

// Error notification functions
export const showErrorNotification = (error, options = {}) => {
  const errorMessage = error instanceof Error ? error.message : String(error);

  return notifications.show({
    type: "error",
    title: "Error",
    message: errorMessage,
    duration: 8000,
    actions: [
      {
        label: "Dismiss",
        onClick: () => {},
      },
      ...(options.actions || []),
    ],
    ...options,
  });
};

export const showWarningNotification = (message, options = {}) => {
  return notifications.show({
    type: "warning",
    title: "Warning",
    message,
    duration: 6000,
    ...options,
  });
};

export const showSuccessNotification = (message, options = {}) => {
  return notifications.show({
    type: "success",
    title: "Success",
    message,
    duration: 4000,
    ...options,
  });
};

export const showInfoNotification = (message, options = {}) => {
  return notifications.show({
    type: "info",
    title: "Information",
    message,
    duration: 5000,
    ...options,
  });
};

// Service-specific error handlers
export const handleServiceError = (serviceName, error, options = {}) => {
  // Service error logged

  const userFriendlyMessages = {
    DatabaseService:
      "Unable to access your learning data. This is usually temporary.",
    SessionService: "Problem creating your study session. Please try again.",
    TimerService: "Timer functionality is temporarily unavailable.",
    StrategyService: "Strategy hints are currently unavailable.",
    ChromeAPI:
      "Connection to Chrome extension failed. Try refreshing the page.",
  };

  const message =
    userFriendlyMessages[serviceName] ||
    `${serviceName} is temporarily unavailable. Please try again.`;

  return showErrorNotification(error, {
    title: `${serviceName} Error`,
    message,
    actions: [
      {
        label: "Retry",
        primary: true,
        onClick: options.onRetry,
      },
      {
        label: "Report Issue",
        onClick: options.onReport,
      },
    ],
    ...options,
  });
};

// Database-specific error handlers
export const handleDatabaseError = (operation, error, options = {}) => {
  // Database error logged

  const messages = {
    read: "Unable to load your data. Your information is safe.",
    write: "Unable to save changes. Please try again.",
    delete: "Unable to delete item. Please try again.",
    migrate: "Database update failed. Your data remains safe.",
    backup: "Unable to create backup. Operation cancelled for safety.",
  };

  return showErrorNotification(error, {
    title: "Data Access Issue",
    message: messages[operation] || "Database operation failed.",
    persistent: operation === "migrate" || operation === "backup",
    actions: [
      {
        label: "Retry",
        primary: true,
        onClick: options.onRetry,
      },
      {
        label: "Report Issue",
        onClick: options.onReport,
      },
    ],
    ...options,
  });
};

// Chrome API error handlers
export const handleChromeAPIError = (apiName, error, options = {}) => {
  // Chrome API error logged

  return showErrorNotification(error, {
    title: "Extension Connection Issue",
    message:
      "Connection to CodeMaster extension failed. Try refreshing the page.",
    actions: [
      {
        label: "Refresh Page",
        primary: true,
        onClick: () => window.location.reload(),
      },
      {
        label: "Report Issue",
        onClick: options.onReport,
      },
    ],
    ...options,
  });
};

// Component error handlers
export const handleComponentError = (componentName, error, options = {}) => {
  // Component error logged

  return showErrorNotification(error, {
    title: `${componentName} Unavailable`,
    message: `The ${componentName} feature encountered an issue. You can continue using other features.`,
    actions: [
      {
        label: "Reload Component",
        primary: true,
        onClick: options.onRetry,
      },
      {
        label: "Report Issue",
        onClick: options.onReport,
      },
    ],
    ...options,
  });
};

// Recovery notification
export const showRecoveryNotification = (message, options = {}) => {
  return showSuccessNotification(message, {
    title: "Recovered",
    actions: [
      {
        label: "Great!",
        primary: true,
        onClick: () => {},
      },
    ],
    ...options,
  });
};

// Progress notifications for long operations
export const showProgressNotification = (title, message, options = {}) => {
  return notifications.show({
    type: "info",
    title,
    message,
    persistent: true,
    actions: options.cancelable
      ? [
          {
            label: "Cancel",
            onClick: options.onCancel,
          },
        ]
      : [],
    ...options,
  });
};

export const hideNotification = (id) => {
  notifications.hide(id);
};

export const hideAllNotifications = () => {
  notifications.hideAll();
};

// Helper to replace console.error calls with user notifications
export const notifyError = (error, context = {}) => {
  if (context.service) {
    return handleServiceError(context.service, error, context);
  } else if (context.database) {
    return handleDatabaseError(
      context.operation || "operation",
      error,
      context
    );
  } else if (context.component) {
    return handleComponentError(context.component, error, context);
  } else if (context.chromeAPI) {
    return handleChromeAPIError(context.api || "API", error, context);
  } else {
    return showErrorNotification(error, context);
  }
};

export default {
  showErrorNotification,
  showWarningNotification,
  showSuccessNotification,
  showInfoNotification,
  handleServiceError,
  handleDatabaseError,
  handleChromeAPIError,
  handleComponentError,
  showRecoveryNotification,
  showProgressNotification,
  hideNotification,
  hideAllNotifications,
  notifyError,
};
