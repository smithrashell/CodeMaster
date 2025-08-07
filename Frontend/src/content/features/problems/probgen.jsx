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
    <div className="cd-simple-problem-item-container">
      <div className="cd-simple-problem-item">
        <button
          type="button"
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
          className="cd-simple-problem-link"
          aria-label={`Navigate to ${problem.problemDescription || problem.title} problem. Difficulty: ${problem.difficulty || 'Medium'}${isNewProblem ? '. This is a new problem.' : ''}`}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: 'inherit', 
            textAlign: 'left',
            padding: 0,
            font: 'inherit',
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'block',
            width: '100%'
          }}
        >
          {problem.problemDescription || problem.title}
        </button>
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
          {isNewProblem && <span className="cd-new-tag">NEW</span>}
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
    <div id="cd-mySidenav" className="cd-sidenav problink" role="dialog" aria-labelledby="main-heading" aria-modal="true">
      <div 
        role="status" 
        aria-live="assertive" 
        aria-atomic="true"
        className="sr-only"
        style={{ 
          position: 'absolute', 
          left: '-10000px', 
          width: '1px', 
          height: '1px', 
          overflow: 'hidden' 
        }}
      >
        {announcement}
      </div>
      <Header title="Generator" />
      <main className="cd-sidenav__content" id="main-content" role="main">
        <div 
          role="region" 
          aria-label="Navigation instructions"
          className="cd-navigation-help sr-only"
          style={{ 
            position: 'absolute',
            left: '-10000px',
            width: '1px',
            height: '1px',
            overflow: 'hidden'
          }}
        >
          Use arrow keys to navigate, Enter to select, Escape to close
        </div>
        {problems.length > 0 ? (
          <div className="cd-simple-problems-list" role="list" aria-label={`Available problems for practice. ${problems.length} problems total. Use arrow keys to navigate.`}>
            {problems.map((problem, index) => {
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
