/**
 * Strategy Route Definitions
 */
import React from "react";
import { Route, Navigate } from "react-router-dom";
import { MistakeAnalysis } from "../pages/strategy/mistake-analysis.jsx";
import { TagMastery } from "../pages/strategy/tag-mastery.jsx";
import { LearningPath } from "../pages/strategy/learning-path.jsx";
import { DashboardPage } from "../pages/mockup";
import ErrorBoundary from "../../shared/components/ErrorBoundary";
import { DashboardErrorFallback } from "../../shared/components/ErrorFallback";

export const StrategyRoutes = () => (
  <Route path="/strategy" element={<DashboardPage />}>
    <Route index element={<Navigate to="tag-mastery" replace />} />
    <Route
      path="tag-mastery"
      element={
        <ErrorBoundary
          section="Tag Mastery"
          fallback={DashboardErrorFallback}
        >
          <TagMastery />
        </ErrorBoundary>
      }
    />
    <Route
      path="learning-path"
      element={
        <ErrorBoundary
          section="Learning Path"
          fallback={DashboardErrorFallback}
        >
          <LearningPath />
        </ErrorBoundary>
      }
    />
    <Route
      path="mistake-analysis"
      element={
        <ErrorBoundary
          section="Mistake Analysis"
          fallback={DashboardErrorFallback}
        >
          <MistakeAnalysis />
        </ErrorBoundary>
      }
    />
  </Route>
);