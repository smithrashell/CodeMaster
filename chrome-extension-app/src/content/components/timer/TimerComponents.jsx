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

// Still working prompt component
export const StillWorkingPrompt = ({ getTimerClass, handleClose, handleStillWorking, handleStuck, handleMoveOn }) => (
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
