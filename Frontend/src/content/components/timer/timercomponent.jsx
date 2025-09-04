import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  HiPlay, 
  HiPause, 
  HiArrowRight, 
  HiXMark,
  HiArrowPath
} from "react-icons/hi2";
import TimeDisplay from "../../../shared/components/timedisplay";
import { FloatingHintButton } from "../strategy";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import AccurateTimer from "../../../shared/utils/AccurateTimer";
import "../../../shared/components/css/timerBanner.css";

const TimerBanner = (props) => {
  const [problemTitle, setProblemTitle] = useState("");
  const [currentURL, setCurrentURL] = useState(window.location.href);
  const [open, setOpen] = useState(true);
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [countdownValue, setCountdownValue] = useState(null);
  const [displayTime, setDisplayTime] = useState(0); // For display purposes only

  // Soft warning system states
  const [timeWarningLevel, setTimeWarningLevel] = useState(0); // 0=none, 1=75%, 2=100%, 3=150%
  const [showStillWorkingPrompt, setShowStillWorkingPrompt] = useState(false);
  const [userIntent, setUserIntent] = useState("solving"); // "solving" | "stuck" | "completed"
  const [exceededRecommendedTime, setExceededRecommendedTime] = useState(false);
  const [isUnlimitedMode, setIsUnlimitedMode] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Interview signal tracking
  const [interviewSignals, setInterviewSignals] = useState({
    timeToFirstPlanMs: null,
    timeToFirstKeystroke: null,
    hintsUsed: 0,
    hintsRequestedTimes: [],
    approachChosen: null,
    stallReasons: []
  });
  const [hasFirstPlan, setHasFirstPlan] = useState(false);
  const [hasFirstKeystroke, setHasFirstKeystroke] = useState(false);

  const { pathname, state } = useLocation();
  const navigate = useNavigate();

  // Timer state management
  useEffect(() => {
    // Timer state updates handled here
  }, [state]);

  // Use AccurateTimer for all time operations
  const timerRef = useRef(null);
  const intervalIdRef = useRef(null);
  const previousURLRef = useRef(currentURL);

  // Memoize processed problem tags to prevent re-renders
  const processedTags = useMemo(() => {
    return state?.Tags ? state.Tags.map((tag) => tag.toLowerCase().trim()) : [];
  }, [state?.Tags]);

  // Memoize interview configuration to prevent re-renders
  const interviewConfig = useMemo(() => {
    return state?.interviewConfig || null;
  }, [state?.interviewConfig]);

  const sessionType = useMemo(() => {
    return state?.sessionType || null;
  }, [state?.sessionType]);

  // Determine UI mode from interview configuration
  const uiMode = useMemo(() => {
    if (!interviewConfig || sessionType === 'standard') {
      return 'full-support';
    }
    return interviewConfig.uiMode || 'full-support';
  }, [interviewConfig, sessionType]);

  // Calculate interview-specific time limits
  const calculateInterviewTimeLimit = useCallback((standardLimitInMinutes, problemDifficulty) => {
    if (!interviewConfig?.timing || sessionType === 'standard') {
      return standardLimitInMinutes * 60; // Return in seconds
    }

    // Use interview mode thresholds if available
    if (interviewConfig.timing.thresholds && problemDifficulty) {
      const thresholdInMs = interviewConfig.timing.thresholds[problemDifficulty];
      if (thresholdInMs) {
        return Math.floor(thresholdInMs / 1000); // Convert ms to seconds
      }
    }

    // Apply interview timing multiplier
    const multiplier = interviewConfig.timing.multiplier || 1.0;
    return Math.floor(standardLimitInMinutes * 60 * multiplier);
  }, [interviewConfig, sessionType]);

  // Interview signal tracking functions
  const recordFirstPlan = useCallback(() => {
    if (!hasFirstPlan && timerRef.current?.isRunning) {
      const timeToFirstPlan = timerRef.current.getElapsedTime() * 1000; // Convert to milliseconds
      setHasFirstPlan(true);
      setInterviewSignals(prev => ({
        ...prev,
        timeToFirstPlanMs: timeToFirstPlan
      }));
      console.log("🎯 First plan recorded:", timeToFirstPlan + "ms");
    }
  }, [hasFirstPlan]);

  const recordFirstKeystroke = useCallback(() => {
    if (!hasFirstKeystroke && timerRef.current?.isRunning) {
      const timeToFirstKeystroke = timerRef.current.getElapsedTime() * 1000; // Convert to milliseconds
      setHasFirstKeystroke(true);
      setInterviewSignals(prev => ({
        ...prev,
        timeToFirstKeystroke: timeToFirstKeystroke
      }));
      console.log("⌨️ First keystroke recorded:", timeToFirstKeystroke + "ms");
    }
  }, [hasFirstKeystroke]);

  // Listen for keyboard events to capture first keystroke
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only record if we're in an interview mode and timer is running
      if (sessionType && sessionType !== 'standard' && timerRef.current?.isRunning) {
        recordFirstKeystroke();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [recordFirstKeystroke, sessionType]);

  // Memoize callback functions to prevent re-renders
  const handleHintOpen = useCallback((data) => {
    // Track popover open event for analytics
  }, []);

  const handleHintClose = useCallback((data) => {
    // Track popover close event for analytics
  }, []);

  const handleHintClick = useCallback((hintData) => {
    // Track individual hint clicks for usage analytics and interview signals
    if (sessionType && sessionType !== 'standard' && timerRef.current?.isRunning) {
      const currentTime = timerRef.current.getElapsedTime() * 1000; // Convert to milliseconds
      setInterviewSignals(prev => ({
        ...prev,
        hintsUsed: prev.hintsUsed + 1,
        hintsRequestedTimes: [...prev.hintsRequestedTimes, currentTime]
      }));
      console.log("💡 Hint used in interview mode at:", currentTime + "ms");
    }

    // Original analytics tracking
    // AnalyticsService.trackHintUsage(hintData);
  }, [sessionType]);

  const toggleTimer = () => {
    if (!timerRef.current) return;

    if (timerRef.current.isRunning) {
      handleStop();
    } else {
      handleStart();
    }
  };

  // Initialize timer when limits are received
  const {
    data: limitsData,
    loading,
    error,
  } = useChromeMessage(
    state?.LeetCodeID
      ? {
          type: "getLimits",
          id: state.LeetCodeID,
        }
      : null,
    [state?.LeetCodeID],
    {
      onSuccess: (response) => {
        // Adaptive limits received and processed
        const limitInMinutes = response.limits.Time;
        const standardLimitInSeconds = AccurateTimer.minutesToSeconds(limitInMinutes);

        // Get problem difficulty for interview time calculation
        const problemDifficulty = state?.Difficulty;

        // Calculate interview-adjusted time limit
        const adjustedLimitInSeconds = calculateInterviewTimeLimit(limitInMinutes, problemDifficulty);

        // Check if we're in unlimited mode (standard mode or no interview config)
        const adaptiveLimits = response.limits.adaptiveLimits;
        const isStandardUnlimited = adaptiveLimits?.isUnlimited || limitInMinutes >= 999;
        const isInterviewMode = sessionType && sessionType !== 'standard';
        const unlimited = !isInterviewMode && isStandardUnlimited;

        setIsUnlimitedMode(unlimited);

        // Always initialize timer as elapsed time counter (counting up from 0)
        timerRef.current = new AccurateTimer(0);
        setDisplayTime(0);

        // Store the appropriate limit for reference/warnings
        timerRef.current.recommendedLimit = isInterviewMode ? adjustedLimitInSeconds : standardLimitInSeconds;
        timerRef.current.isUnlimited = unlimited;
        timerRef.current.isInterviewMode = isInterviewMode;
        timerRef.current.interviewConfig = interviewConfig;

        // Timer initialized with interview-aware limits
      },
    }
  );

  const handleStart = () => {
    if (!timerRef.current) {
      console.error("❌ Timer not initialized");
      return;
    }

    if (timerRef.current.start()) {
      setIsTimerRunning(true);
      // Start the display update interval - always show elapsed time
      intervalIdRef.current = setInterval(() => {
        const elapsedTime = timerRef.current.getElapsedTime();
        setDisplayTime(elapsedTime); // Always show elapsed time counting up

        // Handle interview mode hard cutoffs
        if (timerRef.current.isInterviewMode && 
            timerRef.current.interviewConfig?.timing?.hardCutoff) {
          const recommendedLimit = timerRef.current.recommendedLimit;
          if (elapsedTime >= recommendedLimit) {
            // Hard cutoff - automatically complete the problem
            handleComplete();
            return;
          }
        }

        // Only show warnings if we have a recommended limit (not unlimited mode)
        if (!isUnlimitedMode && timerRef.current.recommendedLimit > 0) {
          const recommendedLimit = timerRef.current.recommendedLimit;
          const timeProgress = elapsedTime / recommendedLimit;

          // Adjust warning thresholds for interview mode
          const isInterviewMode = timerRef.current.isInterviewMode;
          const warnThreshold1 = isInterviewMode ? 0.6 : 0.75; // Earlier warnings in interview
          const warnThreshold2 = isInterviewMode ? 0.8 : 1.0;  // Earlier final warning
          const warnThreshold3 = isInterviewMode ? 1.0 : 1.5;  // Hard stop vs continue

          if (timeProgress >= warnThreshold3 && timeWarningLevel < 3) {
            setTimeWarningLevel(3); // Final warning or hard cutoff
          } else if (timeProgress >= warnThreshold2 && timeWarningLevel < 2) {
            setTimeWarningLevel(2); // Approaching limit or exceeded
            setExceededRecommendedTime(true);
            if (!isInterviewMode) {
              setShowStillWorkingPrompt(true); // Only show prompt for non-interview
            }
          } else if (timeProgress >= warnThreshold1 && timeWarningLevel < 1) {
            setTimeWarningLevel(1); // Approaching recommended time
          }

          // Show notification when recommended time is reached
          if (Math.floor(elapsedTime) === recommendedLimit && elapsedTime > 0) {
            if (isInterviewMode && timerRef.current.interviewConfig?.timing?.hardCutoff) {
              // Don't show countdown for hard cutoff modes - will auto-complete
              startCountdown();
            } else {
              startCountdown();
            }
          }
        }
      }, 1000);

      // Timer started in elapsed time mode
    }
  };

  const startCountdown = () => {
    setCountdownVisible(true);
    setCountdownValue("Recommended Time Reached");

    setTimeout(() => {
      setCountdownValue("Keep going if making progress!");
      setTimeout(() => {
        setCountdownVisible(false);
        // Don't auto-complete anymore - let user decide
      }, 2000);
    }, 2000);
  };

  const handleStillWorking = () => {
    setShowStillWorkingPrompt(false);
    setUserIntent("solving");
    // User indicated still working on solution
  };

  const handleStuck = () => {
    setShowStillWorkingPrompt(false);
    setUserIntent("stuck");
    // User indicated stuck - suggesting hints
    // Could trigger hint system or other help
  };

  const handleMoveOn = () => {
    setShowStillWorkingPrompt(false);
    setUserIntent("completed");
    handleComplete();
  };

  const handleStop = () => {
    if (!timerRef.current) return;

    timerRef.current.pause();
    setIsTimerRunning(false);

    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    // Timer stopped
  };

  const handleClose = () => {
    handleStop();
    navigate("/");
  };

  const handleComplete = () => {
    handleStop();
    if (state !== null && timerRef.current) {
      let problem = { ...state };

      // Calculate accurate time spent using AccurateTimer
      const timeSpentInSeconds = timerRef.current.getElapsedTime();
      const timeSpentInMinutes = AccurateTimer.secondsToMinutes(
        timeSpentInSeconds,
        1
      );
      const totalTimeInSeconds = timerRef.current.totalTimeInSeconds;
      const overageTime = Math.max(0, timeSpentInSeconds - totalTimeInSeconds);

      // Ensure minimum time of 1 minute for valid submissions
      problem["Time"] = Math.max(1, Math.round(timeSpentInMinutes));

      // Enhanced time tracking for soft limits
      problem["timeSpentInSeconds"] = timeSpentInSeconds;
      problem["exceededRecommendedTime"] = exceededRecommendedTime;
      problem["overageTime"] = overageTime;
      problem["userIntent"] = userIntent;
      problem["timeWarningLevel"] = timeWarningLevel;

      // Add interview signals if this is an interview session
      if (sessionType && sessionType !== 'standard') {
        const finalInterviewSignals = {
          ...interviewSignals,
          // Calculate hint pressure: hints per second
          hintPressure: timeSpentInSeconds > 0 ? interviewSignals.hintsUsed / timeSpentInSeconds : 0,
          // Calculate transfer accuracy (will be set later based on success)
          transferAccuracy: null, // This will be calculated in the submission flow
          // Calculate speed delta (will be calculated against baselines later)
          speedDelta: null, // This will be calculated against tag baselines
        };

        problem["interviewSignals"] = finalInterviewSignals;
        console.log("🎯 Interview signals captured:", finalInterviewSignals);
      }

      // Problem completion recorded

      setOpen(false);
      navigate("/Probtime", { state: problem });
    }
  };

  const handleReset = () => {
    if (!timerRef.current) return;

    handleStop();
    timerRef.current.reset();
    setDisplayTime(0); // Always reset to 0 for elapsed time counter

    // Reset warning states
    setTimeWarningLevel(0);
    setShowStillWorkingPrompt(false);
    setUserIntent("solving");
    setExceededRecommendedTime(false);

    // Timer reset to 0
  };

  // Get warning message based on current warning level
  const getWarningMessage = () => {
    const isInterviewMode = sessionType && sessionType !== 'standard';
    const hasHardCutoff = interviewConfig?.timing?.hardCutoff;

    switch (timeWarningLevel) {
      case 1:
        return isInterviewMode ? "Interview time halfway point" : "Approaching recommended time";
      case 2:
        if (isInterviewMode) {
          return hasHardCutoff ? "Interview time almost up - wrap up your solution" : "Interview time exceeded - finish up";
        }
        return "Interview time exceeded - keep going if making progress";
      case 3:
        if (isInterviewMode) {
          return hasHardCutoff ? "Interview time limit reached" : "Interview time well exceeded - move on";
        }
        return "Consider reviewing hints or moving to next problem";
      default:
        return null;
    }
  };

  // Get timer CSS class based on warning level and UI mode
  const getTimerClass = () => {
    let baseClass;
    switch (timeWarningLevel) {
      case 1:
        baseClass = "timer-warning-1";
        break;
      case 2:
        baseClass = "timer-warning-2";
        break;
      case 3:
        baseClass = "timer-warning-3";
        break;
      default:
        baseClass = "timer-normal";
    }

    // Apply UI mode modifiers
    switch (uiMode) {
      case 'pressure-indicators':
        return `${baseClass} timer-pressure`;
      case 'minimal-clean':
        return `${baseClass} timer-minimal`;
      default:
        return baseClass;
    }
  };

  // Get warning message CSS class based on warning level
  const getWarningMessageClass = () => {
    switch (timeWarningLevel) {
      case 1:
        return "timer-warning-message warning-1";
      case 2:
        return "timer-warning-message warning-2";
      case 3:
        return "timer-warning-message warning-3";
      default:
        return "timer-warning-message";
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
      if (timerRef.current?.isRunning) {
        timerRef.current.stop();
      }
    };
  }, []);
  if (countdownVisible) {
    return (
      <div className="countdown-overlay">
        <h1>{countdownValue}</h1>
      </div>
    );
  }

  if (showStillWorkingPrompt) {
    return (
      <div className="timer-banner still-working-prompt">
        <div className="timer-banner-header">
          <h1 className={getTimerClass()}>Time Check</h1>
          <HiXMark 
            onClick={handleClose} 
            className="close-icon"
            title="Close timer and return to menu"
            aria-label="Close timer and return to menu"
          />
        </div>

        <div className="timer-banner-content">
          <div style={{ textAlign: "center", padding: "10px" }}>
            <p>You've exceeded the recommended interview time.</p>
            <p>How are you feeling about this problem?</p>

            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "center",
                marginTop: "15px",
              }}
            >
              <button
                onClick={handleStillWorking}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "var(--cm-success, #4CAF50)",
                  color: "var(--cm-btn-text, white)",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Still Making Progress
              </button>
              <button
                onClick={handleStuck}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "var(--cm-warning, #FF9800)",
                  color: "var(--cm-btn-text, white)",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                I'm Stuck
              </button>
              <button
                onClick={handleMoveOn}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "var(--cm-error, #f44336)",
                  color: "var(--cm-btn-text, white)",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Move On
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!open) return null;

  return (
    <div className="timer-banner">
      <div className="timer-banner-header">
        <h1 className={getTimerClass()}>
          {sessionType && sessionType !== 'standard' 
            ? `Interview Timer (${sessionType === 'interview-like' ? 'Practice' : 'Full Interview'})`
            : isUnlimitedMode ? "Timer (No Limits)" : "Timer"}
        </h1>
        <HiXMark 
          onClick={handleClose} 
          className="close-icon"
          title="Close timer and return to menu"
          aria-label="Close timer and return to menu"
        />
      </div>

      <div className="timer-banner-content">
        <TimeDisplay time={displayTime} toggleTimer={toggleTimer} />

        {/* Mode indicator */}
        <div
          style={{
            fontSize: "11px",
            textAlign: "center",
            color: "var(--cm-timer-text, #000000)",
            opacity: 0.7,
            marginTop: "2px",
            fontStyle: "italic",
          }}
        >
          {sessionType && sessionType !== 'standard'
            ? `Interview Mode • ${interviewConfig?.timing?.hardCutoff ? 'Hard time limits' : 'Soft guidance'}`
            : isUnlimitedMode
            ? "No guidance • Learn at your own pace"
            : "Elapsed time • Guidance enabled"}
        </div>

        {/* Warning message display (only for guided mode) */}
        {!isUnlimitedMode && getWarningMessage() && (
          <div
            className={getWarningMessageClass()}
            style={{
              fontSize: "12px",
              textAlign: "center",
              marginTop: "5px",
              fontWeight: "bold",
            }}
          >
            {getWarningMessage()}
          </div>
        )}
      </div>

      <div className="timer-banner-controls">
        <HiArrowPath 
          onClick={handleReset} 
          title="Reset timer to 00:00"
          aria-label="Reset timer to 00:00"
          style={{ cursor: 'pointer' }}
        />
        {/* Interview mode: First Plan button */}
        {sessionType && sessionType !== 'standard' && !hasFirstPlan && isTimerRunning && (
          <button
            onClick={recordFirstPlan}
            className="first-plan-button"
            style={{
              padding: "4px 8px",
              fontSize: "10px",
              backgroundColor: "var(--cm-success, #4CAF50)",
              color: "var(--cm-btn-text, white)",
              border: "none",
              borderRadius: "3px",
              cursor: "pointer",
              margin: "0 5px"
            }}
            title="Click when you have your approach planned out"
          >
            Got Plan!
          </button>
        )}

        {/* Add hint button as part of timer controls */}
        {processedTags.length > 0 && (
          <div style={{ display: "flex", alignItems: "center" }}>
            <FloatingHintButton
              problemTags={processedTags}
              problemId={state?.LeetCodeID || null}
              onOpen={handleHintOpen}
              onClose={handleHintClose}
              onHintClick={handleHintClick}
              interviewConfig={interviewConfig}
              sessionType={sessionType}
              uiMode={uiMode}
            />
          </div>
        )}
        {isTimerRunning ? (
          <HiPause 
            onClick={handleStop} 
            title="Pause timer"
            aria-label="Pause timer"
            style={{ cursor: 'pointer' }}
          />
        ) : (
          <HiPlay 
            onClick={handleStart} 
            title="Start timer"
            aria-label="Start timer"
            style={{ cursor: 'pointer' }}
          />
        )}
        <HiArrowRight 
          onClick={handleComplete} 
          title="Complete problem and submit"
          aria-label="Complete problem and submit"
          style={{ cursor: 'pointer' }}
        />
      </div>
    </div>
  );
};

export default TimerBanner;
