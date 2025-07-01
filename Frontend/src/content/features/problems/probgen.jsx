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
        <ul>
          {problems.map((problem) => (
            <li key={uuidv4()}>
              <a href="#" onClick={(e) => handleLinkClick(problem)}>
                {" "}
                {problem.problemDescription || problem.title}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>No problems found.</p>
      )}
      </div>
    </div>
  );
};

export default ProbGen;
