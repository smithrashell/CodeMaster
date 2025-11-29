/**
 * Settings Helpers - Hooks and Utilities for Settings Page
 */

import { useState, useEffect, useMemo } from "react";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import SessionLimits from "../../../shared/utils/sessionLimits.js";
import { component } from "../../../shared/utils/logger.js";

// Re-export components from settingsComponents
export {
  InterviewModeControls,
  RemindersSection,
  SaveSettingsButton,
  LoadingDebugInfo,
  SessionControls,
} from "./settingsComponents.jsx";

// Custom hook for settings management
export const useSettingsState = () => {
  const [settings, setSettings] = useState(null);
  const [maxNewProblems, setMaxNewProblems] = useState(8);
  const useMock = false;

  const MOCK_SETTINGS = useMemo(() => ({
    adaptive: true,
    sessionLength: 8,
    numberofNewProblemsPerSession: 3,
    limit: "Auto",
    reminder: {
      enabled: false,
      streakAlerts: false,
      cadenceNudges: false,
      weeklyGoals: false,
      reEngagement: false
    },
    interviewMode: "disabled",
    interviewReadinessThreshold: 0.8,
    interviewFrequency: "manual",
  }), []);

  const { data: _chromeSettings, loading: _loading, error: _error } = useChromeMessage(
    !useMock ? { type: "getSettings" } : null, [], {
      onSuccess: (response) => {
        if (response) {
          setSettings(response);
        } else {
          console.warn("No settings received, using defaults.");
        }
      },
    }
  );

  useEffect(() => {
    if (useMock) {
      setSettings(MOCK_SETTINGS);
    }
  }, [useMock, MOCK_SETTINGS]);

  useEffect(() => {
    if (settings && !settings.interviewMode) {
      const defaultSettings = {
        ...settings,
        interviewMode: "disabled",
        interviewReadinessThreshold: 0.8,
        interviewFrequency: "manual",
      };
      setSettings(defaultSettings);
    }
  }, [settings]);

  useEffect(() => {
    const updateMaxNewProblems = async () => {
      try {
        const sessionState = await chrome.runtime.sendMessage({ type: "getSessionState" });
        const newMax = SessionLimits.getMaxNewProblems(sessionState, settings?.sessionLength);
        setMaxNewProblems(newMax);
      } catch (error) {
        const fallbackMax = SessionLimits.getMaxNewProblems(null, settings?.sessionLength);
        setMaxNewProblems(fallbackMax);
      }
    };

    if (settings) {
      updateMaxNewProblems();
    }
  }, [settings]);

  return { settings, setSettings, maxNewProblems, _loading, _error };
};

// Helper to get working settings
export const getWorkingSettings = (settings) => {
  return settings || {
    adaptive: true,
    sessionLength: 8,
    numberofNewProblemsPerSession: 3,
    limit: "Auto",
    reminder: {
      enabled: false,
      streakAlerts: false,
      cadenceNudges: false,
      weeklyGoals: false,
      reEngagement: false
    },
    interviewMode: "disabled",
    interviewReadinessThreshold: 0.7,
    interviewFrequency: "manual"
  };
};

// Helper to save settings
export const saveSettings = (settings) => {
  console.log("🔄 Saving settings:", settings);
  chrome.runtime.sendMessage(
    { type: "setSettings", message: settings },
    (response) => {
      console.log("✅ Settings save response:", response);

      if (response?.status === "success") {
        console.log("✅ Settings successfully saved");
      } else {
        console.error("❌ Settings save failed:", response);
      }
    }
  );
};

// Helper to handle interview settings changes
export const handleInterviewSettingsUpdate = (workingSettings, newSettings, handleSave) => {
  component("Settings", "🎯 Settings update requested", newSettings);

  const interviewSettingsChanged = (
    workingSettings.interviewMode !== newSettings.interviewMode ||
    workingSettings.interviewFrequency !== newSettings.interviewFrequency ||
    workingSettings.interviewReadinessThreshold !== newSettings.interviewReadinessThreshold
  );

  component("Settings", "🔍 Interview settings change check", {
    changed: interviewSettingsChanged,
    oldMode: workingSettings.interviewMode,
    newMode: newSettings.interviewMode,
    oldFreq: workingSettings.interviewFrequency,
    newFreq: newSettings.interviewFrequency,
    oldThreshold: workingSettings.interviewReadinessThreshold,
    newThreshold: newSettings.interviewReadinessThreshold
  });

  handleSave(newSettings);

  if (interviewSettingsChanged) {
    component("Settings", "🎯 Interview settings changed");
    component("Settings", "✅ Settings updated without page reload - components will react to changes");
  } else {
    component("Settings", "ℹ️ No interview settings changes detected");
  }
};

// Custom hook for auto-constraining new problems per session
export const useAutoConstrainNewProblems = (workingSettings, maxNewProblems, setSettings) => {
  useEffect(() => {
    if (workingSettings?.sessionLength && workingSettings?.numberofNewProblemsPerSession) {
      const maxAllowed = workingSettings.sessionLength === 'auto'
        ? maxNewProblems
        : Math.min(maxNewProblems, workingSettings.sessionLength);

      if (workingSettings.numberofNewProblemsPerSession > maxAllowed) {
        setSettings(prev => ({
          ...prev,
          numberofNewProblemsPerSession: maxAllowed
        }));
      }
    }
  }, [workingSettings?.sessionLength, maxNewProblems, workingSettings?.numberofNewProblemsPerSession, setSettings]);
};
