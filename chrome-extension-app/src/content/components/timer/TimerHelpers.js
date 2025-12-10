/**
 * Timer Helper Functions
 */

import AccurateTimer from "../../../shared/utils/timing/AccurateTimer";
import logger from "../../../shared/utils/logging/logger.js";

// Helper function to create stop timer functionality
export const createStopTimerFunction = (timerRef, setIsTimerRunning, intervalIdRef) => () => {
  if (!timerRef.current) return;
  timerRef.current.pause();
  setIsTimerRunning(false);
  if (intervalIdRef.current) {
    clearInterval(intervalIdRef.current);
    intervalIdRef.current = null;
  }
};

// Helper function to build problem data with timing information
export const buildProblemData = (state, timerRef, timerState, sessionType, interviewSignals) => {
  const { exceededRecommendedTime, userIntent, timeWarningLevel } = timerState;
  let problem = { ...state };

  const timeSpentInSeconds = timerRef.current.getElapsedTime();
  const timeSpentInMinutes = AccurateTimer.secondsToMinutes(timeSpentInSeconds, 1);
  const totalTimeInSeconds = timerRef.current.totalTimeInSeconds;
  const overageTime = Math.max(0, timeSpentInSeconds - totalTimeInSeconds);

  problem["Time"] = Math.max(1, Math.round(timeSpentInMinutes));
  problem["timeSpentInSeconds"] = timeSpentInSeconds;
  problem["exceededRecommendedTime"] = exceededRecommendedTime;
  problem["overageTime"] = overageTime;
  problem["userIntent"] = userIntent;
  problem["timeWarningLevel"] = timeWarningLevel;

  if (sessionType && sessionType !== 'standard') {
    const finalInterviewSignals = {
      ...interviewSignals,
      hintPressure: timeSpentInSeconds > 0 ? interviewSignals.hintsUsed / timeSpentInSeconds : 0,
      transferAccuracy: null,
      speedDelta: null,
    };

    problem["interviewSignals"] = finalInterviewSignals;
    logger.info("Interview signals captured:", finalInterviewSignals);
  }

  return problem;
};

// Helper function to get time warning thresholds
export const getTimeWarningThresholds = (isInterviewMode) => ({
  warnThreshold1: isInterviewMode ? 0.6 : 0.75,
  warnThreshold2: isInterviewMode ? 0.8 : 1.0,
  warnThreshold3: isInterviewMode ? 1.0 : 1.5
});

// Helper function to create event handlers for timer banner
export const createTimerEventHandlers = ({
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

// Helper function to get warning message based on warning level
export const getWarningMessage = (timeWarningLevel, sessionType, interviewConfig) => {
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
export const getTimerClass = (timeWarningLevel, uiMode) => {
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
export const getWarningMessageClass = (timeWarningLevel) => {
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
