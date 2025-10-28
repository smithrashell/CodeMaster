import "../../css/main.css";
import { useState, useEffect, useMemo } from "react";
import Button from '../../components/ui/Button.jsx';
import Tooltip from '../../components/ui/Tooltip.jsx';
import SegmentedControl from '../../components/ui/SegmentedControl.jsx';
import Switch from '../../components/ui/Switch.jsx';
import { IconTrophy, IconInfoCircle, IconClock } from "@tabler/icons-react";
import AdaptiveSessionToggle from "./AdaptiveSessionToggle.js";
import Header from "../../components/navigation/header.jsx";
import { useChromeMessage, clearChromeMessageCache } from "../../../shared/hooks/useChromeMessage";
import { useInterviewReadiness } from "../../../shared/hooks/useInterviewReadiness";
import { useNav } from "../../../shared/provider/navprovider";
import { useAnimatedClose } from "../../../shared/hooks/useAnimatedClose";
import SessionLimits from "../../../shared/utils/sessionLimits.js";
import { component, debug, system } from "../../../shared/utils/logger.js";

// Interview Mode Controls Component (copied from AdaptiveSettingsCard)
function InterviewModeControls({ settings, updateSettings, interviewReadiness }) {
  component("InterviewModeControls", "🎯 Rendering with data", { 
    hasSettings: !!settings, 
    interviewMode: settings?.interviewMode,
    readiness: interviewReadiness 
  });
  
  const getInterviewModeData = () => [
    { 
      label: "Disabled", 
      value: "disabled",
      description: "Standard learning sessions with full support"
    },
    { 
      label: "Interview-Like", 
      value: "interview-like",
      disabled: false, // Always enable for testing - remove readiness check
      description: "Limited hints, mild time pressure"
    },
    { 
      label: "Full Interview", 
      value: "full-interview",
      disabled: false, // Always enable for testing - remove readiness check
      description: "No hints, strict timing, realistic conditions"
    }
  ];

  const currentMode = settings?.interviewMode || "disabled";
  const currentModeData = getInterviewModeData().find(mode => mode.value === currentMode);

  // Always render the component, even if settings aren't loaded yet
  if (!settings) {
    return <InterviewModeLoadingState />;
  }

  return (
    <div className="cm-form-group">
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
        <IconTrophy size={14} />
        Interview Mode
        <Tooltip 
          label="Interview practice modes to test skill transfer under pressure"
          withArrow
          position="top"
          classNames={{
            tooltip: 'cm-force-tooltip-visible'
          }}
        >
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
          label: item.value === "disabled" ? "Disabled" : 
                 item.value === "interview-like" ? "Practice" : 
                 "Interview" // Clearer labels for content script
        }))}
        size="xs"
        style={{ width: '100%', cursor: 'pointer' }}
      />
      
      {currentModeData && currentMode !== "disabled" && (
        <div style={{ 
          fontSize: '11px', 
          color: '#ffffff', // Fixed white color for visibility
          marginTop: '6px', 
          display: 'flex', 
          alignItems: 'center',
          minHeight: '16px' // Ensure adequate height for icon
        }}>
          <IconClock size={12} style={{ marginRight: '6px', flexShrink: 0, color: 'var(--cm-text-secondary)' }} />
          <span style={{ color: 'var(--cm-text-secondary)' }}>
            {currentMode === "interview-like" ? "Limited hints, mild pressure" : 
             currentMode === "full-interview" ? "No hints, strict timing" : 
             currentModeData.description}
          </span>
        </div>
      )}
      
      {currentMode !== "disabled" && (
        <div style={{ 
          fontSize: '11px', 
          color: '#ffffff', // Fixed white text for visibility
          marginTop: '6px', 
          padding: '6px 8px', 
          background: '#2c2e33', // Dark background for contrast
          border: '1px solid #373a40',
          borderRadius: '4px' 
        }}>
          🎯 Applies to next session
        </div>
      )}

      {/* Interview Frequency Controls - Show only when interview mode is enabled */}
      {currentMode !== "disabled" && (
        <InterviewFrequencyControls settings={settings} updateSettings={updateSettings} />
      )}
    </div>
  );
}

