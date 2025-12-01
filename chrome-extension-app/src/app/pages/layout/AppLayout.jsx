/**
 * Main App Layout Component
 */
import React from "react";
import { DoubleNavbar } from "../../../shared/components/navigation/DoubleNavbar";
import ErrorBoundary from "../../../shared/components/error/ErrorBoundary";
import { DashboardErrorFallback } from "../../../shared/components/error/ErrorFallback";

export const AppLayout = ({ children }) => (
  <div
    style={{
      display: "flex",
      minHeight: "100vh",
      width: "100%",
    }}
  >
    <ErrorBoundary section="Navigation" fallback={null}>
      <DoubleNavbar />
    </ErrorBoundary>

    <main
      id="main-content"
      style={{
        padding: "20px",
        flex: 1,
        overflowY: "auto",
        maxHeight: "100vh",
      }}
    >
      <ErrorBoundary
        section="Dashboard Content"
        fallback={DashboardErrorFallback}
      >
        {children}
      </ErrorBoundary>
    </main>
  </div>
);