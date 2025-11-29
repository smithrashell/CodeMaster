/**
 * Logging utilities barrel export
 */
export {
  default as logger,
  logInfo,
  logError,
  trace,
  debug,
  info,
  warn,
  error,
  fatal,
  component,
  data,
  system,
  success,
  context,
  fallback
} from './logger.js';

export { default as chromeMessageLogger } from './chromeMessageLogger.js';

export {
  showErrorNotification,
  showWarningNotification,
  showSuccessNotification,
  showInfoNotification,
  handleServiceError,
  handleDatabaseError,
  handleChromeAPIError
} from './errorNotifications.js';
