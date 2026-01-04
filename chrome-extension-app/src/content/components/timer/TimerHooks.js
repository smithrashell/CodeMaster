/**
 * Timer Custom Hooks
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import logger from "../../../shared/utils/logging/logger.js";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import AccurateTimer from "../../../shared/utils/timing/AccurateTimer";

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
  // State for interview mode loaded from storage (fallback when route state is missing)
  const [storedInterviewMode, setStoredInterviewMode] = useState(null);

  // Load interview mode from storage if not in route state
  // This handles navigation via window.location.href which doesn't preserve React Router state
  useEffect(() => {
    // Initial load from storage
    if (!state?.sessionType && !state?.interviewConfig) {
      chrome.storage.local.get(['currentInterviewMode'], (result) => {
        if (result.currentInterviewMode && result.currentInterviewMode.sessionType) {
          logger.info('Loaded interview mode from storage:', result.currentInterviewMode);
          setStoredInterviewMode(result.currentInterviewMode);
        } else {
          // Fallback: fetch active session from background script if storage is empty
          logger.info('Storage empty, fetching active session from background');
          if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ type: 'getActiveSession' }, (response) => {
              if (response?.session) {
                const sessionInfo = {
                  sessionType: response.session.session_type || 'standard',
                  interviewConfig: response.session.interviewConfig || null
                };
                logger.info('Loaded interview mode from active session:', sessionInfo);
                setStoredInterviewMode(sessionInfo);
                // Also update storage for future consistency
                chrome.storage.local.set({ currentInterviewMode: sessionInfo });
              }
            });
          }
        }
      });
    }

    // Listen for storage changes to sync across tabs
    const handleStorageChange = (changes, areaName) => {
      if (areaName === 'local' && changes.currentInterviewMode) {
        logger.info('Interview mode changed in storage:', changes.currentInterviewMode.newValue);
        setStoredInterviewMode(changes.currentInterviewMode.newValue);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, [state?.sessionType, state?.interviewConfig]);

  const processedTags = useMemo(() => {
    return state?.Tags ? state.Tags.map((tag) => tag.toLowerCase().trim()) : [];
  }, [state?.Tags]);

  const memoizedInterviewConfig = useMemo(() => {
    // Prefer route state, fall back to storage
    return state?.interviewConfig || storedInterviewMode?.interviewConfig || null;
  }, [state?.interviewConfig, storedInterviewMode?.interviewConfig]);

  const memoizedSessionType = useMemo(() => {
    // Prefer route state, fall back to storage
    return state?.sessionType || storedInterviewMode?.sessionType || null;
  }, [state?.sessionType, storedInterviewMode?.sessionType]);

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

  // Use a version counter to force refetch when settings change
  const [settingsVersion, setSettingsVersion] = useState(0);

  const { refetch } = useChromeMessage(
    state?.LeetCodeID
      ? {
          type: "getLimits",
          id: state.LeetCodeID,
        }
      : null,
    [state?.LeetCodeID, settingsVersion], // Add settingsVersion to deps to allow forced refetch
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

  // Listen for Chrome storage changes to refresh limits when settings are updated
  // This fixes the issue where timer limits didn't update after changing settings
  useEffect(() => {
    const handleStorageChange = (changes, areaName) => {
      if (areaName === 'local' && changes.settings) {
        logger.info('Timer: Settings changed, refreshing limits');
        // Increment version to trigger useChromeMessage refetch
        setSettingsVersion(v => v + 1);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, []);

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

  return { timerRef, intervalIdRef, refetchLimits: refetch };
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
