import "../../css/main.css";
import { useState, useEffect } from "react";
import { Button, Text, Alert, SegmentedControl, Tooltip } from "@mantine/core";
import { IconTrophy, IconInfoCircle, IconClock } from "@tabler/icons-react";
import {
  SliderMarksSessionLength,
  SliderMarksNewProblemsPerSession,
  GradientSegmentedControlTimeLimit,
  ToggleSelectRemainders,
} from "../../../shared/components/nantine.jsx";
import AdaptiveSessionToggle from "./AdaptiveSessionToggle.js";
import Header from "../../components/navigation/header.jsx";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import { useNav } from "../../../shared/provider/navprovider";
import SessionLimits from "../../../shared/utils/sessionLimits.js";

// Interview Readiness Hook (copied from AdaptiveSettingsCard)
function useInterviewReadiness(settings) {
  const [readiness, setReadiness] = useState({
    interviewLikeUnlocked: true, // Default to true for better UX
    fullInterviewUnlocked: true, // Default to true for better UX
    reasoning: "Loading interview capabilities..."
  });

  useEffect(() => {
    const checkReadiness = async () => {
      console.log("🎯 Content Settings - Checking interview readiness...", { settings: !!settings });
      
      try {
        if (typeof chrome !== "undefined" && chrome.runtime) {
          console.log("🎯 Content Settings - Chrome runtime available, sending message...");
          
          // Set timeout to prevent hanging
          const timeout = setTimeout(() => {
            console.log("🎯 Content Settings - Interview readiness check timed out, using fallback");
            setReadiness({
              interviewLikeUnlocked: true,
              fullInterviewUnlocked: true,
              reasoning: "Timeout - interview features available"
            });
          }, 3000);
          
          chrome.runtime.sendMessage(
            { type: "getInterviewReadiness" },
            (response) => {
              clearTimeout(timeout);
              console.log("🎯 Content Settings - Interview readiness response:", response, "Error:", chrome.runtime.lastError);
              if (response && !chrome.runtime.lastError) {
                setReadiness(response);
              } else {
                console.log("🎯 Content Settings - Using development fallback for interview readiness");
                // Fallback for development/testing
                setReadiness({
                  interviewLikeUnlocked: true, // Allow testing
                  fullInterviewUnlocked: true, // Allow testing
                  reasoning: "Development mode - all modes unlocked"
                });
              }
            }
          );
        } else {
          console.log("🎯 Content Settings - Chrome runtime not available, using fallback");
          // Direct fallback when no Chrome runtime
          setReadiness({
            interviewLikeUnlocked: true,
            fullInterviewUnlocked: true,
            reasoning: "Browser mode - interview features available for testing"
          });
        }
      } catch (error) {
        console.warn("🎯 Content Settings - Interview readiness check failed:", error);
        // Fallback readiness
        setReadiness({
          interviewLikeUnlocked: true,
          fullInterviewUnlocked: true,
          reasoning: "Error fallback - interview features available"
        });
      }
    };

    if (settings) {
      checkReadiness();
    }
  }, [settings]);

  return readiness;
}

