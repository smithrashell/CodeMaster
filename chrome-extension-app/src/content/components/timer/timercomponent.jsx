import React, { useState, useRef } from "react";
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

function TimerBanner(_props) {
  const [_problemTitle, _setProblemTitle] = useState("");
  const [_currentURL, _setCurrentURL] = useState(window.location.href);

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

  const { handleStillWorking, handleStuck, handleMoveOn, handleClose } = createTimerEventHandlers({
    setShowStillWorkingPrompt, setUserIntent, handleComplete, handleStop, navigate
  });

  const currentWarningMessage = getWarningMessage(timeWarningLevel, sessionType, interviewConfig);
  const currentTimerClass = getTimerClass(timeWarningLevel, uiMode);
  const currentWarningMessageClass = getWarningMessageClass(timeWarningLevel);

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
