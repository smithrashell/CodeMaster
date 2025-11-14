import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter as Router } from "react-router-dom";
import ThemeProviderWrapper from "../shared/provider/themeprovider";
import ErrorBoundary from "../shared/components/ErrorBoundary";
import { DashboardErrorFallback } from "../shared/components/ErrorFallback";
import "@mantine/core/styles.css";
import "../content/css/theme.css";
import "../app/app.css";
import "./styles/accessibility.css";
import { AppRoutes } from "./routes/index.jsx";
import { AppLayout } from "./components/layout/AppLayout.jsx";
import { WelcomeModal } from "./components/onboarding/WelcomeModal.jsx";
import { WelcomeBackModal } from "./components/onboarding/WelcomeBackModal.jsx";
import { useAppOnboarding } from "./hooks/useAppOnboarding.js";
import { useWelcomeBack } from "./hooks/useWelcomeBack.js";

function App() {
  const { showOnboarding, handleCompleteOnboarding, handleCloseOnboarding } = useAppOnboarding();
  const { showWelcomeBack, strategy, handleConfirm, handleClose } = useWelcomeBack();

  // Priority logic: Onboarding takes precedence over Welcome Back modal
  // This prevents both modals from showing simultaneously for users who:
  // 1. Haven't completed onboarding AND
  // 2. Are returning after a long gap
  const shouldShowWelcomeBack = showWelcomeBack && !showOnboarding;

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
          
          <AppLayout>
            <AppRoutes />
          </AppLayout>
        </Router>
        
        {/* App Onboarding Modal */}
        <WelcomeModal
          opened={showOnboarding}
          onClose={handleCloseOnboarding}
          onComplete={handleCompleteOnboarding}
        />

        {/* Welcome Back Modal - Phase 2: Recalibration */}
        <WelcomeBackModal
          opened={shouldShowWelcomeBack}
          onClose={handleClose}
          strategy={strategy}
          onConfirm={handleConfirm}
        />
      </ThemeProviderWrapper>
    </ErrorBoundary>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
