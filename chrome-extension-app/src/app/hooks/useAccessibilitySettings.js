import { useEffect, useState, useCallback } from "react";
import { useChromeMessage } from "../../shared/hooks/useChromeMessage";
import logger from "../../shared/utils/logger.js";

// Comprehensive Accessibility Settings Hook using Chrome messaging
export function useAccessibilitySettings() {
  const [saveStatus, setSaveStatus] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Get current settings using the Chrome message hook
  const { data: currentSettings, loading, error, refetch } = useChromeMessage(
    { type: "getSettings" },
    [],
    { showNotifications: false }
  );

  // Save accessibility settings
  const saveSettings = useCallback(async (settings) => {
    if (!settings) return;

    setIsSaving(true);
    setSaveStatus(null);

    try {
      // Ensure we have current settings
      const baseSettings = currentSettings || {};
      
      const updatedSettings = {
        ...baseSettings,
        accessibility: settings
      };

      // Save the updated settings using Chrome messaging (to be replaced with hook in future iteration)
      const saveResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: "setSettings", message: updatedSettings },
          (response) => {
            resolve(response);
          }
        );
      });

      if (saveResponse?.status === "success") {
        setSaveStatus({ type: "success", message: "Accessibility settings saved successfully!" });
        setHasChanges(false);
        // Refetch settings to ensure UI is up to date
        refetch();
      } else {
        setSaveStatus({ type: "error", message: "Failed to save accessibility settings." });
      }
    } catch (error) {
      logger.error("AccessibilitySettings: Error saving settings:", error);
      setSaveStatus({ type: "error", message: "Failed to save accessibility settings." });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  }, [currentSettings, refetch]);

  return {
    settings: currentSettings?.accessibility,
    loading,
    error,
    saveStatus,
    hasChanges,
    isSaving,
    setHasChanges,
    saveSettings
  };
}

// Settings Save Hook for Accessibility (Legacy compatibility)
export function useAccessibilitySettingsSave(setSaveStatus, setHasChanges, setIsSaving) {
  const { saveSettings } = useAccessibilitySettings();
  
  return useCallback(async (settings) => {
    // Sync the external state setters with our internal hook
    setIsSaving(true);
    setSaveStatus(null);
    
    try {
      await saveSettings(settings);
      // The saveSettings function handles its own state management,
      // but we also need to update the external states for compatibility
      if (saveSettings) {
        setHasChanges(false);
        setSaveStatus({ type: "success", message: "Accessibility settings saved successfully!" });
      }
    } catch (error) {
      setSaveStatus({ type: "error", message: "Failed to save accessibility settings." });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  }, [saveSettings, setSaveStatus, setHasChanges, setIsSaving]);
}

// CSS class management for accessibility settings
export function useAccessibilityClasses(settings) {
  useEffect(() => {
    const root = document.documentElement;
    // Remove all accessibility classes initially
    root.classList.remove(
      'a11y-large-targets',
      'a11y-reduced-motion', 
      'a11y-extended-hover',
      'a11y-sticky-hover',
      'a11y-enhanced-focus'
    );
  }, []);

  useEffect(() => {
    // Skip if settings are empty (initial load)
    if (!settings || Object.keys(settings).length === 0) return;
    
    // Apply CSS classes based on settings
    const root = document.documentElement;
    
    // Motor accessibility
    const motorClasses = [
      { setting: settings?.motor?.largerTargets, className: 'a11y-large-targets' },
      { setting: settings?.motor?.reducedMotion, className: 'a11y-reduced-motion' },
      { setting: settings?.motor?.extendedHover, className: 'a11y-extended-hover' },
      { setting: settings?.motor?.stickyHover, className: 'a11y-sticky-hover' }
    ];

    // Keyboard navigation
    const keyboardClasses = [
      { setting: settings?.keyboard?.enhancedFocus, className: 'a11y-enhanced-focus' }
    ];

    [...motorClasses, ...keyboardClasses].forEach(({ setting, className }) => {
      if (setting) {
        root.classList.add(className);
      } else {
        root.classList.remove(className);
      }
    });
  }, [settings]);
}