import logger from "../../../shared/utils/logger.js";
import { useState, useCallback, useEffect, useRef } from "react";
import "../../css/probrec.css";
import Header from "../../components/navigation/header";
import { v4 as uuidv4 } from "uuid";
import ProblemInfoIcon from "../../components/problem/ProblemInfoIcon";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import { useSimilarProblems } from "../../components/problem/useSimilarProblems";
import { useNav } from "../../../shared/provider/navprovider";
import ChromeAPIErrorHandler from "../../../shared/services/ChromeAPIErrorHandler";

// Custom hook for settings loading and management
const useSettingsManager = () => {
  const [settings, setSettings] = useState(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const { 
    data: _settingsData, 
    loading: settingsLoading, 
    error: _settingsError 
  } = useChromeMessage({ type: "getSettings" }, [], {
    onSuccess: (response) => {
      if (response) {
        setSettings(response);
      }
      setSettingsLoaded(true);
    },
    onError: (error) => {
      logger.error("Failed to load settings:", error);
      setSettingsLoaded(true); // Still mark as loaded even on error
    }
  });

  return {
    settings,
    settingsLoaded,
    settingsLoading
  };
};

// Helper functions for session management
const getFreshSettings = async (fallbackSettings) => {
  logger.info('🎯 Getting fresh settings before creating session');
  try {
    const settingsResponse = await ChromeAPIErrorHandler.sendMessageWithRetry({
      type: "getSettings"
    });
    const freshSettings = settingsResponse || fallbackSettings;
    logger.info('🎯 Fresh settings retrieved:', freshSettings);
    return freshSettings;
  } catch (error) {
    logger.warn('🎯 Failed to get fresh settings, using cached:', error);
    return fallbackSettings;
  }
};

const processSessionResponse = (response, handlers, sessionCreationAttempted, operationName) => {
  const { setProblems, setSessionData, setShowRegenerationBanner } = handlers;
  logger.info(`🔍 ${operationName} API Response:`, {
    hasSession: !!response.session,
    sessionId: response.session?.id?.substring(0, 8),
    sessionType: response.session?.sessionType,
    isSessionStale: response.isSessionStale,
    lastActivityTime: response.session?.lastActivityTime
  });
  
  if (response.session) {
    const { problems: sessionProblems, ...restOfSession } = response.session;
    setProblems(sessionProblems || []);
    setSessionData(restOfSession);
    
    // Set regeneration banner state for direct API calls
    logger.info(`🎯 ${operationName} - Setting regeneration banner state:`, response.isSessionStale || false);
    setShowRegenerationBanner(response.isSessionStale || false);
    
    sessionCreationAttempted.current = true;
    logger.info(`✅ ${operationName} session created successfully`);
    return true;
  } else {
    logger.warn(`⚠️ No session in ${operationName} response - showing banner again`);
    return false;
  }
};

// Helper function to determine if interview banner should be shown
const shouldShowInterviewBanner = (settings, settingsLoaded) => {
  logger.info('🎯 Interview Banner Logic Check:', {
    settingsLoaded,
    settingsObject: settings,
    interviewMode: settings?.interviewMode,
    interviewFrequency: settings?.interviewFrequency,
    conditionMet: settings?.interviewMode && 
                 settings.interviewMode !== 'disabled' && 
                 settings?.interviewFrequency === 'manual',
    willShowBanner: settings?.interviewMode && 
                  settings.interviewMode !== 'disabled' && 
                  settings?.interviewFrequency === 'manual'
  });

  // Enhanced logic: Show banner if interview frequency is manual, regardless of mode setting
  // This covers cases where user sets frequency to manual but forgets to enable interview mode
  return (
    // Original condition: Interview mode enabled AND frequency manual
    (settings?.interviewMode && 
     settings.interviewMode !== 'disabled' && 
     settings?.interviewFrequency === 'manual') ||
    // Fallback condition: If frequency is manual, assume user wants interview options
    // even if they haven't explicitly enabled interview mode
    (settings?.interviewFrequency === 'manual' && 
     settings?.interviewMode !== 'disabled')  // Still respect explicit disable
  );
};

// Helper function for processing session loader response
const processSessionLoaderResponse = (response, handlers, sessionCreationAttempted, settings, pathName = '') => {
  const { setProblems, setSessionData, setShowRegenerationBanner, setShowInterviewBanner, settingsLoaded } = handlers;
  if (response.session) {
    // Store session data and show problems immediately for both draft and in_progress
    setSessionData(response.session);
    
    // Check if session is stale - hide regeneration banner if session is fresh
    logger.info('🎯 Setting regeneration banner state:', response.isSessionStale || false);
    setShowRegenerationBanner(response.isSessionStale || false);
    
    // Show problems immediately for any session with problems
    if (response.session.problems && Array.isArray(response.session.problems)) {
      setProblems(response.session.problems);
    } else {
      setProblems([]);
    }
    setShowInterviewBanner(false);
    
    // Reset session creation flag after successful session retrieval
    sessionCreationAttempted.current = false;
  } else {
    // No existing session found - check if we should show banner
    setProblems([]);
    setSessionData(null);
    setShowRegenerationBanner(false); // No session means no staleness
    
    // Only show banner if interview mode is manual and no session was found
    if (shouldShowInterviewBanner(settings, settingsLoaded)) {
      logger.info(`✅ Setting showInterviewBanner to true${pathName ? ` (${pathName})` : ''}`);
      setShowInterviewBanner(true);
    } else {
      logger.info(`❌ Interview banner conditions not met${pathName ? ` (${pathName})` : ''} - staying in empty state`);
    }
  }
};

// Custom hook for session management
const useSessionManagement = (settings, settingsLoaded, sessionCreationAttempted, lastSettingsHash, setProblems) => {
  const [sessionData, setSessionData] = useState(null);
  const [showInterviewBanner, setShowInterviewBanner] = useState(false);
  const [showRegenerationBanner, setShowRegenerationBanner] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Session choice handlers - explicit session type selection
  const handleInterviewChoice = async () => {
    const freshSettings = await getFreshSettings(settings);
    
    // Enhanced logic: Allow interview choice if frequency is manual, even if mode isn't explicitly enabled
    const canCreateInterviewSession = freshSettings?.interviewMode && freshSettings.interviewMode !== 'disabled';
    const defaultInterviewMode = canCreateInterviewSession ? freshSettings.interviewMode : 'interview-like';
    
    logger.info('🎯 handleInterviewChoice called:', {
      settingsInterviewMode: freshSettings?.interviewMode,
      canCreateInterviewSession,
      willUseMode: defaultInterviewMode,
      settingsFrequency: freshSettings?.interviewFrequency,
      freshSettings,
      cachedSettings: settings
    });
    
    setShowInterviewBanner(false);
    
    try {
      // Clear session cache first to ensure we create a new session with the correct type
      logger.info('🎯 Clearing session cache before creating interview session');
      await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "clearSessionCache"
      });
      
      // Directly create interview session with explicit sessionType - bypass race condition
      logger.info('🎯 Creating interview session with sessionType:', defaultInterviewMode);
      const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "getOrCreateSession",
        sessionType: defaultInterviewMode
      });
      
      // Process the response using helper function
      const success = processSessionResponse(response, { setProblems, setSessionData, setShowRegenerationBanner }, sessionCreationAttempted, 'handleInterviewChoice');
      if (!success) {
        setShowInterviewBanner(true);
      }
    } catch (error) {
      logger.error("❌ Failed to create interview session:", {
        error: error.message,
        stack: error.stack,
        settingsState: {
          interviewMode: settings?.interviewMode,
          interviewFrequency: settings?.interviewFrequency
        }
      });
      setShowInterviewBanner(true); // Show banner again on error
    }
  };

  const handleRegularChoice = async () => {
    logger.info('🎯 handleRegularChoice called - creating standard session');
    setShowInterviewBanner(false);
    
    try {
      // Directly create standard session with explicit sessionType - bypass race condition  
      const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "getOrCreateSession", 
        sessionType: 'standard'
      });
      
      // Process the response using helper function
      const success = processSessionResponse(response, { setProblems, setSessionData, setShowRegenerationBanner }, sessionCreationAttempted, 'handleRegularChoice');
      if (!success) {
        setShowInterviewBanner(true);
      }
    } catch (error) {
      logger.error("❌ Failed to create standard session:", {
        error: error.message,
        stack: error.stack
      });
      setShowInterviewBanner(true); // Show banner again on error
    }
  };

  // Handle session regeneration
  const handleRegenerateSession = async () => {
    setIsRegenerating(true);
    setShowRegenerationBanner(false);
    
    try {
      // Call refresh session to create a fresh session
      const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "refreshSession",
        sessionType: sessionData?.sessionType || 'standard'
      });
      
      if (response.session) {
        const { problems: sessionProblems, ...restOfSession } = response.session;
        setProblems(sessionProblems || []);
        setSessionData(restOfSession);
        sessionCreationAttempted.current = true;
      }
    } catch (error) {
      logger.error("Failed to regenerate session:", error);
      // Show regeneration banner again on error
      setShowRegenerationBanner(true);
    } finally {
      setIsRegenerating(false);
    }
  };

  return {
    sessionData,
    setSessionData,
    showInterviewBanner,
    setShowInterviewBanner,
    showRegenerationBanner,
    setShowRegenerationBanner,
    isRegenerating,
    handleInterviewChoice,
    handleRegularChoice,
    handleRegenerateSession
  };
};

