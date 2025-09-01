/**
 * Main Route Configuration
 */
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { OverviewRoutes } from "./OverviewRoutes.jsx";
import { ProgressRoutes } from "./ProgressRoutes.jsx";
import { SessionRoutes } from "./SessionRoutes.jsx";
import { StrategyRoutes } from "./StrategyRoutes.jsx";
import { SettingsRoutes } from "./SettingsRoutes.jsx";

export const AppRoutes = () => (
  <Routes>
    <Route
      path="/app.html"
      element={<Navigate to="/" replace />}
    />

    <OverviewRoutes />
    <ProgressRoutes />
    <SessionRoutes />
    <StrategyRoutes />
    <SettingsRoutes />
  </Routes>
);