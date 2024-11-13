import React, { useState, useEffect, useContext, createContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../css/timer.css";


const TimeDisplay = ({ time, toggleTimer }) => {
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;

  const min = minutes.toString().padStart(2, "0");
  const sec = seconds.toString().padStart(2, "0");

  return (
    <div
      className="dail"
      style={{
        color: "red",
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        padding: "5px",
        cursor: "pointer" // Make it clear that this is clickable
      }}
      onClick={toggleTimer}
    >
      <span>{min}</span>
      <p>min</p>
      <span>{sec}</span>
      <p>sec</p>
    </div>
  );
};

export default TimeDisplay;