// Custom hook for session loading and effects
const useSessionLoader = (options) => {
  const {
    settings, 
    settingsLoaded, 
    sessionCreationAttempted, 
    lastSettingsHash, 
    setProblems, 
    setSessionData, 
    setShowInterviewBanner, 
    setShowRegenerationBanner,
    cacheClearedRecently
  } = options;
  const [_manualSessionTypeOverride, _setManualSessionTypeOverride] = useState(null);

  // Unified session loading - let background script auto-determine session type from settings
  const { 
    data: sessionResponse, 
    loading: sessionLoading,
    error: _sessionError,
    retry: triggerSessionLoad
  } = useChromeMessage(
    { 
      type: "getOrCreateSession",
      // Pass explicit sessionType if user made manual override OR if interview mode is enabled and not manual
      ...(_manualSessionTypeOverride && { sessionType: _manualSessionTypeOverride }),
      // Auto-pass interview mode when enabled and frequency is not manual (for auto-creation)
      ...(settings?.interviewMode && 
          settings.interviewMode !== 'disabled' && 
          settings.interviewFrequency !== 'manual' && 
          !_manualSessionTypeOverride && 
          { sessionType: settings.interviewMode }),
      // IMPORTANT: Also pass sessionType if cache was recently cleared due to settings change (even with manual frequency)
      ...(settings?.interviewMode && 
          settings.interviewMode !== 'disabled' && 
          cacheClearedRecently && 
          !_manualSessionTypeOverride && 
          { sessionType: settings.interviewMode })
    }, 
    [settings, settingsLoaded, _manualSessionTypeOverride], // Depend on settings and manual override
    {
      immediate: false, // Wait for manual trigger after settings are confirmed loaded
      onSuccess: (response) => {
        logger.info('🔍 ProblemGenerator API Response:', {
          hasSession: !!response.session,
          sessionId: response.session?.id?.substring(0, 8),
          sessionType: response.session?.sessionType,
          isSessionStale: response.isSessionStale,
          lastActivityTime: response.session?.lastActivityTime,
          backgroundScriptData: response.backgroundScriptData
        });
        
        processSessionLoaderResponse(response, { setProblems, setSessionData, setShowRegenerationBanner, setShowInterviewBanner, settingsLoaded }, sessionCreationAttempted, settings);
      },
      onError: (error) => {
        logger.error('ProblemGenerator session fetch error:', error);
        
        setProblems([]);
        setSessionData(null);
        setShowRegenerationBanner(false); // Hide regeneration banner on error
        
        // Reset session creation flag on error to allow retry
        sessionCreationAttempted.current = false;
        
        // On error, show banner only for manual interview mode
        if (shouldShowInterviewBanner(settings, settingsLoaded)) {
          logger.info('✅ Setting showInterviewBanner to true (ERROR PATH)');
          setShowInterviewBanner(true);
        } else {
          logger.info('❌ Interview banner conditions not met (ERROR PATH) - staying in empty state');
        }
      }
    }
  );

  // Stable callback for session loading that respects existing protections  
  const handleSessionLoad = useCallback(() => {
    if (sessionCreationAttempted.current) {
      return; // Already attempted session creation for current settings
    }
    
    sessionCreationAttempted.current = true;
    triggerSessionLoad(); // Load session with correct type from loaded settings
  }, [triggerSessionLoad, sessionCreationAttempted]);

  // Only load session AFTER settings are fully loaded and we have valid settings
  useEffect(() => {
    if (settingsLoaded && settings && !sessionLoading && !sessionResponse) {
      // Create a simple hash of relevant settings to detect actual changes
      const settingsHash = JSON.stringify({
        interviewMode: settings.interviewMode,
        interviewFrequency: settings.interviewFrequency,
        interviewReadinessThreshold: settings.interviewReadinessThreshold
      });
      
      // Reset session creation flag if settings actually changed
      if (lastSettingsHash.current !== settingsHash) {
        logger.info('🔄 ProblemGenerator: Settings changed, resetting session creation', {
          oldHash: lastSettingsHash.current,
          newHash: settingsHash,
          changedSettings: {
            interviewMode: settings.interviewMode,
            interviewFrequency: settings.interviewFrequency,
            interviewReadinessThreshold: settings.interviewReadinessThreshold
          }
        });
        sessionCreationAttempted.current = false;
        lastSettingsHash.current = settingsHash;
      }
      
      handleSessionLoad();
    }
  }, [settingsLoaded, settings, sessionLoading, sessionResponse, handleSessionLoad, lastSettingsHash, sessionCreationAttempted]);

  return {
    sessionLoading,
    sessionResponse,
    _manualSessionTypeOverride,
    _setManualSessionTypeOverride
  };
};

