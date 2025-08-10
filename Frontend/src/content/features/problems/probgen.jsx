import React, { useState, useEffect, useRef } from "react";
import "../../css/probrec.css";
import Header from "../../components/navigation/header";
import { v4 as uuidv4 } from "uuid";
import ProblemInfoIcon from "../../components/problem/ProblemInfoIcon";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";

// Problem Item Component with expandable reason text
const ProblemItemWithReason = ({ problem, isNewProblem, onLinkClick }) => {
  const [hovered, setHovered] = useState(false);

  return (

    <div className="cm-simple-problem-item-container">
      <div className="cm-simple-problem-item">
        <a
          href="#"

          onClick={(e) => {
            onLinkClick(problem);
            e.target.blur(); // Remove focus after click to prevent outline
            // Force remove focus with timeout to ensure it's gone
            setTimeout(() => {
              if (e.target === document.activeElement) {
                e.target.blur();
              }
            }, 0);
          }}

          className="cm-simple-problem-link"
        >
          {problem.problemDescription || problem.title}
        </a>
        <div className="cm-problem-badges">

          {/* Show problem selection reasoning if available - FIRST in badges */}
          {problem.selectionReason && (
            <div
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              className="cm-problem-info-icon"
            >
              <ProblemInfoIcon className="cm-problem-info-icon" />
            </div>
          )}
          {isNewProblem && <span className="cm-new-tag">NEW</span>}
          <span
            className={`cd-difficulty cd-difficulty-${(
              problem.difficulty || "medium"
            ).toLowerCase()}`}
          >
            {problem.difficulty || "Medium"}
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
              color: "var(--cm-text, #ffffff)",
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
const ProbGen = () => {
  const [problems, setProblems] = useState([]);
  const [announcement, setAnnouncement] = useState('');

  // New approach using custom hook
  useChromeMessage({ type: "getCurrentSession" }, [], {
    onSuccess: (response) => {
      if (response.session) {
        setProblems(response.session);
      }
    },
  });

  const handleLinkClick = (problem) => {
    window.location.href =
      problem.LeetCodeAddress ||
      `https://leetcode.com/problems/${problem.slug}/description/`;
  };


  return (

    <div id="cm-mySidenav" className="cm-sidenav problink">
      <Header title="Generator" />
      <div className="cm-sidenav__content ">
        {problems.length > 0 ? (
          <div className="cm-simple-problems-list">
            {problems.map((problem) => {


              const isNewProblem =
                !problem.attempts || problem.attempts.length === 0;

              return (
                <div key={uuidv4()} role="listitem">
                  <ProblemItemWithReason
                    problem={problem}
                    isNewProblem={isNewProblem}
                    onLinkClick={handleLinkClick}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div role="status" aria-live="polite">
            <p>No problems found. Please generate a new session.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProbGen;
