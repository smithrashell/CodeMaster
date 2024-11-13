import "../css/main.css";
import React, { useState, useEffect } from "react";
import { Label, Button, Title } from "@mantine/core";
import {
  SliderMarks,
  GradientSegmentedControl,
  ToggleSelect,
} from "../components/nantine";

const Settings = () => {
  const { settings, setSettings } = useState();
  const [value, setValue] = useState(40);
  useEffect(() => {
    // chrome.runtime.sendMessage({ type: 'getSettings' }, (response) => {
    //   console.log('Settings received:', response);
    //   setSettings(response)
    // });
  }, [settings]);

  // Function to handle a change in settings
  const handleChange = (newSessionLength) => {
    if (newSessionLength !== undefined) {
      // Update the sessionLength setting
      setSettings((prevSettings) => ({
        ...prevSettings,
        sessionLength: newSessionLength,
      }));

      // Send the updated session length to the background script
      // chrome.runtime.sendMessage(
      //   { type: 'setSettings', payload: { key: 'sessionLength', value: newSessionLength } },
      //   (response) => {
      //     console.log('Session length saved:', response);
      //   }
      // );
    } else {
      console.error("Received undefined value in handleChange");
    }
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
        <SliderMarks value={value} onChange={setValue} />
        <label> Time Limits </label>
        <GradientSegmentedControl />
        <label>Remainders</label>
        <ToggleSelect />
        {/* I should add a  option to use time limits or not  */}
        <Button>Save</Button>
      </div>
    </div>
  );
};

export default Settings;
