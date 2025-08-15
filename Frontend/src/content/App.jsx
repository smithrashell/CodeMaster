import "./css/main.css";
import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import ProbStat from "./features/statistics/probstat";
import Main, { Menubutton } from "./features/navigation/main";
import ProbGen from "./features/problems/probgen";
import ProbTime from "./features/problems/probtime";
import StrategyMap from "./features/strategy/StrategyMap";
import Settings from "./features/settings/settings";
import TimerBanner from "./components/timer/timercomponent";
import "@mantine/core/styles.css";
import { AppProviders } from "../shared/provider/appprovider";
import { useNav } from "../shared/provider/navprovider";
import ErrorBoundary from "../shared/components/ErrorBoundary";
import {
  TimerErrorFallback,
  StrategyErrorFallback,
  GenericErrorFallback,
} from "../shared/components/ErrorFallback";

const MenuButtonContainer = () => {
  const { pathname } = useLocation();
  const { isAppOpen, setIsAppOpen } = useNav();

  return (
    <>
      {pathname !== "/Timer" && (
        <div style={{ display: "flex", flexDirection: "row" }}>
          <Menubutton
            setIsAppOpen={setIsAppOpen}
            isAppOpen={isAppOpen}
            currPath={pathname}
          />
        </div>
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
        console.error("Content Script Error Report:", errorData);
      }}
    >
      <AppProviders>
        <MenuButtonContainer />
        <Routes>
          <Route path="/" element={<Main />}>
            <Route
              index
              element={<div />} // Empty element for the main route
            />
            <Route
              path="Probtime"
              element={
                <ErrorBoundary
                  section="Problem Timer"
                  fallback={GenericErrorFallback}
                >
                  <ProbTime />
                </ErrorBoundary>
              }
            />
            <Route
              path="Probstat"
              element={
                <ErrorBoundary
                  section="Problem Statistics"
                  fallback={GenericErrorFallback}
                >
                  <ProbStat />
                </ErrorBoundary>
              }
            />
            <Route
              path="Probgen"
              element={
                <ErrorBoundary
                  section="Problem Generator"
                  fallback={GenericErrorFallback}
                >
                  <ProbGen />
                </ErrorBoundary>
              }
            />
            <Route
              path="Strategy"
              element={
                <ErrorBoundary
                  section="Strategy System"
                  fallback={StrategyErrorFallback}
                >
                  <StrategyMap />
                </ErrorBoundary>
              }
            />
            <Route
              path="Settings"
              element={
                <ErrorBoundary
                  section="Settings"
                  fallback={GenericErrorFallback}
                >
                  <Settings />
                </ErrorBoundary>
              }
            />
            <Route
              path="Timer"
              element={
                <ErrorBoundary section="Timer" fallback={TimerErrorFallback}>
                  <TimerBanner />
                </ErrorBoundary>
              }
            />
            <Route
              path="*"
              element={<div />} // Catch-all within Main layout
            />
          </Route>
        </Routes>
      </AppProviders>
    </ErrorBoundary>
  );
};

export default Router;
