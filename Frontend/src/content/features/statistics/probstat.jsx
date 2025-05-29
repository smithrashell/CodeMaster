import React, { useState, useEffect } from "react";
import Header from "../../../shared/components/header";
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
    <Header title="Statistics"/>
    <div className="cd-sidenav__content"
      >
      {Object.entries(boxLevelData).map(([level, count]) => (
        <p key={level}>
          Box Level {level}: {count} problems
        </p>
      ))}
    </div>
    </div>
  );
};

export default ProbStat;