// Helper component for loading state
const InterviewModeLoadingState = () => (
  <div className="cm-form-group">
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '14px', fontWeight: '500' }}>
      <IconTrophy size={14} />
      Interview Mode
      <Tooltip 
        label="Loading interview settings..." 
        withArrow 
        position="top"
        classNames={{
          tooltip: 'cm-force-tooltip-visible'
        }}
      >
        <IconInfoCircle size={12} style={{ cursor: "help", opacity: 0.7 }} />
      </Tooltip>
    </div>
    <div style={{ padding: '8px', background: '#f8f9fa', borderRadius: '4px', fontSize: '12px', color: 'var(--cm-text)' }}>
      ⏳ Loading...
    </div>
  </div>
);

// Helper component for interview frequency controls
const InterviewFrequencyControls = ({ settings, updateSettings }) => (
  <>
    <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #e0e0e0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
        📅 Interview Frequency
        <Tooltip 
          label="When should interview sessions be automatically suggested?"
          withArrow 
          position="top"
          classNames={{
            tooltip: 'cm-force-tooltip-visible'
          }}
        >
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

    {/* Readiness Threshold - Show only for level-up frequency */}
    {settings?.interviewFrequency === "level-up" && (
      <div style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
          🎯 Readiness Threshold
          <Tooltip 
            label="Minimum performance score needed before suggesting Full Interview mode"
            withArrow 
            position="top"
            styles={{
              tooltip: {
                zIndex: 9700,
                fontSize: '11px'
              }
            }}
          >
            <IconInfoCircle size={12} style={{ cursor: "help", opacity: 0.7 }} />
          </Tooltip>
        </div>

        <div style={{ padding: '8px', background: '#f8f9fa', borderRadius: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--cm-text)' }}>Conservative</span>
            <span style={{ fontSize: '12px', fontWeight: '500' }}>
              {Math.round((settings?.interviewReadinessThreshold || 0.7) * 100)}%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--cm-text)' }}>Confident</span>
          </div>
          
          <input
            type="range"
            min="0.5"
            max="1.0"
            step="0.05"
            value={settings?.interviewReadinessThreshold || 0.7}
            onChange={(e) => updateSettings({ 
              ...settings, 
              interviewReadinessThreshold: parseFloat(e.target.value) 
            })}
            style={{
              width: '100%',
              height: '4px',
              borderRadius: '2px',
              background: '#ddd',
              outline: 'none',
              cursor: 'pointer'
            }}
          />
          
          <div style={{ fontSize: '10px', color: 'var(--cm-text)', marginTop: '4px', textAlign: 'center' }}>
            Full Interview mode unlocks at {Math.round((settings?.interviewReadinessThreshold || 0.7) * 100)}% mastery
          </div>
        </div>
      </div>
    )}
  </>
);

// Custom hook for settings management
const useSettingsState = () => {
  const [settings, setSettings] = useState(null);
  const [maxNewProblems, setMaxNewProblems] = useState(8);
  const useMock = false;
  
  const MOCK_SETTINGS = useMemo(() => ({
    adaptive: true,
    sessionLength: 8,
    numberofNewProblemsPerSession: 3,
    limit: "Auto",
    reminder: { 
      enabled: false, 
      streakAlerts: false,
      cadenceNudges: false,
      weeklyGoals: false,
      reEngagement: false
    },
    interviewMode: "disabled",
    interviewReadinessThreshold: 0.8,
    interviewFrequency: "manual",
  }), []);

  // Settings loading
  const { data: _chromeSettings, loading: _loading, error: _error } = useChromeMessage(
    !useMock ? { type: "getSettings" } : null, [], {
      onSuccess: (response) => {
        if (response) {
          setSettings(response);
        } else {
          console.warn("No settings received, using defaults.");
        }
      },
    }
  );

  // Handle mock settings
  useEffect(() => {
    if (useMock) {
      setSettings(MOCK_SETTINGS);
    }
  }, [useMock, MOCK_SETTINGS]);

  // Initialize interview settings
  useEffect(() => {
    if (settings && !settings.interviewMode) {
      const defaultSettings = {
        ...settings,
        interviewMode: "disabled",
        interviewReadinessThreshold: 0.8,
        interviewFrequency: "manual",
      };
      setSettings(defaultSettings);
    }
  }, [settings]);

  // Update max new problems
  useEffect(() => {
    const updateMaxNewProblems = async () => {
      try {
        const sessionState = await chrome.runtime.sendMessage({ type: "getSessionState" });
        const newMax = SessionLimits.getMaxNewProblems(sessionState, settings?.sessionLength);
        setMaxNewProblems(newMax);
      } catch (error) {
        const fallbackMax = SessionLimits.getMaxNewProblems(null, settings?.sessionLength);
        setMaxNewProblems(fallbackMax);
      }
    };

    if (settings) {
      updateMaxNewProblems();
    }
  }, [settings]);

  return { settings, setSettings, maxNewProblems, _loading, _error };
};

