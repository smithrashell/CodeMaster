/**
 * Timer Custom Hooks
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import logger from "../../../shared/utils/logger.js";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import AccurateTimer from "../../../shared/utils/AccurateTimer";

// Custom hook for timer state management
export const useTimerState = () => {
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
export const useInterviewSignals = () => {
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
export const useTimerConfiguration = (state) => {
  const processedTags = useMemo(() => {
    return state?.Tags ? state.Tags.map((tag) => tag.toLowerCase().trim()) : [];
  }, [state?.Tags]);

  const memoizedInterviewConfig = useMemo(() => {
    return state?.interviewConfig || null;
  }, [state?.interviewConfig]);

  const memoizedSessionType = useMemo(() => {
    return state?.sessionType || null;
  }, [state?.sessionType]);

  const uiMode = useMemo(() => {
    if (!memoizedInterviewConfig || memoizedSessionType === 'standard') {
      return 'full-support';
    }
    return memoizedInterviewConfig.uiMode || 'full-support';
  }, [memoizedInterviewConfig, memoizedSessionType]);

  const calculateInterviewTimeLimit = useCallback((standardLimitInMinutes, problemDifficulty) => {
    if (!memoizedInterviewConfig?.timing || memoizedSessionType === 'standard') {
      return standardLimitInMinutes * 60;
    }

    if (memoizedInterviewConfig.timing.thresholds && problemDifficulty) {
      const thresholdInMs = memoizedInterviewConfig.timing.thresholds[problemDifficulty];
      if (thresholdInMs) {
        return Math.floor(thresholdInMs / 1000);
      }
    }

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
export const useInterviewFeatures = (sessionType, timerRef, interviewSignalsState) => {
  const { setInterviewSignals, hasFirstPlan, setHasFirstPlan, hasFirstKeystroke, setHasFirstKeystroke } = interviewSignalsState;

  const recordFirstPlan = useCallback(() => {
    if (!hasFirstPlan && timerRef.current?.isRunning) {
      const timeToFirstPlan = timerRef.current.getElapsedTime() * 1000;
      setHasFirstPlan(true);
      setInterviewSignals(prev => ({
        ...prev,
        timeToFirstPlanMs: timeToFirstPlan
      }));
      logger.info("First plan recorded:", timeToFirstPlan + "ms");
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
      logger.info("First keystroke recorded:", timeToFirstKeystroke + "ms");
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
      logger.info("Hint used in interview mode at:", currentTime + "ms");
    }
  }, [sessionType, setInterviewSignals, timerRef]);

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

  const limitInMinutes = response.limits.Time;
  const standardLimitInSeconds = AccurateTimer.minutesToSeconds(limitInMinutes);
  const problemDifficulty = state?.Difficulty;
  const adjustedLimitInSeconds = calculateInterviewTimeLimit(limitInMinutes, problemDifficulty);

  const adaptiveLimits = response.limits.adaptiveLimits;
  const isStandardUnlimited = adaptiveLimits?.isUnlimited || limitInMinutes >= 999;
  const isInterviewMode = sessionType && sessionType !== 'standard';
  const unlimited = !isInterviewMode && isStandardUnlimited;

  setIsUnlimitedMode(unlimited);

  timerRef.current = new AccurateTimer(0);
  setDisplayTime(0);

  timerRef.current.recommendedLimit = isInterviewMode ? adjustedLimitInSeconds : standardLimitInSeconds;
  timerRef.current.isUnlimited = unlimited;
  timerRef.current.isInterviewMode = isInterviewMode;
  timerRef.current.interviewConfig = interviewConfig;
};

// Initialize timer with default limits when query fails
const initializeTimerWithDefaults = (options) => {
  const defaultResponse = {
    limits: {
      standard: 30,
      adaptiveLimits: {
        isUnlimited: false,
        limitInMinutes: 30
      }
    }
  };

  initializeTimerWithLimits(defaultResponse, options);
};

// Custom hook for timer setup and initialization
export const useTimerSetup = (options) => {
  const { state, sessionType, interviewConfig, calculateInterviewTimeLimit, setDisplayTime, setIsUnlimitedMode } = options;
  const timerRef = useRef(null);
  const intervalIdRef = useRef(null);

  useChromeMessage(
    state?.LeetCodeID
      ? {
          type: "getLimits",
          id: state.LeetCodeID,
        }
      : null,
    [state?.LeetCodeID],
    {
      onSuccess: (response) => {
        initializeTimerWithLimits(response, {
          state,
          sessionType,
          interviewConfig,
          calculateInterviewTimeLimit,
          timerRef,
          setDisplayTime,
          setIsUnlimitedMode
        });
      },
      onError: (_error) => {
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
    }
  );

  useEffect(() => {
    if (!state?.LeetCodeID && !timerRef.current) {
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
  }, [state, sessionType, interviewConfig, calculateInterviewTimeLimit, setDisplayTime, setIsUnlimitedMode]);

  return { timerRef, intervalIdRef };
};

// Custom hook for timer UI utilities and callbacks
export const useTimerUIHelpers = (timerRef, handleStart, handleStop) => {
  const handleHintOpen = useCallback((_data) => {
    // Track popover open event for analytics
  }, []);

  const handleHintClose = useCallback((_data) => {
    // Track popover close event for analytics
  }, []);

  const toggleTimer = useCallback(() => {
    if (!timerRef.current) return;

    if (timerRef.current.isRunning) {
      handleStop();
    } else {
      handleStart();
    }
  }, [timerRef, handleStart, handleStop]);

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
