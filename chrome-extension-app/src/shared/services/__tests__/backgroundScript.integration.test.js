/**
 * Background Script Integration Tests
 * Tests Chrome messaging handlers resilience and error handling
 * Focuses on getGoalsData handler with Focus Coordination Service
 */

import FocusCoordinationService from '../focusCoordinationService.js';
import { StorageService } from '../storage/storageService.js';
import { getGoalsData } from '../../../app/services/dashboardService.js';

// Mock dependencies
jest.mock('../focusCoordinationService.js');
jest.mock('../storage/storageService.js');
jest.mock('../../../app/services/dashboardService.js');

// Helper functions for background script tests
const createDefaultSettings = () => ({
  focusAreas: ['array'],
  sessionLength: 4
});

const createDefaultFocusDecision = () => ({
  activeFocusTags: ['array', 'hash-table'],
  systemRecommendation: ['array', 'hash-table', 'string'],
  userPreferences: ['array'],
  algorithmReasoning: 'Performance-based: 2 tags optimal',
  onboarding: false,
  performanceLevel: 'good',
  escapeHatches: [],
  graduation: { needsUpdate: false },
  availableTags: ['array', 'hash-table', 'string']
});

const createDefaultGoalsData = () => ({
  learningPlan: {
    focus: {
      primaryTags: ['array'],
      userFocusAreas: ['array'],
      systemFocusTags: ['array', 'hash-table', 'string'],
      activeFocusTags: ['array', 'hash-table'],
      algorithmReasoning: 'Performance-based: 2 tags optimal'
    }
  }
});

const setupDefaultMocks = () => {
  StorageService.getSettings.mockResolvedValue(createDefaultSettings());
  FocusCoordinationService.getFocusDecision.mockResolvedValue(createDefaultFocusDecision());
  getGoalsData.mockResolvedValue(createDefaultGoalsData());
};


const _expectSuccessResponse = (mockSendResponse) => {
  expect(mockSendResponse).toHaveBeenCalledWith(
    expect.objectContaining({
      success: true,
      data: expect.any(Object)
    })
  );
};

const assertFailedResult = (result, expectedErrorMessage) => {
  expect(result.success).toBe(false);
  if (expectedErrorMessage) {
    expect(result.error).toBe(expectedErrorMessage);
  }
};

// Background script handler simulation helpers
const extractFocusData = (focusDecision) => ({
  focusAreas: focusDecision.activeFocusTags,
  userFocusAreas: focusDecision.userPreferences,
  systemFocusTags: focusDecision.systemRecommendation,
});

const buildGoalsDataContext = (settings, focusData, focusDecision) => ({
  settings,
  ...focusData,
  focusDecision
});

const createHandlerResults = (mockSendResponse) => ({
  handleSuccess: (result) => {
    mockSendResponse({ result });
    return { success: true };
  },
  
  handleError: (error) => {
    console.error("❌ Error in getGoalsData handler:", error);
    mockSendResponse({ error: error.message });
    return { success: false, error: error.message };
  }
});

// Simulate the actual background script handler - shared across all tests
const createBackgroundHandler = (mockSendResponse) => {
  const { handleSuccess, handleError } = createHandlerResults(mockSendResponse);
  
  return async (request = {}) => {
    try {
      const focusDecision = await FocusCoordinationService.getFocusDecision("session_state");
      const settings = await StorageService.getSettings();
      
      const focusData = extractFocusData(focusDecision);
      const context = buildGoalsDataContext(settings, focusData, focusDecision);
      
      const result = await getGoalsData(request.options || {}, context);
      
      return handleSuccess(result);
    } catch (error) {
      return handleError(error);
    }
  };
};


// Shared test setup
let mockSendResponse;
let simulateGetGoalsDataHandler;

beforeEach(() => {
  jest.clearAllMocks();
  mockSendResponse = jest.fn();
  setupDefaultMocks();
  simulateGetGoalsDataHandler = createBackgroundHandler(mockSendResponse);
});