// Helper to get working settings
const getWorkingSettings = (settings) => {
  return settings || {
    adaptive: true,
    sessionLength: 8,
    numberofNewProblemsPerSession: 3,
    limit: "Auto",
    reminder: { 
      enabled: false, 
      streakAlerts: false,
      cadenceNudges: false,
      weeklyGoals: false,
      reEngagement: false
    },
    interviewMode: "disabled",
    interviewReadinessThreshold: 0.7,
    interviewFrequency: "manual"
  };
};

// Learning Progress Display Component
const LearningProgressDisplay = ({ learningStatus }) => {
  const progressPercentage = learningStatus.learningPhase 
    ? Math.max(0, ((5 - learningStatus.sessionsNeeded) / 5) * 100)
    : 100;

  return (
    <div style={{ 
      marginBottom: '10px', 
      padding: '8px 12px', 
      backgroundColor: 'var(--cm-bg-secondary)', 
      borderRadius: '6px',
      border: '1px solid var(--cm-border)',
      fontSize: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ marginRight: '6px' }}>🧠</span>
        <span style={{ fontWeight: '500', color: 'var(--cm-text)' }}>
          {learningStatus.learningPhase ? 'Learning your habits...' : 'Habits learned!'}
        </span>
      </div>
      <div style={{ color: 'var(--cm-text-secondary)' }}>
        {learningStatus.learningPhase 
          ? `Complete ${learningStatus.sessionsNeeded} more sessions for personalized reminders`
          : 'Personalized reminders are now available'
        }
        <div style={{ 
          width: '100%', 
          height: '4px', 
          backgroundColor: 'var(--cm-bg-tertiary)', 
          borderRadius: '2px', 
          marginTop: '4px',
          overflow: 'hidden'
        }}>
          <div style={{ 
            width: `${progressPercentage}%`, 
            height: '100%', 
            backgroundColor: 'var(--cm-primary, #228be6)', 
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>
    </div>
  );
};

// Reminder Type Checkboxes Component
const ReminderTypeCheckboxes = ({ settings, handleReminderTypeChange }) => (
  <div style={{ marginTop: '12px', marginLeft: '8px' }}>
    <div style={{ 
      display: 'block', 
      fontSize: '13px', 
      fontWeight: '500', 
      color: 'var(--cm-text)', 
      marginBottom: '8px' 
    }}>
      Reminder Types
    </div>
    
    {/* Streak Alerts */}
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
      <input
        type="checkbox"
        id="streakAlerts"
        checked={settings.reminder?.streakAlerts || false}
        onChange={(e) => handleReminderTypeChange('streakAlerts', e.target.checked)}
        style={{ marginRight: '8px' }}
      />
      <label htmlFor="streakAlerts" style={{ fontSize: '12px', color: 'var(--cm-text)' }}>
        🔥 Streak alerts (protect practice streaks)
      </label>
    </div>

    {/* Cadence Nudges */}
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
      <input
        type="checkbox"
        id="cadenceNudges"
        checked={settings.reminder?.cadenceNudges || false}
        onChange={(e) => handleReminderTypeChange('cadenceNudges', e.target.checked)}
        style={{ marginRight: '8px' }}
      />
      <label htmlFor="cadenceNudges" style={{ fontSize: '12px', color: 'var(--cm-text)' }}>
        📅 Cadence reminders (based on your practice rhythm)
      </label>
    </div>

    {/* Weekly Goals */}
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
      <input
        type="checkbox"
        id="weeklyGoals"
        checked={settings.reminder?.weeklyGoals || false}
        onChange={(e) => handleReminderTypeChange('weeklyGoals', e.target.checked)}
        style={{ marginRight: '8px' }}
      />
      <label htmlFor="weeklyGoals" style={{ fontSize: '12px', color: 'var(--cm-text)' }}>
        🎯 Weekly goal notifications (mid-week & weekend check-ins)
      </label>
    </div>

    {/* Re-engagement */}
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <input
        type="checkbox"
        id="reEngagement"
        checked={settings.reminder?.reEngagement || false}
        onChange={(e) => handleReminderTypeChange('reEngagement', e.target.checked)}
        style={{ marginRight: '8px' }}
      />
      <label htmlFor="reEngagement" style={{ fontSize: '12px', color: 'var(--cm-text)' }}>
        👋 Re-engagement prompts (gentle return after breaks)
      </label>
    </div>
  </div>
);

// Custom Reminders Component (without Mantine)
const RemindersSection = ({ settings, setSettings }) => {
  const [learningStatus, setLearningStatus] = useState({
    totalSessions: 0,
    learningPhase: true,
    sessionsNeeded: 5,
    loading: true
  });

  useEffect(() => {
    fetchLearningStatus();
  }, []);

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
    setSettings(prev => ({
      ...prev,
      reminder: {
        ...prev.reminder,
        enabled: !prev.reminder?.enabled
      }
    }));
  };

  const handleReminderTypeChange = (reminderType, value) => {
    setSettings(prev => ({
      ...prev,
      reminder: {
        ...prev.reminder,
        [reminderType]: value
      }
    }));
  };

  return (
    <div className="cm-form-group">
      <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--cm-text)' }}>
        Reminders
      </div>
      
      {/* Learning Progress Section */}
      <LearningProgressDisplay learningStatus={learningStatus} />

      {/* Main Reminder Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '5px' }}>
        <Switch
          checked={settings.reminder?.enabled || false}
          onChange={handleToggle}
          size="md"
          disabled={learningStatus.learningPhase && !learningStatus.loading}
        />
      </div>

      {/* Reminder Type Options - shown when enabled and not in learning phase */}
      {settings.reminder?.enabled && !learningStatus.learningPhase && (
        <ReminderTypeCheckboxes 
          settings={settings} 
          handleReminderTypeChange={handleReminderTypeChange} 
        />
      )}
    </div>
  );
};

