import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaPause, FaPlay, FaArrowRight } from "react-icons/fa";
import { AiOutlineClear } from "react-icons/ai";
import { GrClose, GrPowerReset } from "react-icons/gr";
import TimeDisplay from "../../shared/components/timedisplay";
import { FloatingHintButton } from "./strategy";
import "./css/timerBanner.css";

const TimerBanner = (props) => {
  const [problemTitle, setProblemTitle] = useState("");
  const [currentURL, setCurrentURL] = useState(window.location.href);
  const [timerRunning, setTimerRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [open, setOpen] = useState(true);
  const [limit, setLimit] = useState(0);
  const { pathname, state } = useLocation();
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [countdownValue, setCountdownValue] = useState(null);

  const navigate = useNavigate();

  const intervalIdRef = useRef(null); // Use useRef to store interval ID
  const previousURLRef = useRef(currentURL);

  const toggleTimer = () => {
    if (timerRunning) {
      handleStop();
    } else {
      handleStart();
    }
  };

  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: "getLimits", id: state.LeetCodeID },
      function (response) {
        console.log("✅limits being sent to content script", response);

        let limit = response.limits.Time;
        setLimit(limit * 60);
        setTime(limit * 60);
      }
    );
  }, [setLimit, setTime]);

  const handleStart = () => {
    setTimerRunning(true);

    intervalIdRef.current = setInterval(() => {
      setTime((prevTime) => {
        if (prevTime <= 0) {
          handleStop();
          return 0;
        }
        // Trigger countdown at last 3 seconds
        if (prevTime === 4) {
          startCountdown();
        }
        return prevTime - 1;
      });
    }, 1000);
  };

  const startCountdown = () => {
    setCountdownVisible(true);
    setCountdownValue(3);

    setTimeout(() => {
      setCountdownValue(2);
      setTimeout(() => {
        setCountdownValue(1);
        setTimeout(() => {
          setCountdownValue("Time's Up!");
          setTimeout(() => {
            setCountdownVisible(false);
            handleComplete(); // Navigate after countdown
          }, 1000);
        }, 1000);
      }, 1000);
    }, 1000);
  };

  const handleStop = () => {
    setTimerRunning(false);
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null; // Clear the interval ID
    }
  };

  const handleClose = () => {
    handleStop();
    navigate("/");
  };

  const handleComplete = () => {
    handleStop();
    if (state !== null) {
      console.log("why");
      let problem = state;
      console.log("state timercomponent", problem);
      console.log("time", time, time / (1000 * 60));
      problem["Time"] =
        limit / 60 - Math.round(time / 60) < 1
          ? 1
          : limit / 60 - Math.round(time / 60);
      console.log("problem.time", problem.time);
      setOpen(false);
      navigate("/Probtime", { state: problem });
    }
  };

  const handleReset = () => {
    handleStop();
    setTime(limit);
  };
  if (countdownVisible) {
    return (
      <div className="countdown-overlay">
        <h1>{countdownValue}</h1>
      </div>
    );
  }

  if (!open) return null;

  return (
    <div className="timer-banner">
      <div className="timer-banner-header">
        <h1>Timer</h1>
        <GrClose onClick={handleClose} className="close-icon" />
      </div>

      <div className="timer-banner-content">
        <TimeDisplay time={time} toggleTimer={toggleTimer} />
      </div>

      <div className="timer-banner-controls">
        <GrPowerReset style={{ color: "black" }} onClick={handleReset} />
        <AiOutlineClear style={{ color: "black" }} />
        {/* Add hint button as part of timer controls */}
        {state?.Tags && state.Tags.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <FloatingHintButton 
              problemTags={state.Tags.map(tag => tag.toLowerCase().trim())}
              onOpen={(data) => {
                console.log('🔍 Strategy hints popover opened:', data);
                // Track popover open event for analytics
              }}
              onClose={(data) => {
                console.log('❌ Strategy hints popover closed:', data);
                // Track popover close event for analytics
              }}
            />
          </div>
        )}
        {timerRunning ? (
          <FaPause style={{ color: "black" }} onClick={handleStop} />
        ) : (
          <FaPlay style={{ color: "black" }} onClick={handleStart} />
        )}
        <FaArrowRight style={{ color: "black" }} onClick={handleComplete} />
      </div>
    </div>
  );
};

export default TimerBanner;
