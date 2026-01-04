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
import { usePageTour } from "../../components/onboarding/usePageTour";
import ChromeAPIErrorHandler from "../../../shared/services/chrome/chromeAPIErrorHandler.js";
import logger from "../../../shared/utils/logging/logger.js";
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
  // State for interview mode loaded from storage (fallback when route state is missing)
  const [storedInterviewMode, setStoredInterviewMode] = useState(null);

  const routeInterviewConfig = getProblemProperty(routeState, 'interviewConstraints');
  const routeSessionType = getProblemProperty(routeState, 'sessionType');

  // Load interview mode from storage if not in route state
  // This handles navigation via window.location.href which doesn't preserve React Router state
  useEffect(() => {
    // Initial load from storage
    if (!routeSessionType && !routeInterviewConfig) {
      chrome.storage.local.get(['currentInterviewMode'], (result) => {
        if (result.currentInterviewMode && result.currentInterviewMode.sessionType) {
          logger.info('ProblemDetail: Loaded interview mode from storage:', result.currentInterviewMode);
          setStoredInterviewMode(result.currentInterviewMode);
        } else {
          // Fallback: fetch active session from background script if storage is empty
          logger.info('ProblemDetail: Storage empty, fetching active session from background');
          if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({ type: 'getActiveSession' }, (response) => {
              if (response?.session) {
                const sessionInfo = {
                  sessionType: response.session.session_type || 'standard',
                  interviewConfig: response.session.interviewConfig || null
                };
                logger.info('ProblemDetail: Loaded interview mode from active session:', sessionInfo);
                setStoredInterviewMode(sessionInfo);
                // Also update storage for future consistency
                chrome.storage.local.set({ currentInterviewMode: sessionInfo });
              }
            });
          }
        }
      });
    }

    // Listen for storage changes to sync across tabs
    const handleStorageChange = (changes, areaName) => {
      if (areaName === 'local' && changes.currentInterviewMode) {
        logger.info('ProblemDetail: Interview mode changed in storage:', changes.currentInterviewMode.newValue);
        setStoredInterviewMode(changes.currentInterviewMode.newValue);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    }
  }, [routeSessionType, routeInterviewConfig]);

  const problemData = useMemo(() => {
    const data = routeState?.problemData;
    if (!data) return {};

    return {
      leetcode_id: data.leetcode_id || data.id,
      title: data.title,
      tags: data.tags || [],
      difficulty: data.difficulty || 'Unknown'
    };
  }, [routeState]);

  // Prefer route state, fall back to storage
  const interviewConfig = routeInterviewConfig || storedInterviewMode?.interviewConfig || null;
  const sessionType = routeSessionType || storedInterviewMode?.sessionType || null;
  const isInterviewMode = sessionType && sessionType !== 'standard';

  return { problemData, interviewConfig, sessionType, isInterviewMode };
};

/**
 * Navigation and action handlers
 */
const useProblemActions = ({ navigate, setIsAppOpen, problemData, interviewConfig, sessionType, routeState, showPageTour }) => {
  const _handleClose = () => {
    setIsAppOpen(false);
  };

  const handleNewAttempt = () => {
    // Complete page tour only if it's currently active (to avoid unnecessary API calls)
    if (showPageTour) {
      ChromeAPIErrorHandler.sendMessageWithRetry({
        type: 'markPageTourCompleted',
        pageId: 'probtime'
      }).catch(error => {
        logger.warn('Failed to mark page tour completed:', error);
      });
    }
    
    navigate("/Timer", {
      state: {
        LeetCodeID: problemData.leetcode_id,
        Description: problemData.title,
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
          Last Attempted:
        </span>
        <div className={styles.statusItem}>
          <span className={styles.statusValue}>
            {formatLastSolved(attemptStats?.lastAttempted || attemptStats?.lastSolved)}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Main content card component
 */
const MainContentCard = ({ problemData, getDifficultyColor, attemptStats }) => {
  console.log('🔍 MainContentCard received problemData:', problemData);
  console.log('🔍 MainContentCard title value:', problemData?.title);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <ChevronLeftIcon className={styles.backIcon} />
        <span>
          Problem #{problemData?.leetcode_id || "N/A"}
        </span>
      </div>
      <h3 className={styles.title}>
        {problemData?.title || "N/A"}
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
};

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
    margin: '12px 0'
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

// Hook to fetch problem attempt statistics
function useProblemAttemptStats(problemId) {
  const [attemptStats, setAttemptStats] = useState({ successful: 0, total: 0, lastSolved: null });

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

  return attemptStats;
}

const ProbDetail = ({ isLoading }) => {
  const { state: routeState } = useLocation();
  const { setIsAppOpen } = useNav();
  const navigate = useNavigate();
  const [showSkip, setShowSkip] = useState(false);
  const [fetchedProblemData, setFetchedProblemData] = useState(null);

  const { problemData, interviewConfig, sessionType, isInterviewMode } = useProblemData(routeState);

  // If problemData is missing essential fields, try to fetch from database
  const needsDataFetch = !problemData?.leetcode_id;
  const finalProblemData = fetchedProblemData || problemData;
  
  // Use page tour hook to check if tour is active
  const { showTour: showPageTour } = usePageTour();
  
  const { handleNewAttempt, handleSkip } = useProblemActions({
    navigate, setIsAppOpen, problemData: finalProblemData, interviewConfig, sessionType, routeState, showPageTour
  });

  // Memoize problem tags to prevent array recreation
  const problemTags = useMemo(() =>
    finalProblemData?.tags || [],
    [finalProblemData?.tags]
  );

  // Memoize problem ID to prevent string recreation
  const problemId = useMemo(() =>
    finalProblemData?.leetcode_id,
    [finalProblemData?.leetcode_id]
  );

  // Fetch attempt statistics for this problem
  const attemptStats = useProblemAttemptStats(problemId);

  // Fetch missing problem data from database if needed
  useEffect(() => {
    if (needsDataFetch) {
      // Try to get problem ID from URL params or route state
      const urlParams = new URLSearchParams(window.location.search);
      const problemIdFromUrl = urlParams.get('problemId') || routeState?.problemId;

      if (problemIdFromUrl) {
        ChromeAPIErrorHandler.sendMessageWithRetry({
          type: 'getProblemById',
          problemId: problemIdFromUrl
        }).then(response => {
          if (response?.success && response.data) {
            setFetchedProblemData(response.data);
          }
        }).catch(error => {
          logger.error('Failed to fetch problem data:', error);
        });
      }
    }
  }, [needsDataFetch, routeState?.problemId]);

  useEffect(() => {
    setShowSkip(!routeState?.problemFound);
  }, [routeState?.problemFound]);

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
          problemData={finalProblemData}
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
            interviewConfig={interviewConfig}
            sessionType={sessionType}
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
