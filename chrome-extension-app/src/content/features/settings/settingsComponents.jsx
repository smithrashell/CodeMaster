/**
 * Settings Components - UI Components for Settings Page
 */

import { useState, useEffect } from "react";
import Button from '../../components/ui/Button.jsx';
import Tooltip from '../../components/ui/Tooltip.jsx';
import SegmentedControl from '../../components/ui/SegmentedControl.jsx';
import Switch from '../../components/ui/Switch.jsx';
import { IconTrophy, IconInfoCircle, IconClock } from "@tabler/icons-react";
import { component, debug } from "../../../shared/utils/logger.js";

// Interview Mode Controls Component
export function InterviewModeControls({ settings, updateSettings, interviewReadiness }) {
  component("InterviewModeControls", "🎯 Rendering with data", {
    hasSettings: !!settings,
    interviewMode: settings?.interviewMode,
    readiness: interviewReadiness
  });

  const getInterviewModeData = () => [
    { label: "Disabled", value: "disabled", description: "Standard learning sessions with full support" },
    { label: "Interview-Like", value: "interview-like", disabled: false, description: "Limited hints, mild time pressure" },
    { label: "Full Interview", value: "full-interview", disabled: false, description: "No hints, strict timing, realistic conditions" }
  ];

  const currentMode = settings?.interviewMode || "disabled";
  const currentModeData = getInterviewModeData().find(mode => mode.value === currentMode);

  if (!settings) {
    return <InterviewModeLoadingState />;
  }

  return (
    <div className="cm-form-group">
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
        <IconTrophy size={14} />
        Interview Mode
        <Tooltip label="Interview practice modes to test skill transfer under pressure" withArrow position="top" classNames={{ tooltip: 'cm-force-tooltip-visible' }}>
          <IconInfoCircle size={12} style={{ cursor: "help", opacity: 0.7 }} />
        </Tooltip>
      </div>

      <SegmentedControl
        value={currentMode}
        onChange={(value) => {
          component("InterviewModeControls", "🎯 Interview mode change", { value });
          const updatedSettings = { ...settings, interviewMode: value };
          debug("🎯 Updated settings", updatedSettings);
          updateSettings(updatedSettings);
        }}
        data={getInterviewModeData().map(item => ({
          ...item,
          label: item.value === "disabled" ? "Disabled" : item.value === "interview-like" ? "Practice" : "Interview"
        }))}
        size="xs"
        style={{ width: '100%', cursor: 'pointer' }}
      />

      {currentModeData && currentMode !== "disabled" && (
        <div style={{ fontSize: '11px', color: '#ffffff', marginTop: '6px', display: 'flex', alignItems: 'center', minHeight: '16px' }}>
          <IconClock size={12} style={{ marginRight: '6px', flexShrink: 0, color: 'var(--cm-text-secondary)' }} />
          <span style={{ color: 'var(--cm-text-secondary)' }}>
            {currentMode === "interview-like" ? "Limited hints, mild pressure" : currentMode === "full-interview" ? "No hints, strict timing" : currentModeData.description}
          </span>
        </div>
      )}

      {currentMode !== "disabled" && (
        <div style={{ fontSize: '11px', color: '#ffffff', marginTop: '6px', padding: '6px 8px', background: '#2c2e33', border: '1px solid #373a40', borderRadius: '4px' }}>
          🎯 Applies to next session
        </div>
      )}

      {currentMode !== "disabled" && (
        <InterviewFrequencyControls settings={settings} updateSettings={updateSettings} />
      )}
    </div>
  );
}

// Helper component for loading state
export const InterviewModeLoadingState = () => (
  <div className="cm-form-group">
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
      <IconTrophy size={14} />
      Interview Mode
      <Tooltip label="Loading interview settings..." withArrow position="top" classNames={{ tooltip: 'cm-force-tooltip-visible' }}>
        <IconInfoCircle size={12} style={{ cursor: "help", opacity: 0.7 }} />
      </Tooltip>
    </div>
    <div style={{ padding: '8px', background: '#f8f9fa', borderRadius: '4px', fontSize: '12px', color: 'var(--cm-text)' }}>⏳ Loading...</div>
  </div>
);

