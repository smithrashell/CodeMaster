import "../../css/main.css";
import { useState, useEffect } from "react";
import { Button } from "@mantine/core";
import {
  SliderMarksSessionLength,
  SliderMarksNewProblemsPerSession,
  GradientSegmentedControlTimeLimit,
  ToggleSelectRemainders,
} from "../../../shared/components/nantine.jsx";
import AdaptiveSessionToggle from "./AdaptiveSessionToggle.js";
import Header from "../../components/navigation/header.jsx";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import { useNav } from "../../../shared/provider/navprovider";
import SessionLimits from "../../../shared/utils/sessionLimits.js";

const Settings = () => {
  const { setIsAppOpen } = useNav();

  const handleClose = () => {
    setIsAppOpen(false);
  };
  const [settings, setSettings] = useState(null);
  const [maxNewProblems, setMaxNewProblems] = useState(8);
  const useMock = false;
  const MOCK_SETTINGS = {
    adaptive: true, // try false to test toggling
    sessionLength: 8,
    numberofNewProblemsPerSession: 3,
    limit: "Auto",
    reminder: {
      enabled: true,
      time: "12",
    },
  };

  // New approach using custom hook
  const {
    data: _chromeSettings,
    loading: _loading,
    error: _error,
  } = useChromeMessage(!useMock ? { type: "getSettings" } : null, [], {
    onSuccess: (response) => {
      if (response) {
        setSettings(response);
      } else {
        console.warn("No settings received, using defaults.");
      }
    },
  });

  // Handle mock settings
  useEffect(() => {
    if (useMock) {
      setSettings(MOCK_SETTINGS);
    }
  }, [useMock, MOCK_SETTINGS]);

  // Update max new problems dynamically when settings change
  useEffect(() => {
    const updateMaxNewProblems = async () => {
      try {
        const sessionState = await chrome.runtime.sendMessage({ type: "getSessionState" });
        const newMax = SessionLimits.getMaxNewProblems(sessionState, settings?.sessionLength);
        setMaxNewProblems(newMax);
      } catch (error) {
        console.error('Settings.jsx: Failed to get session state, using fallback limits:', error);
        // Fallback to default if session state unavailable
        const fallbackMax = SessionLimits.getMaxNewProblems(null, settings?.sessionLength);
        setMaxNewProblems(fallbackMax);
      }
    };

    if (settings) {
      updateMaxNewProblems();
    }
  }, [settings]); // Re-run when settings change

  const handleSave = (settings) => {
    chrome.runtime.sendMessage(
      { type: "setSettings", message: settings },
      (response) => {
        // Clear any cached settings to ensure fresh data on next read
        chrome.runtime.sendMessage(
          { type: "clearSettingsCache" },
          () => {
            // Settings cache cleared
          }
        );

        // Notify user of successful save
        if (response?.status === "success") {
          // Settings successfully updated and cache cleared
        }
      }
    );
  };

  const _toggleAdaptive = (value) => {
    setSettings((prev) => ({ ...prev, adaptive: value }));
  };

  return (
    <div id="cm-mySidenav" className="cm-sidenav problink">
      <Header title="Settings" onClose={handleClose} />

      <div className="cm-sidenav__content ">
        {/* Adaptive Toggle */}
        <AdaptiveSessionToggle
          adaptive={settings?.adaptive}
          onChange={(val) => setSettings({ ...settings, adaptive: val })}
        />

        {/* Session Controls (conditionally shown) */}
        {!settings?.adaptive && (
          <>
            <div className="cm-form-group">
              <label>Session Length</label>
              <SliderMarksSessionLength
                value={settings?.sessionLength}
                onChange={(value) =>
                  setSettings({ ...settings, sessionLength: value })
                }
              />
            </div>

            <div className="cm-form-group">
              <label>New Problems Per Session</label>
              <SliderMarksNewProblemsPerSession
                value={Math.min(settings?.numberofNewProblemsPerSession || 1, maxNewProblems)}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    numberofNewProblemsPerSession: value,
                  })
                }
                max={maxNewProblems}
              />
            </div>
          </>
        )}

        <div className="cm-form-group">
          <label>Time Limits</label>
          <GradientSegmentedControlTimeLimit
            value={settings?.limit}
            onChange={(value) => setSettings({ ...settings, limit: value })}
          />
        </div>
        <div className="cm-form-group">
          <label>Reminders</label>
          <ToggleSelectRemainders
            reminder={settings?.reminder}
            onChange={(updatedReminder) =>
              setSettings((prevSettings) => ({
                ...prevSettings,
                reminder: { ...prevSettings.reminder, ...updatedReminder },
              }))
            }
          />
        </div>
        <Button onClick={() => handleSave(settings)}>Save</Button>
      </div>
    </div>
  );
};

export default Settings;
