/**
 * Progress Route Definitions
 */
import React from "react";
import { Route, Navigate } from "react-router-dom";
import { Progress } from "../pages/progress/learning-progress.jsx";
import { Goals } from "../pages/progress/goals.jsx";
import { DashboardPage } from "../pages/mockup";
import ErrorBoundary from "../../shared/components/ErrorBoundary";
import { DashboardErrorFallback } from "../../shared/components/ErrorFallback";

export const ProgressRoutes = () => (
  <Route path="/progress" element={<DashboardPage />}>
    <Route index element={<Navigate to="learning-progress" replace />} />
    <Route
      path="learning-progress"
      element={
        <ErrorBoundary
          section="Learning Progress"
          fallback={DashboardErrorFallback}
        >
          <Progress />
        </ErrorBoundary>
      }
    />
    <Route
      path="goals"
      element={
        <ErrorBoundary
          section="Goals"
          fallback={DashboardErrorFallback}
        >
          <Goals />
        </ErrorBoundary>
      }
    />
  </Route>
);