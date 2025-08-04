import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useChromeMessage } from './useChromeMessage';

// Simple test component to verify hook works in isolation
const TestComponent = ({ request, deps = [], options = {} }) => {
  const { data, loading, error } = useChromeMessage(request, deps, options);

  return (
    <div data-testid="chrome-message-test">
      <div data-testid="loading">{loading ? 'Loading...' : 'Not loading'}</div>
      <div data-testid="error">{error ? `Error: ${error}` : 'No error'}</div>
      <div data-testid="data">{data ? JSON.stringify(data) : 'No data'}</div>
    </div>
  );
};

describe('useChromeMessage Hook', () => {
  beforeEach(() => {
    // Reset Chrome API mocks before each test
    global.chrome = {
      runtime: {
        sendMessage: jest.fn(),
        lastError: null
      }
    };
  });

  test('should handle null request without making API call', () => {
    render(<TestComponent request={null} />);
    
    expect(screen.getByTestId('loading')).toHaveTextContent('Not loading');
    expect(screen.getByTestId('error')).toHaveTextContent('No error');
    expect(screen.getByTestId('data')).toHaveTextContent('No data');
    expect(global.chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  test('should show loading state initially', () => {
    global.chrome.runtime.sendMessage.mockImplementation(() => {
      // Don't call callback immediately to test loading state
    });

    render(<TestComponent request={{ type: "getSettings" }} />);
    
    expect(screen.getByTestId('loading')).toHaveTextContent('Loading...');
    expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: "getSettings" },
      expect.any(Function)
    );
  });

  test('should handle successful response', async () => {
    const mockResponse = { theme: 'dark', sessionLength: 8 };
    global.chrome.runtime.sendMessage.mockImplementation((request, callback) => {
      setTimeout(() => callback(mockResponse), 0);
    });

    render(<TestComponent request={{ type: "getSettings" }} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not loading');
    });
    
    expect(screen.getByTestId('data')).toHaveTextContent(JSON.stringify(mockResponse));
    expect(screen.getByTestId('error')).toHaveTextContent('No error');
  });

  test('should handle Chrome runtime error', async () => {
    global.chrome.runtime.sendMessage.mockImplementation((request, callback) => {
      global.chrome.runtime.lastError = { message: 'Extension context invalidated' };
      setTimeout(() => callback(), 0);
    });

    render(<TestComponent request={{ type: "getSettings" }} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not loading');
    });
    
    expect(screen.getByTestId('error')).toHaveTextContent('Error: Extension context invalidated');
    expect(screen.getByTestId('data')).toHaveTextContent('No data');
  });

  test('should handle response error', async () => {
    const errorResponse = { error: 'Settings not found' };
    global.chrome.runtime.sendMessage.mockImplementation((request, callback) => {
      setTimeout(() => callback(errorResponse), 0);
    });

    render(<TestComponent request={{ type: "getSettings" }} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Not loading');
    });
    
    expect(screen.getByTestId('error')).toHaveTextContent('Error: Settings not found');
    expect(screen.getByTestId('data')).toHaveTextContent('No data');
  });

  test('should call onSuccess callback on successful response', async () => {
    const mockResponse = { theme: 'light' };
    const onSuccess = jest.fn();
    
    global.chrome.runtime.sendMessage.mockImplementation((request, callback) => {
      setTimeout(() => callback(mockResponse), 0);
    });

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

  test('should call onError callback on error', async () => {
    const onError = jest.fn();
    
    global.chrome.runtime.sendMessage.mockImplementation((request, callback) => {
      global.chrome.runtime.lastError = { message: 'Test error' };
      setTimeout(() => callback(), 0);
    });

    render(
      <TestComponent 
        request={{ type: "getSettings" }} 
        options={{ onError }}
      />
    );
    
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Test error');
    });
  });
});

// Manual test helper for browser console testing
export const runManualTests = () => {
  console.info('🧪 Testing useChromeMessage hook...');
  console.info('✅ Use Jest tests for automated testing. Check test results above.');
};

export default TestComponent;