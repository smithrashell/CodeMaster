import React, { useState, useCallback, useEffect, useRef } from "react";
import "../../css/probrec.css";
import Header from "../../components/navigation/header";
import { v4 as uuidv4 } from "uuid";
import ProblemInfoIcon from "../../components/problem/ProblemInfoIcon";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import { useNav } from "../../../shared/provider/navprovider";
import ChromeAPIErrorHandler from "../../../shared/services/ChromeAPIErrorHandler";

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

// Problem Item Component with expandable reason text
const ProblemItemWithReason = ({ problem, isNewProblem, onLinkClick }) => {
  const [hovered, setHovered] = useState(false);
  const [similarProblems, setSimilarProblems] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [similarProblemsCache, setSimilarProblemsCache] = useState(null);

  // Debounced similar problems fetching
  const fetchSimilarProblems = useCallback(
    (problemId) => {
      if (!problemId || similarProblemsCache || loadingSimilar) return;

      setLoadingSimilar(true);
      try {
        chrome.runtime.sendMessage({
          type: 'getSimilarProblems',
          problemId: problemId,
          limit: 3
        }, (response) => {
          if (response?.similarProblems) {
            setSimilarProblems(response.similarProblems);
            setSimilarProblemsCache(response.similarProblems);
          }
          setLoadingSimilar(false);
        });
      } catch (error) {
        console.error('Error fetching similar problems:', error);
        setLoadingSimilar(false);
      }
    },
    [similarProblemsCache, loadingSimilar]
  );

  // Handle hover with debouncing
  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    
    // Fetch similar problems if we have a problem ID and haven't cached them yet
    if (problem?.id && !similarProblemsCache && !loadingSimilar) {
      // Small delay to avoid fetching on quick hovers
      const timeoutId = setTimeout(() => {
        fetchSimilarProblems(problem.id);
      }, 200);
      
      // Store timeout ID for potential cleanup
      return () => clearTimeout(timeoutId);
    }
  }, [problem?.id, similarProblemsCache, loadingSimilar, fetchSimilarProblems]);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
  }, []);

  return (
    <div className="cm-simple-problem-item-container">
      <div className="cm-simple-problem-item">
        <a
          href="#"
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
        >
          {problem.problemDescription || problem.title}
        </a>
        <div className="cm-problem-badges">
          {/* Show problem selection reasoning if available - FIRST in badges */}
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
            className={`cd-difficulty cd-difficulty-${(
              problem.difficulty || "medium"
            ).toLowerCase()}`}
          >
            {problem.difficulty || "Medium"}
          </span>
        </div>
      </div>

      {/* Expandable content - reason text and similar problems */}
      {problem.selectionReason && (
        <div
          style={{
            maxHeight: hovered ? "120px" : "0px",
            opacity: hovered ? 1 : 0,
            overflow: "hidden",
            transition: "all 0.3s ease",
          }}
        >
          {/* Existing reason text */}
          <div
            style={{
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
            }}
          >
            <strong>🎯 Selected because:</strong> {getHumanReadableReason(problem.selectionReason.shortText)}
          </div>

          {/* Similar Problems Section */}
          {(similarProblems.length > 0 || loadingSimilar) && (
            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--cm-text, #ffffff)",
                opacity: 0.9,
                padding: "2px 0",
              }}
            >
              <div style={{ textAlign: "left" ,fontWeight: "bold", marginBottom: "2px", fontSize: "0.7rem" }}>
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
                    <div
                      key={similar.id || index}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.65rem",
                        padding: "1px 0",
                      }}
                    >
                  
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
                        <span
                          style={{
                            fontSize: "0.55rem",
                            padding: "2px 4px",
                            borderRadius: "3px",
                            backgroundColor: similar.difficulty === 'Easy' ? '#10b981' : 
                                           similar.difficulty === 'Hard' ? '#ef4444' : '#f59e0b',
                            color: 'white',
                            fontWeight: 'bold',
                            flexShrink: 0,
                          }}
                        >
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
          )}
        </div>
      )}
    </div>
  );
};