// Helper component for interview frequency controls
export const InterviewFrequencyControls = ({ settings, updateSettings }) => (
  <>
    <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #e0e0e0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
        📅 Interview Frequency
        <Tooltip label="When should interview sessions be automatically suggested?" withArrow position="top" classNames={{ tooltip: 'cm-force-tooltip-visible' }}>
          <IconInfoCircle size={12} style={{ cursor: "help", opacity: 0.7 }} />
        </Tooltip>
      </div>

      <SegmentedControl
        value={settings?.interviewFrequency || "manual"}
        onChange={(value) => {
          component("InterviewModeControls", "🎯 Interview frequency change", { value });
          const updatedSettings = { ...settings, interviewFrequency: value };
          debug("🎯 Updated settings", updatedSettings);
          updateSettings(updatedSettings);
        }}
        data={[
          { label: "Manual", value: "manual", description: "You decide when" },
          { label: "Weekly", value: "weekly", description: "Auto-suggest weekly" },
          { label: "Level Up", value: "level-up", description: "On mastery progress" }
        ]}
        size="xs"
        style={{ width: '100%', cursor: 'pointer' }}
      />

      <div style={{ fontSize: '10px', color: 'var(--cm-text)', marginTop: '4px' }}>
        {settings?.interviewFrequency === "manual" && "Interview sessions available on demand"}
        {settings?.interviewFrequency === "weekly" && "System will suggest interview sessions every 7-10 days"}
        {settings?.interviewFrequency === "level-up" && "Interview sessions suggested after tag mastery improvements"}
      </div>
    </div>

    {settings?.interviewFrequency === "level-up" && (
      <ReadinessThresholdControl settings={settings} updateSettings={updateSettings} />
    )}
  </>
);

