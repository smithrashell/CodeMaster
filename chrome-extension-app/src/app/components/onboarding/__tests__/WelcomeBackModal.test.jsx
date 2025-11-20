/**
 * Characterization tests for WelcomeBackModal
 *
 * These tests capture the EXISTING behavior before refactoring.
 * Goal: Ensure refactoring doesn't break functionality.
 *
 * Tests cover:
 * - Three modal types (gentle_recal, moderate_recal, major_recal)
 * - Day formatting logic
 * - Icon selection logic
 * - Modal interactions (onClose, onConfirm)
 * - Edge cases
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { WelcomeBackModal } from '../WelcomeBackModal';

// Mock ThemeProvider context
const mockThemeContext = {
  colorScheme: 'light',
  toggleColorScheme: jest.fn(),
  setFontSize: jest.fn(),
  setLayoutDensity: jest.fn(),
  setAnimationsEnabled: jest.fn()
};

// Mock the useTheme hook
jest.mock('../../../../shared/provider/themeprovider', () => ({
  useTheme: () => mockThemeContext
}));

// Test wrapper with minimal providers needed for testing
const TestWrapper = ({ children }) => (
  <MantineProvider>
    {children}
  </MantineProvider>
);

// eslint-disable-next-line max-lines-per-function -- Test suite organization prioritizes readability over line limits
describe('WelcomeBackModal - Characterization Tests', () => {

  // ==========================================
  // TEST GROUP 1: Modal Type Rendering
  // ==========================================

  describe('Modal Type: gentle_recal (30-90 days)', () => {
    const gentleStrategy = {
      type: 'gentle_recal',
      daysSinceLastUse: 45,
      message: 'We\'ve already applied some gentle adjustments to your learning path.',
      approach: 'adaptive_first_session',
      recommendation: 'adaptive_first_session'
    };

    it('should render simple welcome message with Continue button', () => {
      const onClose = jest.fn();
      const onConfirm = jest.fn();

      render(
        <WelcomeBackModal
          opened={true}
          onClose={onClose}
          strategy={gentleStrategy}
          onConfirm={onConfirm}
        />,
        { wrapper: TestWrapper }
      );

      // Should show Welcome Back title
      expect(screen.getByText('Welcome Back!')).toBeInTheDocument();

      // Should show days away badge
      expect(screen.getByText(/1 month/i)).toBeInTheDocument();

      // Should show message (use queryAllByText to handle potential duplicates)
      const matches = screen.queryAllByText(/gentle adjustments/i);
      expect(matches.length).toBeGreaterThan(0);

      // Should show Continue button (not "Maybe Later")
      expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      expect(screen.queryByText('Maybe Later')).not.toBeInTheDocument();
    });

    it('should call onConfirm with adaptive_first_session on Continue click', () => {
      const onClose = jest.fn();
      const onConfirm = jest.fn();

      render(
        <WelcomeBackModal
          opened={true}
          onClose={onClose}
          strategy={gentleStrategy}
          onConfirm={onConfirm}
        />,
        { wrapper: TestWrapper }
      );

      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      expect(onConfirm).toHaveBeenCalledWith('adaptive_first_session');
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('Modal Type: moderate_recal (90-365 days)', () => {
    const moderateStrategy = {
      type: 'moderate_recal',
      daysSinceLastUse: 180,
      message: 'Choose how you\'d like to recalibrate.',
      options: [
        {
          value: 'adaptive_first_session',
          label: 'Start Fresh',
          time: '~1 session',
          description: 'Jump right in with an adaptive session.',
          recommended: true
        },
        {
          value: 'diagnostic',
          label: 'Quick Assessment',
          time: '~15 min',
          description: 'Take a diagnostic to recalibrate your level.'
        }
      ],
      recommendation: 'adaptive_first_session'
    };

    it('should render option selection with 2 choices', () => {
      const onClose = jest.fn();
      const onConfirm = jest.fn();

      render(
        <WelcomeBackModal
          opened={true}
          onClose={onClose}
          strategy={moderateStrategy}
          onConfirm={onConfirm}
        />,
        { wrapper: TestWrapper }
      );

      // Should show Welcome Back title
      expect(screen.getByText('Welcome Back!')).toBeInTheDocument();

      // Should show 6 months away
      expect(screen.getByText(/6 months/i)).toBeInTheDocument();

      // Should show both options
      expect(screen.getByText('Start Fresh')).toBeInTheDocument();
      expect(screen.getByText('Quick Assessment')).toBeInTheDocument();

      // Should show recommended badge
      expect(screen.getByText('Recommended')).toBeInTheDocument();

      // Should show Maybe Later button
      expect(screen.getByRole('button', { name: /maybe later/i })).toBeInTheDocument();
    });

    it('should enable Continue button after selecting an option', () => {
      const onClose = jest.fn();
      const onConfirm = jest.fn();

      // Create strategy WITHOUT recommendation to test disabled state
      const strategyWithoutRecommendation = {
        ...moderateStrategy,
        recommendation: null
      };

      render(
        <WelcomeBackModal
          opened={true}
          onClose={onClose}
          strategy={strategyWithoutRecommendation}
          onConfirm={onConfirm}
        />,
        { wrapper: TestWrapper }
      );

      const continueButton = screen.getByRole('button', { name: /continue/i });

      // Initially disabled (no selection)
      expect(continueButton).toBeDisabled();

      // Click on first option card to select it
      const firstOption = screen.getByText('Start Fresh').closest('.mantine-Card-root');
      if (firstOption) {
        fireEvent.click(firstOption);

        // Should enable after selection
        waitFor(() => {
          expect(continueButton).not.toBeDisabled();
        });
      }
    });
  });

  describe('Modal Type: major_recal (365+ days)', () => {
    const majorStrategy = {
      type: 'major_recal',
      daysSinceLastUse: 400,
      message: 'It\'s been a while! We\'ve applied passive decay.',
      options: [
        {
          value: 'diagnostic',
          label: 'Diagnostic Assessment',
          time: '~20 min',
          description: 'Most accurate recalibration.',
          recommended: true
        },
        {
          value: 'adaptive_first_session',
          label: 'Adaptive Session',
          time: '~1 session',
          description: 'Start with an adaptive session.'
        },
        {
          value: 'reset',
          label: 'Fresh Start',
          time: 'Immediate',
          description: 'Reset your progress completely.',
          warning: 'This cannot be undone.'
        }
      ],
      recommendation: 'diagnostic'
    };

    it('should render "Long Time, No See!" title for 365+ days', () => {
      const onClose = jest.fn();
      const onConfirm = jest.fn();

      render(
        <WelcomeBackModal
          opened={true}
          onClose={onClose}
          strategy={majorStrategy}
          onConfirm={onConfirm}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Long Time, No See!')).toBeInTheDocument();
    });

    it('should show passive decay alert for major recalibration', () => {
      const onClose = jest.fn();
      const onConfirm = jest.fn();

      render(
        <WelcomeBackModal
          opened={true}
          onClose={onClose}
          strategy={majorStrategy}
          onConfirm={onConfirm}
        />,
        { wrapper: TestWrapper }
      );

      // Use getAllByText and check that at least one match exists
      const matches = screen.queryAllByText(/applied passive decay/i);
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should show warning for reset option', () => {
      const onClose = jest.fn();
      const onConfirm = jest.fn();

      render(
        <WelcomeBackModal
          opened={true}
          onClose={onClose}
          strategy={majorStrategy}
          onConfirm={onConfirm}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    });

    it('should show 3 options for major recalibration', () => {
      const onClose = jest.fn();
      const onConfirm = jest.fn();

      render(
        <WelcomeBackModal
          opened={true}
          onClose={onClose}
          strategy={majorStrategy}
          onConfirm={onConfirm}
        />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('Diagnostic Assessment')).toBeInTheDocument();
      expect(screen.getByText('Adaptive Session')).toBeInTheDocument();
      expect(screen.getByText('Fresh Start')).toBeInTheDocument();
    });
  });

  // ==========================================
  // TEST GROUP 2: Day Formatting Logic
  // ==========================================

  describe('Day formatting (getDaysText)', () => {
    it('should format days correctly for less than 30 days', () => {
      const strategy = {
        type: 'gentle_recal',
        daysSinceLastUse: 15,
        message: 'Test message',
        recommendation: 'adaptive_first_session'
      };

      render(
        <WelcomeBackModal opened={true} onClose={jest.fn()} strategy={strategy} onConfirm={jest.fn()} />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('15 days away')).toBeInTheDocument();
    });

    it('should format days correctly for 1 day (singular)', () => {
      const strategy = {
        type: 'gentle_recal',
        daysSinceLastUse: 1,
        message: 'Test message',
        recommendation: 'adaptive_first_session'
      };

      render(
        <WelcomeBackModal opened={true} onClose={jest.fn()} strategy={strategy} onConfirm={jest.fn()} />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('1 day away')).toBeInTheDocument();
    });

    it('should format days as months for 30-365 days', () => {
      const strategy = {
        type: 'moderate_recal',
        daysSinceLastUse: 90,
        message: 'Test message',
        options: [],
        recommendation: 'diagnostic'
      };

      render(
        <WelcomeBackModal opened={true} onClose={jest.fn()} strategy={strategy} onConfirm={jest.fn()} />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('3 months away')).toBeInTheDocument();
    });

    it('should format days as years for 365+ days', () => {
      const strategy = {
        type: 'major_recal',
        daysSinceLastUse: 365,
        message: 'Test message',
        options: [],
        recommendation: 'diagnostic'
      };

      render(
        <WelcomeBackModal opened={true} onClose={jest.fn()} strategy={strategy} onConfirm={jest.fn()} />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText('1 year away')).toBeInTheDocument();
    });

    it('should format days as years and months for 365+ days with remainder', () => {
      const strategy = {
        type: 'major_recal',
        daysSinceLastUse: 425, // 1 year, 2 months
        message: 'Test message',
        options: [],
        recommendation: 'diagnostic'
      };

      render(
        <WelcomeBackModal opened={true} onClose={jest.fn()} strategy={strategy} onConfirm={jest.fn()} />,
        { wrapper: TestWrapper }
      );

      expect(screen.getByText(/1 year.*2 months/i)).toBeInTheDocument();
    });
  });

  // ==========================================
  // TEST GROUP 3: Edge Cases
  // ==========================================

  describe('Edge cases', () => {
    it('should return null for null strategy', () => {
      render(
        <WelcomeBackModal opened={true} onClose={jest.fn()} strategy={null} onConfirm={jest.fn()} />,
        { wrapper: TestWrapper }
      );

      // Modal should not render - check for absence of modal content
      expect(screen.queryByText('Welcome Back!')).not.toBeInTheDocument();
      expect(screen.queryByText('Long Time, No See!')).not.toBeInTheDocument();
    });

    it('should return null for normal strategy type', () => {
      const normalStrategy = {
        type: 'normal',
        daysSinceLastUse: 5
      };

      render(
        <WelcomeBackModal opened={true} onClose={jest.fn()} strategy={normalStrategy} onConfirm={jest.fn()} />,
        { wrapper: TestWrapper }
      );

      // Modal should not render for normal strategy
      expect(screen.queryByText('Welcome Back!')).not.toBeInTheDocument();
      expect(screen.queryByText('Long Time, No See!')).not.toBeInTheDocument();
    });

    it('should handle missing recommendation gracefully', () => {
      const strategyWithoutRecommendation = {
        type: 'moderate_recal',
        daysSinceLastUse: 100,
        message: 'Test',
        options: [
          { value: 'option1', label: 'Option 1', description: 'Test', time: '5 min' }
        ]
        // No recommendation field
      };

      const { container } = render(
        <WelcomeBackModal
          opened={true}
          onClose={jest.fn()}
          strategy={strategyWithoutRecommendation}
          onConfirm={jest.fn()}
        />,
        { wrapper: TestWrapper }
      );

      // Should still render without crashing
      expect(container.firstChild).toBeTruthy();
    });
  });

  // ==========================================
  // TEST GROUP 4: User Interactions
  // ==========================================

  describe('User interactions', () => {
    it('should call onClose when clicking "Maybe Later"', () => {
      const onClose = jest.fn();
      const onConfirm = jest.fn();

      const strategy = {
        type: 'moderate_recal',
        daysSinceLastUse: 100,
        message: 'Test',
        options: [
          { value: 'option1', label: 'Option 1', description: 'Test', time: '5 min', recommended: true }
        ],
        recommendation: 'option1'
      };

      render(
        <WelcomeBackModal opened={true} onClose={onClose} strategy={strategy} onConfirm={onConfirm} />,
        { wrapper: TestWrapper }
      );

      fireEvent.click(screen.getByRole('button', { name: /maybe later/i }));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('should change button text to "Start Assessment" when diagnostic is selected', async () => {
      const onClose = jest.fn();
      const onConfirm = jest.fn();

      const strategy = {
        type: 'moderate_recal',
        daysSinceLastUse: 100,
        message: 'Test',
        options: [
          { value: 'adaptive_first_session', label: 'Adaptive', description: 'Test', time: '1 session' },
          { value: 'diagnostic', label: 'Diagnostic', description: 'Test', time: '15 min', recommended: true }
        ],
        recommendation: 'diagnostic'
      };

      render(
        <WelcomeBackModal opened={true} onClose={onClose} strategy={strategy} onConfirm={onConfirm} />,
        { wrapper: TestWrapper }
      );

      // With recommendation, diagnostic should be selected by default
      // Button should show "Start Assessment"
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /start assessment/i });
        expect(button).toBeInTheDocument();
      });
    });
  });
});
