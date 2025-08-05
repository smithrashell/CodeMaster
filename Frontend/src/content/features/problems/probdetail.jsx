import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNav } from "../../../shared/provider/navprovider";
import Header from "../../components/navigation/header";
import {
  ChevronLeftIcon,
  BarChart3Icon,
  TrendingUpIcon,
  TagIcon,
  PlayIcon,
  BrainIcon,
} from "../../../shared/components/ui/Icons";
import Button from "../../../shared/components/ui/Button";
import Badge from "../../../shared/components/ui/Badge";
import Separator from "../../../shared/components/ui/Separator";
import StrategyService from "../../services/strategyService";
import WhyThisProblem from "../../components/problem/WhyThisProblem";

// Expandable Primer Component that matches the design
const ExpandablePrimerSection = ({ problemTags }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [primers, setPrimers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (problemTags && problemTags.length > 0) {
      loadPrimers();
    }
  }, [problemTags]);

  const loadPrimers = async () => {
    try {
      setLoading(true);
      console.log("Loading primers for tags:", problemTags);
      // Normalize tags to lowercase to match strategy data
      const normalizedTags = problemTags.map((tag) => tag.toLowerCase().trim());
      console.log("Normalized tags:", normalizedTags);
      const tagPrimers = await StrategyService.getTagPrimers(normalizedTags);
      console.log("Loaded primers:", tagPrimers);
      setPrimers(tagPrimers);
    } catch (err) {
      console.error("Error loading primers:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    // Track engagement for effectiveness measurement
    if (!isExpanded) {
      console.log("📊 Primer section opened for tags:", problemTags);
    }
  };

  return (
    <div className="problem-sidebar-section">
      <div
        className="problem-sidebar-section-header"
        onClick={handleToggle}
        style={{ cursor: "pointer", userSelect: "none" }}
      >
        <BrainIcon className="problem-sidebar-section-icon" />
        <span className="problem-sidebar-section-title">
          Problem Overview
          {primers.length > 0 && `(${primers.length})`}
        </span>
        <span style={{ marginLeft: "auto", fontSize: "12px" }}>
          {isExpanded ? "▼" : "▶"}
        </span>
      </div>

      {isExpanded && (
        <div
          className="problem-sidebar-primer-content"
          style={{
            marginTop: "8px",
            fontSize: "14px",
            lineHeight: "1.5",
            color: "rgba(255, 255, 255, 0.85)",
          }}
        >
          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "12px",
                fontSize: "14px",
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              Loading strategies...
            </div>
          ) : primers.length > 0 ? (
            primers.map((primer, index) => (
              <div
                key={index}
                style={{
                  marginBottom: "16px",
                  padding: "8px",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  borderRadius: "6px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                }}
              >
                <div
                  style={{
                    fontWeight: "600",
                    marginBottom: "6px",
                    color: "rgba(255, 255, 255, 0.95)",
                    textTransform: "capitalize",
                    fontSize: "15px",
                  }}
                >
                  {primer.tag}
                </div>
                {primer.strategy && (
                  <div
                    style={{
                      fontSize: "13px",
                      marginBottom: "6px",
                      lineHeight: "1.4",
                      color: "rgba(255, 255, 255, 0.8)",
                    }}
                  >
                    💡 {primer.strategy}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "12px",
                opacity: 0.7,
                fontSize: "14px",
                color: "rgba(255, 255, 255, 0.6)",
              }}
            >
              No strategy information available
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ProbDetail = (isLoading) => {
  const { state: routeState } = useLocation();
  const { setIsAppOpen } = useNav();
  const navigate = useNavigate();

  const [showSkip, setShowSkip] = useState(false);

  // Extract problem data from route state
  const problemData = {
    id: routeState?.problemData?.leetCodeID || routeState?.problemData?.id,
    leetCodeID:
      routeState?.problemData?.leetCodeID || routeState?.problemData?.id,
    title:
      routeState?.problemData?.ProblemDescription ||
      routeState?.problemData?.title,
    ProblemDescription:
      routeState?.problemData?.ProblemDescription ||
      routeState?.problemData?.title,
    tags: routeState?.problemData?.tags || [],
    difficulty: routeState?.problemData?.difficulty || "Unknown",
    acceptance: routeState?.problemData?.acceptance || "N/A",
    submissions: routeState?.problemData?.submissions || "N/A",
    attempts: routeState?.problemData?.attempts || 0,
    lastSolved: routeState?.problemData?.lastSolved || "Never",
  };

  useEffect(() => {
    setShowSkip(!routeState?.problemFound);
  }, [routeState?.problemFound]);

  const handleClose = () => {
    setIsAppOpen(false);
  };

  const handleNewAttempt = () => {
    navigate("/Timer", {
      state: {
        LeetCodeID: problemData.leetCodeID,
        Description: problemData.ProblemDescription,
        Tags: problemData.tags,
      },
    });
  };

  const handleSkip = () => {
    if (chrome?.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: "skipProblem",
        consentScriptData: routeState?.problemData,
      });
    }
    navigate("/Probgen");
  };

  const getDifficultyVariant = (difficulty) => {
    if (!difficulty) return "default";
    const diff = difficulty.toLowerCase();
    if (diff === "easy") return "easy";
    if (diff === "medium") return "medium";
    if (diff === "hard") return "hard";
    return "default";
  };

  if (isLoading && !problemData.leetCodeID) {
    return (
      <div id="cd-mySidenav" className="cd-sidenav">
        <Header title="Problem Details" onClose={handleClose} />
        <div className="cd-sidenav__content">
          <p
            style={{
              color: "var(--cd-text)",
              textAlign: "center",
              marginTop: "50px",
            }}
          >
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="cd-mySidenav" className="cd-sidenav">
      <Header title="Problem Details" onClose={handleClose} />

      <div className="cd-sidenav__content">
        {/* Main Content Card */}
        <div className="problem-sidebar-card">
          <div className="problem-sidebar-card-header">
            <ChevronLeftIcon className="problem-sidebar-back-icon" />
            <span>
              Problem #{problemData?.leetCodeID || problemData?.id || "N/A"}
            </span>
          </div>
          <h3 className="problem-sidebar-card-title">
            {problemData?.ProblemDescription || problemData?.title || "N/A"}
          </h3>
          <Badge
            className="problem-sidebar-difficulty-badge"
            variant={getDifficultyVariant(problemData?.difficulty)}
          >
            {problemData?.difficulty || "Unknown"}
          </Badge>

          <Separator className="problem-sidebar-separator" />

          <div className="problem-sidebar-stats">
            <div className="problem-sidebar-stat">
              <BarChart3Icon className="problem-sidebar-stat-icon" />
              <div>
                <div className="problem-sidebar-stat-value">
                  {problemData?.acceptance || "N/A"}
                </div>
                <div className="problem-sidebar-stat-label">Acceptance</div>
              </div>
            </div>
            <div className="problem-sidebar-stat">
              <TrendingUpIcon className="problem-sidebar-stat-icon" />
              <div>
                <div className="problem-sidebar-stat-value">
                  {problemData?.submissions || "N/A"}
                </div>
                <div className="problem-sidebar-stat-label">Submissions</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tags Section */}
        <div className="problem-sidebar-section">
          <div className="problem-sidebar-section-header">
            <TagIcon className="problem-sidebar-section-icon" />
            <span className="problem-sidebar-section-title">Tags</span>
          </div>
          <div className="problem-sidebar-tags">
            {problemData?.tags && problemData.tags.length > 0 ? (
              problemData.tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="problem-sidebar-tag"
                >
                  {tag.charAt(0).toUpperCase() + tag.slice(1)}
                </Badge>
              ))
            ) : (
              <span className="problem-sidebar-no-tags">No tags available</span>
            )}
          </div>
        </div>

        {/* Why This Problem Section - Show reasoning for problem selection */}
        {routeState?.problemData?.selectionReason && (
          <WhyThisProblem
            selectionReason={routeState.problemData.selectionReason}
            problemTags={problemData?.tags || []}
          />
        )}

        {/* Strategy Primer Section */}
        {problemData?.tags && problemData.tags.length > 0 && (
          <ExpandablePrimerSection problemTags={problemData.tags} />
        )}

        {/* Status Section */}
        <div className="problem-sidebar-section">
          <div className="problem-sidebar-status-card">
            <BrainIcon className="problem-sidebar-status-icon" />
            <div className="problem-sidebar-status-content">
              <div className="problem-sidebar-status-item">
                <span className="problem-sidebar-status-label">Attempts:</span>
                <span className="problem-sidebar-status-value">
                  {problemData?.attempts || 0}
                </span>
              </div>
              <div className="problem-sidebar-status-item">
                <span className="problem-sidebar-status-label">
                  Last Solved:
                </span>
                <span className="problem-sidebar-status-value">
                  {problemData?.lastSolved || "Never"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          className="problem-sidebar-actions"
          style={{ marginTop: "40px", padding: "12px", marginBottom: "20px" }}
        >
          <Button
            onClick={handleNewAttempt}
            className="problem-sidebar-primary-btn"
            variant="default"
            size="lg"
          >
            <PlayIcon className="problem-sidebar-btn-icon" />
            New Attempt
          </Button>
          {showSkip && (
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="problem-sidebar-skip-btn"
            >
              Skip Problem
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProbDetail;
