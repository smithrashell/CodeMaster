import React, { useState, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../../../shared/components/css/timerBanner.css";

import {
  CountdownOverlay,
  StillWorkingPrompt,
  TimerHeader,
  TimerContent,
  TimerControls
} from "./TimerComponents.jsx";

import {
  useTimerState,
  useInterviewSignals,
  useTimerConfiguration,
  useInterviewFeatures,
  useTimerSetup,
  useTimerUIHelpers
} from "./TimerHooks.js";

import { useTimerOperations } from "./TimerOperations.js";

import {
  createTimerEventHandlers,
  getWarningMessage,
  getTimerClass,
  getWarningMessageClass
} from "./TimerHelpers.js";

// Extra time to add when user clicks "I'm Stuck" (in seconds)
const STUCK_TIME_EXTENSION = 5 * 60; // 5 minutes

function TimerBanner(_props) {
  const [_problemTitle, _setProblemTitle] = useState("");
  const [_currentURL, _setCurrentURL] = useState(window.location.href);
  const [forceHintsOpen, setForceHintsOpen] = useState(false);

  const timerState = useTimerState();
  const {
    open, setOpen, countdownVisible, countdownValue, displayTime, setDisplayTime,
    timeWarningLevel, showStillWorkingPrompt, setShowStillWorkingPrompt,
    setUserIntent, isUnlimitedMode, setIsUnlimitedMode, isTimerRunning
  } = timerState;

  const interviewSignalsState = useInterviewSignals();
  const { interviewSignals, hasFirstPlan } = interviewSignalsState;

  const { pathname: _pathname, state } = useLocation();
  const navigate = useNavigate();

  const { processedTags, interviewConfig, sessionType, uiMode, calculateInterviewTimeLimit } = useTimerConfiguration(state);

  const { timerRef, intervalIdRef } = useTimerSetup({
    state, sessionType, interviewConfig, calculateInterviewTimeLimit, setDisplayTime, setIsUnlimitedMode
  });

  const _previousURLRef = useRef(_currentURL);

  const { recordFirstPlan, handleHintClick } = useInterviewFeatures(sessionType, timerRef, interviewSignalsState);

  const enhancedTimerState = { ...timerState, interviewSignals, setOpen };

  const { handleStart, handleStop, handleReset, handleComplete } = useTimerOperations(
    timerRef, intervalIdRef, enhancedTimerState, { sessionType, navigate, state }
  );

  const { handleHintOpen, handleHintClose, toggleTimer } = useTimerUIHelpers(timerRef, handleStart, handleStop);

  const { handleStillWorking, handleStuck: baseHandleStuck, handleMoveOn, handleClose } = createTimerEventHandlers({
    setShowStillWorkingPrompt, setUserIntent, handleComplete, handleStop, navigate
  });

  // Enhanced handleStuck: extends timer and opens hints
  const handleStuck = useCallback(() => {
    // 1. Extend the timer by adding extra time to the recommended limit
    if (timerRef.current && timerRef.current.recommendedLimit) {
      timerRef.current.recommendedLimit += STUCK_TIME_EXTENSION;
    }

    // 2. Open hints panel
    setForceHintsOpen(true);
    // Reset after a short delay so it can be triggered again if needed
    setTimeout(() => setForceHintsOpen(false), 100);

    // 3. Call base handler (hides prompt, sets userIntent to "stuck")
    baseHandleStuck();
  }, [baseHandleStuck, timerRef]);

  const currentWarningMessage = getWarningMessage(timeWarningLevel, sessionType, interviewConfig);
  const currentTimerClass = getTimerClass(timeWarningLevel, uiMode);
  const currentWarningMessageClass = getWarningMessageClass(timeWarningLevel);

  if (countdownVisible) {
    return <CountdownOverlay countdownValue={countdownValue} />;
  }

  if (!open) return null;

  return (
    <>
      {showStillWorkingPrompt && (
        <StillWorkingPrompt
          getTimerClass={() => currentTimerClass}
          handleClose={handleStillWorking}
          handleStillWorking={handleStillWorking}
          handleStuck={handleStuck}
          handleMoveOn={handleMoveOn}
        />
      )}
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
        forceHintsOpen={forceHintsOpen}
      />
    </div>
    </>
  );
}

export default TimerBanner;
