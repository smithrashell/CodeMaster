import React, { useState, useCallback } from "react";
import "../../css/probrec.css";
import Header from "../../components/navigation/header";
import { v4 as uuidv4 } from "uuid";
import ProblemInfoIcon from "../../components/problem/ProblemInfoIcon";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import { useNav } from "../../../shared/provider/navprovider";

// Convert cryptic reasoning text to human-readable explanations
const getHumanReadableReason = (shortText) => {
  if (!shortText) return "Selected for your learning progression";
  
  // Handle common patterns
  if (shortText.toLowerCase().includes("new") && shortText.toLowerCase().includes("easy")) {
    return "This introduces fundamental problem-solving patterns with Easy difficulty";
  }
  if (shortText.toLowerCase().includes("new") && shortText.toLowerCase().includes("medium")) {
    return "This builds on your foundation with Medium-level challenges";
  }
  if (shortText.toLowerCase().includes("new") && shortText.toLowerCase().includes("hard")) {
    return "This advances your skills with Hard-level problem complexity";
  }
  if (shortText.toLowerCase().includes("review")) {
    return "This reinforces previously learned concepts based on spaced repetition";
  }
  if (shortText.toLowerCase().includes("weakness")) {
    return "This targets an area where you can improve your performance";
  }
  if (shortText.toLowerCase().includes("mastery")) {
    return "This helps solidify your understanding of key patterns";
  }
  
  // Fallback for unrecognized patterns
  return `Selected because: ${shortText}`;
};

// Problem Item Component with expandable reason text
const ProblemItemWithReason = ({ problem, isNewProblem, onLinkClick }) => {
  const [hovered, setHovered] = useState(false);
  const [similarProblems, setSimilarProblems] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [similarProblemsCache, setSimilarProblemsCache] = useState(null);

  // Debounced similar problems fetching
  const fetchSimilarProblems = useCallback(
    (problemId) => {
      if (!problemId || similarProblemsCache || loadingSimilar) return;

      setLoadingSimilar(true);
      try {
        chrome.runtime.sendMessage({
          type: 'getSimilarProblems',
          problemId: problemId,
          limit: 3
        }, (response) => {
          if (response?.similarProblems) {
            setSimilarProblems(response.similarProblems);
            setSimilarProblemsCache(response.similarProblems);
          }
          setLoadingSimilar(false);
        });
      } catch (error) {
        console.error('Error fetching similar problems:', error);
        setLoadingSimilar(false);
      }
    },
    [similarProblemsCache, loadingSimilar]
  );

  // Handle hover with debouncing
  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    
    // Fetch similar problems if we have a problem ID and haven't cached them yet
    if (problem?.id && !similarProblemsCache && !loadingSimilar) {
      // Small delay to avoid fetching on quick hovers
      const timeoutId = setTimeout(() => {
        fetchSimilarProblems(problem.id);
      }, 200);
      
      // Store timeout ID for potential cleanup
      return () => clearTimeout(timeoutId);
    }
  }, [problem?.id, similarProblemsCache, loadingSimilar, fetchSimilarProblems]);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
  }, []);

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
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
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

      {/* Expandable content - reason text and similar problems */}
      {problem.selectionReason && (
        <div
          style={{
            maxHeight: hovered ? "120px" : "0px",
            opacity: hovered ? 1 : 0,
            overflow: "hidden",
            transition: "all 0.3s ease",
          }}
        >
          {/* Existing reason text */}
          <div
            style={{
              maxWidth: "240px",
              margin: 0,
              fontSize: "0.75rem",
              color: "var(--cm-text, #ffffff)",
              lineHeight: 1.4,
              wordWrap: "break-word",
              overflowWrap: "anywhere",
              padding: "4px 0",
              borderBottom: (similarProblems.length > 0 || loadingSimilar) ? "1px solid rgba(255, 255, 255, 0.1)" : "none",
              marginBottom: (similarProblems.length > 0 || loadingSimilar) ? "6px" : "0",
              textAlign: "left",
            }}
          >
            <strong>🎯 Selected because:</strong> {getHumanReadableReason(problem.selectionReason.shortText)}
          </div>

          {/* Similar Problems Section */}
          {(similarProblems.length > 0 || loadingSimilar) && (
            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--cm-text, #ffffff)",
                opacity: 0.9,
                padding: "2px 0",
              }}
            >
              <div style={{ textAlign: "left" ,fontWeight: "bold", marginBottom: "2px", fontSize: "0.7rem" }}>
                🔗 Similar Problems:
              </div>
              
              {loadingSimilar && (
                <div style={{ fontSize: "0.7rem", color: "rgba(7, 7, 7, 0.6)", fontStyle: "italic" }}>
                  Finding similar problems...
                </div>
              )}

              {similarProblems.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", textAlign: "left" }}>
                  {similarProblems.slice(0, 2).map((similar, index) => (
                    <div
                      key={similar.id || index}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.65rem",
                        padding: "1px 0",
                      }}
                    >
                  
                      <span style={{ 
                        flex: 1, 
                        textAlign: "left",
                        lineHeight: "1.2",
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}>
                        {(similar.title || similar.problemDescription || '').substring(0, 30)}
                        {(similar.title || similar.problemDescription || '').length > 30 ? '...' : ''}
                      </span>
                      {similar.difficulty && (
                        <span
                          style={{
                            fontSize: "0.55rem",
                            padding: "2px 4px",
                            borderRadius: "3px",
                            backgroundColor: similar.difficulty === 'Easy' ? '#10b981' : 
                                           similar.difficulty === 'Hard' ? '#ef4444' : '#f59e0b',
                            color: 'white',
                            fontWeight: 'bold',
                            flexShrink: 0,
                          }}
                        >
                          {similar.difficulty.substring(0, 1)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!loadingSimilar && similarProblems.length === 0 && hovered && (
                <div style={{ fontSize: "0.6rem", color: "rgba(255, 255, 255, 0.6)", fontStyle: "italic" }}>
                  🌱 No patterns discovered yet<br/>
                  Complete more problems to build connections!
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
const ProbGen = () => {
  const { setIsAppOpen } = useNav();
  const [problems, setProblems] = useState([]);
  const [_announcement, _setAnnouncement] = useState("");

  const handleClose = () => {
    setIsAppOpen(false);
  };

  // New approach using custom hook
  useChromeMessage({ type: "getCurrentSession" }, [], {
    onSuccess: (response) => {
      
      if (response.session) {
        // Validate session object structure
        if (response.session.problems && Array.isArray(response.session.problems)) {
          setProblems(response.session.problems);
        } else {
          setProblems([]);
        }
      } else {
        // Trigger session creation as fallback
        chrome.runtime.sendMessage({ type: 'createOrResumeSession' }, (createResponse) => {
          if (createResponse?.session?.problems) {
            setProblems(createResponse.session.problems);
          } else {
            setProblems([]);
          }
        });
      }
    },
    onError: (error) => {
      console.error('❌ ProblemGenerator session fetch error:', error);
      setProblems([]);
    }
  });

  const handleLinkClick = (problem) => {
    window.location.href =
      problem.LeetCodeAddress ||
      `https://leetcode.com/problems/${problem.slug}/description/`;
  };

  return (
    <div id="cm-mySidenav" className="cm-sidenav problink">
      <Header title="Generator" onClose={handleClose} />
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
      </div>
    </div>
  );
};

export default ProbGen;
