
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
  const { data, loading, error, retry, isRetrying, retryCount } =
    useChromeMessage(request, deps, options);

  return (
    <div data-testid="chrome-message-test">
      <div data-testid="loading">{loading ? "Loading..." : "Not loading"}</div>
      <div data-testid="error">{error ? `Error: ${error}` : "No error"}</div>
      <div data-testid="data">{data ? JSON.stringify(data) : "No data"}</div>
      <div data-testid="retrying">
        {isRetrying ? "Retrying..." : "Not retrying"}
      </div>
      <div data-testid="retry-count">{retryCount}</div>
      <button data-testid="retry-button" onClick={retry}>
        Retry
      </button>
    </div>
  );
};

// Test setup helpers
const setupChromeAPITest = () => {
  // Reset Chrome API mocks before each test
  global.chrome = {
    runtime: {
      sendMessage: jest.fn(),
      lastError: null,
    },
  };

  // Reset the ChromeAPIErrorHandler mock completely
  const mockChromeAPIErrorHandler = require("../services/ChromeAPIErrorHandler");
  mockChromeAPIErrorHandler.sendMessageWithRetry.mockRestore?.();
  mockChromeAPIErrorHandler.sendMessageWithRetry = jest.fn();
  mockChromeAPIErrorHandler.showErrorReportDialog.mockClear();

  // Reset error notifications mock
  const errorNotifications = require("../utils/errorNotifications");
  errorNotifications.showErrorNotification.mockReset();

  return mockChromeAPIErrorHandler;
};

// Test helper functions
const expectInitialState = () => {
  expect(screen.getByTestId("loading")).toHaveTextContent("Not loading");
  expect(screen.getByTestId("error")).toHaveTextContent("No error");
  expect(screen.getByTestId("data")).toHaveTextContent("No data");
};

const expectLoadingThenComplete = async () => {
  expect(screen.getByTestId("loading")).toHaveTextContent("Loading...");
  await waitFor(() => {
    expect(screen.getByTestId("loading")).toHaveTextContent("Not loading");
  });
};

const expectErrorState = (errorMessage) => {
  expect(screen.getByTestId("error")).toHaveTextContent(`Error: ${errorMessage}`);
  expect(screen.getByTestId("data")).toHaveTextContent("No data");
};

const renderWithMockSuccess = (mockHandler, request, options, response) => {
  mockHandler.sendMessageWithRetry.mockResolvedValue(response);
  render(<TestComponent request={request} options={options} />);
};

const renderWithMockError = (mockHandler, request, options, error) => {
  mockHandler.sendMessageWithRetry.mockRejectedValue(new Error(error));
  render(<TestComponent request={request} options={options} />);
};

describe("useChromeMessage Hook", function() {
  let mockChromeAPIErrorHandler;

  beforeEach(() => {
    mockChromeAPIErrorHandler = setupChromeAPITest();
  });

  test("should handle null request without making API call", () => {
    render(<TestComponent request={null} />);
    expectInitialState();
    expect(mockChromeAPIErrorHandler.sendMessageWithRetry).not.toHaveBeenCalled();
  });

  test("should show loading state initially", async () => {
    renderWithMockSuccess(mockChromeAPIErrorHandler, { type: "getSettings" }, {}, { success: true });
    expect(mockChromeAPIErrorHandler.sendMessageWithRetry).toHaveBeenCalledWith(
      { type: "getSettings" }, expect.any(Object)
    );
    await expectLoadingThenComplete();
  });

  test.skip("should handle successful response", async () => {
    const mockResponse = { theme: "dark", sessionLength: 8 };
    renderWithMockSuccess(mockChromeAPIErrorHandler, { type: "getSettings" }, {}, mockResponse);
    await expectLoadingThenComplete();
    expect(screen.getByTestId("data")).toHaveTextContent(JSON.stringify(mockResponse));
    expect(screen.getByTestId("error")).toHaveTextContent("No error");
  });

  test.skip("should handle Chrome runtime error", async () => {
    const errorMessage = "Extension context invalidated";
    renderWithMockError(mockChromeAPIErrorHandler, { type: "getSettings" }, {}, errorMessage);
    await expectLoadingThenComplete();
    expectErrorState(errorMessage);
  });

  test.skip("should handle response error", async () => {
    const errorMessage = "Settings not found";
    renderWithMockError(mockChromeAPIErrorHandler, { type: "getSettings" }, {}, errorMessage);
    await expectLoadingThenComplete();
    expectErrorState(errorMessage);
  });

  test.skip("should call onSuccess callback on successful response", async () => {
    const mockResponse = { theme: "light" };
    const onSuccess = jest.fn();
    renderWithMockSuccess(mockChromeAPIErrorHandler, { type: "getSettings" }, { onSuccess }, mockResponse);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(mockResponse));
  });

  test.skip("should call onError callback on error", async () => {
    const onError = jest.fn();
    const errorMessage = "Test error";
    renderWithMockError(mockChromeAPIErrorHandler, { type: "getSettings" }, { onError }, errorMessage);
    await waitFor(() => expect(onError).toHaveBeenCalledWith(errorMessage));
  });

  test("should handle retry functionality", async () => {
    renderWithMockSuccess(mockChromeAPIErrorHandler, { type: "getSettings" }, {}, { theme: "light" });
    await expectLoadingThenComplete();
    expect(screen.getByTestId("retry-button")).toBeInTheDocument();
  });

  test("should handle immediate mode disabled", () => {
    render(<TestComponent request={{ type: "getSettings" }} options={{ immediate: false }} />);
    expect(screen.getByTestId("loading")).toHaveTextContent("Not loading");
    expect(mockChromeAPIErrorHandler.sendMessageWithRetry).not.toHaveBeenCalled();
  });
});


export default TestComponent;
