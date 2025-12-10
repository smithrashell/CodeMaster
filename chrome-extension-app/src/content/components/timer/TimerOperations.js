/**
 * Timer Operations Hook
 */

import { useCallback } from "react";
import logger from "../../../shared/utils/logging/logger.js";
import { createStopTimerFunction, buildProblemData, getTimeWarningThresholds } from "./TimerHelpers.js";

// Custom hook for timer operations
export const useTimerOperations = (timerRef, intervalIdRef, timerState, { sessionType, navigate, state }) => {
  const {
    setIsTimerRunning, setDisplayTime, setTimeWarningLevel,
    setExceededRecommendedTime, setShowStillWorkingPrompt,
    setCountdownVisible, setCountdownValue, setUserIntent, setOpen,
    isUnlimitedMode, timeWarningLevel, interviewSignals
  } = timerState;

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

  const handleComplete = useCallback(() => {
    const stopTimer = createStopTimerFunction(timerRef, setIsTimerRunning, intervalIdRef);
    stopTimer();

    if (state !== null && timerRef.current) {
      const problem = buildProblemData(state, timerRef, timerState, sessionType, interviewSignals);
      setOpen(false);
      navigate("/Probtime", { state: problem });
    }
  }, [state, timerRef, interviewSignals, sessionType, navigate, setOpen, timerState, setIsTimerRunning, intervalIdRef]);

  const handleStart = useCallback(() => {
    if (!timerRef.current) {
      logger.error("Timer not initialized");
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
