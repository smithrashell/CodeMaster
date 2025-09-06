import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNav } from "../../../shared/provider/navprovider";
import {
  ChevronLeftIcon,
  BarChart3Icon,
  TrendingUpIcon,
  PlayIcon,
  BrainIcon,
} from "../../../shared/components/ui/Icons";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import Separator from "../../components/ui/Separator.jsx";
import WhyThisProblem from "../../components/problem/WhyThisProblem";
import TagStrategyGrid from "../../components/problem/TagStrategyGrid";
import styles from "./ProblemCard.module.css";

/**
 * Extract problem data from route state
 */
const useProblemData = (routeState) => {
  const problemData = {
    id: routeState?.problemData?.LeetCodeID || routeState?.problemData?.leetCodeID || routeState?.problemData?.id,
    leetCodeID: routeState?.problemData?.LeetCodeID || routeState?.problemData?.leetCodeID || routeState?.problemData?.id,
    LeetCodeID: routeState?.problemData?.LeetCodeID || routeState?.problemData?.leetCodeID || routeState?.problemData?.id,
    title: routeState?.problemData?.Description || routeState?.problemData?.ProblemDescription || routeState?.problemData?.title,
    Description: routeState?.problemData?.Description || routeState?.problemData?.ProblemDescription || routeState?.problemData?.title,
    ProblemDescription: routeState?.problemData?.Description || routeState?.problemData?.ProblemDescription || routeState?.problemData?.title,
    tags: routeState?.problemData?.Tags || routeState?.problemData?.tags || [],
    Tags: routeState?.problemData?.Tags || routeState?.problemData?.tags || [],
    difficulty: routeState?.problemData?.Difficulty || routeState?.problemData?.difficulty || "Unknown",
    acceptance: routeState?.problemData?.acceptance || "N/A",
    submissions: routeState?.problemData?.submissions || "N/A",
    attempts: routeState?.problemData?.attempts || 0,
    lastSolved: routeState?.problemData?.lastSolved || "Never",
  };

  const interviewConfig = routeState?.problemData?.interviewConstraints || null;
  const sessionType = routeState?.problemData?.sessionType || null;
  const isInterviewMode = sessionType && sessionType !== 'standard';

  return { problemData, interviewConfig, sessionType, isInterviewMode };
};

/**
 * Navigation and action handlers
 */
