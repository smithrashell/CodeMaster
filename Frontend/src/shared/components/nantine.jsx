import { Switch, Select, Group, Slider, rem } from "@mantine/core";
import { IconPoint, IconGripHorizontal } from "@tabler/icons-react";
import { SegmentedControl } from "@mantine/core";
import classes from "./css/SliderMarks.module.css";
import React, { useState, useEffect } from "react";

export function ToggleSelectRemainders({ reminder, onChange }) {
  const [currReminder, setCurrReminder] = useState(
    reminder || { enabled: false, time: "12" }
  ); // State to manage the slider toggle
  useEffect(() => {
    setCurrReminder(reminder || { enabled: false, time: "12" });
  }, [reminder]);

  const handleToggle = () => {
    const updatedReminder = {
      ...currReminder,
      enabled: !currReminder?.enabled,
    };
    setCurrReminder(updatedReminder);
    onChange(updatedReminder);
  };

  const handleSelectChange = (selectedValue) => {
    const updatedReminder = { ...currReminder, time: selectedValue };
    setCurrReminder(updatedReminder);
    onChange(updatedReminder);
  };

  return (
    <div>
      <Group position="center">
        {/* Slider Toggle */}
        <Switch
          checked={currReminder?.enabled || false}
          onChange={handleToggle}
          size="md"
          color={currReminder?.enabled ? "blue.5" : "gray.5"} // vivid blue when active
        />
      </Group>

      {/* Dropdown Select Component */}
      {currReminder?.enabled && (
        <Select
          label="Reminder Frequency"
          placeholder="Select frequency"
          value={currReminder?.time}
          data={[
            { value: "6", label: "Every 6 hours" },
            { value: "12", label: "Every 12 hours" },
            { value: "24", label: "Once a day" },
          ]}
          onChange={handleSelectChange}
          withinPortal={false}
          dropdownPosition="bottom"
          styles={{
            dropdown: {
              zIndex: 10000,
            },
          }}
        />
      )}
    </div>
  );
}

const point = (
  <IconPoint
    style={{
      marginTop: rem(6),
      width: rem(10),
      height: rem(10),
      color: "var(--cm-text)",
    }}
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
            style={{ width: rem(20), height: rem(20), color: "var(--cm-text)" }}
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
        style={{ width: "100%", marginBottom: rem(10) }}
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
            style={{ width: rem(20), height: rem(20), color: "var(--cm-text)" }}
            stroke={1.5}
          />
        }
        marks={marks}
        step={1}
        min={1}
        max={props.max}
        style={{ marginBottom: rem(10), width: "100%" }}
      />
    </div>
  );
}
export function GradientSegmentedControlTimeLimit(props) {
  return (
    <SegmentedControl
      radius="md"
      size="sm"
      data={[
        { label: "Auto", value: "Auto" },
        { label: "Off", value: "off" },
        { label: "Fixed", value: "Fixed" },
      ]}
      value={props.value}
      onChange={props.onChange}
      color="var(--cm-active-blue)"
    />
  );
}
