/**
 * Main Route Configuration
 */
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
// Import page components directly
import { Stats } from "../pages/dashboard/overview.jsx";
import { Progress } from "../pages/progress/learning-progress.jsx";
import { Goals } from "../pages/progress/goals.jsx";
import { Metrics as SessionHistory } from "../pages/sessions/session-history.jsx";
import { ProductivityInsights } from "../pages/sessions/productivity-insights.jsx";
import { TagMastery } from "../pages/strategy/tag-mastery.jsx";
import { LearningPath } from "../pages/strategy/learning-path.jsx";
import { General } from "../pages/settings/general.jsx";
import { Appearance } from "../pages/settings/appearance.jsx";
import { Accessibility } from "../pages/settings/accessibility.jsx";
import { HelpPage } from "../pages/help/index.jsx";
import { DashboardPage } from "../pages/layout/DashboardLayout";
import ErrorBoundary from "../../shared/components/error/ErrorBoundary";
import { DashboardErrorFallback } from "../../shared/components/error/ErrorFallback";

// Helper function to create protected routes with ErrorBoundary
const createProtectedRoute = (section, Component) => (
  <ErrorBoundary section={section} fallback={DashboardErrorFallback}>
    <Component />
  </ErrorBoundary>
);

// Route group generators
const createOverviewRoutes = () => (
  <>
    <Route path="/" element={<DashboardPage />}>
      <Route index element={createProtectedRoute("Overview", Stats)} />
    </Route>
    <Route path="/overview" element={<Navigate to="/" replace />} />
  </>
);

const createProgressRoutes = () => (
  <Route path="/progress" element={<DashboardPage />}>
    <Route index element={<Navigate to="learning-progress" replace />} />
    <Route path="learning-progress" element={createProtectedRoute("Progress", Progress)} />
    <Route path="goals" element={createProtectedRoute("Goals", Goals)} />
  </Route>
);

const createSessionRoutes = () => (
  <Route path="/sessions" element={<DashboardPage />}>
    <Route index element={<Navigate to="session-history" replace />} />
    <Route path="session-history" element={createProtectedRoute("Session History", SessionHistory)} />
    <Route path="productivity-insights" element={createProtectedRoute("Productivity Insights", ProductivityInsights)} />
  </Route>
);

const createStrategyRoutes = () => (
  <Route path="/strategy" element={<DashboardPage />}>
    <Route index element={<Navigate to="tag-mastery" replace />} />
    <Route path="tag-mastery" element={createProtectedRoute("Tag Mastery", TagMastery)} />
    <Route path="learning-path" element={createProtectedRoute("Learning Path", LearningPath)} />
  </Route>
);

const createSettingsRoutes = () => (
  <Route path="/settings" element={<DashboardPage />}>
    <Route index element={<Navigate to="general" replace />} />
    <Route path="general" element={createProtectedRoute("General Settings", General)} />
    <Route path="appearance" element={createProtectedRoute("Appearance Settings", Appearance)} />
    <Route path="accessibility" element={createProtectedRoute("Accessibility Settings", Accessibility)} />
  </Route>
);

const createHelpRoutes = () => (
  <Route path="/help" element={<DashboardPage />}>
    <Route index element={createProtectedRoute("Help & Support", HelpPage)} />
  </Route>
);

export const AppRoutes = () => (
  <Routes>
    <Route path="/app.html" element={<Navigate to="/" replace />} />
    {createOverviewRoutes()}
    {createProgressRoutes()}
    {createSessionRoutes()}
    {createStrategyRoutes()}
    {createSettingsRoutes()}
    {createHelpRoutes()}
  </Routes>
);