const useProblemActions = ({ navigate, setIsAppOpen, problemData, interviewConfig, sessionType, routeState }) => {
  const _handleClose = () => {
    setIsAppOpen(false);
  };

  const handleNewAttempt = () => {
    navigate("/Timer", {
      state: {
        LeetCodeID: problemData.leetCodeID,
        Description: problemData.ProblemDescription,
        Tags: problemData.tags,
        interviewConfig: interviewConfig,
        sessionType: sessionType,
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

  return { handleNewAttempt, handleSkip };
};

/**
 * Problem statistics display component
 */
const ProblemStats = ({ problemData: _problemData, attemptStats = { successful: 0, total: 0 } }) => (
  <div className={styles.stats}>
    <div className={styles.stat}>
      <BarChart3Icon className={styles.statIcon} />
      <div>
        <div className={styles.statValue}>
          {attemptStats.successful}
        </div>
        <div className={styles.statLabel}>Successful Attempts</div>
      </div>
    </div>
    <div className={styles.stat}>
      <TrendingUpIcon className={styles.statIcon} />
      <div>
        <div className={styles.statValue}>
          {attemptStats.total}
        </div>
        <div className={styles.statLabel}>Total Attempts</div>
      </div>
    </div>
  </div>
);

/**
 * Status section component
 */
const StatusSection = ({ problemData: _problemData, attemptStats }) => {
  const formatLastSolved = (lastSolved) => {
    if (!lastSolved) return "Never";
    
    try {
      const date = new Date(lastSolved);
      const now = new Date();
      const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch (error) {
      return "Never";
    }
  };

  return (
    <div className="problem-sidebar-section">
      <div className={styles.statusCard}>
        <BrainIcon className={styles.statusIcon} />
        <span className={styles.statusLabel}>
          Last Solved:
        </span>
        <div className={styles.statusItem}>
          <span className={styles.statusValue}>
            {formatLastSolved(attemptStats?.lastSolved)}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Main content card component
 */
const MainContentCard = ({ problemData, getDifficultyColor, attemptStats }) => (
  <div className={styles.card}>
    <div className={styles.header}>
      <ChevronLeftIcon className={styles.backIcon} />
      <span>
        Problem #{problemData?.LeetCodeID || problemData?.leetCodeID || problemData?.id || "N/A"}
      </span>
    </div>
    <h3 className={styles.title}>
      {problemData?.Description || problemData?.ProblemDescription || problemData?.title || "N/A"}
    </h3>
    <Badge
      className={styles.difficultyBadge}
      color={getDifficultyColor(problemData?.difficulty)}
      variant="filled"
    >
      {problemData?.difficulty || "Unknown"}
    </Badge>

    <Separator className={styles.separator} />
    <ProblemStats problemData={problemData} attemptStats={attemptStats} />
    <StatusSection problemData={problemData} attemptStats={attemptStats} />
  </div>
);

/**
 * Action buttons component
 */
const ActionButtons = ({ handleNewAttempt, handleSkip, showSkip }) => (
  <div className="problem-sidebar-actions" style={{ marginTop: '6px' }}>
    <Button
      onClick={handleNewAttempt}
      className="problem-sidebar-primary-btn"
      variant="default"
      size="lg"
      style={{ padding: '8px 16px', fontSize: '13px' }}
    >
      <PlayIcon className="problem-sidebar-btn-icon" />
      New Attempt
    </Button>
    {showSkip && (
      <Button
        variant="ghost"
        onClick={handleSkip}
        className="problem-sidebar-skip-btn"
        style={{ padding: '6px 12px', fontSize: '12px' }}
      >
        Skip Problem
      </Button>
    )}
  </div>
);

/**
 * Interview Mode Banner Component
 */
const InterviewModeBanner = ({ isInterviewMode, sessionType, interviewConfig }) => {
  if (!isInterviewMode) return null;

  const modeDisplayName = sessionType === 'interview-like' ? 'Interview Practice' : 
                         sessionType === 'full-interview' ? 'Full Interview' : 
                         'Interview Mode';
  
  const constraints = [];
  if (interviewConfig?.hints?.max !== null && interviewConfig?.hints?.max !== undefined) {
    constraints.push(`${interviewConfig.hints.max} hint${interviewConfig.hints.max !== 1 ? 's' : ''} max`);
  }
  if (interviewConfig?.timing?.hardCutoff) {
    constraints.push('hard time limits');
  }
  if (interviewConfig?.primers?.available === false) {
    constraints.push('no strategy guides');
  }

  const bannerStyle = {
    backgroundColor: sessionType === 'full-interview' ? '#fef2f2' : '#fff7ed',
    border: `1px solid ${sessionType === 'full-interview' ? '#fecaca' : '#fed7aa'}`,
    borderRadius: '8px',
    padding: '12px 16px',
    margin: '12px 0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const iconStyle = {
    fontSize: '16px',
    color: sessionType === 'full-interview' ? '#dc2626' : '#ea580c'
  };

  const textStyle = {
    fontSize: '13px',
    color: sessionType === 'full-interview' ? '#7f1d1d' : '#9a3412',
    fontWeight: '500'
  };

  const constraintStyle = {
    fontSize: '11px',
    color: sessionType === 'full-interview' ? '#991b1b' : '#c2410c',
    marginLeft: '4px'
  };

  return (
    <div style={bannerStyle}>
      <span style={iconStyle}>
        {sessionType === 'full-interview' ? '🎯' : '💪'}
      </span>
      <div>
        <div style={textStyle}>
          {modeDisplayName} Mode Active
        </div>
        {constraints.length > 0 && (
          <div style={constraintStyle}>
            {constraints.join(' • ')}
          </div>
        )}
      </div>
    </div>
  );
};

const ProbDetail = ({ isLoading }) => {
  const { state: routeState } = useLocation();
  const { setIsAppOpen } = useNav();
  const navigate = useNavigate();
  const [showSkip, setShowSkip] = useState(false);
  const [attemptStats, setAttemptStats] = useState({ successful: 0, total: 0, lastSolved: null });

  const { problemData, interviewConfig, sessionType, isInterviewMode } = useProblemData(routeState);
  const { handleNewAttempt, handleSkip } = useProblemActions({
    navigate, setIsAppOpen, problemData, interviewConfig, sessionType, routeState
  });

  // DEBUG: Log problem data and route state
  console.log("🔍 ProbDetail routeState:", routeState);
  console.log("🔍 ProbDetail problemData:", problemData);
  console.log("🔍 ProbDetail tags specifically:", problemData.tags);

  useEffect(() => {
    setShowSkip(!routeState?.problemFound);
  }, [routeState?.problemFound]);

  // Fetch attempt statistics for this problem
  useEffect(() => {
    const problemId = problemData?.LeetCodeID || problemData?.leetCodeID || problemData?.id;
    if (problemId) {
      chrome.runtime.sendMessage({
        type: "getProblemAttemptStats",
        problemId: problemId
      }, (response) => {
        if (response?.success) {
          setAttemptStats({
            successful: response.data?.successful || 0,
            total: response.data?.total || 0,
            lastSolved: response.data?.lastSolved || null
          });
        }
      });
    }
  }, [problemData?.LeetCodeID, problemData?.leetCodeID, problemData?.id]);

  const getDifficultyColor = (difficulty) => {
    if (!difficulty) return "gray";
    const diff = difficulty.toLowerCase();
    if (diff === "easy") return "green";
    if (diff === "medium") return "orange";
    if (diff === "hard") return "red";
    return "gray";
  };


  if (isLoading && !problemData.LeetCodeID && !problemData.leetCodeID) {
    return (
      <p
        style={{
          color: "var(--cm-text)",
          textAlign: "center",
          marginTop: "50px",
        }}
      >
        Loading...
      </p>
    );
  }

  return (
    <>
      <div className="cm-sidenav__content">
        <InterviewModeBanner 
          isInterviewMode={isInterviewMode}
          sessionType={sessionType}
          interviewConfig={interviewConfig}
        />
        <MainContentCard 
          problemData={problemData} 
          getDifficultyColor={getDifficultyColor}
          attemptStats={attemptStats}
        />
        <TagStrategyGrid 
          problemTags={problemData?.Tags || problemData?.tags || []} 
          problemId={problemData?.LeetCodeID || problemData?.leetCodeID || problemData?.id}
          interviewConfig={interviewConfig}
          sessionType={sessionType}
        />
        {routeState?.problemData?.selectionReason && (
          <WhyThisProblem
            selectionReason={routeState.problemData.selectionReason}
            problemTags={problemData?.Tags || problemData?.tags || []}
            currentProblemId={problemData?.LeetCodeID || problemData?.leetCodeID || routeState?.problemData?.LeetCodeID}
          />
        )}
        <ActionButtons 
          handleNewAttempt={handleNewAttempt}
          handleSkip={handleSkip}
          showSkip={showSkip}
        />
      </div>
    </>
  );
};

export default ProbDetail;
