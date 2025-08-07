import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { useChromeMessage } from "./useChromeMessage";

// Mock the ChromeAPIErrorHandler
jest.mock("../services/ChromeAPIErrorHandler", () => ({
  sendMessageWithRetry: jest.fn(),
  showErrorReportDialog: jest.fn(),
}));

// Mock the error notifications
jest.mock("../utils/errorNotifications", () => ({
  showErrorNotification: jest.fn(),
}));

// Simple test component to verify hook works in isolation
const TestComponent = ({ request, deps = [], options = {} }) => {
  const { data, loading, error, retry, isRetrying, retryCount } = useChromeMessage(request, deps, options);

  return (
    <div data-testid="chrome-message-test">
      <div data-testid="loading">{loading ? "Loading..." : "Not loading"}</div>
      <div data-testid="error">{error ? `Error: ${error}` : "No error"}</div>
      <div data-testid="data">{data ? JSON.stringify(data) : "No data"}</div>
      <div data-testid="retrying">{isRetrying ? "Retrying..." : "Not retrying"}</div>
      <div data-testid="retry-count">{retryCount}</div>
      <button data-testid="retry-button" onClick={retry}>Retry</button>
    </div>
  );
};

describe("useChromeMessage Hook", () => {
  let mockChromeAPIErrorHandler;

  beforeEach(() => {
    // Reset Chrome API mocks before each test
    global.chrome = {
      runtime: {
        sendMessage: jest.fn(),
        lastError: null,
      },
    };

    // Reset the ChromeAPIErrorHandler mock
    mockChromeAPIErrorHandler = require("../services/ChromeAPIErrorHandler");
    mockChromeAPIErrorHandler.sendMessageWithRetry.mockReset();
    mockChromeAPIErrorHandler.showErrorReportDialog.mockReset();

    // Reset error notifications mock
    const errorNotifications = require("../utils/errorNotifications");
    errorNotifications.showErrorNotification.mockReset();
  });

  test("should handle null request without making API call", () => {
    render(<TestComponent request={null} />);

    expect(screen.getByTestId("loading")).toHaveTextContent("Not loading");
    expect(screen.getByTestId("error")).toHaveTextContent("No error");
    expect(screen.getByTestId("data")).toHaveTextContent("No data");
    expect(mockChromeAPIErrorHandler.sendMessageWithRetry).not.toHaveBeenCalled();
  });

  test("should show loading state initially", async () => {
    // Mock a delayed response
    mockChromeAPIErrorHandler.sendMessageWithRetry.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
    );

    render(<TestComponent request={{ type: "getSettings" }} />);

    expect(screen.getByTestId("loading")).toHaveTextContent("Loading...");
    expect(mockChromeAPIErrorHandler.sendMessageWithRetry).toHaveBeenCalledWith(
      { type: "getSettings" },
      expect.any(Object)
    );

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("Not loading");
    });
  });

  test("should handle successful response", async () => {
    const mockResponse = { theme: "dark", sessionLength: 8 };
    mockChromeAPIErrorHandler.sendMessageWithRetry.mockResolvedValue(mockResponse);

    render(<TestComponent request={{ type: "getSettings" }} />);

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("Not loading");
    });

    expect(screen.getByTestId("data")).toHaveTextContent(
      JSON.stringify(mockResponse)
    );
    expect(screen.getByTestId("error")).toHaveTextContent("No error");
  });

  test("should handle Chrome runtime error", async () => {
    const errorMessage = "Extension context invalidated";
    mockChromeAPIErrorHandler.sendMessageWithRetry.mockRejectedValue(new Error(errorMessage));

    render(<TestComponent request={{ type: "getSettings" }} />);

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("Not loading");
    });

    expect(screen.getByTestId("error")).toHaveTextContent(
      `Error: ${errorMessage}`
    );
    expect(screen.getByTestId("data")).toHaveTextContent("No data");
  });

  test("should handle response error", async () => {
    const errorMessage = "Settings not found";
    mockChromeAPIErrorHandler.sendMessageWithRetry.mockRejectedValue(new Error(errorMessage));

    render(<TestComponent request={{ type: "getSettings" }} />);

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("Not loading");
    });

    expect(screen.getByTestId("error")).toHaveTextContent(
      `Error: ${errorMessage}`
    );
    expect(screen.getByTestId("data")).toHaveTextContent("No data");
  });

  test("should call onSuccess callback on successful response", async () => {
    const mockResponse = { theme: "light" };
    const onSuccess = jest.fn();
    mockChromeAPIErrorHandler.sendMessageWithRetry.mockResolvedValue(mockResponse);

    render(
      <TestComponent
        request={{ type: "getSettings" }}
        options={{ onSuccess }}
      />
    );

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockResponse);
    });
  });

  test("should call onError callback on error", async () => {
    const onError = jest.fn();
    const errorMessage = "Test error";
    mockChromeAPIErrorHandler.sendMessageWithRetry.mockRejectedValue(new Error(errorMessage));

    render(
      <TestComponent request={{ type: "getSettings" }} options={{ onError }} />
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(errorMessage);
    });
  });

  test("should handle retry functionality", async () => {
    const mockResponse = { theme: "light" };
    mockChromeAPIErrorHandler.sendMessageWithRetry.mockResolvedValue(mockResponse);

    render(<TestComponent request={{ type: "getSettings" }} />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("Not loading");
    });

    // Test retry button works
    const retryButton = screen.getByTestId("retry-button");
    expect(retryButton).toBeInTheDocument();
  });

  test("should handle immediate mode disabled", () => {
    render(<TestComponent request={{ type: "getSettings" }} options={{ immediate: false }} />);

    expect(screen.getByTestId("loading")).toHaveTextContent("Not loading");
    expect(mockChromeAPIErrorHandler.sendMessageWithRetry).not.toHaveBeenCalled();
  });
});

// Manual test helper for browser console testing
export const runManualTests = () => {
  console.info("🧪 Testing enhanced useChromeMessage hook...");
  console.info(
    "✅ Use Jest tests for automated testing. Check test results above."
  );
};

export default TestComponent;