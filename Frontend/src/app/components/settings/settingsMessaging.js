import { useChromeMessage, clearChromeMessageCache } from "../../../shared/hooks/useChromeMessage";
import logger from "../../../shared/utils/logger.js";

// React hook for settings operations using Chrome messaging
export const useSettingsMessaging = () => {
  // Get all settings using Chrome message hook
  const { data: settings, loading, error, refetch } = useChromeMessage(
    { type: "getSettings" },
    [],
    { showNotifications: false }
  );

  // Save settings and clear cache
  const saveSettings = async (newSettings) => {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: "setSettings", message: newSettings },
          (response) => {
            resolve(response);
          }
        );
      });

      // Clear both hook cache and backend cache
      clearChromeMessageCache("getSettings");
      chrome.runtime.sendMessage({ type: "clearSettingsCache" }, (_response) => {
        if (chrome.runtime.lastError) {
          logger.warn("Clear cache failed:", chrome.runtime.lastError.message);
        }
      });

      // Refetch to get fresh settings
      refetch();
      return response;
    } catch (error) {
      logger.error("Failed to save settings:", error);
      throw error;
    }
  };

  // Get all settings (returns current data from hook)
  const getAllSettings = () => {
    return settings || {};
  };

  return {
    settings,
    loading,
    error,
    getAllSettings,
    saveSettings,
    refetch
  };
};

// Legacy Chrome messaging utilities for backward compatibility
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