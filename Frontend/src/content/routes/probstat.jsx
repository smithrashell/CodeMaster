import React, { useState, useEffect } from "react";

const ProbStat = () => {
  const [boxLevelData, setBoxLevelData] = useState({});

  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: "countProblemsByBoxLevel" },
      (response) => {
        if (response.status === "success") {
          setBoxLevelData(response.data);
        } else {
          console.error("Failed to get problem count by box level");
        }
      }
    );
  }, []);

  return (
    <div id="cd-mySidenav" className="cd-sidenav ">
      <h2>Problem Stats by Box Level</h2>
      {Object.entries(boxLevelData).map(([level, count]) => (
        <p key={level}>
          Box Level {level}: {count} problems
        </p>
      ))}
    </div>
  );
};

export default ProbStat;