// Save Button Component
const SaveSettingsButton = ({ workingSettings, handleSave }) => (
  <Button 
    id="save-settings-button"
    onClick={() => handleSave(workingSettings)} 
    size="lg"
    style={{
      width: '100%',
      padding: '12px 24px',
      backgroundColor: 'var(--cm-primary, #228be6)',
      fontSize: '16px',
      fontWeight: '600',
      marginTop: '16px',
      transition: 'all 0.2s ease'
    }}
    onMouseOver={(e) => {
      e.target.style.backgroundColor = 'var(--cm-primary-hover, #1971c2)';
      e.target.style.transform = 'translateY(-1px)';
    }}
    onMouseOut={(e) => {
      e.target.style.backgroundColor = 'var(--cm-primary, #228be6)';
      e.target.style.transform = 'translateY(0px)';
    }}
    onFocus={(e) => {
      e.target.style.backgroundColor = 'var(--cm-primary-hover, #1971c2)';
    }}
    onBlur={(e) => {
      e.target.style.backgroundColor = 'var(--cm-primary, #228be6)';
    }}
  >
    Save Settings
  </Button>
);

// Helper to save settings
const saveSettings = (settings) => {
  console.log("🔄 Saving settings:", settings);
  chrome.runtime.sendMessage(
    { type: "setSettings", message: settings },
    (response) => {
      console.log("✅ Settings save response:", response);
      chrome.runtime.sendMessage({ type: "clearSettingsCache" }, (cacheResponse) => {
        console.log("🗑️ Settings cache cleared:", cacheResponse);
      });
      // Clear the useChromeMessage cache to prevent stale data
      clearChromeMessageCache("getSettings");
      
      if (response?.status === "success") {
        console.log("✅ Settings successfully saved and cache cleared");
      } else {
        console.error("❌ Settings save failed:", response);
      }
    }
  );
};

