import React, { useState, useEffect } from "react";
import Header from "../../components/navigation/header";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";

const ProbStat = () => {
  const [boxLevelData, setBoxLevelData] = useState({});
  const [error, setError] = useState(null);

  // New approach using custom hook
  const {
    data: statisticsData,
    loading,
    error: hookError,
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
    onError: (errorMsg) => {
      console.error("Failed to get problem count by box level");
      setError("Failed to load statistics. Please try refreshing.");
    },
  });

  const totalProblems = Object.values(boxLevelData).reduce(
    (sum, count) => sum + count,
    0
  );
  const hasData = Object.keys(boxLevelData).length > 0;

  return (
    <div id="cd-mySidenav" className="cd-sidenav">
      <Header title="Statistics" />
      <div className="cd-sidenav__content cd-stats-container">
        {loading ? (
          <div className="cd-stats-loading">
            <p>Loading statistics...</p>
            <div className="cd-loading-spinner"></div>
          </div>
        ) : error ? (
          <div className="cd-stats-error">
            <p>⚠️ {error}</p>
            <button
              className="cd-retry-button"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        ) : !hasData ? (
          <div className="cd-stats-empty">
            <h3>📊 No Data Yet</h3>
            <p>Start solving problems to see your statistics!</p>
            <div className="cd-stats-hint">
              <p>Your progress will be tracked using the Leitner system:</p>
              <ul>
                <li>📦 Box 1: New/Difficult problems</li>
                <li>📦 Box 2: Getting familiar</li>
                <li>📦 Box 3: Well understood</li>
                <li>📦 Box 4: Mastered</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="cd-stats-content">
            <div className="cd-stats-summary">
              <h3>📈 Your Progress</h3>
              <div className="cd-total-problems">
                <span className="cd-stat-number">{totalProblems}</span>
                <span className="cd-stat-label">Total Problems</span>
              </div>
            </div>

            <div className="cd-stats-breakdown">
              <h4>Box Level Distribution</h4>
              {Object.entries(boxLevelData)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([level, count]) => {
                  const percentage =
                    totalProblems > 0
                      ? ((count / totalProblems) * 100).toFixed(1)
                      : 0;
                  return (
                    <div key={level} className="cd-stat-row">
                      <div className="cd-stat-info">
                        <span className="cd-stat-level">📦 Box {level}</span>
                        <span className="cd-stat-count">
                          {count} problems ({percentage}%)
                        </span>
                      </div>
                      <div className="cd-stat-bar">
                        <div
                          className="cd-stat-fill"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProbStat;
