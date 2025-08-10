/**
 * Comprehensive tests for TimerButton component
 * Tests timer functionality, user interactions, and Chrome extension integration
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import InjectedButton from '../timerbutton';

// Mock chrome extension APIs
const mockChrome = {
  storage: {
    local: {
      set: jest.fn((data, callback) => {
        if (callback) callback();
      })
    }
  },
  runtime: {
    sendMessage: jest.fn()
  }
};

// Mock console.log to avoid noise in tests
console.log = jest.fn();

describe('TimerButton Component', () => {
  beforeEach(() => {
    // Setup chrome mock
    global.chrome = mockChrome;
    jest.clearAllMocks();
    
    // Mock timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Component Rendering', () => {
    it('should render InjectedButton wrapper component', () => {
      // Act
      render(<InjectedButton />);

      // Assert
      expect(screen.getByText('Reset')).toBeInTheDocument();
      expect(screen.getByText('Submit')).toBeInTheDocument();
      // Timer should start at 00m:00s
      expect(screen.getByText('00m:00s')).toBeInTheDocument();
    });

    it('should render all timer control buttons', () => {
      // Act
      render(<InjectedButton />);

      // Assert
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
      
      const resetButton = screen.getByText('Reset');
      const timerButton = screen.getByText('00m:00s');
      const submitButton = screen.getByText('Submit');
      
      expect(resetButton).toBeInTheDocument();
      expect(timerButton).toBeInTheDocument();
      expect(submitButton).toBeInTheDocument();
    });

    it('should apply correct initial styles', () => {
      // Act
      render(<InjectedButton />);

      // Assert
      const resetButton = screen.getByText('Reset');
      const submitButton = screen.getByText('Submit');
      const timerButton = screen.getByText('00m:00s');

      expect(resetButton).toHaveStyle({ backgroundColor: '#000' });
      expect(submitButton).toHaveStyle({ backgroundColor: '#000' });
      // Timer should start with red color (not running) - CSS returns rgb format
      expect(timerButton).toHaveStyle({ color: 'rgb(255, 0, 0)' });
    });
  });

  describe('Timer Display Logic', () => {
    it('should format time correctly for seconds', () => {
      // Since we can't directly test internal state, we test through interaction
      // The component starts at 0 seconds, formatted as "00m:00s"
      render(<InjectedButton />);
      expect(screen.getByText('00m:00s')).toBeInTheDocument();
    });

    it('should format time correctly for minutes and seconds', () => {
      // This tests the formatting logic indirectly
      // We can't easily set internal time state, but we can verify the format pattern
      render(<InjectedButton />);
      
      const timerDisplay = screen.getByText(/\d{2}m:\d{2}s/);
      expect(timerDisplay).toBeInTheDocument();
    });

    it('should pad single digit values with zeros', () => {
      // Test that the format always shows two digits
      render(<InjectedButton />);
      
      const timerText = screen.getByText('00m:00s');
      expect(timerText.textContent).toMatch(/^\d{2}m:\d{2}s$/);
    });
  });

  describe('Button Interactions', () => {
    it('should handle Reset button click', () => {
      // Arrange
      render(<InjectedButton />);
      const resetButton = screen.getByText('Reset');

      // Act
      fireEvent.click(resetButton);

      // Assert - Should not throw error and component should remain stable
      expect(resetButton).toBeInTheDocument();
      expect(screen.getByText('00m:00s')).toBeInTheDocument();
    });

    it('should handle Timer button click', () => {
      // Arrange
      render(<InjectedButton />);
      const timerButton = screen.getByText('00m:00s');

      // Act
      fireEvent.click(timerButton);

      // Assert - Should not throw error
      expect(timerButton).toBeInTheDocument();
      // Component should remain stable
      expect(screen.getByText('Reset')).toBeInTheDocument();
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });

    it('should handle Submit button click and interact with Chrome storage', () => {
      // Arrange
      render(<InjectedButton />);
      const submitButton = screen.getByText('Submit');

      // Act
      fireEvent.click(submitButton);

      // Assert
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        { time: 0 }, // Initial time is 0
        expect.any(Function)
      );
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "navigate",
        navigate: true,
        route: "/Probtime",
        content: "",
        time: 0 // Math.floor(0 * 60) = 0
      });
    });

    it('should call console.log when saving to Chrome storage', () => {
      // Arrange
      render(<InjectedButton />);
      const submitButton = screen.getByText('Submit');

      // Act
      fireEvent.click(submitButton);

      // Wait for async operations
      act(() => {
        // Trigger the callback from chrome.storage.local.set
        const setCall = mockChrome.storage.local.set.mock.calls[0];
        if (setCall && setCall[1]) {
          setCall[1](); // Execute callback
        }
      });

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        "**limit saved to Chrome storage.",
        0
      );
    });
  });

  describe('Chrome Extension Integration', () => {
    it('should render without chrome API but fail on interaction', () => {
      // Arrange - Remove chrome from global
      delete global.chrome;
      
      // Act & Assert - Should not throw error when rendering
      expect(() => render(<InjectedButton />)).not.toThrow();
      
      // Component renders fine but will fail when chrome API is accessed
      const submitButton = screen.getByText('Submit');
      expect(submitButton).toBeInTheDocument();
      
      // This documents current behavior: component doesn't gracefully handle missing chrome
      // It will throw ReferenceError when chrome is accessed in handleSubmit
    });

    it('should work with properly mocked Chrome APIs', () => {
      // Arrange - Ensure proper chrome mock
      global.chrome = mockChrome;
      render(<InjectedButton />);
      const submitButton = screen.getByText('Submit');

      // Act
      fireEvent.click(submitButton);

      // Assert - Should work without errors
      expect(mockChrome.storage.local.set).toHaveBeenCalled();
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalled();
    });
  });

  describe('Timer State Management', () => {
    it('should display correct initial timer color', () => {
      // Note: Since handleTimerClick is empty, timerRunning never changes
      render(<InjectedButton />);
      const timerButton = screen.getByText('00m:00s');

      // Initially should be red (not running) - using rgb format as returned by JSDOM
      expect(timerButton).toHaveStyle({ color: 'rgb(255, 0, 0)' });
      
      // The component logic shows: timerRunning ? "green" : "red"
      // Since timerRunning starts as false and handleTimerClick is empty, it stays red
    });

    it('should maintain state after multiple interactions', () => {
      // Arrange
      render(<InjectedButton />);
      const resetButton = screen.getByText('Reset');
      const timerButton = screen.getByText('00m:00s');
      const submitButton = screen.getByText('Submit');

      // Act - Multiple interactions
      fireEvent.click(resetButton);
      fireEvent.click(timerButton);
      fireEvent.click(submitButton);
      fireEvent.click(resetButton);

      // Assert - Component should remain stable
      expect(resetButton).toBeInTheDocument();
      expect(timerButton).toBeInTheDocument();
      expect(submitButton).toBeInTheDocument();
      expect(screen.getByText('00m:00s')).toBeInTheDocument();
    });
  });

  describe('Component Structure and Accessibility', () => {
    it('should have proper button elements for accessibility', () => {
      // Act
      render(<InjectedButton />);

      // Assert
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3);
      
      // All buttons should be clickable
      buttons.forEach(button => {
        expect(button).toBeEnabled();
      });
    });

    it('should have correct container structure', () => {
      // Act
      render(<InjectedButton />);

      // Assert
      const container = screen.getByText('Reset').parentElement;
      expect(container).toHaveClass('btn');
      expect(container.children).toHaveLength(3);
    });

    it('should maintain consistent component hierarchy', () => {
      // Act
      render(<InjectedButton />);

      // Assert - InjectedButton wraps TimerButton
      const container = screen.getByText('Reset').closest('.btn');
      expect(container).toBeInTheDocument();
      
      // Should contain all expected elements
      expect(container).toContainElement(screen.getByText('Reset'));
      expect(container).toContainElement(screen.getByText('00m:00s'));
      expect(container).toContainElement(screen.getByText('Submit'));
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle rapid button clicks', () => {
      // Arrange
      render(<InjectedButton />);
      const submitButton = screen.getByText('Submit');

      // Act - Rapid clicks
      for (let i = 0; i < 10; i++) {
        fireEvent.click(submitButton);
      }

      // Assert - Should not throw errors and maintain state
      expect(submitButton).toBeInTheDocument();
      expect(mockChrome.storage.local.set).toHaveBeenCalledTimes(10);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledTimes(10);
    });

    it('should handle component re-renders gracefully', () => {
      // Arrange
      const { rerender } = render(<InjectedButton />);

      // Act - Force re-render
      rerender(<InjectedButton />);
      rerender(<InjectedButton />);

      // Assert - Should maintain functionality
      expect(screen.getByText('Reset')).toBeInTheDocument();
      expect(screen.getByText('00m:00s')).toBeInTheDocument();
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });

    it('should require complete Chrome API for submit functionality', () => {
      // This test documents that the component requires chrome.storage and chrome.runtime
      // to function properly during submit operations
      
      // Arrange - Complete chrome mock
      global.chrome = mockChrome;
      render(<InjectedButton />);
      const submitButton = screen.getByText('Submit');

      // Act
      fireEvent.click(submitButton);

      // Assert - Both APIs should be called when available
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        { time: 0 },
        expect.any(Function)
      );
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "navigate",
        navigate: true,
        route: "/Probtime",
        content: "",
        time: 0
      });
    });
  });
});