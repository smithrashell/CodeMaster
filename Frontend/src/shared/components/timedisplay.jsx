


import "./css/timer.css";

const TimeDisplay = ({ time, toggleTimer }) => {
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;

  const min = minutes.toString().padStart(2, "0");
  const sec = seconds.toString().padStart(2, "0");

  return (
    <div
      className="dail"
      style={{
        color: "var(--cm-timer-text, #000000)",
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        padding: "5px",
        cursor: "pointer", // Make it clear that this is clickable
      }}
      onClick={toggleTimer}
      title="Click to start/pause timer"
      aria-label="Click to start or pause timer"
    >
      <span>{min}</span>
      <p>min</p>
      <span>{sec}</span>
      <p>sec</p>
    </div>
  );
};

export default TimeDisplay;