// Session Regeneration Banner Component
const SessionRegenerationBanner = ({ onRegenerateSession }) => {
  return (
    <div className="cm-session-regeneration-banner" style={{
      backgroundColor: 'rgba(251, 146, 60, 0.1)',
      border: '2px solid #f59e0b',
      borderRadius: '8px',
      padding: '10px 10px',
      margin: '0 0 16px 0',
      display: 'flex',
      flexDirection: "column",
      alignItems: 'center',
      gap: '16px',
      minWidth: '300px'
    }}>
      <div style={{ 
        flex: 1,
        minWidth: '200px',
        maxWidth: 'none'
      }}>
        <div style={{ 
          fontWeight: 'bold', 
          color: '#f59e0b',
          fontSize: '14px',
          marginBottom: '6px',
          lineHeight: '1.2',
          whiteSpace: 'nowrap'
        }}>
          Session Inactive
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: 'var(--cm-text-secondary, #888)',
          lineHeight: '1.5',
          marginBottom: '2px',
          wordWrap: 'break-word',
          overflowWrap: 'normal'
        }}>
          Your session has been inactive. 
          Generate fresh problems?
        </div>
      </div>
      <button
        onClick={onRegenerateSession}
        style={{
          padding: '8px 14px',
          backgroundColor: '#f59e0b',
          border: 'none',
          borderRadius: '6px',
          color: 'white',
          fontSize: '12px',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}
        onMouseOver={(e) => {
          e.target.style.backgroundColor = '#d97706';
        }}
        onFocus={(e) => {
          e.target.style.backgroundColor = '#d97706';
        }}
        onMouseOut={(e) => {
          e.target.style.backgroundColor = '#f59e0b';
        }}
        onBlur={(e) => {
          e.target.style.backgroundColor = '#f59e0b';
        }}
      >
        Generate New Session
      </button>
    </div>
  );
};

