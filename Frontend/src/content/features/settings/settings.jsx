import "../../css/main.css";
import { useState, useEffect, useMemo } from "react";
import Button from '../../components/ui/Button.jsx';
import Tooltip from '../../components/ui/Tooltip.jsx';
import SegmentedControl from '../../components/ui/SegmentedControl.jsx';
import { IconTrophy, IconInfoCircle, IconClock } from "@tabler/icons-react";
import {
  SliderMarksSessionLength,
  SliderMarksNewProblemsPerSession,
  GradientSegmentedControlTimeLimit,
  ToggleSelectRemainders,
} from "../../../shared/components/nantine.jsx";
import AdaptiveSessionToggle from "./AdaptiveSessionToggle.js";
import Header from "../../components/navigation/header.jsx";
import { useChromeMessage, clearChromeMessageCache } from "../../../shared/hooks/useChromeMessage";
import { useInterviewReadiness } from "../../../shared/hooks/useInterviewReadiness";
import { useNav } from "../../../shared/provider/navprovider";
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
        color="var(--cm-active-blue)"
        style={{ width: '100%', cursor: 'pointer' }}
      />
      
      {currentModeData && currentMode !== "disabled" && (
        <div style={{ fontSize: '11px', color: 'var(--cm-text)', marginTop: '4px', display: 'flex', alignItems: 'center' }}>
          <IconClock size={10} style={{ marginRight: '4px' }} />
          {currentMode === "interview-like" ? "Limited hints, mild pressure" : 
           currentMode === "full-interview" ? "No hints, strict timing" : 
           currentModeData.description}
        </div>
      )}
      
      {currentMode !== "disabled" && (
        <div style={{ 
          fontSize: '11px', 
          color: 'var(--cm-link)', 
          marginTop: '4px', 
          padding: '4px 8px', 
          background: '#e6f3ff', 
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
        color="var(--cm-active-blue)"
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
    reminder: { enabled: true, time: "12" },
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
    reminder: { enabled: true, time: "12" },
    interviewMode: "disabled",
    interviewReadinessThreshold: 0.7,
    interviewFrequency: "manual"
  };
};

// Save Button Component
const SaveSettingsButton = ({ workingSettings, handleSave }) => (
  <Button 
    onClick={() => handleSave(workingSettings)} 
    size="lg"
    style={{
      width: '100%',
      padding: '12px 24px',
      backgroundColor: 'rgba(34, 197, 94, 0.9)',
      fontSize: '16px',
      fontWeight: '600',
      marginTop: '16px',
      transition: 'all 0.2s ease'
    }}
    onMouseOver={(e) => {
      e.target.style.backgroundColor = 'rgba(34, 197, 94, 1)';
      e.target.style.transform = 'translateY(-1px)';
    }}
    onMouseOut={(e) => {
      e.target.style.backgroundColor = 'rgba(34, 197, 94, 0.9)';
      e.target.style.transform = 'translateY(0px)';
    }}
    onFocus={(e) => {
      e.target.style.backgroundColor = 'rgba(34, 197, 94, 1)';
    }}
    onBlur={(e) => {
      e.target.style.backgroundColor = 'rgba(34, 197, 94, 0.9)';
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

const Settings = () => {
  const { setIsAppOpen } = useNav();
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

  return (
    <div id="cm-mySidenav" className="cm-sidenav problink">
      <Header title="Settings" onClose={handleClose} />

      <div className="cm-sidenav__content ">
        {/* Debug info */}
        {!settings && (
          <div style={{ padding: '8px', background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: 'var(--cm-text)' }}>
              ⚠️ Settings loading: {_loading ? 'Loading...' : _error ? 'Error' : 'Using defaults'}
            </div>
          </div>
        )}
        {/* Adaptive Toggle */}
        <AdaptiveSessionToggle
          adaptive={workingSettings.adaptive}
          onChange={(val) => setSettings({ ...workingSettings, adaptive: val })}
        />

        {/* Session Controls (conditionally shown) */}
        {!workingSettings.adaptive && (
          <>
            <div className="cm-form-group">
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--cm-text)' }}>Session Length</div>
              <SliderMarksSessionLength
                value={workingSettings.sessionLength}
                onChange={(value) =>
                  setSettings({ ...workingSettings, sessionLength: value })
                }
              />
            </div>

            <div className="cm-form-group">
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: 'var(--cm-text)' }}>New Problems Per Session</div>
              <SliderMarksNewProblemsPerSession
                value={Math.min(workingSettings.numberofNewProblemsPerSession || 1, maxNewProblems)}
                onChange={(value) =>
                  setSettings({
                    ...workingSettings,
                    numberofNewProblemsPerSession: value,
                  })
                }
                max={maxNewProblems}
              />
            </div>
          </>
        )}

        <div className="cm-form-group">
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Time Limits</div>
          <GradientSegmentedControlTimeLimit
            value={workingSettings.limit}
            onChange={(value) => setSettings(prevSettings => ({ ...prevSettings, limit: value }))}
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

        <div className="cm-form-group">
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Reminders</div>
          <ToggleSelectRemainders
            reminder={workingSettings.reminder}
            onChange={(updatedReminder) =>
              setSettings((prevSettings) => ({
                ...prevSettings,
                reminder: { ...prevSettings.reminder, ...updatedReminder },
              }))
            }
          />
        </div>
        <SaveSettingsButton 
          workingSettings={workingSettings} 
          handleSave={handleSave} 
        />
      </div>
    </div>
  );
};

export default Settings;
