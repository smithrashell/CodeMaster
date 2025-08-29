import "../../css/main.css";
import  { useState } from "react";
import {  Switch } from "@mantine/core";


const AdaptiveSessionToggle = ({ adaptive, onChange }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          maxWidth: "100%",
        }}
      >
        <div
          style={{ fontSize: "1rem", fontWeight: 500, color: "var(--cm-text)" }}
        >
          Adaptive Sessions
        </div>

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
            cursor: "default",
          }}
        >
          i
        </div>
      </div>

      {/* Inline paragraph shown only when hovering */}
      <div
        style={{
          maxHeight: hovered ? "100px" : "0px",
          opacity: hovered ? 1 : 0,
          overflow: "hidden",
          transition: "all 0.3s ease",
        }}
      >
        <p
          style={{
            maxWidth: "200px",
            margin: 0,
            fontSize: "0.85rem",
            color: "#444",
            lineHeight: 1.4,
            wordWrap: "break-word",
            overflowWrap: "anywhere",
          }}
        >
          Automatically adjusts session length and number of new problems based
          on your performance.
        </p>
      </div>

      <Switch
        checked={adaptive}
        onChange={(event) => onChange(event.currentTarget.checked)}
        onLabel="ON"
        offLabel="OFF"
        size="lg"
        styles={{
          track: { height: 24 },
          thumb: { width: 18, height: 18 },
        }}
      />
    </div>
  );
};

export default AdaptiveSessionToggle;