// Interview Mode Banner Component
const InterviewModeBanner = ({ sessionType, interviewConfig: _interviewConfig }) => {
  if (!sessionType || sessionType === 'standard') return null;

  const getModeDisplay = (mode) => {
    switch (mode) {
      case 'interview-like':
        return {
          icon: '🟡',
          title: 'Interview-Like Mode',
          description: 'Limited hints • Mild time pressure • Practice interview conditions',
          color: '#f59e0b'
        };
      case 'full-interview':
        return {
          icon: '🔴', 
          title: 'Full Interview Mode',
          description: 'No hints • Strict timing • Realistic interview simulation',
          color: '#ef4444'
        };
      default:
        return {
          icon: '🎯',
          title: 'Interview Mode',
          description: 'Interview practice session',
          color: '#3b82f6'
        };
    }
  };

  const modeDisplay = getModeDisplay(sessionType);
  
  return (
    <div className="cm-interview-mode-banner" style={{
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
      border: `2px solid ${modeDisplay.color}`,
      borderRadius: '8px',
      padding: '12px 16px',
      margin: '0 0 16px 0',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      <span style={{ fontSize: '20px' }}>{modeDisplay.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ 
          fontWeight: 'bold', 
          color: modeDisplay.color,
          fontSize: '14px',
          marginBottom: '2px'
        }}>
          {modeDisplay.title}
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: 'var(--cm-text-secondary, #888)',
          lineHeight: '1.3'
        }}>
          {modeDisplay.description}
        </div>
      </div>
    </div>
  );
};

