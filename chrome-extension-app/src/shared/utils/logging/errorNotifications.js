/**
 * Centralized Error Notifications for CodeMaster
 *
 * Replaces console-only error logging with user-facing notifications
 * and provides consistent error messaging across the application.
 */

import NotificationManager from "./NotificationManager.js";

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
