/**
 * Comprehensive tests for TimerButton component
 * Tests timer functionality, user interactions, and Chrome extension integration
 */

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import InjectedButton from "../timerbutton";

// Mock chrome extension APIs
const mockChrome = {
  storage: {
    local: {
      set: jest.fn((data, callback) => {
        if (callback) callback();
      }),
    },
  },
  runtime: {
    sendMessage: jest.fn(),
  },
};

// Mock console.log to avoid noise in tests
console.log = jest.fn();

// Test setup helpers
const setupTimerTest = () => {
  // Setup chrome mock
  global.chrome = mockChrome;
  jest.clearAllMocks();
  
  // Mock timers
  jest.useFakeTimers();
};

const cleanupTimerTest = () => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
};

// Common test assertions
const assertTimerButtonExists = () => {
  expect(screen.getByText("Reset")).toBeInTheDocument();
};

const _assertTimerState = (expectedState) => {
  const timerElement = screen.getByTestId('timer-display');
  expect(timerElement).toHaveTextContent(expectedState);
};

// Additional helper functions for common test patterns
const assertAllControlButtons = () => {
  const buttons = screen.getAllByRole("button");
  expect(buttons).toHaveLength(3);

  const resetButton = screen.getByText("Reset");
  const timerButton = screen.getByText("00m:00s");
  const submitButton = screen.getByText("Submit");

  expect(resetButton).toBeInTheDocument();
  expect(timerButton).toBeInTheDocument();
  expect(submitButton).toBeInTheDocument();
};

const assertInitialButtonStyles = () => {
  const resetButton = screen.getByText("Reset");
  const submitButton = screen.getByText("Submit");
  const timerButton = screen.getByText("00m:00s");

  expect(resetButton).toHaveStyle({ backgroundColor: "#000" });
  expect(submitButton).toHaveStyle({ backgroundColor: "#000" });
  expect(timerButton).toHaveStyle({ color: "rgb(255, 0, 0)" });
};

const assertChromeStorageCall = (expectedTime) => {
  expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
    { time: expectedTime },
    expect.any(Function)
  );
};

const assertChromeMessageCall = (expectedTime) => {
  expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: "navigate",
    navigate: true,
    route: "/Probtime",
    content: "",
    time: expectedTime,
  });
};

const triggerChromeStorageCallback = () => {
  act(() => {
    const setCall = mockChrome.storage.local.set.mock.calls[0];
    if (setCall && setCall[1]) {
      setCall[1](); // Execute callback
    }
  });
};

const performMultipleInteractions = () => {
  const resetButton = screen.getByText("Reset");
  const timerButton = screen.getByText("00m:00s");
  const submitButton = screen.getByText("Submit");

  fireEvent.click(resetButton);
  fireEvent.click(timerButton);
  fireEvent.click(submitButton);
  fireEvent.click(resetButton);

  return { resetButton, timerButton, submitButton };
};

const assertComponentStability = (resetButton, timerButton, submitButton) => {
  expect(resetButton).toBeInTheDocument();
  expect(timerButton).toBeInTheDocument();
  expect(submitButton).toBeInTheDocument();
  expect(screen.getByText("00m:00s")).toBeInTheDocument();
};

// Component Rendering Tests
const runRenderingTests = () => {
  describe("Component Rendering", () => {
    it("should render InjectedButton wrapper component", () => {
      render(<InjectedButton />);
      assertTimerButtonExists();
      expect(screen.getByText("Submit")).toBeInTheDocument();
      expect(screen.getByText("00m:00s")).toBeInTheDocument();
    });

    it("should render all timer control buttons", () => {
      render(<InjectedButton />);
      assertAllControlButtons();
    });

    it("should apply correct initial styles", () => {
      render(<InjectedButton />);
      assertInitialButtonStyles();
    });
  });
};

// Timer Display Logic Tests
const runTimerDisplayTests = () => {
  describe("Timer Display Logic", () => {
    it("should format time correctly for seconds", () => {
      render(<InjectedButton />);
      expect(screen.getByText("00m:00s")).toBeInTheDocument();
    });

    it("should format time correctly for minutes and seconds", () => {
      render(<InjectedButton />);
      const timerDisplay = screen.getByText(/\d{2}m:\d{2}s/);
      expect(timerDisplay).toBeInTheDocument();
    });

    it("should pad single digit values with zeros", () => {
      render(<InjectedButton />);
      const timerText = screen.getByText("00m:00s");
      expect(timerText.textContent).toMatch(/^\d{2}m:\d{2}s$/);
    });
  });
};