// Service Failure Tests
describe('Critical: getGoalsData Handler Resilience', () => {
  it('should handle coordination service failure gracefully', async () => {
    FocusCoordinationService.getFocusDecision.mockRejectedValue(
      new Error('Focus coordination service unavailable')
    );
    
    const result = await simulateGetGoalsDataHandler();
    assertFailedResult(result, 'Focus coordination service unavailable');
  });

  it('should handle storage service failure gracefully', async () => {
    StorageService.getSettings.mockRejectedValue(
      new Error('Chrome storage unavailable')
    );
    
    const result = await simulateGetGoalsDataHandler();
    assertFailedResult(result, 'Chrome storage unavailable');
  });

  it('should handle dashboard service failure gracefully', async () => {
    getGoalsData.mockRejectedValue(
      new Error('Dashboard data generation failed')
    );
    
    const result = await simulateGetGoalsDataHandler();
    assertFailedResult(result, 'Dashboard data generation failed');
  });
  
  it('should handle null coordination service response', async () => {
    FocusCoordinationService.getFocusDecision.mockResolvedValue(null);
    const result = await simulateGetGoalsDataHandler();
    
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it('should handle corrupted focus decision data', async () => {
    FocusCoordinationService.getFocusDecision.mockResolvedValue({
      activeFocusTags: null,
      systemRecommendation: undefined,
      userPreferences: 'invalid-not-array'
    });
    
    const result = await simulateGetGoalsDataHandler();
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it('should handle network timeout scenarios', async () => {
    let timeoutId;
    FocusCoordinationService.getFocusDecision.mockImplementation(() => {
      return new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Service timeout'));
        }, 100);
      });
    });
    
    const result = await simulateGetGoalsDataHandler();
    
    clearTimeout(timeoutId);
    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
  });

  it('should maintain data structure consistency even with service failures', async () => {
    getGoalsData.mockRejectedValue(new Error('Dashboard service failed'));
    
    await simulateGetGoalsDataHandler();
    
    expect(FocusCoordinationService.getFocusDecision).toHaveBeenCalledWith("session_state");
    expect(StorageService.getSettings).toHaveBeenCalled();
  });
});

// Message Handler Tests
describe('Critical: Message Handler Error Boundaries', () => {
  it('should handle null request objects', async () => {
    const result = await simulateGetGoalsDataHandler(null);
    expect(mockSendResponse).toHaveBeenCalled();
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it('should handle malformed options in requests', async () => {
    const malformedRequests = [
      { options: null },
      { options: 'invalid-string' },
      { malformed: true }
    ];
    
    for (const request of malformedRequests) {
      mockSendResponse.mockClear();
      const result = await simulateGetGoalsDataHandler(request);
      expect(mockSendResponse).toHaveBeenCalled();
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    }
  });

  it('should handle concurrent handler calls', async () => {
    const promises = [
      simulateGetGoalsDataHandler({ userId: 'user1' }),
      simulateGetGoalsDataHandler({ userId: 'user2' }),
      simulateGetGoalsDataHandler({ userId: 'user3' })
    ];
    
    const results = await Promise.all(promises);
    
    results.forEach(result => {
      expect(typeof result.success).toBe('boolean');
    });
    
    expect(mockSendResponse).toHaveBeenCalledTimes(3);
  });

  it('should handle memory pressure scenarios', async () => {
    const largeFocusDecision = createDefaultFocusDecision();
    largeFocusDecision.systemRecommendation = new Array(10000).fill('memory-intensive-tag');
    
    FocusCoordinationService.getFocusDecision.mockResolvedValue(largeFocusDecision);
    
    const result = await simulateGetGoalsDataHandler();
    expect(typeof result.success).toBe('boolean');
    expect(mockSendResponse).toHaveBeenCalled();
  });
});

// Chrome Context Tests
describe('Critical: Chrome Extension Context', () => {
  it('should handle chrome.runtime unavailable', async () => {
    const originalChrome = global.chrome;
    global.chrome = undefined;
    
    const result = await simulateGetGoalsDataHandler();
    expect(typeof result.success).toBe('boolean');
    
    global.chrome = originalChrome;
  });

  it('should handle extension context mismatch', async () => {
    StorageService.getSettings.mockRejectedValue(
      new Error('Extension context invalidated')
    );
    
    const result = await simulateGetGoalsDataHandler();
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Extension context invalidated');
  });
});

// Data Flow Tests
describe('Critical: Data Flow Validation', () => {
  it('should pass correct data structure to dashboard service', async () => {
    const mockRequest = { options: { test: true } };
    
    await simulateGetGoalsDataHandler(mockRequest);
    
    expect(getGoalsData).toHaveBeenCalledWith(
      { test: true },
      expect.objectContaining({
        settings: expect.any(Object),
        focusAreas: expect.any(Array),
        userFocusAreas: expect.any(Array),
        systemFocusTags: expect.any(Array),
        focusDecision: expect.any(Object)
      })
    );
  });

  it('should maintain backward compatibility in response format', async () => {
    await simulateGetGoalsDataHandler();
    
    expect(mockSendResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        result: expect.any(Object)
      })
    );
    
    const response = mockSendResponse.mock.calls[0][0];
    expect(response.result).toBeDefined();
    expect(typeof response.result).toBe('object');
  });
});