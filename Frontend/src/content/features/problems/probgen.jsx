import { useLocation, useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import "../../css/probrec.css";
import Header from "../../../shared/components/header";
import { v4 as uuidv4 } from "uuid";
const ProbGen = (props) => {
  const { state } = useLocation();
  const [problems, setProblems] = useState([]);

  const navigate = useNavigate();
  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: "getCurrentSession" },
      function (response) {
        console.log(response);
        if (response.session) {
          console.log(response.session);
          setProblems(response.session);
        }
      }
    );
  }, []);

  const handleLinkClick = (problem) => {
    window.location.href =
      problem.LeetCodeAddress ||
      `https://leetcode.com/problems/${problem.slug}/description/`;
  };

  return (
    <div id="cd-mySidenav" className="cd-sidenav problink">
    <Header title="Generator"/>
    <div className="cd-sidenav__content "
      >
      {problems.length > 0 ? (
        <div className="cd-simple-problems-list">
          {problems.map((problem) => {
            const isNewProblem = !problem.attempts || problem.attempts.length === 0;
            
            return (
              <div key={uuidv4()} className="cd-simple-problem-item">
                <a 
                  href="#" 
                  onClick={(e) => {
                    e.preventDefault();
                    handleLinkClick(problem);
                  }}
                  className="cd-simple-problem-link"
                >
                  {problem.problemDescription || problem.title}
                </a>
                <div className="cd-problem-badges">
                  {isNewProblem && (
                    <span className="cd-new-tag">NEW</span>
                  )}
                  <span className={`cd-difficulty cd-difficulty-${(problem.difficulty || 'medium').toLowerCase()}`}>
                    {problem.difficulty || 'Medium'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p>No problems found.</p>
      )}
      </div>
    </div>
  );
};

export default ProbGen;
