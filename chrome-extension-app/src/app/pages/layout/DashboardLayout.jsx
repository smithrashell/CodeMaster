/**
 * Dashboard Layout Component
 *
 * Simple wrapper that renders child routes via React Router's Outlet.
 * Used as the layout element for all dashboard routes.
 */
import React from "react";
import { Outlet } from "react-router-dom";

export function DashboardPage() {
  return (
    <div>
      <Outlet />
    </div>
  );
}
