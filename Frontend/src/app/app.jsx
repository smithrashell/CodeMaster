import React from "react";
import { createRoot } from "react-dom/client";
import {
  MemoryRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Text } from "@mantine/core";
import ThemeProviderWrapper from "../shared/provider/themeprovider";
import { DoubleNavbar } from "../shared/components/DoubleNavbar";
import ErrorBoundary from "../shared/components/ErrorBoundary";
import { DashboardErrorFallback } from "../shared/components/ErrorFallback";
import "@mantine/core/styles.css";
import "../content/css/theme.css";
import "../app/app.css";
import { Progress } from "./pages/progress/learning-progress.jsx";
import { Stats } from "./pages/overview.jsx";

import {
  DashboardPage,
  SettingsPage,
} from "./pages/mockup";
import { MistakeAnalysis } from "./pages/strategy/mistake-analysis.jsx";
import { TagMastery } from "./pages/strategy/tag-mastery.jsx";
import { Metrics } from "./pages/sessions/session-history.jsx";
import { ProductivityInsights } from "./pages/sessions/productivity-insights.jsx";
import { LearningPath } from "./pages/strategy/learning-path.jsx";
import { General } from "./pages/settings/general.jsx";
import { Appearance } from "./pages/settings/appearance.jsx";
import { Accessibility } from "./pages/settings/accessibility.jsx";
import { Goals } from "./pages/progress/goals.jsx";
import { useState, useEffect } from "react";
import { useChromeMessage } from "../shared/hooks/useChromeMessage";
import {
  checkOnboardingStatus,
  completeOnboarding,
} from "../shared/services/onboardingService";
import { shouldUseMockDashboard } from "./config/mockConfig.js";
import { getMockDashboardStatistics } from "./services/mockDashboardService.js";
function App() {
  console.log("🚀 DASHBOARD APP INITIALIZED");
  console.log("📍 Router: Using MemoryRouter for Chrome extension compatibility");
  
  const [appState, setAppState] = useState(null);
  const [_showOnboarding, _setShowOnboarding] = useState(false);

  // Check onboarding status on app initialization (skip in mock mode)
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        // Skip onboarding in development/mock mode
        if (shouldUseMockDashboard()) {
          _setShowOnboarding(false);
          return;
        }

        const status = await checkOnboardingStatus();
        _setShowOnboarding(!status.isCompleted);
      } catch (error) {
        console.error("Error checking onboarding status:", error);
        _setShowOnboarding(false);
      }
    };

    checkOnboarding();
  }, []);

  // Initialize data based on mode (mock vs real)
  useEffect(() => {
    const initializeData = async () => {
      try {
        if (shouldUseMockDashboard()) {
          // Use mock data in development
          // eslint-disable-next-line no-console
          console.log("🎭 Using mock dashboard data");
          const mockData = await getMockDashboardStatistics();
          setAppState(mockData);
        } else {
          // Use real Chrome extension data in production
          // This will be handled by the Chrome message hook below
        }
      } catch (error) {
        console.error("Error initializing dashboard data:", error);
        setAppState({ statistics: null, progress: null });
      }
    };

    initializeData();
  }, []);

  // Chrome message hook for production data (conditionally used)
  const {
    data: _dashboardData,
    loading: _loading,
    error: _error,
  } = useChromeMessage(
    { type: "getDashboardStatistics" }, 
    [], 
    {
      immediate: !shouldUseMockDashboard(), // Only immediate in production
      onSuccess: (response) => {
        if (!shouldUseMockDashboard()) {
          console.info("Dashboard statistics received:", response.result);
          setAppState(response.result);
        }
      },
      onError: (error) => {
        if (!shouldUseMockDashboard()) {
          console.warn("Dashboard statistics failed:", error);
          // Don't block the app if data fetch fails
          setAppState({ statistics: null, progress: null });
        }
      },
    }
  );

  const _handleCompleteOnboarding = async () => {
    try {
      await completeOnboarding();
      _setShowOnboarding(false);
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  const _handleCloseOnboarding = () => {
    _setShowOnboarding(false);
  };

  return (
    <ErrorBoundary
      section="Dashboard Application"
      fallback={DashboardErrorFallback}
      onReportProblem={(errorData) => {
        // Store error report for dashboard issues
        // eslint-disable-next-line no-console
        console.error("Dashboard Error Report:", errorData);
      }}
    >
      <ThemeProviderWrapper>
        <Router initialEntries={["/"]} initialIndex={0}>
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
              style={{
                padding: "20px",
                flex: 1,
                overflowY: "auto",
                maxHeight: "100vh",
              }}
            >
              {!appState ? (
                <Text>Loading...</Text>
              ) : (
                <ErrorBoundary
                  section="Dashboard Content"
                  fallback={DashboardErrorFallback}
                >
                  <Routes>
                    <Route
                      path="/app.html"
                      element={<Navigate to="/" replace />}
                    />

                    {/* Overview */}
                    <Route path="/" element={<DashboardPage />}>
                      <Route 
                        index 
                        element={
                          <ErrorBoundary
                            section="Overview"
                            fallback={DashboardErrorFallback}
                          >
                            <Stats appState={appState?.statistics} />
                          </ErrorBoundary>
                        }
                      />
                    </Route>
                    
                    {/* Redirect /overview to / for compatibility */}
                    <Route path="/overview" element={<Navigate to="/" replace />} />

                    {/* Progress */}
                    <Route path="/progress" element={<DashboardPage />}>
                      <Route index element={<Navigate to="learning-progress" replace />} />
                      <Route
                        path="learning-progress"
                        element={
                          <ErrorBoundary
                            section="Learning Progress"
                            fallback={DashboardErrorFallback}
                          >
                            <Progress appState={appState?.progress} />
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
                            <Goals appState={appState?.goals} />
                          </ErrorBoundary>
                        }
                      />
                    </Route>


                    {/* Sessions */}
                    <Route path="/sessions" element={<DashboardPage />}>
                      <Route index element={<Navigate to="session-history" replace />} />
                      <Route
                        path="session-history"
                        element={
                          <ErrorBoundary
                            section="Session History"
                            fallback={DashboardErrorFallback}
                          >
                            <Metrics appState={appState?.sessions} />
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
                            <ProductivityInsights appState={appState?.sessions} />
                          </ErrorBoundary>
                        }
                      />
                    </Route>

                    {/* Strategy */}
                    <Route path="/strategy" element={<DashboardPage />}>
                      <Route index element={<Navigate to="tag-mastery" replace />} />
                      <Route
                        path="tag-mastery"
                        element={
                          <ErrorBoundary
                            section="Tag Mastery"
                            fallback={DashboardErrorFallback}
                          >
                            <TagMastery appState={appState?.mastery} />
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
                            <LearningPath appState={appState?.mastery} />
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
                            <MistakeAnalysis appState={appState} />
                          </ErrorBoundary>
                        }
                      />
                    </Route>

                    {/* Settings */}
                    <Route path="/settings" element={<SettingsPage />}>
                      <Route index element={<Navigate to="general" replace />} />
                      <Route
                        path="general"
                        element={
                          <ErrorBoundary
                            section="Settings - General"
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
                            section="Settings - Appearance"
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
                            section="Settings - Accessibility"
                            fallback={DashboardErrorFallback}
                          >
                            <Accessibility />
                          </ErrorBoundary>
                        }
                      />
                    </Route>

                  </Routes>
                </ErrorBoundary>
              )}
            </main>
          </div>
        </Router>
      </ThemeProviderWrapper>
    </ErrorBoundary>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
