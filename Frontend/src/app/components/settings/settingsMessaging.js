import logger from "../../../shared/utils/logger.js";

// Chrome messaging utilities for settings operations
export const settingsMessaging = {
  // Get all settings from Chrome storage
  getAllSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
        resolve(response || {});
      });
    });
  },

  // Save settings and clear cache
  saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: "setSettings", message: settings },
        (response) => {
          // Clear settings cache
          chrome.runtime.sendMessage({ type: "clearSettingsCache" }, (_response) => {
            if (chrome.runtime.lastError) {
              logger.warn("Clear cache failed:", chrome.runtime.lastError.message);
            }
          });
          
          resolve(response);
        }
      );
    });
  }
};