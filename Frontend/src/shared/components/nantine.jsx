import { Switch, Slider, rem } from "@mantine/core";
import { IconPoint, IconGripHorizontal } from "@tabler/icons-react";
import { SegmentedControl } from "@mantine/core";
import classes from "./css/SliderMarks.module.css";
import  { useState, useEffect } from "react";

// Helper functions for rendering different sections
const renderLearningProgress = (learningStatus) => {
  if (!learningStatus.learningPhase || learningStatus.loading) return null;

  return (
    <div style={{ 
      marginTop: '10px', 
      padding: '8px 12px', 
      backgroundColor: 'var(--cm-bg-secondary)', 
      borderRadius: '6px',
      border: '1px solid var(--cm-border)',
      fontSize: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ marginRight: '6px' }}>🧠</span>
        <span style={{ fontWeight: '500', color: 'var(--cm-text)' }}>
          Learning your habits...
        </span>
      </div>
      <div style={{ color: 'var(--cm-text)' }}>
        {learningStatus.sessionsNeeded > 0 ? (
          <>
            Complete {learningStatus.sessionsNeeded} more session{learningStatus.sessionsNeeded > 1 ? 's' : ''} for personalized reminders
            <div style={{ 
              width: '100%', 
              height: '4px', 
              backgroundColor: 'var(--cm-border)', 
              borderRadius: '2px', 
              marginTop: '4px',
              overflow: 'hidden'
            }}>
              <div style={{ 
                width: `${(learningStatus.totalSessions / 5) * 100}%`, 
                height: '100%', 
                backgroundColor: 'var(--cm-primary)', 
                transition: 'width 0.3s ease'
              }} />
            </div>
          </>
        ) : (
          "Almost ready for smart reminders!"
        )}
      </div>
    </div>
  );
};

const renderReminderOption = (id, currReminder, handleReminderTypeChange, emoji, text) => (
  <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center' }}>
    <input
      type="checkbox"
      id={id}
      checked={currReminder?.[id] || false}
      onChange={(e) => handleReminderTypeChange(id, e.target.checked)}
      style={{ marginRight: '8px' }}
    />
    <label htmlFor={id} style={{ fontSize: '12px', color: 'var(--cm-text)' }}>
      {emoji} {text}
    </label>
  </div>
);

const renderReminderOptions = (currReminder, learningStatus, handleReminderTypeChange) => {
  if (!currReminder?.enabled || learningStatus.learningPhase) return null;

  return (
    <div style={{ marginTop: '12px', marginLeft: '8px' }}>
      <div style={{ 
        display: 'block', 
        fontSize: '13px', 
        fontWeight: '500', 
        color: 'var(--cm-text)', 
        marginBottom: '8px' 
      }} role="heading" aria-level="4">
        Reminder Types
      </div>
      
      {renderReminderOption(
        'streakAlerts', 
        currReminder, 
        handleReminderTypeChange, 
        '🔥', 
        'Streak alerts (protect practice streaks)'
      )}
      
      {renderReminderOption(
        'cadenceNudges', 
        currReminder, 
        handleReminderTypeChange, 
        '📅', 
        'Cadence reminders (based on your practice rhythm)'
      )}
      
      {renderReminderOption(
        'weeklyGoals', 
        currReminder, 
        handleReminderTypeChange, 
        '🎯', 
        'Weekly goal notifications (mid-week & weekend check-ins)'
      )}
      
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <input
          type="checkbox"
          id="reEngagement"
          checked={currReminder?.reEngagement || false}
          onChange={(e) => handleReminderTypeChange('reEngagement', e.target.checked)}
          style={{ marginRight: '8px' }}
        />
        <label htmlFor="reEngagement" style={{ fontSize: '12px', color: 'var(--cm-text)' }}>
          👋 Re-engagement prompts (gentle return after breaks)
        </label>
      </div>
    </div>
  );
};

const getDefaultReminder = () => ({
  enabled: false, 
  streakAlerts: false,
  cadenceNudges: false,
  weeklyGoals: false,
  reEngagement: false
});


export function ToggleSelectRemainders({ reminder, onChange }) {
  const [learningStatus, setLearningStatus] = useState({
    totalSessions: 0,
    learningPhase: true,
    sessionsNeeded: 5,
    loading: true
  });
  const [currReminder, setCurrReminder] = useState(reminder || getDefaultReminder());
  
  useEffect(() => {
    setCurrReminder(reminder || getDefaultReminder());
    fetchLearningStatus();
  }, [reminder]);

  const fetchLearningStatus = () => {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage(
          { type: "getLearningStatus" },
          (response) => {
            if (response && !chrome.runtime.lastError) {
              setLearningStatus({
                totalSessions: response.totalSessions || 0,
                learningPhase: response.learningPhase || true,
                sessionsNeeded: Math.max(0, 5 - (response.totalSessions || 0)),
                loading: false
              });
            } else {
              setLearningStatus({
                totalSessions: 0,
                learningPhase: true,
                sessionsNeeded: 5,
                loading: false
              });
            }
          }
        );
      } else {
        setLearningStatus({
          totalSessions: 0,
          learningPhase: true,
          sessionsNeeded: 5,
          loading: false
        });
      }
    } catch (error) {
      console.warn("Error fetching learning status:", error);
      setLearningStatus({
        totalSessions: 0,
        learningPhase: true,
        sessionsNeeded: 5,
        loading: false
      });
    }
  };

  const handleToggle = () => {
    const updatedReminder = {
      ...currReminder,
      enabled: !currReminder?.enabled,
    };
    setCurrReminder(updatedReminder);
    onChange(updatedReminder);
  };

  const handleReminderTypeChange = (reminderType, value) => {
    const updatedReminder = { 
      ...currReminder, 
      [reminderType]: value 
    };
    setCurrReminder(updatedReminder);
    onChange(updatedReminder);
  };

  return (
    <div>
      {renderLearningProgress(learningStatus)}
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' , margin: "5px"}}>
        <Switch
          checked={currReminder?.enabled || false}
          onChange={handleToggle}
          size="md"
          color={currReminder?.enabled ? "blue.5" : "gray.5"}
          disabled={learningStatus.learningPhase && !learningStatus.loading}
        />
      </div>

      {renderReminderOptions(currReminder, learningStatus, handleReminderTypeChange)}
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
  // Dynamically generate Marks with proper validation
  const generateMarks = (max) => {
    // Ensure max is a valid positive number, default to 8 if invalid
    const validMax = typeof max === 'number' && max > 0 ? max : 8;
    return Array.from({ length: validMax }, (_, index) => ({
      value: index + 1,
      label: index + 1,
    }));
  };

  // Use validated max value
  const validMax = typeof props.max === 'number' && props.max > 0 ? props.max : 8;
  const marks = generateMarks(validMax);
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
        max={validMax}
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
