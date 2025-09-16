import logger from "../../../shared/utils/logger.js";
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

// Countdown overlay component
const CountdownOverlay = ({ countdownValue }) => (
  <div className="countdown-overlay">
    <h1>{countdownValue}</h1>
  </div>
);

// Still working prompt component
const StillWorkingPrompt = ({ getTimerClass, handleClose, handleStillWorking, handleStuck, handleMoveOn }) => (
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
        <p>You&apos;ve exceeded the recommended interview time.</p>
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
            I&apos;m Stuck
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

// Timer header component
const TimerHeader = ({ sessionType, isUnlimitedMode, getTimerClass, handleClose }) => (
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
);

// Timer content component
const TimerContent = ({ displayTime, toggleTimer, sessionType, interviewConfig, isUnlimitedMode, getWarningMessage, getWarningMessageClass }) => (
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
);

// Timer controls component
const TimerControls = ({ 
  handleReset, sessionType, hasFirstPlan, isTimerRunning, recordFirstPlan,
  processedTags, state, handleHintOpen, handleHintClose, handleHintClick,
  interviewConfig, uiMode, handleStop, handleStart, handleComplete
}) => (
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
);

// Custom hook for timer state management
const useTimerState = () => {
  const [open, setOpen] = useState(true);
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [countdownValue, setCountdownValue] = useState(null);
  const [displayTime, setDisplayTime] = useState(0);
  const [timeWarningLevel, setTimeWarningLevel] = useState(0);
  const [showStillWorkingPrompt, setShowStillWorkingPrompt] = useState(false);
  const [userIntent, setUserIntent] = useState("solving");
  const [exceededRecommendedTime, setExceededRecommendedTime] = useState(false);
  const [isUnlimitedMode, setIsUnlimitedMode] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  return {
    open, setOpen,
    countdownVisible, setCountdownVisible,
    countdownValue, setCountdownValue,
    displayTime, setDisplayTime,
    timeWarningLevel, setTimeWarningLevel,
    showStillWorkingPrompt, setShowStillWorkingPrompt,
    userIntent, setUserIntent,
    exceededRecommendedTime, setExceededRecommendedTime,
    isUnlimitedMode, setIsUnlimitedMode,
    isTimerRunning, setIsTimerRunning
  };
};

// Custom hook for interview signals
const useInterviewSignals = () => {
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

  return {
    interviewSignals, setInterviewSignals,
    hasFirstPlan, setHasFirstPlan,
    hasFirstKeystroke, setHasFirstKeystroke
  };
};

// Custom hook for timer limit calculation and configuration
const useTimerConfiguration = (state) => {

  // Memoize processed problem tags to prevent re-renders
  const processedTags = useMemo(() => {
    return state?.Tags ? state.Tags.map((tag) => tag.toLowerCase().trim()) : [];
  }, [state?.Tags]);

  // Memoize interview configuration to prevent re-renders
  const memoizedInterviewConfig = useMemo(() => {
    return state?.interviewConfig || null;
  }, [state?.interviewConfig]);

  const memoizedSessionType = useMemo(() => {
    return state?.sessionType || null;
  }, [state?.sessionType]);

  // Determine UI mode from interview configuration
  const uiMode = useMemo(() => {
    if (!memoizedInterviewConfig || memoizedSessionType === 'standard') {
      return 'full-support';
    }
    return memoizedInterviewConfig.uiMode || 'full-support';
  }, [memoizedInterviewConfig, memoizedSessionType]);

  // Calculate interview-specific time limits
  const calculateInterviewTimeLimit = useCallback((standardLimitInMinutes, problemDifficulty) => {
    if (!memoizedInterviewConfig?.timing || memoizedSessionType === 'standard') {
      return standardLimitInMinutes * 60; // Return in seconds
    }

    // Use interview mode thresholds if available
    if (memoizedInterviewConfig.timing.thresholds && problemDifficulty) {
      const thresholdInMs = memoizedInterviewConfig.timing.thresholds[problemDifficulty];
      if (thresholdInMs) {
        return Math.floor(thresholdInMs / 1000); // Convert ms to seconds
      }
    }

    // Apply interview timing multiplier
    const multiplier = memoizedInterviewConfig.timing.multiplier || 1.0;
    return Math.floor(standardLimitInMinutes * 60 * multiplier);
  }, [memoizedInterviewConfig, memoizedSessionType]);

  return {
    processedTags,
    interviewConfig: memoizedInterviewConfig,
    sessionType: memoizedSessionType,
    uiMode,
    calculateInterviewTimeLimit
  };
};

// Custom hook for interview-specific features
const useInterviewFeatures = (sessionType, timerRef, interviewSignalsState) => {
  const { setInterviewSignals, hasFirstPlan, setHasFirstPlan, hasFirstKeystroke, setHasFirstKeystroke } = interviewSignalsState;

  const recordFirstPlan = useCallback(() => {
    if (!hasFirstPlan && timerRef.current?.isRunning) {
      const timeToFirstPlan = timerRef.current.getElapsedTime() * 1000;
      setHasFirstPlan(true);
      setInterviewSignals(prev => ({
        ...prev,
        timeToFirstPlanMs: timeToFirstPlan
      }));
      logger.info("🎯 First plan recorded:", timeToFirstPlan + "ms");
    }
  }, [hasFirstPlan, setHasFirstPlan, setInterviewSignals, timerRef]);

  const recordFirstKeystroke = useCallback(() => {
    if (!hasFirstKeystroke && timerRef.current?.isRunning) {
      const timeToFirstKeystroke = timerRef.current.getElapsedTime() * 1000;
      setHasFirstKeystroke(true);
      setInterviewSignals(prev => ({
        ...prev,
        timeToFirstKeystroke: timeToFirstKeystroke
      }));
      logger.info("⌨️ First keystroke recorded:", timeToFirstKeystroke + "ms");
    }
  }, [hasFirstKeystroke, setHasFirstKeystroke, setInterviewSignals, timerRef]);

  const handleHintClick = useCallback((_hintData) => {
    if (sessionType && sessionType !== 'standard' && timerRef.current?.isRunning) {
      const currentTime = timerRef.current.getElapsedTime() * 1000;
      setInterviewSignals(prev => ({
        ...prev,
        hintsUsed: prev.hintsUsed + 1,
        hintsRequestedTimes: [...prev.hintsRequestedTimes, currentTime]
      }));
      logger.info("💡 Hint used in interview mode at:", currentTime + "ms");
    }
  }, [sessionType, setInterviewSignals, timerRef]);

  // Listen for keyboard events to capture first keystroke
  useEffect(() => {
    const handleKeyDown = () => {
      if (sessionType && sessionType !== 'standard' && timerRef.current?.isRunning) {
        recordFirstKeystroke();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [recordFirstKeystroke, sessionType, timerRef]);

  return {
    recordFirstPlan,
    recordFirstKeystroke, 
    handleHintClick
  };
};

// Helper function to create stop timer functionality
const createStopTimerFunction = (timerRef, setIsTimerRunning, intervalIdRef) => () => {
  if (!timerRef.current) return;
  timerRef.current.pause();
  setIsTimerRunning(false);
  if (intervalIdRef.current) {
    clearInterval(intervalIdRef.current);
    intervalIdRef.current = null;
  }
};

// Helper function to build problem data with timing information
const buildProblemData = (state, timerRef, timerState, sessionType, interviewSignals) => {
  const { exceededRecommendedTime, userIntent, timeWarningLevel } = timerState;
  let problem = { ...state };

  // Calculate accurate time spent using AccurateTimer
  const timeSpentInSeconds = timerRef.current.getElapsedTime();
  const timeSpentInMinutes = AccurateTimer.secondsToMinutes(timeSpentInSeconds, 1);
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
      hintPressure: timeSpentInSeconds > 0 ? interviewSignals.hintsUsed / timeSpentInSeconds : 0,
      transferAccuracy: null,
      speedDelta: null,
    };

    problem["interviewSignals"] = finalInterviewSignals;
    logger.info("🎯 Interview signals captured:", finalInterviewSignals);
  }

  return problem;
};

// Helper function to get time warning thresholds
const getTimeWarningThresholds = (isInterviewMode) => ({
  warnThreshold1: isInterviewMode ? 0.6 : 0.75,
  warnThreshold2: isInterviewMode ? 0.8 : 1.0,
  warnThreshold3: isInterviewMode ? 1.0 : 1.5
});

// Helper function to create event handlers for timer banner
const createTimerEventHandlers = ({
  setShowStillWorkingPrompt, 
  setUserIntent, 
  handleComplete, 
  handleStop, 
  navigate
}) => {
  const handleStillWorking = () => {
    setShowStillWorkingPrompt(false);
    setUserIntent("solving");
  };

  const handleStuck = () => {
    setShowStillWorkingPrompt(false);
    setUserIntent("stuck");
  };

  const handleMoveOn = () => {
    setShowStillWorkingPrompt(false);
    setUserIntent("completed");
    handleComplete();
  };

  const handleClose = () => {
    handleStop();
    navigate("/");
  };

  return { handleStillWorking, handleStuck, handleMoveOn, handleClose };
};

// Helper function to create toggle timer functionality
const createToggleTimer = (timerRef, handleStart, handleStop) => () => {
  if (!timerRef.current) return;

  if (timerRef.current.isRunning) {
    handleStop();
  } else {
    handleStart();
  }
};

// Helper function to get warning message based on warning level
const getWarningMessage = (timeWarningLevel, sessionType, interviewConfig) => {
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

// Helper function to get timer CSS class based on warning level and UI mode
const getTimerClass = (timeWarningLevel, uiMode) => {
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

// Helper function to get warning message CSS class based on warning level
const getWarningMessageClass = (timeWarningLevel) => {
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

// Helper function to initialize timer with limits data
const initializeTimerWithLimits = (response, options) => {
  const { 
    state, 
    sessionType, 
    interviewConfig, 
    calculateInterviewTimeLimit, 
    timerRef, 
    setDisplayTime, 
    setIsUnlimitedMode
  } = options;
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
};

// Initialize timer with default limits when query fails
const initializeTimerWithDefaults = (options) => {
  const { state, sessionType, interviewConfig: _interviewConfig, calculateInterviewTimeLimit: _calculateInterviewTimeLimit, timerRef, setDisplayTime: _setDisplayTime, setIsUnlimitedMode: _setIsUnlimitedMode } = options;

  console.log("🔍 Timer initializeTimerWithDefaults", { state, sessionType });

  // Use default limits - create a mock response similar to what getLimits would return
  const defaultResponse = {
    limits: {
      standard: 30, // 30 minutes default for standard mode
      adaptiveLimits: {
        isUnlimited: false,
        limitInMinutes: 30
      }
    }
  };

  // Call the same initialization logic with default values
  initializeTimerWithLimits(defaultResponse, options);

  console.log("🔍 Timer initializeTimerWithDefaults: Complete", { timerRefExists: !!timerRef.current });
};

// Custom hook for timer setup and initialization
const useTimerSetup = (options) => {
  const { state, sessionType, interviewConfig, calculateInterviewTimeLimit, setDisplayTime, setIsUnlimitedMode } = options;
  console.log("🔍 Timer useTimerSetup: Hook called", {
    state,
    sessionType,
    leetCodeID: state?.LeetCodeID,
    hasState: !!state
  });
  const timerRef = useRef(null);
  const intervalIdRef = useRef(null);
  
  const limitsQuery = useChromeMessage(
    state?.LeetCodeID
      ? {
          type: "getLimits",
          id: state.LeetCodeID,
        }
      : null,
    [state?.LeetCodeID],
    {
      onSuccess: (response) => {
        console.log("🔍 Timer useTimerSetup: limitsQuery onSuccess", { response, leetCodeID: state?.LeetCodeID });
        initializeTimerWithLimits(response, {
          state,
          sessionType,
          interviewConfig,
          calculateInterviewTimeLimit,
          timerRef,
          setDisplayTime,
          setIsUnlimitedMode
        });
        console.log("🔍 Timer useTimerSetup: timerRef initialized", { timerRefExists: !!timerRef.current });
      },
      onError: (error) => {
        console.error("❌ Timer useTimerSetup: limitsQuery failed", { error, leetCodeID: state?.LeetCodeID });
        // Fallback initialization with default limits
        initializeTimerWithDefaults({
          state,
          sessionType,
          interviewConfig,
          calculateInterviewTimeLimit,
          timerRef,
          setDisplayTime,
          setIsUnlimitedMode
        });
        console.log("🔍 Timer useTimerSetup: timerRef initialized with defaults", { timerRefExists: !!timerRef.current });
      }
    }
  );

  // Handle case where there's no LeetCode ID - initialize with defaults
  useEffect(() => {
    if (!state?.LeetCodeID && !timerRef.current) {
      console.log("🔍 Timer useTimerSetup: No LeetCode ID, initializing with defaults");
      initializeTimerWithDefaults({
        state,
        sessionType,
        interviewConfig,
        calculateInterviewTimeLimit,
        timerRef,
        setDisplayTime,
        setIsUnlimitedMode
      });
    }
  }, [state?.LeetCodeID, sessionType, interviewConfig, calculateInterviewTimeLimit, setDisplayTime, setIsUnlimitedMode]);

  return { timerRef, intervalIdRef, limitsQuery };
};

// Custom hook for timer UI utilities and callbacks
const useTimerUIHelpers = (timerRef, handleStart, handleStop) => {
  // Memoize callback functions to prevent re-renders
  const handleHintOpen = useCallback((_data) => {
    // Track popover open event for analytics
  }, []);

  const handleHintClose = useCallback((_data) => {
    // Track popover close event for analytics
  }, []);

  const toggleTimer = createToggleTimer(timerRef, handleStart, handleStop);

  // Cleanup on unmount
  useEffect(() => {
    const intervalId = timerRef.current?.intervalId;
    const timer = timerRef.current;
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (timer?.isRunning) {
        timer.stop();
      }
    };
  }, [timerRef]);

  return { handleHintOpen, handleHintClose, toggleTimer };
};

// Custom hook for timer operations
const useTimerOperations = (timerRef, intervalIdRef, timerState, { sessionType, navigate, state }) => {
  const {
    setIsTimerRunning, setDisplayTime, setTimeWarningLevel,
    setExceededRecommendedTime, setShowStillWorkingPrompt,
    setCountdownVisible, setCountdownValue, setUserIntent, setOpen,
    isUnlimitedMode, timeWarningLevel, interviewSignals
  } = timerState;

  const handleComplete = useCallback(() => {
    console.log("🔍 Timer handleComplete called", {
      state,
      timerRefExists: !!timerRef.current,
      stateNotNull: state !== null,
      willNavigate: state !== null && timerRef.current
    });

    const stopTimer = createStopTimerFunction(timerRef, setIsTimerRunning, intervalIdRef);
    stopTimer();

    if (state !== null && timerRef.current) {
      console.log("🔍 Timer handleComplete: Original state:", {
        state,
        stateKeys: state ? Object.keys(state) : 'null',
        LeetCodeID: state?.LeetCodeID,
        Description: state?.Description,
        Time: state?.Time
      });
      const problem = buildProblemData(state, timerRef, timerState, sessionType, interviewSignals);
      console.log("🔍 Timer navigating to /Probtime with state:", {
        problem,
        problemKeys: problem ? Object.keys(problem) : 'null',
        LeetCodeID: problem?.LeetCodeID,
        Description: problem?.Description,
        Time: problem?.Time
      });
      setOpen(false);
      navigate("/Probtime", { state: problem });
    } else {
      console.log("❌ Timer navigation blocked", {
        reason: state === null ? "state is null" : "timerRef.current is null",
        state,
        timerRefExists: !!timerRef.current
      });
    }
  }, [state, timerRef, interviewSignals, sessionType, navigate, setOpen, timerState, setIsTimerRunning, intervalIdRef]);

  const handleStart = useCallback(() => {
    if (!timerRef.current) {
      logger.error("❌ Timer not initialized");
      return;
    }

    if (timerRef.current.start()) {
      setIsTimerRunning(true);
      intervalIdRef.current = setInterval(() => {
        const elapsedTime = timerRef.current.getElapsedTime();
        setDisplayTime(elapsedTime);

        if (timerRef.current.isInterviewMode && 
            timerRef.current.interviewConfig?.timing?.hardCutoff) {
          const recommendedLimit = timerRef.current.recommendedLimit;
          if (elapsedTime >= recommendedLimit) {
            handleComplete();
            return;
          }
        }

        if (!isUnlimitedMode && timerRef.current.recommendedLimit > 0) {
          const recommendedLimit = timerRef.current.recommendedLimit;
          const timeProgress = elapsedTime / recommendedLimit;
          const isInterviewMode = timerRef.current.isInterviewMode;
          const { warnThreshold1, warnThreshold2, warnThreshold3 } = getTimeWarningThresholds(isInterviewMode);

          if (timeProgress >= warnThreshold3 && timeWarningLevel < 3) {
            setTimeWarningLevel(3);
          } else if (timeProgress >= warnThreshold2 && timeWarningLevel < 2) {
            setTimeWarningLevel(2);
            setExceededRecommendedTime(true);
            if (!isInterviewMode) {
              setShowStillWorkingPrompt(true);
            }
          } else if (timeProgress >= warnThreshold1 && timeWarningLevel < 1) {
            setTimeWarningLevel(1);
          }

          if (Math.floor(elapsedTime) === recommendedLimit && elapsedTime > 0) {
            startCountdown();
          }
        }
      }, 1000);
    }
  }, [isUnlimitedMode, timeWarningLevel, setIsTimerRunning, setDisplayTime, setTimeWarningLevel, setExceededRecommendedTime, setShowStillWorkingPrompt, handleComplete, startCountdown, timerRef, intervalIdRef]);

  const startCountdown = useCallback(() => {
    setCountdownVisible(true);
    setCountdownValue("Recommended Time Reached");

    setTimeout(() => {
      setCountdownValue("Keep going if making progress!");
      setTimeout(() => {
        setCountdownVisible(false);
      }, 2000);
    }, 2000);
  }, [setCountdownVisible, setCountdownValue]);

  const handleStop = useCallback(() => {
    const stopTimer = createStopTimerFunction(timerRef, setIsTimerRunning, intervalIdRef);
    stopTimer();
  }, [timerRef, setIsTimerRunning, intervalIdRef]);

  const handleReset = useCallback(() => {
    if (!timerRef.current) return;

    handleStop();
    timerRef.current.reset();
    setDisplayTime(0);
    setTimeWarningLevel(0);
    setShowStillWorkingPrompt(false);
    setUserIntent("solving");
    setExceededRecommendedTime(false);
  }, [handleStop, setDisplayTime, setTimeWarningLevel, setShowStillWorkingPrompt, setUserIntent, setExceededRecommendedTime, timerRef]);

  return {
    handleStart,
    handleStop,
    handleReset,
    handleComplete,
    startCountdown
  };
};

function TimerBanner(_props) {
  const [_problemTitle, _setProblemTitle] = useState("");
  const [_currentURL, _setCurrentURL] = useState(window.location.href);

  // Use custom hooks for state management
  const timerState = useTimerState();
  const { open, setOpen, countdownVisible, countdownValue, displayTime, setDisplayTime, timeWarningLevel, showStillWorkingPrompt, setShowStillWorkingPrompt, setUserIntent, isUnlimitedMode, setIsUnlimitedMode, isTimerRunning } = timerState;

  const interviewSignalsState = useInterviewSignals();
  const { interviewSignals, hasFirstPlan } = interviewSignalsState;

  const { pathname: _pathname, state } = useLocation();
  const navigate = useNavigate();
  
  // Use configuration hook for memoized values
  const { processedTags, interviewConfig, sessionType, uiMode, calculateInterviewTimeLimit } = useTimerConfiguration(state);

  // Use timer setup hook
  const { timerRef, intervalIdRef } = useTimerSetup({ state, sessionType, interviewConfig, calculateInterviewTimeLimit, setDisplayTime, setIsUnlimitedMode });
  const _previousURLRef = useRef(_currentURL);

  // Use extracted hooks for functionality  
  const { recordFirstPlan, handleHintClick } = useInterviewFeatures(sessionType, timerRef, interviewSignalsState);
  
  // Enhanced timer state for operations hook
  const enhancedTimerState = { ...timerState, interviewSignals, setOpen };

  const { handleStart, handleStop, handleReset, handleComplete } = useTimerOperations(timerRef, intervalIdRef, enhancedTimerState, { sessionType, navigate, state });

  // Use timer UI helpers hook
  const { handleHintOpen, handleHintClose, toggleTimer } = useTimerUIHelpers(timerRef, handleStart, handleStop);

  // Create event handlers using helper function
  const { handleStillWorking, handleStuck, handleMoveOn, handleClose } = createTimerEventHandlers({ setShowStillWorkingPrompt, setUserIntent, handleComplete, handleStop, navigate });

  // Use helper functions for timer styling and messages
  const currentWarningMessage = getWarningMessage(timeWarningLevel, sessionType, interviewConfig);
  const currentTimerClass = getTimerClass(timeWarningLevel, uiMode);
  const currentWarningMessageClass = getWarningMessageClass(timeWarningLevel);
  // Early returns using extracted components
  if (countdownVisible) {
    return <CountdownOverlay countdownValue={countdownValue} />;
  }

  if (showStillWorkingPrompt) {
    return (
      <StillWorkingPrompt 
        getTimerClass={() => currentTimerClass}
        handleClose={handleClose}
        handleStillWorking={handleStillWorking}
        handleStuck={handleStuck}
        handleMoveOn={handleMoveOn}
      />
    );
  }

  if (!open) return null;

  // Main timer render using extracted components
  return (
    <div className="timer-banner">
      <TimerHeader 
        sessionType={sessionType}
        isUnlimitedMode={isUnlimitedMode}
        getTimerClass={() => currentTimerClass}
        handleClose={handleClose}
      />

      <TimerContent 
        displayTime={displayTime}
        toggleTimer={toggleTimer}
        sessionType={sessionType}
        interviewConfig={interviewConfig}
        isUnlimitedMode={isUnlimitedMode}
        getWarningMessage={() => currentWarningMessage}
        getWarningMessageClass={() => currentWarningMessageClass}
      />

      <TimerControls 
        handleReset={handleReset}
        sessionType={sessionType}
        hasFirstPlan={hasFirstPlan}
        isTimerRunning={isTimerRunning}
        recordFirstPlan={recordFirstPlan}
        processedTags={processedTags}
        state={state}
        handleHintOpen={handleHintOpen}
        handleHintClose={handleHintClose}
        handleHintClick={handleHintClick}
        interviewConfig={interviewConfig}
        uiMode={uiMode}
        handleStop={handleStop}
        handleStart={handleStart}
        handleComplete={handleComplete}
      />
    </div>
  );
}

export default TimerBanner;
