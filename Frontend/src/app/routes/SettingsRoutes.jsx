/**
 * Settings Route Definitions
 */
import React from "react";
import { Route, Navigate } from "react-router-dom";
import { General } from "../pages/settings/general.jsx";
import { Appearance } from "../pages/settings/appearance.jsx";
import { Accessibility } from "../pages/settings/accessibility.jsx";
import { SettingsPage } from "../pages/mockup";
import ErrorBoundary from "../../shared/components/ErrorBoundary";
import { DashboardErrorFallback } from "../../shared/components/ErrorFallback";

export const SettingsRoutes = () => (
  <Route path="/settings" element={<SettingsPage />}>
    <Route index element={<Navigate to="general" replace />} />
    <Route
      path="general"
      element={
        <ErrorBoundary
          section="General Settings"
          fallback={DashboardErrorFallback}
        >
          <General />
        </ErrorBoundary>
      }
    />
    <Route
      path="appearance"
      element={
        <ErrorBoundary
          section="Appearance Settings"
          fallback={DashboardErrorFallback}
        >
          <Appearance />
        </ErrorBoundary>
      }
    />
    <Route
      path="accessibility"
      element={
        <ErrorBoundary
          section="Accessibility Settings"
          fallback={DashboardErrorFallback}
        >
          <Accessibility />
        </ErrorBoundary>
      }
    />
  </Route>
);