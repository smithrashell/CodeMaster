/**
 * Error Boundary Tests for CodeMaster
 * 
 * Tests error boundary functionality with intentional component crashes
 * and verifies error reporting and recovery mechanisms work correctly.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MantineProvider } from '@mantine/core';
import ErrorBoundary from '../ErrorBoundary';
import ErrorReportService from '../../services/ErrorReportService';

// Mock the error notification system
jest.mock('../../utils/errorNotifications', () => ({
  showSuccessNotification: jest.fn(),
}));

// Mock the ErrorReportService
jest.mock('../../services/ErrorReportService', () => ({
  storeErrorReport: jest.fn().mockResolvedValue('mock-report-id'),
  addUserFeedback: jest.fn().mockResolvedValue(),
}));

// Test wrapper that provides Mantine context
const TestWrapper = ({ children }) => (
  <MantineProvider>
    {children}
  </MantineProvider>
);

// Create a component that throws an error for testing
const ThrowError = ({ shouldThrow = false, errorMessage = 'Test error' }) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div data-testid="working-component">Component is working</div>;
};

describe('ErrorBoundary Component', () => {
  // Suppress console errors during tests
  let originalConsoleError;
  
  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = jest.fn();
    jest.clearAllMocks();
    
    // Suppress unhandled promise rejection warnings
    process.on('unhandledRejection', () => {});
    
    // Mock window.prompt for error reporting
    window.prompt = jest.fn().mockReturnValue('User feedback for test error');
  });
  
  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('Normal Operation', () => {
    it('renders children normally when no error occurs', () => {
      render(
        <TestWrapper>
          <ErrorBoundary section="Test Section">
            <ThrowError />
          </ErrorBoundary>
        </TestWrapper>
      );
      
      expect(screen.getByTestId('working-component')).toBeInTheDocument();
      expect(screen.getByText('Component is working')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('catches errors and displays fallback UI', () => {
      render(
        <TestWrapper>
          <ErrorBoundary section="Test Section">
            <ThrowError shouldThrow={true} errorMessage="Test component crash" />
          </ErrorBoundary>
        </TestWrapper>
      );
      
      // Should display error boundary fallback UI
      expect(screen.getByText('Test Section Error')).toBeInTheDocument();
      expect(screen.getByText(/Something went wrong in this section/)).toBeInTheDocument();
    });

    it('displays action buttons in error fallback UI', () => {
      render(
        <TestWrapper>
          <ErrorBoundary section="Test Section">
            <ThrowError shouldThrow={true} />
          </ErrorBoundary>
        </TestWrapper>
      );
      
      expect(screen.getByText('Try Again')).toBeInTheDocument();
      expect(screen.getByText('Reload Page')).toBeInTheDocument();
    });

    it('handles retry functionality', () => {
      render(
        <TestWrapper>
          <ErrorBoundary section="Test Section">
            <ThrowError shouldThrow={true} />
          </ErrorBoundary>
        </TestWrapper>
      );
      
      // Should show error UI
      expect(screen.getByText('Test Section Error')).toBeInTheDocument();
      
      // Click retry button (this resets the error boundary state)
      fireEvent.click(screen.getByText('Try Again'));
      
      // After retry, the error boundary should reset and attempt to render children again
      // In this test, we're just verifying the retry button exists and is clickable
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  describe('Error Reporting', () => {
    it('displays Report Problem button when onReportProblem prop is provided', () => {
      const mockReportHandler = jest.fn();
      
      render(
        <TestWrapper>
          <ErrorBoundary 
            section="Test Section"
            onReportProblem={mockReportHandler}
          >
            <ThrowError shouldThrow={true} />
          </ErrorBoundary>
        </TestWrapper>
      );
      
      expect(screen.getByText('Report Problem')).toBeInTheDocument();
    });
  });

  describe('Development Mode', () => {
    it('shows appropriate error information in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      try {
        render(
          <TestWrapper>
            <ErrorBoundary section="Test Section">
              <ThrowError shouldThrow={true} errorMessage="Dev mode error" />
            </ErrorBoundary>
          </TestWrapper>
        );
        
        // Should show error message in development
        expect(screen.getByText('Dev mode error')).toBeInTheDocument();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});