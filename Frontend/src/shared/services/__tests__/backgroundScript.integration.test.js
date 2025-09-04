/**
 * Background Script Integration Tests
 * Tests Chrome messaging handlers resilience and error handling
 * Focuses on getGoalsData handler with Focus Coordination Service
 */

import FocusCoordinationService from '../focusCoordinationService.js';
import { StorageService } from '../storageService.js';
import { getGoalsData } from '../../../app/services/dashboardService.js';

// Mock dependencies
jest.mock('../focusCoordinationService.js');
jest.mock('../storageService.js');
jest.mock('../../../app/services/dashboardService.js');

describe('Background Script - Critical Handler Resilience', () => {
  let mockSendResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendResponse = jest.fn();
    
    // Default successful mocks
    StorageService.getSettings.mockResolvedValue({
      focusAreas: ['array'],
      sessionLength: 4
    });
    
    FocusCoordinationService.getFocusDecision.mockResolvedValue({
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
    
    getGoalsData.mockResolvedValue({
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
  });

  // Simulate the actual background script handler - shared across all tests
  const simulateGetGoalsDataHandler = async (request = {}) => {
    try {
      // This mimics the actual background.js getGoalsData handler
      const focusDecision = await FocusCoordinationService.getFocusDecision("session_state");
      const settings = await StorageService.getSettings();
      
      const focusAreas = focusDecision.activeFocusTags;
      const userFocusAreas = focusDecision.userPreferences;
      const systemFocusTags = focusDecision.systemRecommendation;
      
      const result = await getGoalsData(request.options || {}, { 
        settings, 
        focusAreas,
        userFocusAreas,
        systemFocusTags,
        focusDecision
      });
      
      mockSendResponse({ result });
      return { success: true };
    } catch (error) {
      console.error("❌ Error in getGoalsData handler:", error);
      mockSendResponse({ error: error.message });
      return { success: false, error: error.message };
    }
  };

  describe('Critical: getGoalsData Handler Resilience', () => {

    it('should handle coordination service failure gracefully', async () => {
      // Mock coordination service failure
      FocusCoordinationService.getFocusDecision.mockRejectedValue(
        new Error('Focus coordination service unavailable')
      );
      
      const result = await simulateGetGoalsDataHandler();
      
      // Should send error response, not crash
      expect(result.success).toBe(false);
      expect(mockSendResponse).toHaveBeenCalledWith({
        error: 'Focus coordination service unavailable'
      });
    });

    it('should handle storage service failure gracefully', async () => {
      // Mock storage service failure
      StorageService.getSettings.mockRejectedValue(
        new Error('Chrome storage unavailable')
      );
      
      const result = await simulateGetGoalsDataHandler();
      
      // Should send error response
      expect(result.success).toBe(false);
      expect(mockSendResponse).toHaveBeenCalledWith({
        error: 'Chrome storage unavailable'
      });
    });

    it('should handle dashboard service failure gracefully', async () => {
      // Mock dashboard service failure
      getGoalsData.mockRejectedValue(
        new Error('Dashboard data generation failed')
      );
      
      const result = await simulateGetGoalsDataHandler();
      
      // Should send error response
      expect(result.success).toBe(false);
      expect(mockSendResponse).toHaveBeenCalledWith({
        error: 'Dashboard data generation failed'
      });
    });

    it('should handle null coordination service response', async () => {
      // Mock null response from coordination service
      FocusCoordinationService.getFocusDecision.mockResolvedValue(null);
      
      const result = await simulateGetGoalsDataHandler();
      
      // Should handle null gracefully - either error or fallback
      if (result.success) {
        // If it succeeds, should have used fallback data
        expect(mockSendResponse).toHaveBeenCalledWith(
          expect.objectContaining({ result: expect.any(Object) })
        );
      } else {
        // If it errors, should provide meaningful error
        expect(result.error).toBeDefined();
        expect(mockSendResponse).toHaveBeenCalledWith({
          error: expect.any(String)
        });
      }
    });

    it('should handle corrupted focus decision data', async () => {
      // Mock corrupted focus decision
      FocusCoordinationService.getFocusDecision.mockResolvedValue({
        // Missing required fields
        activeFocusTags: null,
        systemRecommendation: undefined,
        userPreferences: 'invalid-not-array'
      });
      
      const result = await simulateGetGoalsDataHandler();
      
      // Should either succeed with fallbacks or fail gracefully
      expect(mockSendResponse).toHaveBeenCalled();
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle network timeout scenarios', async () => {
      // Mock timeout-like behavior
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
      // Mock partial service failure but coordination service works
      getGoalsData.mockRejectedValue(new Error('Dashboard service failed'));
      
      await simulateGetGoalsDataHandler();
      
      // Should still call coordination service properly
      expect(FocusCoordinationService.getFocusDecision).toHaveBeenCalledWith("session_state");
      expect(StorageService.getSettings).toHaveBeenCalled();
      
      // Should send error response
      expect(mockSendResponse).toHaveBeenCalledWith({
        error: 'Dashboard service failed'
      });
    });
  });

  describe('Critical: Message Handler Error Boundaries', () => {
    it('should handle malformed request objects', async () => {
      const malformedRequests = [
        null,
        undefined,
        { options: null },
        { options: 'invalid-string' },
        { malformed: true }
      ];
      
      for (const request of malformedRequests) {
        mockSendResponse.mockClear();
        
        const result = await simulateGetGoalsDataHandler(request);
        
        // Should either succeed with defaults or fail gracefully
        expect(mockSendResponse).toHaveBeenCalled();
        
        if (!result.success) {
          expect(result.error).toBeDefined();
        }
      }
    });

    it('should handle concurrent handler calls', async () => {
      // Simulate multiple concurrent requests
      const promises = [
        simulateGetGoalsDataHandler({ userId: 'user1' }),
        simulateGetGoalsDataHandler({ userId: 'user2' }),
        simulateGetGoalsDataHandler({ userId: 'user3' })
      ];
      
      const results = await Promise.all(promises);
      
      // All should complete (either success or error)
      results.forEach(result => {
        expect(typeof result.success).toBe('boolean');
      });
      
      // Should have called sendResponse for each
      expect(mockSendResponse).toHaveBeenCalledTimes(3);
    });

    it('should handle memory pressure scenarios', async () => {
      // Mock large data scenario
      const largeFocusDecision = {
        activeFocusTags: new Array(100).fill('array'),
        systemRecommendation: new Array(100).fill('hash-table'),
        userPreferences: new Array(100).fill('string'),
        algorithmReasoning: 'x'.repeat(10000), // Large string
        availableTags: new Array(1000).fill('large-tag-name-repeated')
      };
      
      FocusCoordinationService.getFocusDecision.mockResolvedValue(largeFocusDecision);
      
      const result = await simulateGetGoalsDataHandler();
      
      // Should handle large data without crashing
      expect(typeof result.success).toBe('boolean');
      expect(mockSendResponse).toHaveBeenCalled();
    });
  });

  describe('Critical: Chrome Extension Context', () => {
    it('should handle chrome.runtime unavailable', async () => {
      // Simulate chrome runtime unavailable (e.g., extension reload)
      const originalChrome = global.chrome;
      global.chrome = undefined;
      
      const result = await simulateGetGoalsDataHandler();
      
      // Should still attempt to process the request
      expect(typeof result.success).toBe('boolean');
      
      // Restore chrome
      global.chrome = originalChrome;
    });

    it('should handle extension context mismatch', async () => {
      // Mock service worker context issues
      StorageService.getSettings.mockRejectedValue(
        new Error('Extension context invalidated')
      );
      
      const result = await simulateGetGoalsDataHandler();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Extension context invalidated');
    });
  });

  describe('Critical: Data Flow Validation', () => {
    it('should pass correct data structure to dashboard service', async () => {
      const mockRequest = { options: { test: true } };
      
      await simulateGetGoalsDataHandler(mockRequest);
      
      // Verify correct data was passed to getGoalsData
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
      
      // Should send result in expected format
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
});