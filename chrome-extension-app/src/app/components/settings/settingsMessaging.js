import { useChromeMessage, clearChromeMessageCache } from "../../../shared/hooks/useChromeMessage";
import { ChromeAPIErrorHandler } from "../../../shared/services/ChromeAPIErrorHandler";
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
      const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "setSettings", 
        message: newSettings
      });

      // Clear both hook cache and backend cache
      clearChromeMessageCache("getSettings");
      
      try {
        await ChromeAPIErrorHandler.sendMessageWithRetry({ type: "clearSettingsCache" });
      } catch (cacheError) {
        logger.warn("Clear cache failed:", cacheError.message);
      }

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
  async getAllSettings() {
    return await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: "getSettings"
    }) || {};
  },

  // Save settings and clear cache
  async saveSettings(settings) {
    const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: "setSettings", 
      message: settings
    });

    // Clear settings cache
    try {
      await ChromeAPIErrorHandler.sendMessageWithRetry({ type: "clearSettingsCache" });
    } catch (cacheError) {
      logger.warn("Clear cache failed:", cacheError.message);
    }
    
    return response;
  }
};