// Readiness Threshold Control
const ReadinessThresholdControl = ({ settings, updateSettings }) => (
  <div style={{ marginTop: '12px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
      🎯 Readiness Threshold
      <Tooltip label="Minimum performance score needed before suggesting Full Interview mode" withArrow position="top" styles={{ tooltip: { zIndex: 9700, fontSize: '11px' } }}>
        <IconInfoCircle size={12} style={{ cursor: "help", opacity: 0.7 }} />
      </Tooltip>
    </div>

    <div style={{ padding: '8px', background: '#f8f9fa', borderRadius: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--cm-text)' }}>Conservative</span>
        <span style={{ fontSize: '12px', fontWeight: '500' }}>{Math.round((settings?.interviewReadinessThreshold || 0.7) * 100)}%</span>
        <span style={{ fontSize: '11px', color: 'var(--cm-text)' }}>Confident</span>
      </div>

      <input
        type="range"
        min="0.5"
        max="1.0"
        step="0.05"
        value={settings?.interviewReadinessThreshold || 0.7}
        onChange={(e) => updateSettings({ ...settings, interviewReadinessThreshold: parseFloat(e.target.value) })}
        style={{ width: '100%', height: '4px', borderRadius: '2px', background: '#ddd', outline: 'none', cursor: 'pointer' }}
      />

      <div style={{ fontSize: '10px', color: 'var(--cm-text)', marginTop: '4px', textAlign: 'center' }}>
        Full Interview mode unlocks at {Math.round((settings?.interviewReadinessThreshold || 0.7) * 100)}% mastery
      </div>
    </div>
  </div>
);

// Learning Progress Display Component
export const LearningProgressDisplay = ({ learningStatus }) => {
  const progressPercentage = learningStatus.learningPhase ? Math.max(0, ((5 - learningStatus.sessionsNeeded) / 5) * 100) : 100;

  return (
    <div style={{ marginBottom: '10px', padding: '8px 12px', backgroundColor: 'var(--cm-bg-secondary)', borderRadius: '6px', border: '1px solid var(--cm-border)', fontSize: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ marginRight: '6px' }}>🧠</span>
        <span style={{ fontWeight: '500', color: 'var(--cm-text)' }}>
          {learningStatus.learningPhase ? 'Learning your habits...' : 'Habits learned!'}
        </span>
      </div>
      <div style={{ color: 'var(--cm-text-secondary)' }}>
        {learningStatus.learningPhase ? `Complete ${learningStatus.sessionsNeeded} more sessions for personalized reminders` : 'Personalized reminders are now available'}
        <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--cm-bg-tertiary)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercentage}%`, height: '100%', backgroundColor: 'var(--cm-primary, #228be6)', transition: 'width 0.3s ease' }} />
        </div>
      </div>
    </div>
  );
};

// Reminder Type Checkboxes Component
export const ReminderTypeCheckboxes = ({ settings, handleReminderTypeChange }) => (
  <div style={{ marginTop: '12px', marginLeft: '8px' }}>
    <div style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--cm-text)', marginBottom: '8px' }}>
      Reminder Types
    </div>

    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
      <input type="checkbox" id="streakAlerts" checked={settings.reminder?.streakAlerts || false} onChange={(e) => handleReminderTypeChange('streakAlerts', e.target.checked)} style={{ marginRight: '8px' }} />
      <label htmlFor="streakAlerts" style={{ fontSize: '12px', color: 'var(--cm-text)' }}>🔥 Streak alerts (protect practice streaks)</label>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
      <input type="checkbox" id="cadenceNudges" checked={settings.reminder?.cadenceNudges || false} onChange={(e) => handleReminderTypeChange('cadenceNudges', e.target.checked)} style={{ marginRight: '8px' }} />
      <label htmlFor="cadenceNudges" style={{ fontSize: '12px', color: 'var(--cm-text)' }}>📅 Cadence reminders (based on your practice rhythm)</label>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
      <input type="checkbox" id="weeklyGoals" checked={settings.reminder?.weeklyGoals || false} onChange={(e) => handleReminderTypeChange('weeklyGoals', e.target.checked)} style={{ marginRight: '8px' }} />
      <label htmlFor="weeklyGoals" style={{ fontSize: '12px', color: 'var(--cm-text)' }}>🎯 Weekly goal notifications (mid-week & weekend check-ins)</label>
    </div>

    <div style={{ display: 'flex', alignItems: 'center' }}>
      <input type="checkbox" id="reEngagement" checked={settings.reminder?.reEngagement || false} onChange={(e) => handleReminderTypeChange('reEngagement', e.target.checked)} style={{ marginRight: '8px' }} />
      <label htmlFor="reEngagement" style={{ fontSize: '12px', color: 'var(--cm-text)' }}>👋 Re-engagement prompts (gentle return after breaks)</label>
    </div>
  </div>
);

// Custom Reminders Component
export const RemindersSection = ({ settings, setSettings }) => {
  const [learningStatus, setLearningStatus] = useState({ totalSessions: 0, learningPhase: true, sessionsNeeded: 5, loading: true });

  useEffect(() => {
    fetchLearningStatus();
  }, []);

  const fetchLearningStatus = () => {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({ type: "getLearningStatus" }, (response) => {
          if (response && !chrome.runtime.lastError) {
            setLearningStatus({ totalSessions: response.totalSessions || 0, learningPhase: response.learningPhase || true, sessionsNeeded: Math.max(0, 5 - (response.totalSessions || 0)), loading: false });
          } else {
            setLearningStatus({ totalSessions: 0, learningPhase: true, sessionsNeeded: 5, loading: false });
          }
        });
      } else {
        setLearningStatus({ totalSessions: 0, learningPhase: true, sessionsNeeded: 5, loading: false });
      }
    } catch (error) {
      console.warn("Error fetching learning status:", error);
      setLearningStatus({ totalSessions: 0, learningPhase: true, sessionsNeeded: 5, loading: false });
    }
  };

  const handleToggle = () => {
    setSettings(prev => ({ ...prev, reminder: { ...prev.reminder, enabled: !prev.reminder?.enabled } }));
  };

  const handleReminderTypeChange = (reminderType, value) => {
    setSettings(prev => ({ ...prev, reminder: { ...prev.reminder, [reminderType]: value } }));
  };

  return (
    <div className="cm-form-group">
      <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--cm-text)' }}>Reminders</div>
      <LearningProgressDisplay learningStatus={learningStatus} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '5px' }}>
        <Switch checked={settings.reminder?.enabled || false} onChange={handleToggle} size="md" disabled={learningStatus.learningPhase && !learningStatus.loading} />
      </div>
      {settings.reminder?.enabled && !learningStatus.learningPhase && (
        <ReminderTypeCheckboxes settings={settings} handleReminderTypeChange={handleReminderTypeChange} />
      )}
    </div>
  );
};

// Save Button Component
export const SaveSettingsButton = ({ workingSettings, handleSave }) => (
  <Button
    id="save-settings-button"
    onClick={() => handleSave(workingSettings)}
    size="lg"
    style={{ width: '100%', padding: '12px 24px', backgroundColor: 'var(--cm-primary, #228be6)', fontSize: '16px', fontWeight: '600', marginTop: '16px', transition: 'all 0.2s ease' }}
    onMouseOver={(e) => { e.target.style.backgroundColor = 'var(--cm-primary-hover, #1971c2)'; e.target.style.transform = 'translateY(-1px)'; }}
    onMouseOut={(e) => { e.target.style.backgroundColor = 'var(--cm-primary, #228be6)'; e.target.style.transform = 'translateY(0px)'; }}
    onFocus={(e) => { e.target.style.backgroundColor = 'var(--cm-primary-hover, #1971c2)'; }}
    onBlur={(e) => { e.target.style.backgroundColor = 'var(--cm-primary, #228be6)'; }}
  >
    Save Settings
  </Button>
);

// Component for debug/loading state information
export const LoadingDebugInfo = ({ settings, _loading, _error }) => {
  if (settings) return null;
  return (
    <div style={{ padding: '8px', background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px', marginBottom: '8px' }}>
      <div style={{ fontSize: '11px', color: 'var(--cm-text)' }}>⚠️ Settings loading: {_loading ? 'Loading...' : _error ? 'Error' : 'Using defaults'}</div>
    </div>
  );
};

// Component for session controls
export const SessionControls = ({ workingSettings, setSettings, maxNewProblems }) => {
  if (workingSettings.adaptive) return null;

  return (
    <>
      <div className="cm-form-group">
        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--cm-text)' }}>Session Length: {workingSettings.sessionLength} problems</div>
        <input type="range" min="3" max="12" value={workingSettings.sessionLength} onChange={(e) => setSettings({ ...workingSettings, sessionLength: parseInt(e.target.value) })} style={{ width: '100%', height: '4px', borderRadius: '2px', outline: 'none', cursor: 'pointer' }} />
      </div>

      <div className="cm-form-group">
        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--cm-text)' }}>
          New Problems Per Session: {Math.min(workingSettings.numberofNewProblemsPerSession || 1, Math.min(maxNewProblems, workingSettings.sessionLength || 8))}
          {maxNewProblems < (workingSettings.sessionLength || 8) && <span style={{ fontSize: '11px', color: 'var(--cm-text-secondary)', marginLeft: '8px' }}>(Max {maxNewProblems} during onboarding)</span>}
        </div>
        <input type="range" min="1" max={Math.min(maxNewProblems, workingSettings.sessionLength || 8)} value={Math.min(workingSettings.numberofNewProblemsPerSession || 1, Math.min(maxNewProblems, workingSettings.sessionLength || 8))} onChange={(e) => { const newValue = parseInt(e.target.value); setSettings({ ...workingSettings, numberofNewProblemsPerSession: Math.min(newValue, workingSettings.sessionLength || 8) }); }} style={{ width: '100%', height: '4px', borderRadius: '2px', outline: 'none', cursor: 'pointer' }} />
      </div>
    </>
  );
};
