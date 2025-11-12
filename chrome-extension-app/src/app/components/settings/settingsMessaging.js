import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
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

  // Save settings
  const saveSettings = async (newSettings) => {
    try {
      const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "setSettings",
        message: newSettings
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
  async getAllSettings() {
    return await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: "getSettings"
    }) || {};
  },

  // Save settings
  async saveSettings(settings) {
    const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: "setSettings",
      message: settings
    });

    return response;
  }
};