// Enhanced Problem Item with Interview Context
const ProblemItemWithInterviewContext = ({ problem, isNewProblem, interviewMode, onLinkClick }) => {
  // Add interview-specific styling
  const getInterviewProblemStyle = () => {
    if (!interviewMode || interviewMode === 'standard') return {};
    
    return {
      borderLeft: interviewMode === 'full-interview' ? '3px solid #ef4444' : '3px solid #f59e0b',
      paddingLeft: '8px'
    };
  };

  return (
    <div style={getInterviewProblemStyle()}>
      <ProblemItemWithReason 
        problem={problem} 
        isNewProblem={isNewProblem} 
        onLinkClick={onLinkClick}
      />
      {interviewMode && interviewMode !== 'standard' && (
        <div style={{
          fontSize: '10px',
          color: 'var(--cm-text-secondary, #888)',
          marginTop: '4px',
          fontStyle: 'italic'
        }}>
          🎯 Interview practice problem
        </div>
      )}
    </div>
  );
};

// Loading State Component
const LoadingState = ({ settingsLoading, isRegenerating, settingsLoaded, sessionLoading, settings }) => (
  <div style={{ 
    textAlign: 'center', 
    padding: '20px', 
    color: 'var(--cm-text-secondary)' 
  }}>
    {settingsLoading ? '⏳ Loading settings...' : isRegenerating ? '🔄 Regenerating session...' : '🎯 Loading session...'}
    {settingsLoaded && (sessionLoading || isRegenerating) && (
      <div style={{ 
        fontSize: '12px', 
        marginTop: '8px', 
        opacity: 0.7 
      }}>
        {isRegenerating ? 'Creating fresh problems...' : `Using ${settings?.interviewMode === 'disabled' ? 'standard' : settings?.interviewMode || 'standard'} mode`}
      </div>
    )}
  </div>
);

// Empty State Component
const EmptyState = ({ _settingsLoaded, _sessionLoading }) => (
  <div role="status" aria-live="polite" style={{
    textAlign: 'center',
    padding: '20px',
    color: 'var(--cm-text-secondary)'
  }}>
    <p style={{ marginBottom: '16px' }}>No problems found. Please generate a new session.</p>
    
    {/* Enhanced user guidance for common issues */}
    <div style={{
      fontSize: '12px',
      backgroundColor: 'rgba(96, 125, 139, 0.05)',
      padding: '12px',
      borderRadius: '6px',
      border: '1px solid rgba(96, 125, 139, 0.1)'
    }}>
      <div style={{ marginBottom: '8px', fontWeight: '500' }}>
        💡 Troubleshooting Tips:
      </div>
      <div style={{ lineHeight: '1.4', textAlign: 'left' }}>
        • If this persists, try refreshing the page<br/>
        • Check if interview mode settings match your needs<br/>
        • Extension restart may help if Chrome API issues occur
      </div>
    </div>
  </div>
);

// Interview Choice Banner Component  
const InterviewChoiceBanner = ({ sessionLoading, handleInterviewChoice, handleRegularChoice }) => (
  <div style={{
    backgroundColor: 'rgba(96, 125, 139, 0.08)',
    width: '100%',
    margin: '16px 0',
    color: 'var(--cm-text)',
    border: '1px solid rgba(96, 125, 139, 0.15)'
  }}>
    <div style={{ textAlign: 'center', padding: '16px' }}>
      <p style={{ 
        margin: 0, 
        fontSize: '14px',
        fontWeight: '500',
        color: 'var(--cm-text)',
        opacity: 0.9
      }}>
        In interview-like mode, would you like to start an interview session?
      </p>
    </div>

    {sessionLoading ? (
      <div style={{ 
        textAlign: 'center',
        padding: '16px',
        fontSize: '14px',
        color: 'var(--cm-text)',
        opacity: 0.7
      }}>
        Creating session...
      </div>
    ) : (
      <div style={{ display: 'flex', width: '100%' }}>
        <button
          onClick={handleInterviewChoice}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: 'rgba(59, 130, 246, 0.9)',
            border: 'none',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = 'rgba(59, 130, 246, 1)';
          }}
          onFocus={(e) => {
            e.target.style.backgroundColor = 'rgba(59, 130, 246, 1)';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
          }}
          onBlur={(e) => {
            e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
          }}
        >
          Yes
        </button>

        <button
          onClick={handleRegularChoice}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: 'rgba(107, 114, 128, 0.8)',
            border: 'none',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = 'rgba(107, 114, 128, 0.9)';
          }}
          onFocus={(e) => {
            e.target.style.backgroundColor = 'rgba(107, 114, 128, 0.9)';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = 'rgba(107, 114, 128, 0.8)';
          }}
          onBlur={(e) => {
            e.target.style.backgroundColor = 'rgba(107, 114, 128, 0.8)';
          }}
        >
          No
        </button>
      </div>
    )}
  </div>
);

