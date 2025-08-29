import React from "react";
import { createRoot } from "react-dom/client";
import {
  MemoryRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import ThemeProviderWrapper from "../shared/provider/themeprovider";
import { DoubleNavbar } from "../shared/components/DoubleNavbar";
import ErrorBoundary from "../shared/components/ErrorBoundary";
import { DashboardErrorFallback } from "../shared/components/ErrorFallback";
import "@mantine/core/styles.css";
import "../content/css/theme.css";
import "../app/app.css";
import "./styles/accessibility.css";
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
import {
  checkOnboardingStatus,
  completeOnboarding,
} from "../shared/services/onboardingService";
import { WelcomeModal } from "./components/onboarding/WelcomeModal.jsx";
function App() {
  const [_showOnboarding, _setShowOnboarding] = useState(false);

  // Check onboarding status on app initialization
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const status = await checkOnboardingStatus();
        _setShowOnboarding(!status.isCompleted);
      } catch (error) {
        // Error checking onboarding status
        _setShowOnboarding(false);
      }
    };

    checkOnboarding();
  }, []);

  const _handleCompleteOnboarding = async () => {
    try {
      await completeOnboarding();
      _setShowOnboarding(false);
    } catch (error) {
      // Error completing onboarding
    }
  };

  const _handleCloseOnboarding = () => {
    _setShowOnboarding(false);
  };

  return (
    <ErrorBoundary
      section="Dashboard Application"
      fallback={DashboardErrorFallback}
      onReportProblem={(_errorData) => {
        // Store error report for dashboard issues
        // eslint-disable-next-line no-console
        // Dashboard error reported
      }}
    >
      <ThemeProviderWrapper>
        <Router initialEntries={["/"]} initialIndex={0}>
          {/* Skip to Content Link for Accessibility */}
          <a href="#main-content" className="skip-to-content">
            Skip to main content
          </a>
          
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
                            <Stats />
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
                            <Progress />
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
                            <Goals />
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
            </main>
          </div>
        </Router>
        
        {/* App Onboarding Modal */}
        <WelcomeModal
          opened={_showOnboarding}
          onClose={() => _setShowOnboarding(false)}
          onComplete={async () => {
            try {
              await completeOnboarding();
              _setShowOnboarding(false);
            } catch (error) {
              // Error completing onboarding
            }
          }}
        />
      </ThemeProviderWrapper>
    </ErrorBoundary>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
