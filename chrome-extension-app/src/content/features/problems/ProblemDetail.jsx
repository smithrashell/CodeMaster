import { useEffect, useState, useMemo, useCallback } from "react";
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
 * Helper function to get property with fallback keys
 */
const getProblemProperty = (routeState, ...keys) => {
  const problemData = routeState?.problemData;
  if (!problemData) return null;
  
  for (const key of keys) {
    if (problemData[key] !== undefined && problemData[key] !== null) {
      return problemData[key];
    }
  }
  return null;
};

/**
 * Extract problem data from route state
 */
const useProblemData = (routeState) => {
  const idValue = getProblemProperty(routeState, 'LeetCodeID', 'leetCodeID', 'id');
  const titleValue = getProblemProperty(routeState, 'Description', 'ProblemDescription', 'title');
  const problemData = useMemo(() => {
    const tagsValue = getProblemProperty(routeState, 'Tags', 'tags') || [];
    const difficultyValue = getProblemProperty(routeState, 'Difficulty', 'difficulty') || 'Unknown';
    const acceptanceValue = getProblemProperty(routeState, 'acceptance') || 'N/A';
    const submissionsValue = getProblemProperty(routeState, 'submissions') || 'N/A';
    const attemptsValue = getProblemProperty(routeState, 'attempts') || 0;
    const lastSolvedValue = getProblemProperty(routeState, 'lastSolved') || 'Never';
    
    return {
      id: idValue,
      leetCodeID: idValue,
      LeetCodeID: idValue,
      title: titleValue,
      Description: titleValue,
      ProblemDescription: titleValue,
      tags: tagsValue,
      Tags: tagsValue,
      difficulty: difficultyValue,
      acceptance: acceptanceValue,
      submissions: submissionsValue,
      attempts: attemptsValue,
      lastSolved: lastSolvedValue,
    };
  }, [idValue, titleValue, routeState]);

  const interviewConfig = getProblemProperty(routeState, 'interviewConstraints');
  const sessionType = getProblemProperty(routeState, 'sessionType');
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

  // Memoize problem tags to prevent array recreation
  const problemTags = useMemo(() => 
    problemData?.Tags || problemData?.tags || [], 
    [problemData?.Tags, problemData?.tags]
  );

  // Memoize problem ID to prevent string recreation
  const problemId = useMemo(() => 
    problemData?.LeetCodeID || problemData?.leetCodeID || problemData?.id,
    [problemData?.LeetCodeID, problemData?.leetCodeID, problemData?.id]
  );

  // DEBUG: Log problem data and route state
  console.log("🔍 ProbDetail routeState:", routeState);
  console.log("🔍 ProbDetail problemData:", problemData);
  console.log("🔍 ProbDetail tags specifically:", problemData.tags);

  useEffect(() => {
    setShowSkip(!routeState?.problemFound);
  }, [routeState?.problemFound]);

  // Fetch attempt statistics for this problem
  useEffect(() => {
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
  }, [problemId]);

  const getDifficultyColor = useCallback((difficulty) => {
    if (!difficulty) return "gray";
    const diff = difficulty.toLowerCase();
    if (diff === "easy") return "green";
    if (diff === "medium") return "orange";
    if (diff === "hard") return "red";
    return "gray";
  }, []);


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
          problemTags={problemTags} 
          problemId={problemId}
          interviewConfig={interviewConfig}
          sessionType={sessionType}
        />
        {routeState?.problemData?.selectionReason && (
          <WhyThisProblem
            selectionReason={routeState.problemData.selectionReason}
            problemTags={problemTags}
            currentProblemId={problemId || routeState?.problemData?.LeetCodeID}
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
