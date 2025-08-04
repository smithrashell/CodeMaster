import { useLocation, useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import "../../css/probrec.css";
import Header from "../../../shared/components/header";
import { v4 as uuidv4 } from "uuid";
import ProblemInfoIcon from "../../../shared/components/ui/ProblemInfoIcon";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";

// Problem Item Component with expandable reason text
const ProblemItemWithReason = ({ problem, isNewProblem, onLinkClick }) => {
  const [hovered, setHovered] = useState(false);
  
  return (
    <div className="cd-simple-problem-item-container">
      <div className="cd-simple-problem-item">
        <a 
          href="#" 
          onClick={(e) => {
            e.preventDefault();
            onLinkClick(problem);
          }}
          className="cd-simple-problem-link"
        >
          {problem.problemDescription || problem.title}
        </a>
        <div className="cd-problem-badges">
          {/* Show problem selection reasoning if available - FIRST in badges */}
          {problem.selectionReason && (
            <div
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              className="cd-problem-info-icon"
            >
              <ProblemInfoIcon />
            </div>
          )}
          {isNewProblem && (
            <span className="cd-new-tag">NEW</span>
          )}
          <span className={`cd-difficulty cd-difficulty-${(problem.difficulty || 'medium').toLowerCase()}`}>
            {problem.difficulty || 'Medium'}
          </span>
        </div>
      </div>
      
      {/* Expandable reason text - matches AdaptiveSessionToggle pattern */}
      {problem.selectionReason && (
        <div
          style={{
            maxHeight: hovered ? "60px" : "0px",
            opacity: hovered ? 1 : 0,
            overflow: "hidden",
            transition: "all 0.3s ease",
          }}
        >
          <p
            style={{
              maxWidth: "200px",
              margin: 0,
              fontSize: "0.75rem",
              color: "var(--cd-text, #ffffff)",
              lineHeight: 1.4,
              wordWrap: "break-word",
              overflowWrap: "anywhere",
              padding: "4px 0",
            }}
          >
            {problem.selectionReason.shortText}
          </p>
        </div>
      )}
    </div>
  );
};
const ProbGen = (props) => {
  const { state } = useLocation();
  const [problems, setProblems] = useState([]);

  const navigate = useNavigate();
  
  // New approach using custom hook
  const { data: sessionData, loading, error } = useChromeMessage(
    { type: "getCurrentSession" },
    [],
    {
      onSuccess: (response) => {
        console.log(response);
        if (response.session) {
          console.log(response.session);
          setProblems(response.session);
        }
      }
    }
  );
  

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
              <ProblemItemWithReason 
                key={uuidv4()}
                problem={problem}
                isNewProblem={isNewProblem}
                onLinkClick={handleLinkClick}
              />
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
