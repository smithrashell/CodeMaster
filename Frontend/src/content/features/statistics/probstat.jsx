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
    <div id="cm-mySidenav" className="cm-sidenav">
      <Header title="Statistics" />
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
            <div className="cm-stats-hint">
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
          <div className="cm-stats-content">
            <div className="cm-stats-summary">
              <h3>📈 Your Progress</h3>
              <div className="cm-total-problems">
                <span className="cm-stat-number">{totalProblems}</span>
                <span className="cm-stat-label">Total Problems</span>
              </div>
            </div>

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
          </div>
        )}
      </div>
    </div>
  );
};

export default ProbStat;
