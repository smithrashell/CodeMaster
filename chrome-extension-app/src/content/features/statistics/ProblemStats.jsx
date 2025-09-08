import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Header from "../../components/navigation/header";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import { useNav } from "../../../shared/provider/navprovider";

// Loading component
const _LoadingState = () => (
  <div className="cm-stats-loading">
    <p>Loading statistics...</p>
    <div className="cm-loading-spinner"></div>
  </div>
);

// Error component
const _ErrorState = ({ error }) => (
  <div className="cm-stats-error">
    <p>⚠️ {error}</p>
    <button
      className="cm-retry-button"
      onClick={() => window.location.reload()}
    >
      Retry
    </button>
  </div>
);

// Empty state component
const _EmptyState = () => (
  <div className="cm-stats-empty">
    <h3>📊 No Data Yet</h3>
    <p>Start solving problems to see your statistics!</p>
    <div className="cm-stats-hint">
      <p>Your progress will be tracked using the Leitner system:</p>
      <ul>
        <li>📦 Box 1: New/Difficult problems</li>
        <li>📦 Box 2: Getting familiar</li>
        <li>📦 Box 3: Comfortable</li>
        <li>📦 Box 4: Well practiced</li>
        <li>📦 Box 5: Mastered</li>
      </ul>
    </div>
  </div>
);

const LeitnerSystemHint = () => (
  <div className="cm-stats-hint">
    <p>Your progress will be tracked using the Leitner system:</p>
    <ul>
      <li>📦 Box 1: New/Difficult problems</li>
      <li>📦 Box 2: Getting familiar</li>
      <li>📦 Box 3: Well understood</li>
      <li>📦 Box 4: Mastered</li>
    </ul>
  </div>
);

const StatsBreakdown = ({ boxLevelData, totalProblems }) => (
  <div className="cm-stats-breakdown">
    <h4>Box Level Distribution</h4>
    {Object.entries(boxLevelData)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([level, count]) => {
        const percentage =
          totalProblems > 0
            ? ((count / totalProblems) * 100).toFixed(1)
            : 0;
        return (
          <div key={level} className="cm-stat-row">
            <div className="cm-stat-info">
              <span className="cm-stat-level">📦 Box {level}</span>
              <span className="cm-stat-count">
                {count} problems ({percentage}%)
              </span>
            </div>
            <div className="cm-stat-bar">
              <div
                className="cm-stat-fill"
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          </div>
        );
      })}
  </div>
);

const ProbStat = () => {
  const { setIsAppOpen } = useNav();
  const { state: routeState } = useLocation();

  const handleClose = () => {
    setIsAppOpen(false);
  };
  const [boxLevelData, setBoxLevelData] = useState({});
  const [error, setError] = useState(null);

  // Check if we just completed a submission to show fresh data
  const wasJustSubmitted = routeState?.submissionComplete;

  // New approach using custom hook
  const {
    data: _statisticsData,
    loading,
    error: _hookError,
    refetch,
  } = useChromeMessage({ type: "countProblemsByBoxLevel" }, [], {
    onSuccess: (response) => {
      if (response && response.status === "success") {
        setBoxLevelData(response.data);
        setError(null);
      } else {
        console.error("Failed to get problem count by box level");
        setError("Failed to load statistics. Please try refreshing.");
      }
    },
    onError: (_errorMsg) => {
      console.error("Failed to get problem count by box level");
      setError("Failed to load statistics. Please try refreshing.");
    },
  });

  // Refresh data when coming from a fresh submission
  useEffect(() => {
    if (wasJustSubmitted) {
      console.log("🔄 Fresh submission detected, refreshing stats data...");
      // Small delay to ensure database operation is fully complete
      const refreshTimer = setTimeout(() => {
        refetch();
      }, 500);
      
      return () => clearTimeout(refreshTimer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wasJustSubmitted]);

  const totalProblems = Object.values(boxLevelData).reduce(
    (sum, count) => sum + count,
    0
  );
  const hasData = Object.keys(boxLevelData).length > 0;

  return (
    <div id="cm-mySidenav" className="cm-sidenav">
      <Header title="Statistics" onClose={handleClose} />
      <div className="cm-sidenav__content cd-stats-container">
        {loading ? (
          <div className="cm-stats-loading">
            <p>Loading statistics...</p>
            <div className="cm-loading-spinner"></div>
          </div>
        ) : error ? (
          <div className="cm-stats-error">
            <p>⚠️ {error}</p>
            <button
              className="cm-retry-button"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        ) : !hasData ? (
          <div className="cm-stats-empty">
            <h3>📊 No Data Yet</h3>
            <p>Start solving problems to see your statistics!</p>
            <LeitnerSystemHint />
          </div>
        ) : (
          <div className="cm-stats-content">
            <div className="cm-stats-summary">
              <h3>📈 Your Progress</h3>
              <div className="cm-total-problems">
                <span className="cm-stat-number">{totalProblems}</span>
                <span className="cm-stat-label">Total Problems</span>
              </div>
            </div>
            <StatsBreakdown boxLevelData={boxLevelData} totalProblems={totalProblems} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProbStat;
