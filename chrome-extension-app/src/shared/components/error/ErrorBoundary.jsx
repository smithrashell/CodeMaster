/**
 * ErrorBoundary Component for CodeMaster
 *
 * React Error Boundary that catches JavaScript errors in component tree and displays
 * user-friendly fallback UI with recovery options instead of crashing the entire app.
 */

import React from "react";
import {
  Container,
  Alert,
  Button,
  Text,
  Stack,
  Group,
  Code,
} from "@mantine/core";
import { IconAlertTriangle, IconRefresh, IconBug } from "@tabler/icons-react";
import ErrorReportService from "../../services/monitoring/ErrorReportService";
import { showSuccessNotification } from "../../utils/logging/errorNotifications";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.setState({
      error,
      errorInfo,
      errorId,
    });

    // Log error details to console for development
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught an error:", {
      errorId,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      location: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    // Store error context for potential reporting
    this.storeErrorContext(errorId, error, errorInfo);
  }

  storeErrorContext = async (errorId, error, errorInfo) => {
    try {
      const userContext = {
        userId: this.props.userId || "anonymous",
        sessionId: sessionStorage.getItem("codemaster_session_id"),
        lastAction: sessionStorage.getItem("codemaster_last_action"),
        currentRoute: window.location.pathname,
      };

      // Store comprehensive error report in IndexedDB
      await ErrorReportService.storeErrorReport({
        errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        section: this.props.section || "unknown",
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        userContext,
        errorType: "react_component",
        severity: this.determineSeverity(error, this.props.section),
      });
    } catch (storageError) {
      // eslint-disable-next-line no-console
      console.warn("Failed to store error context:", storageError);

      // Fallback to localStorage if IndexedDB fails
      try {
        const errorContext = {
          errorId,
          message: error.message,
          stack: error.stack,
          section: this.props.section || "unknown",
          timestamp: new Date().toISOString(),
        };

        const existingErrors = JSON.parse(
          localStorage.getItem("codemaster_errors") || "[]"
        );
        existingErrors.push(errorContext);
        const recentErrors = existingErrors.slice(-10);
        localStorage.setItem("codemaster_errors", JSON.stringify(recentErrors));
      } catch (fallbackError) {
        // eslint-disable-next-line no-console
        console.warn(
          "Failed to store error in localStorage fallback:",
          fallbackError
        );
      }
    }
  };

  determineSeverity = (error, section) => {
    // Determine error severity based on error type and section
    const criticalSections = ["Timer", "Database", "Session"];
    const highSections = ["Dashboard", "Strategy System", "Statistics"];

    if (criticalSections.some((s) => section.includes(s))) {
      return "high";
    } else if (highSections.some((s) => section.includes(s))) {
      return "medium";
    }

    // Check error message for severity indicators
    const errorMsg = error.message.toLowerCase();
    if (
      errorMsg.includes("network") ||
      errorMsg.includes("fetch") ||
      errorMsg.includes("timeout")
    ) {
      return "medium";
    } else if (
      errorMsg.includes("memory") ||
      errorMsg.includes("quota") ||
      errorMsg.includes("permission")
    ) {
      return "high";
    }

    return "low";
  };

  handleRetry = () => {
    // Clear error state to retry rendering the component
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  handleReload = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    console.log("ErrorBoundary: Attempting page reload...");
    
    // Try multiple reload methods to ensure it works
    try {
      // Method 1: Standard reload
      window.location.reload(true);
    } catch (error) {
      console.warn("Standard reload failed, trying alternative method:", error);
      // Method 2: Force navigation to current URL
      try {
        window.location.assign(window.location.href);
      } catch (error2) {
        console.warn("Alternative reload failed, trying location.replace:", error2);
        // Method 3: Replace current location
        try {
          window.location.replace(window.location.href);
        } catch (error3) {
          console.error("All reload methods failed:", error3);
          // Last resort: show user message
          if (typeof alert !== 'undefined') {
            alert("Please manually refresh the page to continue.");
          }
        }
      }
    }
  };

  handleReportProblem = async () => {
    try {
      // Import the ErrorRecoveryUI component dynamically for feedback collection
      // const { ErrorRecoveryUI } = await import('./ErrorRecoveryUI');

      // Show feedback collection modal
      const feedbackData = await this.showFeedbackModal();

      if (feedbackData) {
        // Store additional user feedback with the error report
        await ErrorReportService.addUserFeedback(
          this.state.errorId,
          feedbackData.feedback,
          feedbackData.reproductionSteps
        );
      }

      if (this.props.onReportProblem) {
        this.props.onReportProblem({
          errorId: this.state.errorId,
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          section: this.props.section,
          userFeedback: feedbackData,
        });
      }

      // Show success notification
      showSuccessNotification(
        "Thank you for reporting this issue. We'll investigate and improve CodeMaster.",
        { title: "Problem Report Submitted" }
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Failed to submit problem report:", error);

      // Fallback: just call the prop handler if available
      if (this.props.onReportProblem) {
        this.props.onReportProblem({
          errorId: this.state.errorId,
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          section: this.props.section,
        });
      }
    }
  };

  showFeedbackModal = () => {
    // Simple feedback collection using browser prompt for now
    // In a production app, this would show a proper modal dialog
    return new Promise((resolve) => {
      const feedback = prompt(
        "Please describe what you were doing when this error occurred (optional):"
      );

      const reproductionSteps = feedback ? [feedback] : [];

      resolve({
        feedback: feedback || "",
        reproductionSteps,
      });
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      const { fallback: CustomFallback, section = "Application" } = this.props;

      if (CustomFallback) {
        return (
          <CustomFallback
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            errorId={this.state.errorId}
            onRetry={this.handleRetry}
            onReload={this.handleReload}
            onReportProblem={this.handleReportProblem}
            section={section}
          />
        );
      }

      // Default fallback UI
      return (
        <Container size="sm" py="xl">
          <Alert
            icon={<IconAlertTriangle size="1.1rem" />}
            title={`${section} Error`}
            color="red"
            variant="light"
          >
            <Stack spacing="md">
              <Text size="sm">
                Something went wrong in this section of CodeMaster. Don&apos;t
                worry - your data is safe and this is just a temporary issue.
              </Text>

              {this.state.error && (
                <Text size="xs" c="dimmed">
                  <strong>Error:</strong> {this.state.error.message}
                </Text>
              )}

              {this.state.errorId && (
                <Code size="xs" c="dimmed">
                  Error ID: {this.state.errorId}
                </Code>
              )}

              <Group spacing="sm" mt="md">
                <Button
                  leftSection={<IconRefresh size="1rem" />}
                  variant="outline"
                  size="sm"
                  onClick={this.handleRetry}
                >
                  Try Again
                </Button>

                <Button variant="light" size="sm" onClick={this.handleReload}>
                  Reload Page
                </Button>

                {this.props.onReportProblem && (
                  <Button
                    leftSection={<IconBug size="1rem" />}
                    variant="subtle"
                    size="sm"
                    onClick={this.handleReportProblem}
                  >
                    Report Problem
                  </Button>
                )}
              </Group>

              {process.env.NODE_ENV === "development" && this.state.error && (
                <details style={{ marginTop: "1rem" }}>
                  <summary style={{ cursor: "pointer", fontSize: "0.875rem" }}>
                    Developer Info (click to expand)
                  </summary>
                  <Code block size="xs" mt="xs">
                    {this.state.error.stack}
                  </Code>
                  <Code block size="xs" mt="xs">
                    {this.state.errorInfo.componentStack}
                  </Code>
                </details>
              )}
            </Stack>
          </Alert>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
