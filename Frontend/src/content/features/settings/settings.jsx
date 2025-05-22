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
      time: "09:00",
    },
  };

  /// useEffect to get settings
  useEffect(() => {
    if (useMock) {
      console.log("🔧 Using MOCK_SETTINGS");
      setSettings(MOCK_SETTINGS);
    } else {
      console.log("Fetching settings from Chrome runtime...");
      chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
        if (response) {
          setSettings(response);
        } else {
          console.warn("No settings received, using defaults.");
        }
      });
    }
  }, []);

  const handleSave = (settings) => {
    chrome.runtime.sendMessage(
      { type: "setSettings", message: settings },
      (response) => {
        console.log("Settings saved:", response);
      }
    );
  };

  const toggleAdaptive = (value) => {
    setSettings((prev) => ({ ...prev, adaptive: value }));
  };

  return (
    <div id="cd-mySidenav" className="cd-sidenav problink">
      <Title order={2}>Settings</Title>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          alignItems: "left",
          maxHeight: "100%",
          marginTop: "20px",
        }}
      >
        {/* Adaptive Toggle */}
        <AdaptiveSessionToggle
          adaptive={settings?.adaptive}
          onChange={(val) => setSettings({ ...settings, adaptive: val })}
        />

        {/* Session Controls (conditionally shown) */}
        {!settings?.adaptive && (
          <>
            <label>Session Length</label>
            <SliderMarksSessionLength
              value={settings?.sessionLength}
              onChange={(value) =>
                setSettings({ ...settings, sessionLength: value })
              }
            />

            <label>Max Number of New Problems Per Session</label>
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
          </>
        )}

        <label>Time Limits</label>
        <GradientSegmentedControlTimeLimit
          value={settings?.limit}
          onChange={(value) => setSettings({ ...settings, limit: value })}
        />

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

        <Button onClick={() => handleSave(settings)}>Save</Button>
      </div>
    </div>
  );
};

export default Settings;
