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
import { useState } from "react";
import { useChromeMessage } from "../shared/hooks/useChromeMessage";
function App() {
  const [appState, setAppState] = useState(null);

  // New approach using custom hook
  const {
    data: _dashboardData,
    loading: _loading,
    error: _error,
  } = useChromeMessage({ type: "getDashboardStatistics" }, [], {
    onSuccess: (response) => {
      console.info("Dashboard statistics received:", response.result);
      setAppState(response.result);
    },
  });

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
            {!appState ? (
              <Text>Loading...</Text>
            ) : (
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
            )}
          </main>
        </div>
      </Router>
    </MantineProvider>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
