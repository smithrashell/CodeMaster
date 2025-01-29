import React from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Flashcards } from "./pages/flashcards";
import {
  HomePage,
  DashboardPage,
  AnalyticsPage,
  SettingsPage,
  AccountPage,
  FlashcardPage,
  Stats,
  Reports,
  Goals,
  Progress,
  Conversions,
  Sources,
  General,
  Appearance,
  Accessibility,
  Profile,
  Settings,
  Notifications,
  Practice,
  Review,
} from "./pages/mockup";
import { MantineProvider } from "@mantine/core";
import { DoubleNavbar } from "../content/components/DoubleNavbar";
import "@mantine/core/styles.css";
import "../app/app.css";

function App() {
  return (
    <MantineProvider>
      <Router>
        <div style={{ display: "flex", height: "100vh", width: "100vw" }}>
          <DoubleNavbar />
          <main style={{ padding: "20px", flex: 1 }}>
            <Routes>
              <Route
                path="/app.html"
                element={<Navigate to="/stats" replace />}
              />
              <Route path="/" element={<DashboardPage />}>
                <Route index element={<Navigate to="stats" replace />} />
                <Route path="stats" element={<Stats />} />
                <Route path="reports" element={<Reports />} />
                <Route path="goals" element={<Goals />} />
              </Route>
              <Route path="/analytics" element={<AnalyticsPage />}>
                <Route index element={<Navigate to="progress" replace />} />
                <Route path="progress" element={<Progress />} />
                <Route path="conversions" element={<Conversions />} />
                <Route path="sources" element={<Sources />} />
              </Route>
              <Route path="/settings" element={<SettingsPage />}>
                <Route index element={<Navigate to="general" replace />} />
                <Route path="general" element={<General />} />
                <Route path="appearance" element={<Appearance />} />
                <Route path="accessibility" element={<Accessibility />} />
              </Route>
              <Route path="/account" element={<AccountPage />}>
                <Route index element={<Navigate to="profile" replace />} />
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />
                <Route path="notifications" element={<Notifications />} />
              </Route>
              <Route path="/review" element={<FlashcardPage />}>
                <Route index element={<Navigate to="flashcards" replace />} />
                <Route path="flashcards" element={<Flashcards />} />
                <Route path="practice" element={<Practice />} />
                <Route path="review" element={<Review />} />
              </Route>
            </Routes>
          </main>
        </div>
      </Router>
    </MantineProvider>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
