import { useState } from "react";
import {
  IconRefresh,
  IconClock,
} from "@tabler/icons-react";

// Recovery action handlers
export const recoveryActions = {
  clearTemp: (setDiagnosticResults) => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("codemaster_temp_") || key.startsWith("temp_")) {
        localStorage.removeItem(key);
      }
    });
    setDiagnosticResults((prev) => ({ ...prev, clearTemp: "success" }));
  },

  resetTimer: (setDiagnosticResults) => {
    localStorage.removeItem("timer_state");
    sessionStorage.removeItem("current_timer");
    setDiagnosticResults((prev) => ({ ...prev, resetTimer: "success" }));
  },

  refreshDashboard: (setDiagnosticResults) => {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({ type: "clearCache" }, (_response) => {
          if (chrome.runtime.lastError) {
            console.warn("Clear cache failed:", chrome.runtime.lastError.message);
          }
        });
      }
      setDiagnosticResults((prev) => ({ ...prev, refreshDashboard: "success" }));
    } catch (chromeError) {
      setDiagnosticResults((prev) => ({ ...prev, refreshDashboard: "failed" }));
    }
  }
};

// Function to generate recovery steps based on section
export const generateRecoverySteps = (section, onRetry, runDiagnosticRecovery) => {
  const baseSteps = [
    {
      title: "Quick Retry",
      description: "Try reloading the component that failed",
      action: onRetry,
      icon: IconRefresh,
      color: "blue",
    },
    {
      title: "Clear Local Data",
      description: "Clear temporary data that might be causing issues",
      action: () => runDiagnosticRecovery("clearTemp"),
      icon: IconRefresh,
      color: "orange",
    },
    {
      title: "Full Page Reload",
      description: "Reload the entire application to reset state",
      action: () => window.location.reload(),
      icon: IconRefresh,
      color: "red",
    },
  ];

  if (section === "Timer") {
    baseSteps.splice(1, 0, {
      title: "Reset Timer State",
      description: "Clear timer data and restart with fresh state",
      action: () => runDiagnosticRecovery("resetTimer"),
      icon: IconClock,
      color: "yellow",
    });
  } else if (section === "Dashboard") {
    baseSteps.splice(1, 0, {
      title: "Refresh Dashboard Data",
      description: "Clear dashboard cache and reload data",
      action: () => runDiagnosticRecovery("refreshDashboard"),
      icon: IconRefresh,
      color: "green",
    });
  }

  return baseSteps;
};

// Custom hook for recovery operations
export const useRecoveryOperations = (section, onRetry) => {
  const [isRecovering, setIsRecovering] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState({});

  const runDiagnosticRecovery = (type) => {
    setIsRecovering(true);

    try {
      const action = recoveryActions[type];
      if (action) {
        action(setDiagnosticResults);
      }

      setTimeout(() => {
        setIsRecovering(false);
        if (onRetry) onRetry();
      }, 1000);
    } catch (recoveryError) {
      console.error("Recovery action failed:", recoveryError);
      setDiagnosticResults((prev) => ({ ...prev, [type]: "failed" }));
      setIsRecovering(false);
    }
  };

  const getRecoverySteps = () => {
    return generateRecoverySteps(section, onRetry, runDiagnosticRecovery);
  };

  return { isRecovering, diagnosticResults, runDiagnosticRecovery, getRecoverySteps };
};

// Custom hook for system diagnostics
export const useDiagnostics = () => {
  const [diagnosticsRun, setDiagnosticsRun] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState({});

  const runDiagnostics = () => {
    setDiagnosticsRun(true);
    const results = {};

    try {
      localStorage.setItem("test", "test");
      localStorage.removeItem("test");
      results.localStorage = "working";
    } catch {
      results.localStorage = "failed";
    }

    try {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        results.chromeAPI = "available";
      } else {
        results.chromeAPI = "unavailable";
      }
    } catch {
      results.chromeAPI = "failed";
    }

    try {
      if (performance && performance.memory) {
        const memoryInfo = performance.memory;
        const usedPercent = (memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize) * 100;
        results.memory = usedPercent > 90 ? "high" : "normal";
      } else {
        results.memory = "unknown";
      }
    } catch {
      results.memory = "failed";
    }

    setDiagnosticResults(results);
  };

  return { diagnosticsRun, diagnosticResults, runDiagnostics };
};

// Function to generate report data
export const generateReportData = ({ errorId, error, errorInfo, section, reportText, diagnosticResults }) => {
  return {
    errorId,
    error: error?.message,
    stack: error?.stack,
    componentStack: errorInfo?.componentStack,
    section,
    userDescription: reportText,
    diagnostics: diagnosticResults,
    url: window.location.href,
    timestamp: new Date().toISOString(),
  };
};

// Function to handle error report generation and storage
export const handleErrorReport = (reportData, onReportProblem, onClose) => {
  if (onReportProblem) {
    onReportProblem(reportData);
  }

  try {
    const reports = JSON.parse(localStorage.getItem("codemaster_error_reports") || "[]");
    reports.push(reportData);
    localStorage.setItem("codemaster_error_reports", JSON.stringify(reports.slice(-5)));
  } catch (storageError) {
    console.warn("Failed to store error report:", storageError);
  }

  onClose();
};