const ProbGen = () => {
  const { setIsAppOpen } = useNav();
  const [problems, setProblems] = useState([]);
  const [sessionData, setSessionData] = useState(null);
  const [_announcement, _setAnnouncement] = useState("");
  const [settings, setSettings] = useState(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showInterviewBanner, setShowInterviewBanner] = useState(false);
  
  // Session creation tracking to prevent duplicates
  const sessionCreationAttempted = useRef(false);
  const lastSettingsHash = useRef(null);

  const handleClose = () => {
    setIsAppOpen(false);
  };

  // Fetch settings for interview mode configuration
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
      console.error("Failed to load settings:", error);
      setSettingsLoaded(true); // Still mark as loaded even on error
    }
  });

  // Session choice handlers - explicit session type selection
  const handleInterviewChoice = async () => {
    if (!settings?.interviewMode || settings.interviewMode === 'disabled') {
      return;
    }
    
    setShowInterviewBanner(false);
    
    try {
      // Directly create interview session with explicit sessionType - bypass race condition
      const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "getOrCreateSession",
        sessionType: settings.interviewMode
      });
      
      // Process the response just like the useChromeMessage onSuccess handler
      if (response.session) {
        const { problems: sessionProblems, ...restOfSession } = response.session;
        setProblems(sessionProblems || []);
        setSessionData(restOfSession);
        sessionCreationAttempted.current = true;
      }
    } catch (error) {
      console.error("Failed to create interview session:", error);
      setShowInterviewBanner(true); // Show banner again on error
    }
  };

  const handleRegularChoice = async () => {
    setShowInterviewBanner(false);
    
    try {
      // Directly create standard session with explicit sessionType - bypass race condition  
      const response = await ChromeAPIErrorHandler.sendMessageWithRetry({
        type: "getOrCreateSession", 
        sessionType: 'standard'
      });
      
      // Process the response just like the useChromeMessage onSuccess handler
      if (response.session) {
        const { problems: sessionProblems, ...restOfSession } = response.session;
        setProblems(sessionProblems || []);
        setSessionData(restOfSession);
        sessionCreationAttempted.current = true;
      }
    } catch (error) {
      console.error("Failed to create standard session:", error);
      setShowInterviewBanner(true); // Show banner again on error
    }
  };


  // Unified session loading - let background script auto-determine session type from settings
  const { 
    data: sessionResponse, 
    loading: sessionLoading,
    error: _sessionError,
    retry: triggerSessionLoad
  } = useChromeMessage(
    { 
      type: "getOrCreateSession",
      // Only pass sessionType if user made manual override, otherwise let background auto-determine
      ...(_manualSessionTypeOverride && { sessionType: _manualSessionTypeOverride })
    }, 
    [settings, settingsLoaded, _manualSessionTypeOverride], // Depend on settings and manual override
    {
      immediate: false, // Wait for manual trigger after settings are confirmed loaded
      onSuccess: (response) => {
        if (response.session) {
          // Store full session data for interview mode detection
          setSessionData(response.session);
          
          // If we got a session, hide any interview banner that might be showing
          setShowInterviewBanner(false);
          
          // Validate session object structure
          if (response.session.problems && Array.isArray(response.session.problems)) {
            setProblems(response.session.problems);
          } else {
            setProblems([]);
          }
          
          // Reset session creation flag after successful session creation
          sessionCreationAttempted.current = false;
        } else {
          // No existing session found - check if we should show banner
          setProblems([]);
          setSessionData(null);
          
          // Only show banner if interview mode is manual and no session was found
          if (settings?.interviewMode && 
              settings.interviewMode !== 'disabled' && 
              settings?.interviewFrequency === 'manual') {
            setShowInterviewBanner(true);
          }
        }
      },
      onError: (error) => {
        console.error('ProblemGenerator session fetch error:', error);
        
        setProblems([]);
        setSessionData(null);
        
        // Reset session creation flag on error to allow retry
        sessionCreationAttempted.current = false;
        
        // On error, show banner only for manual interview mode
        if (settings?.interviewMode && 
            settings.interviewMode !== 'disabled' && 
            settings?.interviewFrequency === 'manual') {
          setShowInterviewBanner(true);
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
  }, [triggerSessionLoad]);

  // Only load session AFTER settings are fully loaded and we have valid settings
  useEffect(() => {
    if (settingsLoaded && settings && !sessionLoading && !sessionResponse) {
      // Create a simple hash of relevant settings to detect actual changes
      const settingsHash = JSON.stringify({
        interviewMode: settings.interviewMode,
        interviewFrequency: settings.interviewFrequency
      });
      
      // Reset session creation flag if settings actually changed
      if (lastSettingsHash.current !== settingsHash) {
        sessionCreationAttempted.current = false;
        lastSettingsHash.current = settingsHash;
      }
      
      handleSessionLoad();
    }
  }, [settingsLoaded, settings, sessionLoading, sessionResponse, handleSessionLoad]);

  // State for tracking user manual session type override (currently unused - using direct API calls instead)
  const [_manualSessionTypeOverride, _setManualSessionTypeOverride] = useState(null);

  const handleLinkClick = (problem) => {
    window.location.href =
      problem.LeetCodeAddress ||
      `https://leetcode.com/problems/${problem.slug}/description/`;
  };

  return (
    <div id="cm-mySidenav" className="cm-sidenav problink">
      <Header title="Generator" onClose={handleClose} />
      <div className="cm-sidenav__content">
        {/* Interview Mode Banner - only shows for interview sessions */}
        <InterviewModeBanner 
          sessionType={sessionData?.sessionType}
          interviewConfig={sessionData?.interviewConfig}
        />
        
        {settingsLoading || (settingsLoaded && sessionLoading) ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '20px', 
            color: 'var(--cm-text-secondary)' 
          }}>
            {settingsLoading ? '⏳ Loading settings...' : '🎯 Loading session...'}
            {settingsLoaded && sessionLoading && (
              <div style={{ 
                fontSize: '12px', 
                marginTop: '8px', 
                opacity: 0.7 
              }}>
                Using {settings?.interviewMode === 'disabled' ? 'standard' : settings?.interviewMode || 'standard'} mode
              </div>
            )}
          </div>
        ) : problems.length > 0 ? (
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
                    onLinkClick={handleLinkClick}
                  />
                </div>
              );
            })}
          </div>
        ) : showInterviewBanner ? (
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
                  onMouseOut={(e) => {
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
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = 'rgba(107, 114, 128, 0.8)';
                  }}
                >
                  No
                </button>
              </div>
            )}
          </div>
        ) : settingsLoaded && !sessionLoading ? (
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
        ) : null}
      </div>
    </div>
  );
};

export default ProbGen;
