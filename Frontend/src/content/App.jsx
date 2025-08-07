import "../content/css/main.css";
import React from "react";
import {
  Routes,
  Route,
} from "react-router-dom";
import ProbStat from "./features/statistics/probstat";
import Main from "./features/navigation/main";
import ProbGen from "./features/problems/probgen";
import ProbTime from "./features/problems/probtime";
import StrategyMap from "./features/strategy/StrategyMap";
import Settings from "./features/settings/settings";
import TimerBanner from "./components/timer/timercomponent";
import "@mantine/core/styles.css";
import { AppProviders } from "../shared/provider/appprovider";
import ErrorBoundary from "../shared/components/ErrorBoundary";
import { TimerErrorFallback, StrategyErrorFallback, GenericErrorFallback } from "../shared/components/ErrorFallback";


const Router = () => {
  return (
    <ErrorBoundary
      section="Content Script Application"
      fallback={GenericErrorFallback}
      onReportProblem={(errorData) => {
        // Store error report for content script issues
        // eslint-disable-next-line no-console
        console.error('Content Script Error Report:', errorData);
      }}
    >
      <AppProviders>
        <Routes>
          <Route index element={<Main />} />
          <Route path="*" element={<Main />} />
          <Route path="/" exact element={<Main />}>
            <Route 
              path="/Probtime" 
              exact 
              element={
                <ErrorBoundary section="Problem Timer" fallback={GenericErrorFallback}>
                  <ProbTime />
                </ErrorBoundary>
              } 
            />
            <Route 
              path="/Probstat" 
              exact 
              element={
                <ErrorBoundary section="Problem Statistics" fallback={GenericErrorFallback}>
                  <ProbStat />
                </ErrorBoundary>
              } 
            />
            <Route 
              path="/Probgen" 
              exact 
              element={
                <ErrorBoundary section="Problem Generator" fallback={GenericErrorFallback}>
                  <ProbGen />
                </ErrorBoundary>
              } 
            />
            <Route 
              path="/Strategy" 
              exact 
              element={
                <ErrorBoundary section="Strategy System" fallback={StrategyErrorFallback}>
                  <StrategyMap />
                </ErrorBoundary>
              } 
            />
            <Route 
              path="/Settings" 
              exact 
              element={
                <ErrorBoundary section="Settings" fallback={GenericErrorFallback}>
                  <Settings />
                </ErrorBoundary>
              } 
            />
            <Route 
              path="/Timer" 
              exact 
              element={
                <ErrorBoundary section="Timer" fallback={TimerErrorFallback}>
                  <TimerBanner />
                </ErrorBoundary>
              } 
            />
          </Route>
        </Routes>
      </AppProviders>
    </ErrorBoundary>
  );
};

export default Router;
