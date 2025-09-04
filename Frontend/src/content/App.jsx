import logger from "../shared/utils/logger.js";
import "./css/main.css";
import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import ProbStat from "./features/statistics/ProblemStats";
import Main, { Menubutton } from "./features/navigation/main";
import ProbGen from "./features/problems/ProblemGenerator";
import ProbTime from "./features/problems/ProblemTime";
import Settings from "./features/settings/Settings";
import TimerBanner from "./components/timer/TimerComponent";
import "@mantine/core/styles.css";
import { AppProviders } from "../shared/provider/appprovider";
import { useNav } from "../shared/provider/navprovider";
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";
import {
  TimerErrorFallback,
  GenericErrorFallback,
} from "../shared/components/ErrorFallback";

const handleEmergencyReset = () => {
  logger.warn("🚑 Emergency reset triggered by user");
  chrome.runtime.sendMessage({ type: "emergencyReset" }, (response) => {
    if (response?.status === "success") {
      logger.info("✅ Emergency reset completed, reloading page...");
      window.location.reload();
    }
  });
};

const EmergencyMenuButton = () => (
  <div style={{ 
    position: 'fixed', 
    top: '10px', 
    right: '10px', 
    zIndex: 9999,
    background: '#ff4444',
    color: 'white',
    padding: '8px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  }}>
    <div 
      role="button"
      tabIndex={0}
      onClick={handleEmergencyReset}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleEmergencyReset();
        }
      }}
    >
      🚑 Reset Extension
    </div>
  </div>
);

const useBackgroundScriptHealth = () => {
  const [backgroundScriptHealthy, setBackgroundScriptHealthy] = React.useState(true);

  React.useEffect(() => {
    const checkBackgroundScriptHealth = () => {
      const healthCheckTimeout = setTimeout(() => {
        logger.warn("🚨 Background script health check timeout - script may be unresponsive");
        setBackgroundScriptHealthy(false);
      }, 3000);

      chrome.runtime.sendMessage({ type: "backgroundScriptHealth" }, (response) => {
        clearTimeout(healthCheckTimeout);
        
        if (chrome.runtime.lastError) {
          logger.error("❌ Background script health check failed:", chrome.runtime.lastError);
          setBackgroundScriptHealthy(false);
        } else if (response?.status === "success") {
          setBackgroundScriptHealthy(true);
        } else {
          logger.warn("⚠️ Background script health check returned unexpected response:", response);
          setBackgroundScriptHealthy(false);
        }
      });
    };

    checkBackgroundScriptHealth();
    const healthCheckInterval = setInterval(checkBackgroundScriptHealth, 30000);
    
    return () => clearInterval(healthCheckInterval);
  }, []);

  return backgroundScriptHealthy;
};

function MenuButtonContainer() {
  const { pathname } = useLocation();
  const { isAppOpen, setIsAppOpen } = useNav();
  const backgroundScriptHealthy = useBackgroundScriptHealth();

  return (
    <>
      {!backgroundScriptHealthy && <EmergencyMenuButton />}
      {pathname !== "/Timer" && (
        <ErrorBoundary
          section="Menu Button"
          fallback={({ error: _error, resetError }) => (
            <div style={{ 
              display: "flex", 
              flexDirection: "row",
              background: '#ffeb3b',
              color: '#333',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              <button onClick={() => {
                resetError();
              }}>
                🔄 Menu Error - Click to Retry
              </button>
            </div>
          )}
        >
          <div style={{ display: "flex", flexDirection: "row" }}>
            <Menubutton
              setIsAppOpen={setIsAppOpen}
              isAppOpen={isAppOpen}
              currPath={pathname}
            />
          </div>
        </ErrorBoundary>
      )}
    </>
  );
}

const Router = () => {
  return (
    <ErrorBoundary
      section="Content Script Application"
      fallback={GenericErrorFallback}
      onReportProblem={(errorData) => {
        // Store error report for content script issues
        // eslint-disable-next-line no-console
        logger.error("Content Script Error Report:", errorData);
      }}
    >
      <AppProviders>
        <MenuButtonContainer />
        <Routes>
          <Route
            path="/"
            element={
              <div className="main-content">
                <Main />
              </div>
            }
          />
          <Route
            path="/Probtime"
            element={
              <div className="main-content">
                <ErrorBoundary
                  section="Problem Timer"
                  fallback={GenericErrorFallback}
                >
                  <ProbTime />
                </ErrorBoundary>
              </div>
            }
          />
          <Route
            path="/Probstat"
            element={
              <div className="main-content">
                <ErrorBoundary
                  section="Problem Statistics"
                  fallback={GenericErrorFallback}
                >
                  <ProbStat />
                </ErrorBoundary>
              </div>
            }
          />
          <Route
            path="/Probgen"
            element={
              <div className="main-content">
                <ErrorBoundary
                  section="Problem Generator"
                  fallback={GenericErrorFallback}
                >
                  <ProbGen />
                </ErrorBoundary>
              </div>
            }
          />
          <Route
            path="/Settings"
            element={
              <div className="main-content">
                <ErrorBoundary
                  section="Settings"
                  fallback={GenericErrorFallback}
                >
                  <Settings />
                </ErrorBoundary>
              </div>
            }
          />
          <Route
            path="/Timer"
            element={
              <ErrorBoundary section="Timer" fallback={TimerErrorFallback}>
                <TimerBanner />
              </ErrorBoundary>
            }
          />
          <Route
            path="*"
            element={<div className="main-content"><div /></div>} // Catch-all
          />
        </Routes>
      </AppProviders>
    </ErrorBoundary>
  );
};

export default Router;
