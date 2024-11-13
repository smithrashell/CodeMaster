import { Switch, Select, Group, Slider, rem } from "@mantine/core";
import { IconPoint, IconGripHorizontal } from "@tabler/icons-react";
import { SegmentedControl } from "@mantine/core";
import classes from "../css/SliderMarks.module.css";
import React, { useState } from "react";

export function ToggleSelect() {
  const [isOn, setIsOn] = useState(false); // State to manage the slider toggle

  const handleToggle = () => setIsOn((prev) => !prev);

  return (
    <div style={{ padding: rem(20) }}>
      <Group position="center">
        {/* Slider Toggle */}
        <Switch checked={isOn} onChange={handleToggle} size="md" color="teal" />
      </Group>

      {/* Dropdown Select Component */}
      {isOn && (
        <Select
          label="Select an option"
          placeholder="Pick one"
          data={[
            { value: "6", label: "Every 6 hours" },
            { value: "12", label: "Every 12 hours" },
            { value: "24", label: "Once a day" },
          ]}
          styles={{
            dropdown: {
              color: "#333",
              backgroundColor: "#ffffff", // Set dropdown background color
              border: "1px solid #ddd", // Optional: Add a border to the dropdown
            },
            item: {
              color: "#333", // Set text color for items
              "&[data-selected]": {
                backgroundColor: "#FDD835", // Selected item background
                color: "#333", // Selected item text color
              },
              "&[data-hovered]": {
                backgroundColor: "#FFF9C4", // Hover background color for items
                color: "#333", // Hover text color
              },
            },
          }}
          style={{ marginTop: rem(20) }}
        />
      )}
    </div>
  );
}

const point = (
  <IconPoint
    style={{ marginTop: rem(6), width: rem(10), height: rem(10) }}
    stroke={1.5}
  />
);

export function SliderMarks() {
  return (
    <div className={classes.sliderContainer}>
      <Slider
        orientation="horizontal"
        classNames={{
          track: classes.sliderTrack, // Style for slider track
          marksWrapper: classes.marks, // Horizontal alignment for marks
          markLabel: classes.markLabel, // Center each label/icon
        }}
        defaultValue={2}
        thumbChildren={
          <IconGripHorizontal
            style={{ width: rem(20), height: rem(20) }}
            stroke={1.5}
          />
        }
        marks={[
          { value: 2, label: "2" },
          { value: 3, label: point },
          { value: 4, label: "4" },
          { value: 5, label: point },
          { value: 6, label: "6" },
          { value: 7, label: point },
          { value: 8, label: "8" },
          { value: 9, label: point },
          { value: 10, label: "10" },
        ]}
        step={1}
        min={2}
        max={10}
        style={{ width: "100%" }}
      />
    </div>
  );
}
export function GradientSegmentedControl() {
  return (
    <SegmentedControl
      radius="md"
      size="sm"
      data={["Auto", "off", "15", "20", "30"]}
      classNames={classes}
      styles={() => ({
        indicator: {
          background: "linear-gradient(45deg, #FFF9C4, #FDD835)", // Light yellow to dark yellow gradient
        },
        control: {
          "&[data-active]": {
            color: "#333", // Optional: Set the active text color to contrast the yellow gradient
          },
        },
      })}
    />
  );
}
