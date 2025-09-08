import { useState, useMemo } from "react";
import { useChromeMessage } from "../../shared/hooks/useChromeMessage";
import { ChromeAPIErrorHandler } from "../../shared/services/ChromeAPIErrorHandler";
import logger from "../../shared/utils/logger.js";

/**
 * Custom hook for managing timer settings
 */
export function useTimerSettings() {
  const [settings, setSettings] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const DEFAULT_TIMER_SETTINGS = useMemo(() => ({
    timerDisplay: "mm:ss",
    breakReminders: {
      enabled: false,
      interval: 25
    },
    notifications: {
      sound: false,
      browser: false,
      visual: true
    }
  }), []);

  // Load settings using Chrome message hook
  const {
    data: _chromeSettings,
    loading,
    error,
  } = useChromeMessage({ type: "getSettings" }, [], {
    onSuccess: (response) => {
      if (response) {
        // Extract timer-related settings or use defaults
        setSettings({
          timerDisplay: response.timerDisplay || DEFAULT_TIMER_SETTINGS.timerDisplay,
          breakReminders: response.breakReminders || DEFAULT_TIMER_SETTINGS.breakReminders,
          notifications: response.notifications || DEFAULT_TIMER_SETTINGS.notifications
        });
      } else {
        setSettings(DEFAULT_TIMER_SETTINGS);
      }
    },
  });

  const updateSettings = (newSettings) => {
    setSettings(newSettings);
    setHasChanges(true);
    setSaveStatus(null);
  };

  const saveSettings = async () => {
    if (!hasChanges || isSaving) return;

    setIsSaving(true);
    setSaveStatus(null);

    try {
      // Get current settings first, then merge with timer settings
      const currentSettings = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "getSettings"
      });

      const updatedSettings = {
        ...currentSettings,
        timerDisplay: settings.timerDisplay,
        breakReminders: settings.breakReminders,
        notifications: settings.notifications
      };

      const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "setSettings", 
        message: updatedSettings
      });

      if (response?.status === "success") {
        setHasChanges(false);
        setSaveStatus({ type: "success", message: "Timer settings saved successfully" });
        logger.info("Timer settings saved successfully");
      } else {
        setSaveStatus({ type: "error", message: "Failed to save timer settings" });
      }
    } catch (error) {
      setSaveStatus({ type: "error", message: "Failed to save timer settings" });
      logger.error("Failed to save timer settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    setSettings(DEFAULT_TIMER_SETTINGS);
    setHasChanges(true);
    setSaveStatus(null);
  };

  return {
    settings,
    hasChanges,
    isSaving,
    saveStatus,
    loading,
    error,
    updateSettings,
    saveSettings,
    resetToDefaults,
  };
}