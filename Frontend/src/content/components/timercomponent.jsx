import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaPause, FaPlay, FaArrowRight } from "react-icons/fa";
import { AiOutlineClear } from "react-icons/ai";
import { GrClose, GrPowerReset } from "react-icons/gr";
import TimeDisplay from "../components/TimeDisplay";
import "../css/timerBanner.css";

const TimerBanner = (props) => {
  const [problemTitle, setProblemTitle] = useState("");
  const [currentURL, setCurrentURL] = useState(window.location.href);
  const [timerRunning, setTimerRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [open, setOpen] = useState(true);
  const { pathname, state } = useLocation();
  const navigate = useNavigate();
  const intervalIdRef = useRef(null); // Use useRef to store interval ID
  const previousURLRef = useRef(currentURL);
  // useEffect(() => {
  //   return () => clearInterval(intervalIdRef.current); // Clean up on unmount
  // }, []);

  // useEffect(() => {
  //   // Check if the page is being reloaded
  //   if (performance.navigation.type === 1) {
  //     handleClose();
  //   }
  // }, []);

  const toggleTimer = () => {
    if (timerRunning) {
      handleStop();
    } else {
      handleStart();
    }
  };

  // useEffect(() => {
  //   const currentURL = window.location.href;
  //   if (
  //     pathname === "/Timer" &&
  //     (currentURL !== previousURLRef.current || !problemTitle)
  //   ) {
  //     navigate("/", { replace: true });
  //   }
  //   previousURLRef.current = currentURL;
  // }, [pathname, navigate, problemTitle, previousURLRef]);

  const handleStart = () => {
    setTimerRunning(true);
    intervalIdRef.current = setInterval(() => {
      setTime((prevTime) => prevTime + 1);
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
      console.log("time", time);
      problem["time"] = time;

      setOpen(false);
      navigate("/Probtime", { state: problem });
    }
  };

  const handleReset = () => {
    handleStop();
    setTime(0);
  };

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
