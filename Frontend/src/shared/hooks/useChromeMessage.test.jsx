import React from 'react';
import { useChromeMessage } from './useChromeMessage';

// Simple test component to verify hook works in isolation
const TestComponent = ({ request, deps = [] }) => {
  const { data, loading, error } = useChromeMessage(request, deps);

  return (
    <div data-testid="chrome-message-test">
      <div data-testid="loading">{loading ? 'Loading...' : 'Not loading'}</div>
      <div data-testid="error">{error ? `Error: ${error}` : 'No error'}</div>
      <div data-testid="data">{data ? JSON.stringify(data) : 'No data'}</div>
    </div>
  );
};

// Manual test cases (to be run in browser console)
export const runManualTests = () => {
  console.log('🧪 Testing useChromeMessage hook...');
  
  // Test 1: Valid request
  console.log('Test 1: Should handle valid getSettings request');
  // Use: <TestComponent request={{ type: "getSettings" }} />
  
  // Test 2: Invalid request type  
  console.log('Test 2: Should handle invalid request gracefully');
  // Use: <TestComponent request={{ type: "invalidType" }} />
  
  // Test 3: No request
  console.log('Test 3: Should handle null request');
  // Use: <TestComponent request={null} />
  
  console.log('✅ Manual tests ready. Render TestComponent with different props.');
};

export default TestComponent;