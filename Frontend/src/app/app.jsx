import React from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { MantineProvider, Text } from "@mantine/core";
import { DoubleNavbar } from "../shared/components/DoubleNavbar";
import ErrorBoundary from "../shared/components/ErrorBoundary";
import { DashboardErrorFallback } from "../shared/components/ErrorFallback";
import "@mantine/core/styles.css";
import "../app/app.css";
import { Progress } from "../app/pages/dashboard/progress";
import { Stats } from "../app/pages/dashboard/stats";

import {
  DashboardPage,
  AnalyticsPage,
  SettingsPage,
  AccountPage,
  FlashcardPage,
  Goals,
  Trends,
  MistakeAnalysis,
  TagMastery,
  Metrics,
  ProductivityInsights,
  Profile,
  Notifications,
  General,
  Appearance,
  Accessibility,
  Flashcards,
  Practice,
  Review,
} from "./pages/mockup";
import { useState, useEffect } from "react";
import { useChromeMessage } from "../shared/hooks/useChromeMessage";
import { checkOnboardingStatus, completeOnboarding } from "../shared/services/onboardingService";
import { WelcomeModal } from "./components/onboarding";
function App() {
  const [appState, setAppState] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check onboarding status on app initialization
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const status = await checkOnboardingStatus();
        setShowOnboarding(!status.isCompleted);
      } catch (error) {
        console.error("Error checking onboarding status:", error);
        setShowOnboarding(false);
      }
    };

    checkOnboarding();
  }, []);

  // New approach using custom hook - non-blocking data fetch
  const {
    data: _dashboardData,
    loading: _loading,
    error: _error,
  } = useChromeMessage({ type: "getDashboardStatistics" }, [], {
    onSuccess: (response) => {
      console.info("Dashboard statistics received:", response.result);
      setAppState(response.result);
    },
    onError: (error) => {
      console.warn("Dashboard statistics failed:", error);
      // Don't block the app if data fetch fails
      setAppState({ statistics: null, progress: null });
    },
  });

  const handleCompleteOnboarding = async () => {
    try {
      await completeOnboarding();
      setShowOnboarding(false);
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
  };

  return (
    <ErrorBoundary
      section="Dashboard Application"
      fallback={DashboardErrorFallback}
      onReportProblem={(errorData) => {
        // Store error report for dashboard issues
        // eslint-disable-next-line no-console
        console.error('Dashboard Error Report:', errorData);
      }}
    >
      <MantineProvider>
        <Router>
          <div
            style={{
              display: "flex",
              height: "100vh",
              width: "100vw",
              minWidth: "100vw",
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            <ErrorBoundary section="Navigation" fallback={null}>
              <DoubleNavbar />
            </ErrorBoundary>


            <main style={{ padding: "20px", flex: 1 }}>
              {!appState ? (
                <Text>Loading...</Text>
              ) : (
                <ErrorBoundary section="Dashboard Content" fallback={DashboardErrorFallback}>
                  <Routes>
                    <Route
                      path="/app.html"
                      element={<Navigate to="/stats" replace />}
                    />


                    {/* Dashboard */}
                    <Route path="/" element={<DashboardPage />}>
                      <Route index element={<Navigate to="stats" replace />} />
                      <Route
                        path="stats"
                        element={
                          <ErrorBoundary section="Statistics" fallback={DashboardErrorFallback}>
                            <Stats appState={appState?.statistics} />
                          </ErrorBoundary>
                        }
                      />
                      <Route
                        path="progress"
                        element={
                          <ErrorBoundary section="Progress" fallback={DashboardErrorFallback}>
                            <Progress appState={appState?.progress} />
                          </ErrorBoundary>
                        }
                      />
                      <Route 
                        path="goals" 
                        element={
                          <ErrorBoundary section="Goals" fallback={DashboardErrorFallback}>
                            <Goals />
                          </ErrorBoundary>
                        } 
                      />
                    </Route>

                    {/* Analytics */}
                    <Route path="/analytics" element={<AnalyticsPage />}>
                      <Route index element={<Navigate to="trends" replace />} />
                      <Route 
                        path="trends" 
                        element={
                          <ErrorBoundary section="Analytics - Trends" fallback={DashboardErrorFallback}>
                            <Trends />
                          </ErrorBoundary>
                        } 
                      />
                      <Route
                        path="mistake-analysis"
                        element={
                          <ErrorBoundary section="Analytics - Mistake Analysis" fallback={DashboardErrorFallback}>
                            <MistakeAnalysis />
                          </ErrorBoundary>
                        }
                      />
                      <Route 
                        path="tag-mastery" 
                        element={
                          <ErrorBoundary section="Analytics - Tag Mastery" fallback={DashboardErrorFallback}>
                            <TagMastery />
                          </ErrorBoundary>
                        } 
                      />
                    </Route>

                    {/* Sessions */}
                    <Route path="/sessions">
                      <Route index element={<Navigate to="metrics" replace />} />
                      <Route 
                        path="session-metrics" 
                        element={
                          <ErrorBoundary section="Session Metrics" fallback={DashboardErrorFallback}>
                            <Metrics />
                          </ErrorBoundary>
                        } 
                      />
                      <Route
                        path="productivity-insights"
                        element={
                          <ErrorBoundary section="Productivity Insights" fallback={DashboardErrorFallback}>
                            <ProductivityInsights />
                          </ErrorBoundary>
                        }
                      />
                    </Route>

                    {/* Account */}
                    <Route path="/account" element={<AccountPage />}>
                      <Route index element={<Navigate to="profile" replace />} />
                      <Route 
                        path="profile" 
                        element={
                          <ErrorBoundary section="Profile" fallback={DashboardErrorFallback}>
                            <Profile />
                          </ErrorBoundary>
                        } 
                      />
                      <Route 
                        path="notifications" 
                        element={
                          <ErrorBoundary section="Notifications" fallback={DashboardErrorFallback}>
                            <Notifications />
                          </ErrorBoundary>
                        } 
                      />
                      <Route path="settings" element={<SettingsPage />}>
                        <Route 
                          path="general" 
                          element={
                            <ErrorBoundary section="Settings - General" fallback={DashboardErrorFallback}>
                              <General />
                            </ErrorBoundary>
                          } 
                        />
                        <Route 
                          path="appearance" 
                          element={
                            <ErrorBoundary section="Settings - Appearance" fallback={DashboardErrorFallback}>
                              <Appearance />
                            </ErrorBoundary>
                          } 
                        />
                        <Route 
                          path="accessibility" 
                          element={
                            <ErrorBoundary section="Settings - Accessibility" fallback={DashboardErrorFallback}>
                              <Accessibility />
                            </ErrorBoundary>
                          } 
                        />
                      </Route>
                    </Route>


                    {/* Flashcards / Review */}
                    <Route path="/review" element={<FlashcardPage />}>
                      <Route index element={<Navigate to="flashcards" replace />} />
                      <Route 
                        path="flashcards" 
                        element={
                          <ErrorBoundary section="Flashcards" fallback={DashboardErrorFallback}>
                            <Flashcards />
                          </ErrorBoundary>
                        } 
                      />
                      <Route 
                        path="practice" 
                        element={
                          <ErrorBoundary section="Practice" fallback={DashboardErrorFallback}>
                            <Practice />
                          </ErrorBoundary>
                        } 
                      />
                      <Route 
                        path="review" 
                        element={
                          <ErrorBoundary section="Review" fallback={DashboardErrorFallback}>
                            <Review />
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
      </MantineProvider>
    </ErrorBoundary>

  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
