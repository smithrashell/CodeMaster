/**
 * Timer UI Components
 */

import React from "react";
import {
  HiPlay,
  HiPause,
  HiArrowRight,
  HiXMark,
  HiArrowPath
} from "react-icons/hi2";
import TimeDisplay from "../../../shared/components/timer/timedisplay";
import { FloatingHintButton } from "../strategy";

// Countdown overlay component
export const CountdownOverlay = ({ countdownValue }) => (
  <div className="countdown-overlay">
    <h1>{countdownValue}</h1>
  </div>
);

// Still working prompt component - Modal style popup
export const StillWorkingPrompt = ({ getTimerClass, handleClose, handleStillWorking, handleStuck, handleMoveOn }) => {
  const onButtonClick = (handler) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    handler();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  return (
    <div
      className="still-working-overlay"
      onClick={onButtonClick(handleClose)}
      onKeyDown={handleKeyDown}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="still-working-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="still-working-title"
      >
        <div className="still-working-header">
          <h2 id="still-working-title" className={getTimerClass()}>Time Check</h2>
          <HiXMark
            onClick={onButtonClick(handleClose)}
            className="close-icon"
            title="Close"
            aria-label="Close"
          />
        </div>

        <div className="still-working-content">
          <p>You&apos;ve exceeded the recommended time.</p>
          <p>How are you feeling about this problem?</p>
        </div>

        <div className="still-working-buttons">
          <button
            onClick={onButtonClick(handleStillWorking)}
            className="still-working-btn btn-progress"
          >
            Still Making Progress
          </button>
          <button
            onClick={onButtonClick(handleStuck)}
            className="still-working-btn btn-stuck"
          >
            I&apos;m Stuck
          </button>
          <button
            onClick={onButtonClick(handleMoveOn)}
            className="still-working-btn btn-move-on"
          >
            Move On
          </button>
        </div>
      </div>
    </div>
  );
};

// Timer header component
export const TimerHeader = ({ sessionType, isUnlimitedMode, getTimerClass, handleClose }) => (
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
export const TimerContent = ({ displayTime, toggleTimer, sessionType, interviewConfig, isUnlimitedMode, getWarningMessage, getWarningMessageClass }) => (
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
export const TimerControls = ({
  handleReset, sessionType, hasFirstPlan, isTimerRunning, recordFirstPlan,
  processedTags, state, handleHintOpen, handleHintClose, handleHintClick,
  interviewConfig, uiMode, handleStop, handleStart, handleComplete, forceHintsOpen
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
          forceOpen={forceHintsOpen}
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
