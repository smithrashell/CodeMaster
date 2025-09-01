/**
 * Session Route Definitions
 */
import React from "react";
import { Route, Navigate } from "react-router-dom";
import { Metrics } from "../pages/sessions/session-history.jsx";
import { ProductivityInsights } from "../pages/sessions/productivity-insights.jsx";
import { DashboardPage } from "../pages/mockup";
import ErrorBoundary from "../../shared/components/ErrorBoundary";
import { DashboardErrorFallback } from "../../shared/components/ErrorFallback";

export const SessionRoutes = () => (
  <Route path="/sessions" element={<DashboardPage />}>
    <Route index element={<Navigate to="session-history" replace />} />
    <Route
      path="session-history"
      element={
        <ErrorBoundary
          section="Session History"
          fallback={DashboardErrorFallback}
        >
          <Metrics />
        </ErrorBoundary>
      }
    />
    <Route
      path="productivity-insights"
      element={
        <ErrorBoundary
          section="Productivity Insights"
          fallback={DashboardErrorFallback}
        >
          <ProductivityInsights />
        </ErrorBoundary>
      }
    />
  </Route>
);