import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import FloatingHintButton from '../FloatingHintButton';
import HintPanel from '../HintPanel';
import PrimerSection from '../PrimerSection';

// Mock the HintInteractionService
jest.mock('../../../../shared/services/hintInteractionService', () => ({
  HintInteractionService: {
    saveHintInteraction: jest.fn(),
  },
}));

// Mock the StrategyService
jest.mock('../../../services/strategyService', () => ({
  __esModule: true,
  default: {
    getContextualHints: jest.fn(),
    getTagPrimers: jest.fn(),
  },
}));

// Test wrapper component that provides required context
const TestWrapper = ({ children }) => (
  <MantineProvider>
    {children}
  </MantineProvider>
);

describe('Hint Component Tracking Integration', () => {
  let mockHintInteractionService;
  let mockStrategyService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockHintInteractionService = require('../../../../shared/services/hintInteractionService').HintInteractionService;
    mockStrategyService = require('../../../services/strategyService').default;
    
    // Mock successful service responses
    mockHintInteractionService.saveHintInteraction.mockResolvedValue({
      id: 'test-interaction-123',
      success: true,
    });
  });

  describe('FloatingHintButton Integration', () => {
    it('should track hint expansion interactions', async () => {
      // Arrange
      const mockHints = [
        {
          type: 'contextual',
          primaryTag: 'array',
          relatedTag: 'hash-table',
          tip: 'Use hash map for O(1) lookups',
          relationshipScore: 0.85,
        },
        {
          type: 'general',
          primaryTag: 'array',
          tip: 'Consider two pointers approach',
        },
      ];

      mockStrategyService.getContextualHints.mockResolvedValue(mockHints);

      const mockOnHintClick = jest.fn();
      const problemTags = ['array', 'hash-table'];
      const problemId = 'two-sum';

      // Act
      render(
        <TestWrapper>
          <FloatingHintButton
            problemTags={problemTags}
            problemId={problemId}
            onHintClick={mockOnHintClick}
          />
        </TestWrapper>
      );

      // Wait for hints to load
      await waitFor(() => {
        expect(mockStrategyService.getContextualHints).toHaveBeenCalledWith(problemTags);
      });

      // Click the floating button to open popover
      const hintButton = screen.getByRole('button', { name: /strategy hints available/i });
      fireEvent.click(hintButton);

      // Wait for popover to open and find the first hint
      await waitFor(() => {
        const firstHint = screen.getByText('array + hash-table');
        expect(firstHint).toBeInTheDocument();
      });

      // Click on the first hint to expand it
      const firstHintTitle = screen.getByText('array + hash-table');
      fireEvent.click(firstHintTitle);

      // Assert
      await waitFor(() => {
        expect(mockHintInteractionService.saveHintInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            problemId: 'two-sum',
            hintType: 'contextual',
            primaryTag: 'array',
            relatedTag: 'hash-table',
            action: 'expand',
            problemTags: ['array', 'hash-table'],
            content: 'Use hash map for O(1) lookups',
            sessionContext: expect.objectContaining({
              popoverOpen: true,
              totalHints: 2,
              hintPosition: 0,
            }),
          }),
          expect.objectContaining({
            totalHints: 2,
          })
        );
      });

      // Should also call the callback
      expect(mockOnHintClick).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'expand',
          hintType: 'contextual',
        })
      );
    });

    it('should track hint collapse interactions', async () => {
      // Arrange
      const mockHints = [
        {
          type: 'contextual',
          primaryTag: 'string',
          relatedTag: 'sliding-window',
          tip: 'Use sliding window technique',
        },
      ];

      mockStrategyService.getContextualHints.mockResolvedValue(mockHints);

      // Act
      render(
        <TestWrapper>
          <FloatingHintButton
            problemTags={['string', 'sliding-window']}
            problemId={'longest-substring'}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockStrategyService.getContextualHints).toHaveBeenCalled();
      });

      // Open popover and expand hint
      fireEvent.click(screen.getByRole('button', { name: /strategy hints available/i }));
      
      await waitFor(() => {
        const hintTitle = screen.getByText('string + sliding-window');
        expect(hintTitle).toBeInTheDocument();
      });

      const hintTitle = screen.getByText('string + sliding-window');
      
      // First click - expand
      fireEvent.click(hintTitle);
      
      // Clear previous calls
      mockHintInteractionService.saveHintInteraction.mockClear();
      
      // Second click - collapse  
      fireEvent.click(hintTitle);

      // Assert
      await waitFor(() => {
        expect(mockHintInteractionService.saveHintInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'collapse',
            hintType: 'contextual',
          }),
          expect.any(Object)
        );
      });
    });

    it('should handle tracking errors gracefully', async () => {
      // Arrange
      const mockHints = [
        {
          type: 'general',
          primaryTag: 'tree',
          tip: 'Use DFS or BFS traversal',
        },
      ];

      mockStrategyService.getContextualHints.mockResolvedValue(mockHints);
      mockHintInteractionService.saveHintInteraction.mockRejectedValue(
        new Error('Database connection failed')
      );

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Act
      render(
        <TestWrapper>
          <FloatingHintButton
            problemTags={['tree']}
            problemId={'binary-tree-traversal'}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockStrategyService.getContextualHints).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByRole('button', { name: /strategy hints available/i }));
      
      await waitFor(() => {
        // Get the clickable hint element (not the badge)
        const hintTitle = screen.getByRole('button', { name: /expand tree strategy hint/i });
        fireEvent.click(hintTitle);
      });

      // Assert - should log warning but not crash
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to save hint interaction:',
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe('HintPanel Integration', () => {
    it('should track panel expand/collapse interactions', async () => {
      // Arrange
      const mockHints = [
        {
          type: 'contextual',
          primaryTag: 'graph',
          relatedTag: 'bfs',
          tip: 'Use BFS for shortest path',
        },
      ];

      mockStrategyService.getContextualHints.mockResolvedValue(mockHints);

      // Act
      render(
        <TestWrapper>
          <HintPanel
            problemTags={['graph', 'bfs']}
            problemId={'shortest-path'}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockStrategyService.getContextualHints).toHaveBeenCalled();
      });

      // Find and click the show/hide hints button
      const toggleButton = screen.getByRole('button', { name: /show hints/i });
      fireEvent.click(toggleButton);

      // Assert
      await waitFor(() => {
        expect(mockHintInteractionService.saveHintInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            problemId: 'shortest-path',
            hintId: 'hint-panel',
            hintType: 'panel',
            primaryTag: 'graph',
            relatedTag: 'bfs',
            action: 'expand',
            problemTags: ['graph', 'bfs'],
            content: 'Hint panel expanded',
            sessionContext: expect.objectContaining({
              panelOpen: true,
              totalHints: 1,
              componentType: 'HintPanel',
            }),
          })
        );
      });
    });

    it('should track collapse action when hiding hints', async () => {
      // Arrange
      const mockHints = [{ type: 'general', primaryTag: 'dynamic-programming' }];
      mockStrategyService.getContextualHints.mockResolvedValue(mockHints);

      // Act
      render(
        <TestWrapper>
          <HintPanel
            problemTags={['dynamic-programming']}
            problemId={'coin-change'}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockStrategyService.getContextualHints).toHaveBeenCalled();
      });

      const toggleButton = screen.getByRole('button', { name: /show hints/i });
      
      // First click - expand
      fireEvent.click(toggleButton);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /hide hints/i })).toBeInTheDocument();
      });

      // Clear previous calls
      mockHintInteractionService.saveHintInteraction.mockClear();
      
      // Second click - collapse
      const hideButton = screen.getByRole('button', { name: /hide hints/i });
      fireEvent.click(hideButton);

      // Assert
      await waitFor(() => {
        expect(mockHintInteractionService.saveHintInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'collapse',
            content: 'Hint panel collapsed',
          })
        );
      });
    });
  });

  describe('PrimerSection Integration', () => {
    it('should track primer viewing interactions', async () => {
      // Arrange
      const mockPrimers = [
        {
          tag: 'binary-search',
          overview: 'Efficient search algorithm for sorted arrays',
          strategy: 'Divide search space in half repeatedly',
          patterns: ['Binary Search', 'Two Pointers'],
          related: ['array', 'sorting'],
        },
      ];

      mockStrategyService.getTagPrimers.mockResolvedValue(mockPrimers);

      // Act
      render(
        <TestWrapper>
          <PrimerSection
            problemTags={['binary-search']}
            problemId={'search-insert-position'}
          />
        </TestWrapper>
      );

      // Assert - should track primer viewing automatically when loaded
      await waitFor(() => {
        expect(mockStrategyService.getTagPrimers).toHaveBeenCalledWith(['binary-search']);
      });

      await waitFor(() => {
        expect(mockHintInteractionService.saveHintInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            problemId: 'search-insert-position',
            hintId: 'primer-section',
            hintType: 'primer',
            primaryTag: 'binary-search',
            relatedTag: null,
            action: 'viewed',
            problemTags: ['binary-search'],
            content: 'Viewed primers for binary-search',
            sessionContext: expect.objectContaining({
              primerCount: 1,
              componentType: 'PrimerSection',
              tagsDisplayed: ['binary-search'],
            }),
          })
        );
      });
    });

    it('should track multiple tag primer viewing', async () => {
      // Arrange
      const mockPrimers = [
        {
          tag: 'heap',
          overview: 'Priority queue data structure',
          strategy: 'Use heap for efficient min/max operations',
        },
        {
          tag: 'greedy',
          overview: 'Make locally optimal choices',
          strategy: 'Choose best option at each step',
        },
      ];

      mockStrategyService.getTagPrimers.mockResolvedValue(mockPrimers);

      // Act
      render(
        <TestWrapper>
          <PrimerSection
            problemTags={['heap', 'greedy']}
            problemId={'merge-k-sorted-lists'}
          />
        </TestWrapper>
      );

      // Assert
      await waitFor(() => {
        expect(mockHintInteractionService.saveHintInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            primaryTag: 'heap',
            relatedTag: 'greedy',
            content: 'Viewed primers for heap, greedy',
            sessionContext: expect.objectContaining({
              primerCount: 2,
              tagsDisplayed: ['heap', 'greedy'],
            }),
          })
        );
      });
    });

    it('should not track when primers fail to load', async () => {
      // Arrange
      mockStrategyService.getTagPrimers.mockRejectedValue(
        new Error('Failed to load primers')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Act
      render(
        <TestWrapper>
          <PrimerSection
            problemTags={['backtracking']}
            problemId={'n-queens'}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error loading primers:',
          expect.any(Error)
        );
      });

      // Assert - should not call tracking service
      expect(mockHintInteractionService.saveHintInteraction).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle tracking failures gracefully', async () => {
      // Arrange
      const mockPrimers = [{ tag: 'graph', overview: 'Graph algorithms' }];
      
      mockStrategyService.getTagPrimers.mockResolvedValue(mockPrimers);
      mockHintInteractionService.saveHintInteraction.mockRejectedValue(
        new Error('Tracking service unavailable')
      );

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Act
      render(
        <TestWrapper>
          <PrimerSection
            problemTags={['graph']}
            problemId={'graph-traversal'}
          />
        </TestWrapper>
      );

      // Assert - should handle error gracefully
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to track primer view:',
          expect.any(Error)
        );
      });

      // Should still display primers despite tracking failure
      await waitFor(() => {
        expect(screen.getByText('graph')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Cross-Component Integration', () => {
    it('should generate unique hint IDs across components', async () => {
      // Arrange
      const mockHints = [{ type: 'general', primaryTag: 'sorting' }];
      const mockPrimers = [{ tag: 'sorting', overview: 'Sorting algorithms' }];

      mockStrategyService.getContextualHints.mockResolvedValue(mockHints);
      mockStrategyService.getTagPrimers.mockResolvedValue(mockPrimers);

      // Act - render multiple components
      render(
        <TestWrapper>
          <FloatingHintButton
            problemTags={['sorting']}
            problemId={'merge-sort'}
          />
          <HintPanel
            problemTags={['sorting']}
            problemId={'merge-sort'}
          />
          <PrimerSection
            problemTags={['sorting']}
            problemId={'merge-sort'}
          />
        </TestWrapper>
      );

      // Wait for all components to load
      await waitFor(() => {
        expect(mockStrategyService.getContextualHints).toHaveBeenCalledTimes(2);
        expect(mockStrategyService.getTagPrimers).toHaveBeenCalledTimes(1);
      });

      // Trigger interactions
      const hintButton = screen.getByRole('button', { name: /strategy hints available/i });
      fireEvent.click(hintButton);

      const panelButton = screen.getByRole('button', { name: /show hints/i });
      fireEvent.click(panelButton);

      // Assert - each component should generate unique hint IDs
      await waitFor(() => {
        const calls = mockHintInteractionService.saveHintInteraction.mock.calls;
        expect(calls.length).toBeGreaterThanOrEqual(2);
        
        const hintIds = calls.map(call => call[0].hintId);
        const uniqueHintIds = new Set(hintIds);
        
        expect(uniqueHintIds.size).toBe(hintIds.length); // All IDs should be unique
      });
    });

    it('should maintain consistent problem context across components', async () => {
      // Arrange
      const mockHints = [{ type: 'contextual', primaryTag: 'divide-conquer' }];
      const mockPrimers = [{ tag: 'divide-conquer', overview: 'Divide and conquer' }];

      mockStrategyService.getContextualHints.mockResolvedValue(mockHints);
      mockStrategyService.getTagPrimers.mockResolvedValue(mockPrimers);

      const problemId = 'quick-sort';
      const problemTags = ['divide-conquer'];

      // Act
      render(
        <TestWrapper>
          <FloatingHintButton
            problemTags={problemTags}
            problemId={problemId}
          />
          <PrimerSection
            problemTags={problemTags}
            problemId={problemId}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockHintInteractionService.saveHintInteraction).toHaveBeenCalled();
      });

      // Assert - all interactions should have consistent problem context
      const calls = mockHintInteractionService.saveHintInteraction.mock.calls;
      
      calls.forEach(call => {
        const interactionData = call[0];
        expect(interactionData.problemId).toBe(problemId);
        expect(interactionData.problemTags).toEqual(problemTags);
      });
    });
  });

  describe('Performance Considerations', () => {
    it('should not block UI rendering when tracking fails', async () => {
      // Arrange
      mockStrategyService.getContextualHints.mockResolvedValue([
        { type: 'general', primaryTag: 'performance-test', tip: 'Use systematic approach for performance-test problems' }
      ]);
      
      // Simulate very slow tracking service
      mockHintInteractionService.saveHintInteraction.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 5000))
      );

      // Act
      render(
        <TestWrapper>
          <FloatingHintButton
            problemTags={['performance-test']}
            problemId={'slow-tracking'}
          />
        </TestWrapper>
      );

      // Assert - UI should render immediately despite slow tracking
      await waitFor(() => {
        const hintButton = screen.getByRole('button', { name: /strategy hints available/i });
        expect(hintButton).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /strategy hints available/i }));

      // Should be able to interact with UI immediately
      await waitFor(() => {
        // Use getAllByText and select the clickable hint (not the badge)
        const hintTitles = screen.getAllByText('performance-test');
        const clickableHint = hintTitles.find(el => el.tagName === 'P');
        expect(clickableHint).toBeInTheDocument();
        fireEvent.click(clickableHint);
      });

      // UI interaction should work even if tracking is still pending
      expect(screen.getByText('Use systematic approach for performance-test problems')).toBeInTheDocument();
    });

    it('should handle high-frequency interactions efficiently', async () => {
      // Arrange
      mockStrategyService.getContextualHints.mockResolvedValue([
        { type: 'contextual', primaryTag: 'rapid-fire', relatedTag: 'test' }
      ]);

      // Act
      render(
        <TestWrapper>
          <FloatingHintButton
            problemTags={['rapid-fire', 'test']}
            problemId={'efficiency-test'}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const hintButton = screen.getByRole('button', { name: /strategy hints available/i });
        fireEvent.click(hintButton);
      });

      await waitFor(() => {
        const hintTitle = screen.getByText('rapid-fire + test');
        
        // Rapid clicks to test performance
        for (let i = 0; i < 10; i++) {
          fireEvent.click(hintTitle);
        }
      });

      // Assert - should handle all interactions without errors
      await waitFor(() => {
        expect(mockHintInteractionService.saveHintInteraction).toHaveBeenCalledTimes(10);
      });
    });
  });
});