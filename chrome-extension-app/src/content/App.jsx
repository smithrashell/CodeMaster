import logger from "../shared/utils/logger.js";
import "./css/main.css";
import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import ProbStat from "./features/statistics/ProblemStats";
import Main, { Menubutton } from "./features/navigation/main";
import ProbGen from "./features/problems/ProblemGenerator";
import ProbTime from "./features/problems/ProblemTime";
import Settings from "./features/settings/settings";
import TimerBanner from "./components/timer/timercomponent";
// Removed Mantine CSS import - not needed in content script
import { AppProviders } from "../shared/provider/appprovider";
import { useNav } from "../shared/provider/navprovider";
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";
import {
  TimerErrorFallback,
  GenericErrorFallback,
} from "../shared/components/ErrorFallback";
import { PageSpecificTour } from "./components/onboarding/PageSpecificTour";
import { usePageTour } from "./components/onboarding/usePageTour";
import { FloatingHelpButton } from "./components/help/FloatingHelpButton.jsx";

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
  const [failureCount, setFailureCount] = React.useState(0);

  React.useEffect(() => {
    const checkBackgroundScriptHealth = () => {
      const healthCheckTimeout = setTimeout(() => {
        logger.warn("🚨 Background script health check timeout - script may be unresponsive");
        setFailureCount(prev => prev + 1);
      }, 5000); // Increased timeout from 3s to 5s

      chrome.runtime.sendMessage({ type: "backgroundScriptHealth" }, (response) => {
        clearTimeout(healthCheckTimeout);
        
        if (chrome.runtime.lastError) {
          // Log as warning instead of error for temporary issues
          logger.warn("⚠️ Background script temporarily unreachable:", chrome.runtime.lastError.message);
          setFailureCount(prev => prev + 1);
        } else if (response?.status === "success") {
          // Reset failure count on successful response
          setFailureCount(0);
          if (!backgroundScriptHealthy) {
            logger.info("✅ Background script connection restored");
            setBackgroundScriptHealthy(true);
          }
        } else {
          logger.warn("⚠️ Background script health check returned unexpected response:", response);
          setFailureCount(prev => prev + 1);
        }
      });
    };

    checkBackgroundScriptHealth();
    const healthCheckInterval = setInterval(checkBackgroundScriptHealth, 15000); // Check more frequently (15s instead of 30s)
    
    return () => clearInterval(healthCheckInterval);
  }, [backgroundScriptHealthy]);

  // Only show error banner after 3 consecutive failures (avoid false alarms)
  React.useEffect(() => {
    if (failureCount >= 3) {
      logger.error("❌ Background script persistently unreachable after 3 attempts");
      setBackgroundScriptHealthy(false);
    } else if (failureCount === 0) {
      setBackgroundScriptHealthy(true);
    }
  }, [failureCount]);

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

// Component that uses React Router hooks - must be inside AppProviders
const PageTourProvider = () => {
  // Page-specific tour management - now has access to Router context
  const { showTour: showPageTour, tourConfig: pageTourConfig, onTourComplete: handlePageTourComplete, onTourClose: handlePageTourClose } = usePageTour();

  return (
    <>
      <MenuButtonContainer />
      
      {/* Page-Specific Tours - now with proper Router context */}
      {pageTourConfig && (
        <PageSpecificTour
          tourId={pageTourConfig.id}
          tourSteps={pageTourConfig.steps}
          isVisible={showPageTour}
          onComplete={handlePageTourComplete}
          onClose={handlePageTourClose}
        />
      )}
    </>
  );
};

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
        <PageTourProvider />
        <FloatingHelpButton />

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
