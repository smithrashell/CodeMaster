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
import WhyThisProblem from "../../components/problem/WhyThisProblem";
import TagStrategyGrid from "../../components/problem/TagStrategyGrid";


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

  // DEBUG: Log problem data and route state
  console.log("🔍 ProbDetail routeState:", routeState);
  console.log("🔍 ProbDetail problemData:", problemData);
  console.log("🔍 ProbDetail tags specifically:", problemData.tags);

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
      <div id="cm-mySidenav" className="cm-sidenav problem-sidebar-view">
        <Header title="Problem Details" onClose={handleClose} />
        <div className="cm-sidenav__content">
          <p
            style={{
              color: "var(--cm-text)",
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
    <div id="cm-mySidenav" className="cm-sidenav problem-sidebar-view">
      <Header title="Problem Details" onClose={handleClose} />

      <div className="cm-sidenav__content">
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
            {/* Status Section */}
        <div className="problem-sidebar-section">
          <div className="problem-sidebar-status-card">
            <BrainIcon className="problem-sidebar-status-icon" />
         
          
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

        {/* Tags with Strategy Grid */}
        <TagStrategyGrid problemTags={problemData?.tags || []} />

        {/* Why This Problem Section - Show reasoning for problem selection */}
        {routeState?.problemData?.selectionReason && (
          <WhyThisProblem
            selectionReason={routeState.problemData.selectionReason}
            problemTags={problemData?.tags || []}
          />
        )}


      

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