// Helper to handle interview settings changes and cache clearing
const handleInterviewSettingsUpdate = (workingSettings, newSettings, handleSave) => {
  component("Settings", "🎯 Settings update requested", newSettings);
  
  // Check if interview-related settings changed
  const interviewSettingsChanged = (
    workingSettings.interviewMode !== newSettings.interviewMode ||
    workingSettings.interviewFrequency !== newSettings.interviewFrequency ||
    workingSettings.interviewReadinessThreshold !== newSettings.interviewReadinessThreshold
  );
  
  component("Settings", "🔍 Interview settings change check", {
    changed: interviewSettingsChanged,
    oldMode: workingSettings.interviewMode,
    newMode: newSettings.interviewMode,
    oldFreq: workingSettings.interviewFrequency,
    newFreq: newSettings.interviewFrequency,
    oldThreshold: workingSettings.interviewReadinessThreshold,
    newThreshold: newSettings.interviewReadinessThreshold
  });
  
  // Auto-save interview settings changes
  handleSave(newSettings);
  
  // Clear session cache if interview settings changed to force new session creation
  if (interviewSettingsChanged) {
    component("Settings", "🎯 Interview settings changed, clearing caches");
    
    // Clear both settings and session cache
    chrome.runtime.sendMessage({ type: "clearSettingsCache" }, (settingsResponse) => {
      component("Settings", "🔄 Settings cache cleared", settingsResponse);
      
      chrome.runtime.sendMessage({ type: "clearSessionCache" }, (sessionResponse) => {
        if (sessionResponse?.status === "success") {
          component("Settings", "✅ Session cache cleared successfully", { clearedCount: sessionResponse.clearedCount });
          component("Settings", "✅ Settings updated without page reload - components will react to changes");
        } else {
          component("Settings", "⚠️ Failed to clear session cache", sessionResponse);
        }
      });
    });
  } else {
    component("Settings", "ℹ️ No interview settings changes detected - no cache clearing needed");
  }
};

// Custom hook for auto-constraining new problems per session
const useAutoConstrainNewProblems = (workingSettings, maxNewProblems, setSettings) => {
  useEffect(() => {
    if (workingSettings?.sessionLength && workingSettings?.numberofNewProblemsPerSession) {
      const maxAllowed = Math.min(maxNewProblems, workingSettings.sessionLength);
      if (workingSettings.numberofNewProblemsPerSession > maxAllowed) {
        setSettings(prev => ({
          ...prev,
          numberofNewProblemsPerSession: maxAllowed
        }));
      }
    }
  }, [workingSettings?.sessionLength, maxNewProblems, workingSettings?.numberofNewProblemsPerSession, setSettings]);
};

