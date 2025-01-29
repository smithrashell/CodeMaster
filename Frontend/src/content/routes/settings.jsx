import "../css/main.css";
import React, { useState, useEffect } from "react";
import { Label, Button, Title } from "@mantine/core";
import {
  SliderMarksSessionLength,
  SliderMarksNewProblemsPerSession,
  GradientSegmentedControlTimeLimit,
  ToggleSelectRemainders,
} from "../components/nantine";

const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [value, setValue] = useState(40);

  /// useEffect to get settings
  useEffect(() => {
    console.log("Fetching settings...");
    chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
      console.log("Settings received:", response);
      if (response) {
        setSettings(response);
      } else {
        console.warn("No settings received, using defaults.");
      }
    });
  }, [setSettings]);

  const handleChange = (newSessionLength) => {
    if (newSessionLength !== undefined) {
      setSettings((prevSettings) => ({
        ...prevSettings,
        sessionLength: newSessionLength,
      }));
    } else {
      console.error("Received undefined value in handleChange");
    }
  };

  const handleSave = (settings) => {
    chrome.runtime.sendMessage(
      { type: "setSettings", message: settings },
      (response) => {
        console.log("Settings saved:", response);
      }
    );
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
          height: "75%",
          marginTop: "20px",
        }}
      >
        <label>Session Length</label>
        <SliderMarksSessionLength
          value={settings?.sessionLength}
          onChange={(value) =>
            setSettings({ ...settings, sessionLength: value })
          }
        />
        <label>Max Number of New Problems Per Session </label>
        <SliderMarksNewProblemsPerSession
          value={settings?.numberofNewProblemsPerSession}
          onChange={(value) =>
            setSettings({ ...settings, numberofNewProblemsPerSession: value })
          }
          max={settings?.sessionLength}
        />
        <label> Time Limits </label>
        <GradientSegmentedControlTimeLimit
          value={settings?.limit}
          onChange={(value) => setSettings({ ...settings, limit: value })}
        />
        <label>Remainders</label>
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