// Convert cryptic reasoning text to human-readable explanations
const getHumanReadableReason = (shortText) => {
  if (!shortText) return "Selected for your learning progression";
  
  // Handle interview mode patterns
  if (shortText.toLowerCase().includes("interview")) {
    return "Selected for interview practice to test skill transfer under pressure";
  }
  
  // Handle common patterns
  if (shortText.toLowerCase().includes("new") && shortText.toLowerCase().includes("easy")) {
    return "This introduces fundamental problem-solving patterns with Easy difficulty";
  }
  if (shortText.toLowerCase().includes("new") && shortText.toLowerCase().includes("medium")) {
    return "This builds on your foundation with Medium-level challenges";
  }
  if (shortText.toLowerCase().includes("new") && shortText.toLowerCase().includes("hard")) {
    return "This advances your skills with Hard-level problem complexity";
  }
  if (shortText.toLowerCase().includes("review")) {
    return "This reinforces previously learned concepts based on spaced repetition";
  }
  if (shortText.toLowerCase().includes("weakness")) {
    return "This targets an area where you can improve your performance";
  }
  if (shortText.toLowerCase().includes("mastery")) {
    return "This helps solidify your understanding of key patterns";
  }
  
  // Fallback for unrecognized patterns
  return `Selected because: ${shortText}`;
};

// Helper function to render problem badges
const renderProblemBadges = ({ problem, isNewProblem, handleMouseEnter, handleMouseLeave }) => (
  <div className="cm-problem-badges">
    {problem.selectionReason && (
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="cm-problem-info-icon"
      >
        <ProblemInfoIcon className="cm-problem-info-icon" />
      </div>
    )}
    {isNewProblem && <span className="cm-new-tag">NEW</span>}
    <span
      className={`cd-difficulty cd-difficulty-${
        (problem.difficulty || "medium").toLowerCase()
      }`}
    >
      {problem.difficulty || "Medium"}
    </span>
  </div>
);

// Helper function to render similar problems section
const renderSimilarProblems = ({ similarProblems, loadingSimilar, hovered }) => (
  <div style={{
    fontSize: "0.7rem",
    color: "var(--cm-text, #ffffff)",
    opacity: 0.9,
    padding: "2px 0",
  }}>
    <div style={{ textAlign: "left", fontWeight: "bold", marginBottom: "2px", fontSize: "0.7rem" }}>
      🔗 Similar Problems:
    </div>
    {loadingSimilar && (
      <div style={{ fontSize: "0.7rem", color: "rgba(7, 7, 7, 0.6)", fontStyle: "italic" }}>
        Finding similar problems...
      </div>
    )}
    {similarProblems.length > 0 && (
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", textAlign: "left" }}>
        {similarProblems.slice(0, 2).map((similar, index) => (
          <div key={similar.id || index} style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.65rem",
            padding: "1px 0",
          }}>
            <span style={{
              flex: 1,
              textAlign: "left",
              lineHeight: "1.2",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}>
              {(similar.title || similar.problemDescription || '').substring(0, 30)}
              {(similar.title || similar.problemDescription || '').length > 30 ? '...' : ''}
            </span>
            {similar.difficulty && (
              <span style={{
                fontSize: "0.55rem",
                padding: "2px 4px",
                borderRadius: "3px",
                backgroundColor: similar.difficulty === 'Easy' ? '#10b981' :
                               similar.difficulty === 'Hard' ? '#ef4444' : '#f59e0b',
                color: 'white',
                fontWeight: 'bold',
                flexShrink: 0,
              }}>
                {similar.difficulty.substring(0, 1)}
              </span>
            )}
          </div>
        ))}
      </div>
    )}
    {!loadingSimilar && similarProblems.length === 0 && hovered && (
      <div style={{ fontSize: "0.6rem", color: "rgba(255, 255, 255, 0.6)", fontStyle: "italic" }}>
        🌱 No patterns discovered yet<br/>
        Complete more problems to build connections!
      </div>
    )}
  </div>
);

