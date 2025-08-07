import React from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { MantineProvider } from "@mantine/core";
import { DoubleNavbar } from "../shared/components/DoubleNavbar";
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
          <DoubleNavbar />

          <main style={{ padding: "20px", flex: 1 }}>
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
                    element={<Stats appState={appState?.statistics} />}
                  />
                  <Route
                    path="progress"
                    element={<Progress appState={appState?.progress} />}
                  />
                  <Route path="goals" element={<Goals />} />
                </Route>

                {/* Analytics */}
                <Route path="/analytics" element={<AnalyticsPage />}>
                  <Route index element={<Navigate to="trends" replace />} />
                  <Route path="trends" element={<Trends />} />
                  <Route
                    path="mistake-analysis"
                    element={<MistakeAnalysis />}
                  />
                  <Route path="tag-mastery" element={<TagMastery />} />
                </Route>

                {/* Sessions */}
                <Route path="/sessions">
                  <Route index element={<Navigate to="metrics" replace />} />
                  <Route path="session-metrics" element={<Metrics />} />
                  <Route
                    path="productivity-insights"
                    element={<ProductivityInsights />}
                  />
                </Route>

                {/* Account */}
                <Route path="/account" element={<AccountPage />}>
                  <Route index element={<Navigate to="profile" replace />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="settings" element={<SettingsPage />}>
                    <Route path="general" element={<General />} />
                    <Route path="appearance" element={<Appearance />} />
                    <Route path="accessibility" element={<Accessibility />} />
                  </Route>
                </Route>

                {/* Flashcards / Review */}
                <Route path="/review" element={<FlashcardPage />}>
                  <Route index element={<Navigate to="flashcards" replace />} />
                  <Route path="flashcards" element={<Flashcards />} />
                  <Route path="practice" element={<Practice />} />
                  <Route path="review" element={<Review />} />
                </Route>
              </Routes>
              
            <WelcomeModal
              opened={showOnboarding}
              onClose={handleCloseOnboarding}
              onComplete={handleCompleteOnboarding}
            />
          </main>
        </div>
      </Router>
    </MantineProvider>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
