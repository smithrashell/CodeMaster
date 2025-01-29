import { useLocation, useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import "../css/probrec.css";
const ProbGen = (props) => {
  const { state } = useLocation();
  const [problems, setProblems] = useState([]);
  const navigate = useNavigate();
  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: "getDailyReviewSchedule" },
      function (response) {
        console.log(response);
        if (response.schedule) {
          console.log(response.schedule);
          setProblems(response.schedule);
        }
      }
    );
  }, []);

  const handleLinkClick = (problem) => {
    window.location.href = problem.LeetCodeAddress || `https://leetcode.com/problems/${problem.slug}/description/`;
  };

  return (
    <div id="cd-mySidenav" className="cd-sidenav problink">
      <h1>Problem Generator</h1>
      {problems.length > 0 ? (
        <ul>
          {problems.map((problem) => (
            <li key={problem.id}>
              <a href="#" onClick={(e) => handleLinkClick(problem)}>
                {" "}
                {problem.ProblemDescription || problem.title}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>No problems found.</p>
      )}
    </div>
  );
};

export default ProbGen;