// Helper function to render expandable content
const renderExpandableContent = ({ problem, hovered, similarProblems, loadingSimilar }) => {
  if (!problem.selectionReason) return null;
  
  return (
    <div style={{
      maxHeight: hovered ? "120px" : "0px",
      opacity: hovered ? 1 : 0,
      overflow: "hidden",
      transition: "all 0.3s ease",
    }}>
      <div style={{
        maxWidth: "240px",
        margin: 0,
        fontSize: "0.75rem",
        color: "var(--cm-text, #ffffff)",
        lineHeight: 1.4,
        wordWrap: "break-word",
        overflowWrap: "anywhere",
        padding: "4px 0",
        borderBottom: (similarProblems.length > 0 || loadingSimilar) ? "1px solid rgba(255, 255, 255, 0.1)" : "none",
        marginBottom: (similarProblems.length > 0 || loadingSimilar) ? "6px" : "0",
        textAlign: "left",
      }}>
        <strong>🎯 Selected because:</strong> {getHumanReadableReason(problem.selectionReason.shortText)}
      </div>
      {(similarProblems.length > 0 || loadingSimilar) &&
        renderSimilarProblems({ similarProblems, loadingSimilar, hovered })
      }
    </div>
  );
};

// Problem Item Component with expandable reason text
const ProblemItemWithReason = ({ problem, isNewProblem, onLinkClick }) => {
  const [hovered, setHovered] = useState(false);
  
  // Use consolidated similar problems hook instead of duplicating logic
  const { similarProblems, loadingSimilar } = useSimilarProblems(problem?.id, hovered);

  // Handle hover events
  const handleMouseEnter = useCallback(() => {
    setHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
  }, []);

  return (
    <div className="cm-simple-problem-item-container">
      <div className="cm-simple-problem-item">
        <button
          type="button"
          onClick={(e) => {
            onLinkClick(problem);
            e.target.blur(); // Remove focus after click to prevent outline
            // Force remove focus with timeout to ensure it's gone
            setTimeout(() => {
              if (e.target === document.activeElement) {
                e.target.blur();
              }
            }, 0);
          }}
          className="cm-simple-problem-link"
          style={{ 
            background: 'none', 
            border: 'none', 
            padding: 0, 
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%'
          }}
        >
          {problem.problemDescription || problem.title}
        </button>
        {renderProblemBadges({ problem, isNewProblem, handleMouseEnter, handleMouseLeave })}
      </div>

      {renderExpandableContent({ problem, hovered, similarProblems, loadingSimilar })}
    </div>
  );
};

// Problems List Component
const ProblemsList = ({ problems, sessionData, onLinkClick }) => (
  <div className="cm-simple-problems-list">
    {problems.map((problem) => {
      const isNewProblem =
        !problem.attempts || problem.attempts.length === 0;

      return (
        <div key={uuidv4()} role="listitem">
          <ProblemItemWithInterviewContext
            problem={problem}
            isNewProblem={isNewProblem}
            interviewMode={sessionData?.sessionType}
            onLinkClick={onLinkClick}
          />
        </div>
      );
    })}
  </div>
);


// Custom hook for session cache listener
const useSessionCacheListener = (setters, sessionCreationAttempted, setCacheClearedRecently) => {
  const { setSessionData, setProblems, setShowInterviewBanner, setShowRegenerationBanner } = setters;
  useEffect(() => {
    const handleSessionCacheCleared = () => {
      logger.info("🔄 ProblemGenerator: Received session cache cleared signal, resetting session state");
      sessionCreationAttempted.current = false;
      setSessionData(null);
      setProblems([]);
      setShowInterviewBanner(false);
      setShowRegenerationBanner(false);
      // Mark that cache was recently cleared due to settings change
      setCacheClearedRecently(true);
      // Reset this flag after a short delay to allow session creation
      setTimeout(() => setCacheClearedRecently(false), 2000);
    };

    const messageListener = (message, sender, sendResponse) => {
      if (message.type === "sessionCacheCleared") {
        handleSessionCacheCleared();
        sendResponse({ status: "success" });
      }
    };

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener(messageListener);
    }

    return () => {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    };
  }, [setters, sessionCreationAttempted, setCacheClearedRecently, setSessionData, setProblems, setShowInterviewBanner, setShowRegenerationBanner]);
};