// Interview Mode Controls Component (copied from AdaptiveSettingsCard)
function InterviewModeControls({ settings, updateSettings, interviewReadiness }) {
  console.log("🎯 Content Settings - InterviewModeControls rendering with:", { 
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
    return (
      <div className="cm-form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '14px' }}>
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
        </label>
        <div style={{ padding: '8px', background: '#f8f9fa', borderRadius: '4px', fontSize: '12px', color: '#666' }}>
          ⏳ Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="cm-form-group">
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '14px' }}>
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
      </label>

      <SegmentedControl
        value={currentMode}
        onChange={(value) => {
          console.log("🎯 Interview mode change:", value);
          const updatedSettings = { ...settings, interviewMode: value };
          console.log("🎯 Updated settings:", updatedSettings);
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
        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px', display: 'flex', alignItems: 'center' }}>
          <IconClock size={10} style={{ marginRight: '4px' }} />
          {currentMode === "interview-like" ? "Limited hints, mild pressure" : 
           currentMode === "full-interview" ? "No hints, strict timing" : 
           currentModeData.description}
        </div>
      )}
      
      {currentMode !== "disabled" && (
        <div style={{ 
          fontSize: '11px', 
          color: '#0066cc', 
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
        <>
          <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #e0e0e0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
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
            </label>

            <SegmentedControl
              value={settings?.interviewFrequency || "manual"}
              onChange={(value) => {
                console.log("🎯 Interview frequency change:", value);
                const updatedSettings = { ...settings, interviewFrequency: value };
                console.log("🎯 Updated settings:", updatedSettings);
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

            <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
              {settings?.interviewFrequency === "manual" && "Interview sessions available on demand"}
              {settings?.interviewFrequency === "weekly" && "System will suggest interview sessions every 7-10 days"}
              {settings?.interviewFrequency === "level-up" && "Interview sessions suggested after tag mastery improvements"}
            </div>
          </div>

          {/* Readiness Threshold - Show only for level-up frequency */}
          {settings?.interviewFrequency === "level-up" && (
            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
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
              </label>

              <div style={{ padding: '8px', background: '#f8f9fa', borderRadius: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#666' }}>Conservative</span>
                  <span style={{ fontSize: '12px', fontWeight: '500' }}>
                    {Math.round((settings?.interviewReadinessThreshold || 0.7) * 100)}%
                  </span>
                  <span style={{ fontSize: '11px', color: '#666' }}>Confident</span>
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
                
                <div style={{ fontSize: '10px', color: '#666', marginTop: '4px', textAlign: 'center' }}>
                  Full Interview mode unlocks at {Math.round((settings?.interviewReadinessThreshold || 0.7) * 100)}% mastery
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const Settings = () => {
  const { setIsAppOpen } = useNav();

  const handleClose = () => {
    setIsAppOpen(false);
  };
  const [settings, setSettings] = useState(null);
  const [maxNewProblems, setMaxNewProblems] = useState(8);
  const useMock = false;
  const MOCK_SETTINGS = {
    adaptive: true, // try false to test toggling
    sessionLength: 8,
    numberofNewProblemsPerSession: 3,
    limit: "Auto",
    reminder: {
      enabled: true,
      time: "12",
    },
    // Interview-specific defaults for mock
    interviewMode: "disabled",
    interviewReadinessThreshold: 0.8,
    interviewFrequency: "manual",
  };

  // Check interview readiness
  const interviewReadiness = useInterviewReadiness(settings);
  
  // Debug settings loading
  console.log("🔧 Content Settings state:", { 
    hasSettings: !!settings, 
    interviewMode: settings?.interviewMode,
    interviewReadiness 
  });

  // New approach using custom hook
  const {
    data: _chromeSettings,
    loading: _loading,
    error: _error,
  } = useChromeMessage(!useMock ? { type: "getSettings" } : null, [], {
    onSuccess: (response) => {
      if (response) {
        setSettings(response);
      } else {
        console.warn("No settings received, using defaults.");
      }
    },
  });

  // Handle mock settings
  useEffect(() => {
    if (useMock) {
      setSettings(MOCK_SETTINGS);
    }
  }, [useMock, MOCK_SETTINGS]);

  // Ensure settings have proper default values for interview mode
  useEffect(() => {
    if (settings && !settings.interviewMode) {
      console.log("🔧 Content Settings - Initializing missing interview settings:", { 
        interviewMode: settings.interviewMode 
      });
      
      const defaultSettings = {
        ...settings,
        interviewMode: "disabled",
        interviewReadinessThreshold: 0.8,
        interviewFrequency: "manual",
      };
      
      console.log("🔧 Content Settings - Setting default interview settings:", defaultSettings);
      setSettings(defaultSettings);
    }
  }, [settings]);

  // Update max new problems dynamically when settings change
  useEffect(() => {
    const updateMaxNewProblems = async () => {
      try {
        const sessionState = await chrome.runtime.sendMessage({ type: "getSessionState" });
        const newMax = SessionLimits.getMaxNewProblems(sessionState, settings?.sessionLength);
        setMaxNewProblems(newMax);
      } catch (error) {
        console.error('Settings.jsx: Failed to get session state, using fallback limits:', error);
        // Fallback to default if session state unavailable
        const fallbackMax = SessionLimits.getMaxNewProblems(null, settings?.sessionLength);
        setMaxNewProblems(fallbackMax);
      }
    };

    if (settings) {
      updateMaxNewProblems();
    }
  }, [settings]); // Re-run when settings change

  const handleSave = (settings) => {
    chrome.runtime.sendMessage(
      { type: "setSettings", message: settings },
      (response) => {
        // Clear any cached settings to ensure fresh data on next read
        chrome.runtime.sendMessage(
          { type: "clearSettingsCache" },
          () => {
            // Settings cache cleared
          }
        );

        // Notify user of successful save
        if (response?.status === "success") {
          // Settings successfully updated and cache cleared
        }
      }
    );
  };

  const _toggleAdaptive = (value) => {
    setSettings((prev) => ({ ...prev, adaptive: value }));
  };

  // Debug logging
  console.log("🔧 Settings component render:", { 
    settings, 
    hasSettings: !!settings,
    loading: _loading,
    error: _error,
    useMock
  });

  // Always ensure settings exist, even if empty
  const workingSettings = settings || {
    adaptive: true,
    sessionLength: 8,
    numberofNewProblemsPerSession: 3,
    limit: "Auto",
    reminder: { enabled: true, time: "12" },
    interviewMode: "disabled",
    interviewReadinessThreshold: 0.7,
    interviewFrequency: "manual"
  };

  return (
    <div id="cm-mySidenav" className="cm-sidenav problink">
      <Header title="Settings" onClose={handleClose} />

      <div className="cm-sidenav__content ">
        {/* Debug info */}
        {!settings && (
          <div style={{ padding: '8px', background: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', color: '#856404' }}>
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
              <label>Session Length</label>
              <SliderMarksSessionLength
                value={workingSettings.sessionLength}
                onChange={(value) =>
                  setSettings({ ...workingSettings, sessionLength: value })
                }
              />
            </div>

            <div className="cm-form-group">
              <label>New Problems Per Session</label>
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
          <label>Time Limits</label>
          <GradientSegmentedControlTimeLimit
            value={workingSettings.limit}
            onChange={(value) => setSettings({ ...workingSettings, limit: value })}
          />
        </div>

        {/* Interview Mode Controls */}
        <InterviewModeControls 
          settings={workingSettings} 
          updateSettings={(newSettings) => {
            console.log("🎯 Settings update requested:", newSettings);
            setSettings(newSettings);
            // Auto-save interview settings changes
            handleSave(newSettings);
          }} 
          interviewReadiness={interviewReadiness}
        />

        <div className="cm-form-group">
          <label>Reminders</label>
          <ToggleSelectRemainders
            reminder={workingSettings.reminder}
            onChange={(updatedReminder) =>
              setSettings((prevSettings) => ({
                ...workingSettings,
                reminder: { ...workingSettings.reminder, ...updatedReminder },
              }))
            }
          />
        </div>
        <Button onClick={() => handleSave(workingSettings)}>Save</Button>
      </div>
    </div>
  );
};

export default Settings;