// Component for debug/loading state information
const LoadingDebugInfo = ({ settings, _loading, _error }) => {
  if (settings) return null;
  
  return (
    <div style={{ padding: '8px', background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px', marginBottom: '8px' }}>
      <div style={{ fontSize: '11px', color: 'var(--cm-text)' }}>
        ⚠️ Settings loading: {_loading ? 'Loading...' : _error ? 'Error' : 'Using defaults'}
      </div>
    </div>
  );
};

// Component for session controls (length and new problems per session)
const SessionControls = ({ workingSettings, setSettings, maxNewProblems }) => {
  if (workingSettings.adaptive) return null;
  
  return (
    <>
      <div className="cm-form-group">
        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--cm-text)' }}>Session Length: {workingSettings.sessionLength} problems</div>
        <input
          type="range"
          min="3"
          max="12"
          value={workingSettings.sessionLength}
          onChange={(e) =>
            setSettings({ ...workingSettings, sessionLength: parseInt(e.target.value) })
          }
          style={{
            width: '100%',
            height: '4px',
            borderRadius: '2px',
            outline: 'none',
            cursor: 'pointer'
          }}
        />
      </div>

      <div className="cm-form-group">
        <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--cm-text)' }}>
          New Problems Per Session: {Math.min(
            workingSettings.numberofNewProblemsPerSession || 1, 
            Math.min(maxNewProblems, workingSettings.sessionLength || 8)
          )}
          {maxNewProblems < (workingSettings.sessionLength || 8) && (
            <span style={{ fontSize: '11px', color: 'var(--cm-text-secondary)', marginLeft: '8px' }}>
              (Max {maxNewProblems} during onboarding)
            </span>
          )}
        </div>
        <input
          type="range"
          min="1"
          max={Math.min(maxNewProblems, workingSettings.sessionLength || 8)}
          value={Math.min(
            workingSettings.numberofNewProblemsPerSession || 1, 
            Math.min(maxNewProblems, workingSettings.sessionLength || 8)
          )}
          onChange={(e) => {
            const newValue = parseInt(e.target.value);
            setSettings({
              ...workingSettings,
              numberofNewProblemsPerSession: Math.min(newValue, workingSettings.sessionLength || 8),
            });
          }}
          style={{
            width: '100%',
            height: '4px',
            borderRadius: '2px',
            outline: 'none',
            cursor: 'pointer'
          }}
        />
      </div>
    </>
  );
};

const Settings = () => {
  const { isAppOpen, setIsAppOpen } = useNav();
  const { shouldRender, isClosing } = useAnimatedClose(isAppOpen);
  const { settings, setSettings, maxNewProblems, _loading, _error } = useSettingsState();
  const interviewReadiness = useInterviewReadiness(settings);
  
  const handleClose = () => {
    setIsAppOpen(false);
  };

  // Debug settings loading
  system("🔧 Content Settings state", { 
    hasSettings: !!settings, 
    interviewMode: settings?.interviewMode,
    interviewReadiness 
  });

  const handleSave = saveSettings;
  const workingSettings = getWorkingSettings(settings);
  
  // Auto-constrain new problems per session when session length changes
  useAutoConstrainNewProblems(workingSettings, maxNewProblems, setSettings);

  return shouldRender ? (
    <div id="cm-mySidenav" className={`cm-sidenav problink${isClosing ? ' cm-closing' : ''}`}>
      <Header title="Settings" onClose={handleClose} />

      <div className="cm-sidenav__content ">
        {/* Debug info */}
        <LoadingDebugInfo settings={settings} _loading={_loading} _error={_error} />
        
        {/* Adaptive Toggle */}
        <AdaptiveSessionToggle
          adaptive={workingSettings.adaptive}
          onChange={(val) => setSettings({ ...workingSettings, adaptive: val })}
        />

        {/* Session Controls (conditionally shown) */}
        <SessionControls 
          workingSettings={workingSettings} 
          setSettings={setSettings} 
          maxNewProblems={maxNewProblems} 
        />

        <div className="cm-form-group">
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Time Limits</div>
          <SegmentedControl
            value={workingSettings.limit}
            onChange={(value) => setSettings(prevSettings => ({ ...prevSettings, limit: value }))}
            options={[
              { label: 'Auto', value: 'auto' },
              { label: 'Off', value: 'off' },
              { label: 'Fixed', value: 'fixed' }
            ]}
            variant="gradient"
            size="sm"
          />
        </div>

        {/* Interview Mode Controls */}
        <InterviewModeControls 
          settings={workingSettings} 
          updateSettings={(newSettings) => {
            setSettings(newSettings);
            handleInterviewSettingsUpdate(workingSettings, newSettings, handleSave);
          }} 
          interviewReadiness={interviewReadiness}
        />

        <RemindersSection 
          settings={workingSettings} 
          setSettings={setSettings} 
        />


        <SaveSettingsButton 
          workingSettings={workingSettings} 
          handleSave={handleSave} 
        />
      </div>
    </div>
  ) : null;
};

export default Settings;