// Main content renderer component
const ProblemGeneratorContent = ({ 
  sessionData, 
  showRegenerationBanner, 
  handleRegenerateSession, 
  settingsLoading, 
  settingsLoaded, 
  sessionLoading, 
  isRegenerating, 
  problems, 
  showInterviewBanner, 
  settings, 
  handleInterviewChoice, 
  handleRegularChoice, 
  onLinkClick 
}) => (
  <>
    <InterviewModeBanner 
      sessionType={sessionData?.sessionType} 
      interviewConfig={sessionData?.interviewConfig} 
    />
    
    {logger.info("🎯 Render check - showRegenerationBanner:", showRegenerationBanner, "sessionData:", sessionData?.id?.substring(0,8))}
    {showRegenerationBanner && (
      <SessionRegenerationBanner onRegenerateSession={handleRegenerateSession} />
    )}
    
    {logger.info("🎯 Render Decision Point:", { 
      settingsLoading, 
      settingsLoaded, 
      sessionLoading, 
      isRegenerating, 
      problemsLength: problems.length, 
      showInterviewBanner, 
      settingsState: { 
        interviewMode: settings?.interviewMode, 
        interviewFrequency: settings?.interviewFrequency 
      } 
    })}
    
    {settingsLoading || (settingsLoaded && sessionLoading) || isRegenerating ? (
      <LoadingState 
        settingsLoading={settingsLoading} 
        isRegenerating={isRegenerating} 
        settingsLoaded={settingsLoaded} 
        sessionLoading={sessionLoading} 
        settings={settings} 
      />
    ) : problems.length > 0 ? (
      <ProblemsList 
        problems={problems} 
        sessionData={sessionData} 
        onLinkClick={onLinkClick} 
      />
    ) : showInterviewBanner ? (
      <InterviewChoiceBanner 
        sessionLoading={sessionLoading} 
        handleInterviewChoice={handleInterviewChoice} 
        handleRegularChoice={handleRegularChoice} 
      />
    ) : settingsLoaded && !sessionLoading ? (
      <EmptyState 
        settingsLoaded={settingsLoaded} 
        sessionLoading={sessionLoading} 
      />
    ) : null}
  </>
);
function ProbGen() {
  const { setIsAppOpen } = useNav();
  const [problems, setProblems] = useState([]);
  const [cacheClearedRecently, setCacheClearedRecently] = useState(false);
  
  // Session creation tracking to prevent duplicates
  const sessionCreationAttempted = useRef(false);
  const lastSettingsHash = useRef(null);

  // Use settings manager hook
  const { settings, settingsLoaded, settingsLoading } = useSettingsManager();

  // Use session management hook
  const {
    sessionData,
    setSessionData,
    showInterviewBanner,
    setShowInterviewBanner,
    showRegenerationBanner,
    setShowRegenerationBanner,
    isRegenerating,
    handleInterviewChoice,
    handleRegularChoice,
    handleRegenerateSession
  } = useSessionManagement(settings, settingsLoaded, sessionCreationAttempted, lastSettingsHash, setProblems);

  // Use session loader hook
  const { sessionLoading } = useSessionLoader({
    settings, 
    settingsLoaded, 
    sessionCreationAttempted, 
    lastSettingsHash, 
    setProblems, 
    setSessionData, 
    setShowInterviewBanner, 
    setShowRegenerationBanner,
    cacheClearedRecently
  });

  // Listen for session cache invalidation events
  useSessionCacheListener(
    { setSessionData, setProblems, setShowInterviewBanner, setShowRegenerationBanner },
    sessionCreationAttempted,
    setCacheClearedRecently
  );

  const handleClose = () => {
    setIsAppOpen(false);
  };

  const handleLinkClick = (problem) => {
    // Hide regeneration banner when user clicks a problem (session reactivated)
    setShowRegenerationBanner(false);
    
    window.location.href =
      problem.LeetCodeAddress ||
      `https://leetcode.com/problems/${problem.slug}/description/`;
  };

  return (
    <div id="cm-mySidenav" className="cm-sidenav problink">
      <Header title="Generator" onClose={handleClose} />
      <div className="cm-sidenav__content">
        <ProblemGeneratorContent
          sessionData={sessionData}
          showRegenerationBanner={showRegenerationBanner}
          handleRegenerateSession={handleRegenerateSession}
          settingsLoading={settingsLoading}
          settingsLoaded={settingsLoaded}
          sessionLoading={sessionLoading}
          isRegenerating={isRegenerating}
          problems={problems}
          showInterviewBanner={showInterviewBanner}
          settings={settings}
          handleInterviewChoice={handleInterviewChoice}
          handleRegularChoice={handleRegularChoice}
          onLinkClick={handleLinkClick}
        />
      </div>
    </div>
  );
}

export default ProbGen;