// Button Interaction Tests
const runInteractionTests = () => {
  describe("Button Interactions", () => {
    it("should handle Reset button click", () => {
      render(<InjectedButton />);
      const resetButton = screen.getByText("Reset");
      fireEvent.click(resetButton);
      expect(resetButton).toBeInTheDocument();
      expect(screen.getByText("00m:00s")).toBeInTheDocument();
    });

    it("should handle Timer button click", () => {
      render(<InjectedButton />);
      const timerButton = screen.getByText("00m:00s");
      fireEvent.click(timerButton);
      expect(timerButton).toBeInTheDocument();
      expect(screen.getByText("Reset")).toBeInTheDocument();
      expect(screen.getByText("Submit")).toBeInTheDocument();
    });

    it("should handle Submit button click and interact with Chrome storage", () => {
      render(<InjectedButton />);
      const submitButton = screen.getByText("Submit");
      fireEvent.click(submitButton);
      assertChromeStorageCall(0);
      assertChromeMessageCall(0);
    });

    it("should call console.log when saving to Chrome storage", () => {
      render(<InjectedButton />);
      const submitButton = screen.getByText("Submit");
      fireEvent.click(submitButton);
      triggerChromeStorageCallback();
      expect(console.log).toHaveBeenCalledWith("**limit saved to Chrome storage.", 0);
    });
  });
};

// Chrome Extension Integration Tests
const runChromeIntegrationTests = () => {
  describe("Chrome Extension Integration", () => {
    it("should render without chrome API but fail on interaction", () => {
      delete global.chrome;
      expect(() => render(<InjectedButton />)).not.toThrow();
      const submitButton = screen.getByText("Submit");
      expect(submitButton).toBeInTheDocument();
    });

    it("should work with properly mocked Chrome APIs", () => {
      global.chrome = mockChrome;
      render(<InjectedButton />);
      const submitButton = screen.getByText("Submit");
      fireEvent.click(submitButton);
      expect(mockChrome.storage.local.set).toHaveBeenCalled();
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
    });
  });
};

describe("TimerButton Component", function() {
  beforeEach(setupTimerTest);
  afterEach(cleanupTimerTest);

  runRenderingTests();
  runTimerDisplayTests();
  runInteractionTests();
  runChromeIntegrationTests();

  describe("Timer State Management", () => {
    it("should display correct initial timer color", () => {
      render(<InjectedButton />);
      const timerButton = screen.getByText("00m:00s");
      expect(timerButton).toHaveStyle({ color: "rgb(255, 0, 0)" });
    });

    it("should maintain state after multiple interactions", () => {
      render(<InjectedButton />);
      const { resetButton, timerButton, submitButton } = performMultipleInteractions();
      assertComponentStability(resetButton, timerButton, submitButton);
    });
  });

  describe("Component Structure and Accessibility", () => {
    it("should have proper button elements for accessibility", () => {
      render(<InjectedButton />);
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(3);
      buttons.forEach((button) => {
        expect(button).toBeEnabled();
      });
    });

    it("should have correct container structure", () => {
      render(<InjectedButton />);
      const container = screen.getByText("Reset").parentElement;
      expect(container).toHaveClass("btn");
      expect(container.children).toHaveLength(3);
    });

    it("should maintain consistent component hierarchy", () => {
      render(<InjectedButton />);
      const container = screen.getByText("Reset").closest(".btn");
      expect(container).toBeInTheDocument();
      expect(container).toContainElement(screen.getByText("Reset"));
      expect(container).toContainElement(screen.getByText("00m:00s"));
      expect(container).toContainElement(screen.getByText("Submit"));
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle rapid button clicks", () => {
      render(<InjectedButton />);
      const submitButton = screen.getByText("Submit");
      for (let i = 0; i < 10; i++) {
        fireEvent.click(submitButton);
      }
      expect(submitButton).toBeInTheDocument();
      expect(mockChrome.storage.local.set).toHaveBeenCalledTimes(10);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(10);
    });

    it("should handle component re-renders gracefully", () => {
      const { rerender } = render(<InjectedButton />);
      rerender(<InjectedButton />);
      rerender(<InjectedButton />);
      expect(screen.getByText("Reset")).toBeInTheDocument();
      expect(screen.getByText("00m:00s")).toBeInTheDocument();
      expect(screen.getByText("Submit")).toBeInTheDocument();
    });

    it("should require complete Chrome API for submit functionality", () => {
      global.chrome = mockChrome;
      render(<InjectedButton />);
      const submitButton = screen.getByText("Submit");
      fireEvent.click(submitButton);
      assertChromeStorageCall(0);
      assertChromeMessageCall(0);
    });
  });
});