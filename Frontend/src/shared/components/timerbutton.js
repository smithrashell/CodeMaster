import  { useState} from "react";

const TimerButton = () => {
  const [time, _setTime] = useState(0);
  const [content, _setContent] = useState("");
  const [timerRunning, setTimerRunning] = useState(false);
  const [limit, _setLimit] = useState(0);
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;

  let min = `${minutes.toString().padStart(2, "0")}m`;
  let sec = `${seconds.toString().padStart(2, "0")}s`;

  const handleTimerClick = () => {};

  const handleReset = () => {};

  const handleSubmit = () => {
    setTimerRunning(false);
    chrome.storage.local.set({ time: time }, () => {
      console.log("**limit saved to Chrome storage.", time);
    });
    // Send a message directly to the background script
    chrome.runtime.sendMessage({
      type: "navigate",
      navigate: true,
      route: "/Probtime",
      content: content,
      time: Math.floor(time * 60),
    });
  };

  return (
    <div className="btn">
      <button style={{ backgroundColor: "#000" }} onClick={handleReset}>
        Reset
      </button>
      <button
        onClick={handleTimerClick}
        style={{ color: timerRunning ? "green" : "red" }}
      >
        {min}:{sec}
      </button>
      <button style={{ backgroundColor: "#000" }} onClick={handleSubmit}>
        Submit
      </button>
    </div>
  );
};

const InjectedButton = () => {
  console.log("InjectedButton is rendering");
  return <TimerButton />;
};

export default InjectedButton;
