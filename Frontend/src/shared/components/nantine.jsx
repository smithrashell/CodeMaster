import { Switch, Select, Group, Slider, rem } from "@mantine/core";
import { IconPoint, IconGripHorizontal } from "@tabler/icons-react";
import { SegmentedControl } from "@mantine/core";
import classes from "./css/SliderMarks.module.css";
import React, { useState, useEffect } from "react";

export function ToggleSelectRemainders({ reminder, onChange }) {
  const [currReminder, setCurrReminder] = useState(reminder); // State to manage the slider toggle
  useEffect(() => {
    setCurrReminder(reminder);
  }, [reminder]);

  const handleToggle = () => {
    const updatedReminder = { ...currReminder, value: !currReminder.value };
    setCurrReminder(updatedReminder);
    onChange(updatedReminder);
  };

  const handleSelectChange = (selectedValue) => {
    const updatedReminder = { ...currReminder, label: selectedValue };
    setCurrReminder(updatedReminder);
    onChange(updatedReminder);
  };

  return (
    <div style={{ padding: rem(20) }}>
      <Group position="center">
        {/* Slider Toggle */}
        <Switch
          checked={currReminder?.value || false}
          onChange={handleToggle}
          size="md"
          color="teal"
        />
      </Group>

      {/* Dropdown Select Component */}
      {currReminder?.value && (
        <Select
          label="Select an option"
          placeholder="Pick one"
          data={[
            { value: "6", label: "Every 6 hours" },
            { value: "12", label: "Every 12 hours" },
            { value: "24", label: "Once a day" },
          ]}
          onChange={handleSelectChange}
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

export function SliderMarksSessionLength(props) {
  console.log("props", props);
  return (
    <div className={classes.sliderContainer}>
      <Slider
        orientation="horizontal"
        classNames={{
          track: classes.sliderTrack, // Style for slider track
          marksWrapper: classes.marks, // Horizontal alignment for marks
          markLabel: classes.markLabel, // Center each label/icon
        }}
        onChange={props.onChange}
        value={props.value}
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

export function SliderMarksNewProblemsPerSession(props) {
  console.log("props", props);
  // Dynamically genrate Marks
  const generateMarks = (max) => {
    return Array.from({ length: max }, (_, index) => ({
      value: index + 1,
      label: index + 1,
    }));
  };

  const marks = generateMarks(props.max);
  return (
    <div className={classes.sliderContainer}>
      <Slider
        orientation="horizontal"
        classNames={{
          track: classes.sliderTrack, // Style for slider track
          marksWrapper: classes.marks, // Horizontal alignment for marks
          markLabel: classes.markLabel, // Center each label/icon
        }}
        onChange={props.onChange}
        value={props.value}
        thumbChildren={
          <IconGripHorizontal
            style={{ width: rem(20), height: rem(20) }}
            stroke={1.5}
          />
        }
        marks={marks}
        step={1}
        min={1}
        max={props.max}
        style={{ width: "100%" }}
      />
    </div>
  );
}
export function GradientSegmentedControlTimeLimit(props) {
  return (
    <SegmentedControl
      radius="md"
      size="sm"
      data={["Auto", "off", "15", "20", "30"]}
      classNames={classes}
      value={props.value}
      onChange={props.onChange}
      styles={() => ({
        indicator: {
          background: "linear-gradient(45deg, #9EC2FF, #03018C)", // Light yellow to dark yellow gradient
        },
        control: {
          "&[dataActive]": {
            color: "#333", // Optional: Set the active text color to contrast the yellow gradient
          },
        },
      })}
    />
  );
}
