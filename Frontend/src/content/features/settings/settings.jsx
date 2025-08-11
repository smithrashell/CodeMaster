import "../../css/main.css";
import React, { useState, useEffect } from "react";
import { Label, Button, Title, Switch, Tooltip, Group } from "@mantine/core";
import {
  SliderMarksSessionLength,
  SliderMarksNewProblemsPerSession,
  GradientSegmentedControlTimeLimit,
  ToggleSelectRemainders,
} from "../../../shared/components/nantine.jsx";
import { IconQuestionMark } from "@tabler/icons-react"; // or
import AdaptiveSessionToggle from "./AdaptiveSessionToggle.js";
import Header from "../../components/navigation/header.jsx";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [value, setValue] = useState(40);
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
    data: chromeSettings,
    loading,
    error,
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
      console.log("🔧 Using MOCK_SETTINGS");
      setSettings(MOCK_SETTINGS);
    }
  }, []);

  const handleSave = (settings) => {
    chrome.runtime.sendMessage(
      { type: "setSettings", message: settings },
      (response) => {
        console.log("Settings saved:", response);

        // Clear any cached settings to ensure fresh data on next read
        chrome.runtime.sendMessage(
          { type: "clearSettingsCache" },
          (cacheResponse) => {
            console.log("Settings cache cleared:", cacheResponse);
          }
        );

        // Notify user of successful save
        if (response?.status === "success") {
          console.log("✅ Settings successfully updated and cache cleared");
        }
      }
    );
  };

  const toggleAdaptive = (value) => {
    setSettings((prev) => ({ ...prev, adaptive: value }));
  };

  return (
    <div id="cm-mySidenav" className="cm-sidenav problink">
      <Header title="Settings" />

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
                value={settings?.numberofNewProblemsPerSession}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    numberofNewProblemsPerSession: value,
                  })
                }
                max={settings?.sessionLength}
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
