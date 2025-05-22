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


const AdaptiveSessionToggle = ({ adaptive, onChange }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <label style={{ fontSize: "1rem", fontWeight: 500 }}>
          Adaptive Sessions
        </label>

        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            backgroundColor: "black",
            color: "white",
            fontSize: "12px",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "default"
          }}
        >
          i
        </div>
      </div>

      {/* Inline paragraph shown only when hovering */}
      {hovered && (
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#444" }}>
          Automatically adjusts session length and number of new problems
          based on your performance.
        </p>
      )}

      <Switch
        checked={adaptive}
        onChange={(event) => onChange(event.currentTarget.checked)}
        onLabel="ON"
        offLabel="OFF"
        size="lg"
        styles={{
          track: { height: 24 },
          thumb: { width: 18, height: 18 }
        }}
      />
    </div>
  );
};

export default AdaptiveSessionToggle;
