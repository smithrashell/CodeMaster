/**
 * Overview Route Definitions
 */
import React from "react";
import { Route, Navigate } from "react-router-dom";
import { Stats } from "../pages/overview.jsx";
import { DashboardPage } from "../pages/mockup";
import ErrorBoundary from "../../shared/components/ErrorBoundary";
import { DashboardErrorFallback } from "../../shared/components/ErrorFallback";

export const OverviewRoutes = () => (
  <>
    {/* Overview */}
    <Route path="/" element={<DashboardPage />}>
      <Route 
        index 
        element={
          <ErrorBoundary
            section="Overview"
            fallback={DashboardErrorFallback}
          >
            <Stats />
          </ErrorBoundary>
        }
      />
    </Route>
    
    {/* Redirect /overview to / for compatibility */}
    <Route path="/overview" element={<Navigate to="/" replace />} />
  </>
);